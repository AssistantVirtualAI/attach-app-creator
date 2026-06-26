# TURN/STUN sur iOS — pourquoi OpenRelay échoue et pourquoi on utilise Metered.ca

## Symptôme observé

Sur iOS (Safari + WebView Capacitor), l'appel SIP s'établit côté signalisation
(`session.new outgoing`) mais l'audio ne se connecte jamais : la session reste
sans `confirmed`, et l'état ICE de la `RTCPeerConnection` reste bloqué à `new`
ou `checking`, sans aucun candidat `relay`. Le SDP ne contient que des IP
locales (`127.0.0.1` / `169.254.x.x`).

## Pourquoi OpenRelay (`openrelay.metered.ca`) ne fonctionne pas sur iOS

1. **TCP TURN seul ne suffit pas en WebView iOS.** WKWebView refuse souvent
   d'ouvrir des sockets TCP arbitraires depuis WebRTC quand le serveur ne
   répond pas en TLS sur 443 — les paquets STUN binding partent mais aucune
   réponse n'est gardée par l'OS.
2. **Pas de TURNS (TURN over TLS).** OpenRelay n'expose pas `turns:` sur 443.
   Sur les réseaux mobiles canadiens (Bell/Rogers/Telus) et derrière la
   plupart des firewalls d'entreprise, seuls les ports `443/tcp` en TLS
   passent. UDP est filtré, TCP clair est inspecté.
3. **Latence et capacité.** Le pool OpenRelay public est saturé : les
   réponses dépassent fréquemment 2–3 s, au-delà du timeout ICE iOS (1.5 s
   par défaut sur WKWebView). Le candidat `relay` n'est jamais offert.
4. **Pas de STUN secondaire.** iOS bloque agressivement `stun.l.google.com`
   sur certaines configs Private Relay / VPN. Sans serveur STUN alternatif,
   aucun candidat `srflx` n'est généré.

## Choix : Metered.ca (`global.relay.metered.ca`)

Metered.ca répond à chaque limitation ci-dessus :

| Besoin                       | Metered.ca                                  |
| ---------------------------- | ------------------------------------------- |
| TURNS (TLS sur 443)          | `turns:global.relay.metered.ca:443?transport=tcp` |
| TURN UDP rapide              | `turn:global.relay.metered.ca:80`           |
| TURN TCP de secours          | `turn:global.relay.metered.ca:80?transport=tcp` |
| STUN alternatif fiable       | `stun:stun.cloudflare.com:3478` en plus de Google |
| Anycast global               | Latence <80 ms en Amérique du Nord          |
| Auth statique (pas d'API)    | Username/credential dans la config WebRTC   |

`iceTransportPolicy: 'all'` reste : on n'oblige pas le relay, mais on garantit
qu'un candidat `relay` arrivera avant l'expiration du gathering iOS.

## Architecture de la solution

- **`rtcConfig.ts`** (mirrored: `src/lib/softphone/` et
  `apps/ava-softphone-mobile/src/lib/sip/`) — source unique de vérité pour
  `ICE_SERVERS`, `FALLBACK_ICE_SERVERS` et `PC_CONFIG`.
- **`probeTurnEndpoints()`** — au démarrage, crée une `RTCPeerConnection`
  éphémère avec `iceTransportPolicy: 'relay'`, attend 5 s un candidat `relay`.
  Si Metered ne répond pas, bascule automatiquement sur `FALLBACK_ICE_SERVERS`
  (OpenRelay) et émet un événement `probe-result`.
- **`ensureActivePcConfig()`** — appelé au boot mobile ; cache le résultat
  et l'expose via `getActivePcConfig()`.
- **`onIceDiagnostic(fn)`** — bus d'événements pour l'overlay UI iOS et la
  console (ice-state, gather-state, candidate, probe-result, pc-config).
- **`IceDiagnosticsOverlay`** — composant React monté dans `MobileApp` ;
  visible si `localStorage['sip:iceDiag']='1'`, `?iceDiag=1`, ou si le mode
  debug SIP est actif. Affiche l'état ICE en direct et les 5 derniers
  candidats (avec leur source STUN/TURN/LOCAL).

## Activer le diagnostic iOS

```js
// Dans la console Safari (USB-debug iOS) :
localStorage.setItem('sip:debug', '1');     // logs verbeux ICE/SDP
localStorage.setItem('sip:iceDiag', '1');   // overlay UI
location.reload();
```

Ou via URL : `?sipDebug=1&iceDiag=1`.

## Configuration par environnement (prod / staging)

Le choix des serveurs STUN/TURN se fait via variables Vite — la valeur par
défaut (Metered.ca) est conservée si aucune variable n'est définie, et la
sonde bascule automatiquement sur `FALLBACK_ICE_SERVERS` en cas d'échec.

| Variable                            | Rôle                                       |
| ----------------------------------- | ------------------------------------------ |
| `VITE_TURN_URLS`                    | Liste CSV des `turn:` / `turns:` primaires |
| `VITE_TURN_USERNAME`                | Username partagé pour les URLs ci-dessus   |
| `VITE_TURN_CREDENTIAL`              | Credential partagé                         |
| `VITE_STUN_URLS`                    | Liste CSV des `stun:` primaires (optionnel) |
| `VITE_TURN_FALLBACK_URLS`           | TURN de secours (OpenRelay par défaut)     |
| `VITE_TURN_FALLBACK_USERNAME`       | Username de secours                        |
| `VITE_TURN_FALLBACK_CREDENTIAL`     | Credential de secours                      |
| `VITE_STUN_FALLBACK_URLS`           | STUN de secours (optionnel)                |
| `VITE_SIP_TELEMETRY_URL`            | Endpoint HTTP qui reçoit les événements    |
| `VITE_SIP_DEBUG`                    | `1` → logs SIP/ICE/SDP toujours actifs     |

## Télémétrie

Événements postés via `navigator.sendBeacon` vers `VITE_SIP_TELEMETRY_URL`
(ou via un sink JS enregistré avec `setTelemetrySink`) :

| Nom                              | Valeur (ms) | Méta                          |
| -------------------------------- | ----------- | ----------------------------- |
| `sip.turn.probe_started`         | —           | —                             |
| `sip.turn.probe_result`          | durée sonde | `{ provider, relayFound }`    |
| `sip.turn.provider_selected`     | —           | `{ provider }` metered/fallback |
| `sip.ice.first_relay_ms`         | latence     | délai PC→1er candidat relay   |
| `sip.ice.connected_ms`           | latence     | délai PC→iceConnectionState connected |

Permet de mesurer les taux d'échec iOS, et de comparer la latence STUN vs
TURN par version d'OS / opérateur mobile côté backend d'analyse.

## mDNS / .local sur iOS WKWebView

Depuis iOS 14, WebKit obfusque les IP locales avec des hostnames mDNS
`<uuid>.local`. FusionPBX ne peut pas résoudre ces adresses : les candidats
sont rejetés et l'état ICE reste `new`/`checking` jusqu'au timeout.

Mitigations en place dans le code :

1. **Info.plist + AppDelegate** activent `WebKitICECandidateFilteringEnabled=false`
   et `WebKitEnumeratingAllNetworkInterfacesEnabled=true` → WebKit émet
   les vraies IP host quand l'autorisation micro est accordée.
2. **Détection client** : `isMdnsCandidate()` dans `rtcConfig.ts` flague
   chaque candidat `.local` (event `mdns-candidate`, visible dans l'overlay).
3. **Fallback automatique** : si la PC reste `new`/`checking` après 6 s et
   qu'au moins un candidat mDNS a été émis, on bascule en
   `iceTransportPolicy: 'relay'` et on appelle `restartIce()` pour ne
   garder que les candidats TURN (résolvables par FusionPBX).
4. **Logs** : tous les `icecandidateerror` et passages ICE → `failed`
   sont émis comme `webrtc-error` et affichés dans l'overlay + console.

## Test manuel iOS — vérification mDNS & fallback relay

Procédure à exécuter sur **chaque profil de signature** (Debug, Release,
Ad-Hoc, TestFlight, App Store). Apple peut filtrer les clés privées
`WebKit*` selon le profil, donc Debug ≠ TestFlight ≠ App Store.

### Pré-requis build

1. `git pull` puis `npx cap sync ios`.
2. Vérifier dans `ios/App/App/Info.plist` (avant archive) la présence de :
   - `NSLocalNetworkUsageDescription` + `NSBonjourServices` (`_sip._tcp`, `_sip._udp`)
   - `WebKitICECandidateFilteringEnabled = false`
   - `WebKitEnumeratingAllNetworkInterfacesEnabled = true`
3. Archive Xcode → exporter en Ad-Hoc (Distribution → Ad Hoc) **et** uploader sur TestFlight.
4. Sur l'appareil de test : activer le diag via `?iceDiag=1` dans l'URL serveur,
   ou `localStorage.setItem('sip:iceDiag','1')` au premier lancement.
5. Accepter la pop-up iOS « Réseau local » au premier appel SIP.

### Scénario A — pas de candidats .local (cas nominal)

| # | Étape                                                    | Attendu                                                       |
|---|----------------------------------------------------------|---------------------------------------------------------------|
| 1 | Appel sortant vers un poste FusionPBX                    | `iceConnectionState` → `connected` en < 5 s, audio bidir.     |
| 2 | Overlay diag → compteur **mDNS**                         | `0` (clés WebKit appliquées, pas d'obfuscation `.local`)      |
| 3 | Overlay → liste candidats locaux                         | IPs réelles (`192.168.x` / `10.x` / IPv6), aucun `*.local`    |
| 4 | Overlay → « 1st relay » et « connected »                 | Valeurs ms renseignées, pas de `webrtc-error`                 |
| 5 | Bouton « Copier diagnostic » → coller dans note          | Rapport contient `iceServers`, candidats, `mDNS=0`, telemetry |

### Scénario B — fallback relay déclenché

| # | Étape                                                                  | Attendu                                                        |
|---|------------------------------------------------------------------------|----------------------------------------------------------------|
| 1 | Forcer Apple à strip les clés (TestFlight/App Store) **ou** désactiver manuellement les clés WebKit avant build | Compteur **mDNS > 0** apparaît dans l'overlay |
| 2 | Laisser l'appel négocier 6 s                                           | Event `ice-fallback` émis (`all → relay`), `restartIce()` exécuté |
| 3 | Overlay → bandeau « fallback: all → relay »                            | Visible, horodaté                                              |
| 4 | Connexion finale                                                       | `iceConnectionState` → `connected` via candidat TURN uniquement |
| 5 | Couper Wi-Fi pendant l'appel → bascule LTE                             | `disconnected` → `connected` après ICE restart (toujours relay) |
| 6 | Bloquer TURN (VPN d'entreprise strict, ports 443/3478 fermés)          | Overlay affiche `fallback` puis `webrtc-error`, toast utilisateur |
| 7 | « Copier diagnostic »                                                  | Rapport contient `mDNS>0`, `fallback=relay`, telemetry probe   |

### Matrice de couverture

- **iOS** : 16, 17, 18 (au moins une version par majeure).
- **Appareils** : iPhone SE 2/3, iPhone 12/13/14/15 Pro Max (perfs RTC variables).
- **Réseaux** : Wi-Fi domestique, LTE Bell/Telus/Rogers, hotspot iPhone, VPN d'entreprise.
- **Profils** : Development, Ad-Hoc, **TestFlight**, App Store (production).

### Critères Go / No-Go

- ✅ **Go** : Scénario A passe sur Debug + Ad-Hoc, et Scénario B passe sur TestFlight/App Store si mDNS réapparaît.
- ❌ **No-Go** : appel échoue (`failed` / `ice=new` timeout) sans déclencher le fallback,
  ou fallback déclenché mais pas de candidat `relay` valide (vérifier creds Metered/TURN).

### Reporting

Joindre à chaque run : capture overlay + sortie « Copier diagnostic » +
profil de build + version iOS + opérateur réseau. Stocker dans le ticket QA
correspondant.

