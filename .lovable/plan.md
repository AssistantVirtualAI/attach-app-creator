# Lemtel Desktop — Full FusionPBX Integration Plan

Ajouter toutes les fonctionnalités téléphoniques FusionPBX dans l'app desktop, par phases livrables et testables.

## Phase 1 — Core call control (immédiat)
- Récupération du mot de passe SIP via l'edge function `softphone-credentials` au démarrage de l'app (au lieu de `password: ''` actuel).
- Transferts : **blind** et **attended** (REFER via JsSIP).
- **Hold / Unhold** (déjà câblé, vérification).
- **DTMF** durant un appel (clavier in-call).
- **Mute / Unmute** (déjà câblé).
- **Conférence 3-way** locale (mix via WebRTC + 2e session).
- Sonneries entrantes (audio + notification système Electron).

## Phase 2 — Historique, contacts, présence
- **Recents** : onglet alimenté par `pbx_cdr_safe` (50 derniers, scope extension de l'user), bouton rappel 1-clic.
- **Contacts** : onglet listant les extensions internes de l'org (`pbx_extensions_safe`), recherche, appel direct.
- **BLF / Presence** : statut des collègues via SIP SUBSCRIBE/NOTIFY (vert = libre, rouge = en appel, gris = offline).
- **Caller ID lookup** : enrichir l'appel entrant avec nom du contact si l'extension est connue.

## Phase 3 — Messagerie & SMS
- **Voicemail visuel** : onglet listant les messages (`pbx_voicemail_messages`), lecture inline, suppression, marquer lu/non-lu.
- **MWI** (Message Waiting Indicator) : badge sur l'onglet voicemail via NOTIFY SIP.
- **SMS/MMS** : onglet threads alimenté par `pbx_sms_threads` + `pbx_sms_messages`, envoi via edge function Telnyx existante.

## Phase 4 — Settings, queues, recording
- **Audio devices** : sélecteur micro/HP/sonnerie (enumerateDevices), persisté dans electron-store.
- **DND** (Do Not Disturb) : toggle local + push vers `pbx_softphone_users.status`.
- **Call forwarding** : always / busy / no-answer, écrit dans FusionPBX via edge function `pbx-extension-update`.
- **Codecs preferences** : OPUS / G.722 / PCMU/A (par défaut OPUS).
- **Ring groups / Queues** : login/logout agent, pause/unpause (edge function `pbx-queue-agent`).
- **Call parking** & **pickup** (codes FusionPBX *3xxx, *4xxx configurables).
- **Enregistrement** : start/stop on-demand, accès aux recordings (`pbx_recordings` + bucket `lemtel-recordings`).
- **Launch on startup**, **minimize to tray** (déjà câblé, vérification).

## Technical section

### Backend (edge functions à créer)
- `pbx-recent-calls` — proxy lecture `pbx_cdr` filtré par extension.
- `pbx-contacts` — liste extensions de l'org depuis `pbx_extensions_safe`.
- `pbx-voicemail` — list/get/delete via FusionPBX API.
- `pbx-extension-update` — update forwarding, DND, codecs, ring strategy.
- `pbx-queue-agent` — login/logout/pause agent dans une queue.
- `pbx-recording-toggle` — start/stop d'un enregistrement actif.

### Frontend (apps/ava-softphone-desktop/src)
- Refactor de `App.tsx` : extraire la logique SIP dans `hooks/useSoftphone.ts` (parité avec l'app web).
- Nouveau `lib/sip.ts` : provider JsSIP avec transfer, conference, DTMF, hold.
- Nouveaux composants : `components/CallView.tsx`, `Dialpad.tsx`, `RecentsList.tsx`, `ContactsList.tsx`, `VoicemailList.tsx`, `SmsThreads.tsx`, `AudioDevicesPicker.tsx`, `SettingsPage.tsx` (étendue).
- Realtime Supabase channel pour MWI, SMS, présence BLF cross-device.
- Version bumpée par phase (1.1.0 → 1.4.0).

### Sécurité
- Aucun mot de passe SIP côté client persistant : refetch via edge function à chaque démarrage.
- Toutes les écritures FusionPBX passent par edge functions avec validation Zod + RLS check.
- Les recordings restent dans le bucket privé, URLs signées 1h max.

## Livraison
Je commence **immédiatement par la Phase 1**, livre, puis enchaîne sur 2 → 3 → 4 en messages séparés pour que tu puisses tester chaque étape.
