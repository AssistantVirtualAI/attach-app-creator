# Planipret Mobile — Qualité d'appel « bulletproof »

Objectif : que l'app mobile Planipret utilise **exactement le même moteur d'appel que Lemtel mobile** (JsSIP + WebRTC + wss fallbacks Lemtel), avec **noise cancellation activée par défaut**, **détection auto Wi-Fi/LTE** et **bascule transparente** en cours d'appel, sans coupure ni dégradation.

## 1. Aligner le moteur d'appel sur Lemtel mobile

Aujourd'hui Planipret mobile déclenche les appels via l'API PBX (`ns-calls action:start`, click‑to‑call côté serveur) — pas de média WebRTC dans l'app, donc pas de contrôle qualité côté téléphone. Lemtel mobile, lui, utilise `useSoftphone` → `sipProvider` (`src/lib/softphone/jssipProvider.ts`) avec `PC_CONFIG` (ICE relay, TURN Lemtel), fallbacks `wss://pbxnode.lemtel.tel:7443` + `wss://node.lemtelcloud.net:7443`, session timers 120s.

Actions :
- Créer `useMplanipretSoftphone` (wrapper de `useSoftphone`) qui, en mobile, force `platform:"mobile"` vers `softphone-credentials` et réutilise `sipProvider`, `PC_CONFIG`, `sdpModifier`, ringtones et logs Lemtel. **Aucune duplication du provider**.
- Rebrancher le bouton d'appel de `PlanipretMobile.tsx` / `Dialer` / `MContacts` / `MCalls` sur ce hook : chemin principal = **WebRTC in-app** (audio HD, contrôle codec), fallback = `ns-calls start` si `sipProvider` non enregistré ou WSS injoignable (règle existante « les deux avec fallback » déjà validée).
- Respecter l'isolation `/mplanipret` : les changements du provider Lemtel sont interdits ; on ne fait que le consommer.

## 2. Noise cancellation par défaut + chaîne audio renforcée

`src/lib/planipret/audio/audioConstraints.ts`, `rnnoise.ts`, `vad.ts` existent déjà mais ne sont utilisés que dans le `CallAudioSheet` — pas dans le vrai flux d'appel.

Actions :
- Dans `useMplanipretSoftphone.call()` / `.answer()`, remplacer `getUserMedia({audio:{ec,ns,agc:true}})` par `getAudioConstraints(ncMode)` (mode persistant `pp_nc_mode`, défaut = `standard`).
- Passer le stream micro dans `applyRnnoise` (WASM) quand `ncMode="office"` avant de le fournir à JsSIP via l'option `mediaStream`.
- Forcer le codec Opus DTX + FEC dans `sdpModifier` (ajout `usedtx=1; useinbandfec=1; stereo=0; maxaveragebitrate=24000; cbr=0`) + `a=ptime:20` — meilleure résilience à la perte de paquets LTE.
- Ajouter `RTCRtpSender.setParameters` avec `networkPriority:"high"` et `priority:"high"` sur la piste audio (QoS DSCP quand supporté).
- Brancher `startVad` sur la piste live pour l'auto-mute + indicateur "vous parlez" dans `ActiveCallOverlay`.

## 3. Détection réseau + bascule Wi-Fi ↔ LTE sans coupure

Nouveau module `src/lib/planipret/net/networkMonitor.ts` :
- Écoute `navigator.connection.change`, `online/offline`, et, sous Capacitor, `@capacitor/network` (`Network.addListener('networkStatusChange')`) pour distinguer `wifi` / `cellular` / `none`.
- Publie un `NetSnapshot { type, effectiveType, downlink, rtt, quality: 'excellent'|'good'|'poor' }` (règles : rtt>300 ou downlink<0.5 → poor).
- Exécute un ping WSS léger (`/health` sur `pbxnode.lemtel.tel`) toutes les 15s pendant un appel actif pour détecter la dégradation avant que l'utilisateur ne l'entende.

Bascule sans coupure — nouveau `handoverController.ts` consommé par `useMplanipretSoftphone` :
- **En veille** : sur changement de réseau, `sipProvider` fait un `register` immédiat sur le nouveau chemin (déjà géré par JsSIP quand le socket tombe ; on force `unregister()` puis `register()` pour raccourcir la fenêtre).
- **En appel actif** :
  1. Capturer un nouveau `MediaStream` sur le nouveau réseau (le mic reste local, mais on relance `getUserMedia` pour purger toute contrainte cellulaire).
  2. Déclencher un **ICE restart** via `session.renegotiate({ rtcOfferConstraints:{ iceRestart:true } })` sur la session JsSIP en cours → nouvelle paire de candidats, TURN Lemtel prend le relais, aucune interruption RTP au-delà de ~300-800 ms.
  3. Si la renégociation échoue en <3 s, tenter un second essai ; sinon afficher un toast « Réseau instable, reprise… » et laisser la reprise SIP standard (re-INVITE) faire son travail.
  4. Adapter le bitrate Opus : `poor` → 16 kbps + ptime 40 ; `good` → 24 kbps ; `excellent` → 32 kbps stéréo mono forcé.
- Un badge réseau (Wi-Fi/LTE/⚠) apparaît dans `ActiveCallOverlay` avec la qualité live (basée sur `getStats()` : `packetsLost`, `jitter`, `roundTripTime`).

## 4. Statistiques & auto-diagnostic en direct

- Boucle `pc.getStats()` toutes les 2 s pendant l'appel : `jitter`, `packetsLost/packetsSent`, `audioLevel`, `roundTripTime`.
- Seuils : jitter>60ms ou loss>5% → étiquette « Qualité dégradée » + tentative auto de handover (§3) si un autre réseau est disponible.
- Journalisation dans `planipret_call_quality_events` (nouvelle table optionnelle) — hors périmètre si non demandé ; par défaut on log seulement en session (console + snapshot dans `sipProvider.logs`).

## 5. UI

- `ActiveCallOverlay` : ajouter (a) icône réseau live, (b) barre qualité (vert/orange/rouge), (c) bouton « Audio » ouvrant le `CallAudioSheet` déjà existant (routing haut-parleur/BT/écouteur + mode NC).
- `MMore` → nouvelle ligne « Diagnostic audio & réseau » qui lance un test 10 s (mic loopback + ping WSS + mesure débit) et affiche un rapport.
- i18n FR/EN dans `src/lib/i18n/mplanipret.ts` pour tous les nouveaux libellés.

## 6. Capacitor natif (si build mobile)

- Ajouter (si absent) `@capacitor/network` — sans lancer `cap sync` (le user le fera).
- `AndroidManifest` / `Info.plist` : rappeler à l'utilisateur d'ajouter `MODIFY_AUDIO_SETTINGS`, `RECORD_AUDIO`, `ACCESS_NETWORK_STATE`, `CHANGE_NETWORK_STATE`, `background modes: voip, audio` (iOS) pour tenir un appel en arrière-plan lors du switch réseau.

## Fichiers touchés

Créés
- `src/hooks/useMplanipretSoftphone.ts`
- `src/lib/planipret/net/networkMonitor.ts`
- `src/lib/planipret/net/handoverController.ts`
- `src/lib/planipret/audio/opusSdp.ts` (modificateur SDP Opus)
- `src/components/planipret/mobile/NetworkQualityBadge.tsx`

Édités
- `src/pages/planipret/PlanipretMobile.tsx` (bouton dial → hook)
- `src/pages/planipret/mobile/MCalls.tsx`, `MContacts.tsx`, `MMore.tsx`
- `src/components/planipret/mobile/ActiveCallOverlay.tsx` (badge + qualité)
- `src/components/planipret/mobile/call/CallAudioSheet.tsx` (NC mode branché sur la vraie session)
- `src/lib/i18n/mplanipret.ts`

Non touchés
- `src/lib/softphone/jssipProvider.ts`, `rtcConfig.ts`, `useSoftphone.ts` (Lemtel — consommés uniquement).

## Hors périmètre

- Modifier le PBX / TURN / codecs côté serveur Lemtel.
- Persister l'historique qualité en base (peut être ajouté ensuite si demandé).
- Créer un nouveau provider SIP concurrent.
