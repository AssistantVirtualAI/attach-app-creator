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
