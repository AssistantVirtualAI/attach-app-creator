## Problèmes identifiés

### 1. Boucle re-INVITE après hold
Dans `CapacitorSip.swift` ligne 653-662, le handler `INVITE 200 OK` ne fait **aucune distinction** entre l'INVITE initial et un re-INVITE (hold/resume). Il :
- écrase systématiquement `callState = "active"` (même quand on vient de passer en `hold`)
- ré-émet `emitCallState("active", stage:"answered")` → la couche JS voit un nouveau changement d'état → `isOnHold` peut être réinitialisé → le hook ré-appelle `setHold(true)` → nouvelle re-INVITE → boucle.

De plus, il rappelle `startRtpIfReady()` à chaque 200 OK (re-démarre AVAudioEngine inutilement).

### 2. Bouton Record (et Transfer/Park/Add) inopérants
`ActiveCallSheet.tsx` appelle `sp.startRecord?.()` / `sp.stopRecord?.()` / `sp.transfer?.()` / `sp.park?.()` / `sp.addCall?.()`. **Aucune** de ces méthodes n'existe dans `useSoftphoneNative.ts` ni dans le plugin Swift → les boutons ne font rien (le `?.` les rend silencieux).

### 3. Audio bidirectionnel muet
Probables causes additionnelles (à confirmer via logs `[RTP]`) :
- `Via:` et `Contact:` envoient encore `0.0.0.0` (lignes 938, 944, 921) au lieu de l'IP locale réelle → le PBX renvoie le RTP vers une route invalide pour signaling, mais surtout certains PBX rejettent les NAT mappings.
- `AVAudioSession` n'est pas en mode `.voiceChat` (pas d'AEC) — feedback / silence si l'écho est filtré côté PBX.
- Aucun log `[RTP]` confirmant que le socket UDP a effectivement bindé une IP routable.

## Plan d'implémentation

### A. Fix boucle hold (`CapacitorSip.swift`)
1. Ajouter un flag `isReInvite` calculé : un INVITE 200 OK est un re-INVITE si `!callRemoteTag.isEmpty` **avant** parsing de la réponse (= dialogue déjà établi).
2. Pour un re-INVITE 200 OK :
   - **ne pas** modifier `callState`
   - **ne pas** appeler `startRtpIfReady()` (juste mettre à jour le remote IP/port RTP si la SDP change)
   - émettre uniquement `holdChanged` avec l'état courant `isOnHold`
3. Pour l'INVITE initial 200 OK : comportement actuel conservé.
4. Côté `setHold` : ne plus pré-modifier `callState` avant l'envoi (laisser le 200 OK confirmer), gardé seulement `isOnHold`.

### B. Fix hook JS (`useSoftphoneNative.ts`)
1. Le listener `holdChanged` doit **seulement** synchroniser `isOnHold` (jamais ré-émettre `setHold`).
2. Le listener `callStateChanged` ne doit pas écraser `isOnHold` quand l'état reste `active` après un re-INVITE.

### C. Implémenter les actions manquantes
Dans `CapacitorSip.swift` + `nativeSipProvider.ts` + `useSoftphoneNative.ts`, ajouter :
- `startRecord` / `stopRecord` → SIP INFO `Record: on|off` (NetSapiens/FusionPBX standard) ou feature code `*1` via INVITE refer-to. Stratégie : `SIP INFO` avec corps `Record: on/off` (compatible NS), retomber sur DTMF `*1` si non supporté.
- `transfer(target)` → SIP `REFER` avec `Refer-To: <sip:target@domain>`.
- `park()` → INVITE/REFER vers feature code `*5` (à confirmer côté PBX) ou `BLF park` ; par défaut transfer aveugle vers `*72`.
- `addCall(target)` → nouvel INVITE en parallèle (hold de l'actuel via re-INVITE, puis nouvel INVITE) — version simple : hold + nouvel appel sortant.
- Exposer les 4 méthodes dans `nativeSipProvider.ts` (types) et `useSoftphoneNative.ts` (wrappers).

### D. Audio bidirectionnel
1. Remplacer `0.0.0.0` par `localIPAddress()` dans `Via:` et `Contact:` (lignes 921, 938, 944 + autres occurrences à scanner).
2. Dans `RTPAudioSession.startAudio()` : configurer `AVAudioSession` en `.playAndRecord` avec `mode: .voiceChat` (active AEC/AGC iOS).
3. Ajouter logs explicites `[RTP] bound localIP=... port=... remote=...:... pt=0` au moment de `startRtp`, et `[RTP] tx=N rx=M` toutes les 5 s.
4. Si après ces fixes l'audio entrant reste muet : confirmer dans l'écran AudioDiagnostics que `rxPackets > 0` ; si 0 = NAT/firewall PBX, on activera le rport+keep-alive RTP (paquet vide toutes les 15 s).

### E. Vérification
1. Rebuild iOS, refaire un appel, vérifier dans Xcode console :
   - un seul `>>> re-INVITE hold=true` par clic Hold
   - `CALL_EVENT|holdChanged|held=true` puis `callState` reste stable
   - `[RTP] bound localIP=192.168.x.x port=2xxxx`
   - `[RTP] tx=… rx=…` non nuls
2. Bouton Record → log `>>> SIP INFO Record: on` + toast UI.
3. Hangup fonctionne après hold/resume.

## Fichiers touchés
- `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift`
- `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift`
- `apps/ava-softphone-mobile/src/lib/sip/nativeSipProvider.ts`
- `apps/ava-softphone-mobile/src/hooks/useSoftphoneNative.ts`

Aucun changement backend / DB / autres apps.