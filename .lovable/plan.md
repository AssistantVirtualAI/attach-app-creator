## Objectif
Aligner tous les appels NS-API sur les endpoints officiels documentés (`docs.ns-api.com`) en utilisant l'authentification `Bearer NS_API_KEY`, corriger le mapping du `callid` NS pour que les enregistrements et transcriptions fonctionnent.

## Prérequis (à confirmer avant build)
1. **Secret `NS_API_KEY`** — Le stack actuel utilise `NS_API_USER` + `NS_API_PASSWORD` via JWT (`_shared/ns-broker.ts`, `_shared/planipret-ns.ts`). Le nouveau plan exige un `NS_API_KEY` (Bearer statique). **Confirmer** que ce secret existe et remplace bien la paire user/password, sinon les fonctions casseront en prod.
2. **`NS_API_BASE_URL`** — actuellement `https://voice.ava-telecom.ca/ns-api/v2`. À conserver.
3. **`NS_DEFAULT_DOMAIN`** = `planipret.ca`. À conserver.

## Étapes

### 1. Migration DB
- `ALTER TABLE planipret_phone_calls ADD COLUMN IF NOT EXISTS ns_callid text, ns_orig_callid text, ns_term_callid text;`
- Index sur `ns_callid`.

### 2. Sync CDR (`pp-admin-ns-sync`, `ns-webhook-receiver`)
- Mapper depuis la réponse CDR :
  - `ns_orig_callid ← cdr["orig-callid"]`
  - `ns_term_callid ← cdr["term-callid"]`
  - `ns_callid ← orig-callid ?? term-callid ?? id`
- Conserver la logique existante multi-candidats mais persister explicitement les 3 nouveaux champs.

### 3. Auth partagée
- Créer `_shared/ns-api-key.ts` exposant `nsHeaders` = `{ Authorization: Bearer NS_API_KEY, Content-Type: application/json }` + `NS_API_BASE_URL` + `NS_DOMAIN`.
- Ne PAS supprimer `_shared/ns-broker.ts` / `planipret-ns.ts` tout de suite (utilisés par ~15 autres fonctions). On migre uniquement les 3 fonctions ciblées dans ce plan.

### 4. Réécrire `ns-recordings` (et `pp-admin-recording-resolve`)
Endpoints officiels dans l'ordre :
1. `GET /domains/{domain}/recordings/{ns_callid}`
2. `GET /domains/{domain}/users/{ext}/recordings/{ns_callid}`
- Si `Content-Type: audio/*` → streamer.
- Si JSON → suivre `url` / `recording-url` / `media-url` / `file-url` / `file-access-url` puis GET.
- Sinon retourner 200 + `{ fallback:true, attempts, cdr_in_db, hint }` (pas de 502).

### 5. Réécrire `ns-transcription` (et `pp-admin-transcribe`)
- Endpoint officiel : `GET /domains/{domain}/transcriptions?callid=...` avec variantes (`orig-callid`, `call-id`, combiné `user=` + `callid=`).
- Parser en `segments[{speaker,text}]`.
- 200 + `{ fallback:true, possible_causes }` si vide (mention `PORTAL_VOICE_TRANSCRIPTION_SENTIMENT`).

### 6. Frontend (`MCalls.tsx`, `CallRecordingPlayer.tsx`, `PARecordings.tsx`)
- Charger `ns_callid, ns_orig_callid, ns_extension` depuis la row.
- Passer `{ ns_callid, ns_extension, call_db_id }` aux deux edge functions.
- Afficher `possible_causes` / `hint` en UI (déjà partiellement en place).

### 7. Provisioning devices — HORS SCOPE de ce fix
Le message initial concerne uniquement recordings + transcriptions. Je ne touche pas `ns-provision-broker-devices` sauf demande explicite.

### 8. Tests
- `supabase--curl_edge_functions` sur `ns-recordings` et `ns-transcription` avec le CDR de François Leblond (2026-07-02 15:22:24, ext 1251).
- Vérifier logs edge et UI.

## Question bloquante
**Le secret `NS_API_KEY` (Bearer statique) est-il déjà configuré, ou dois-je continuer avec le JWT généré via `NS_API_USER`/`NS_API_PASSWORD` (stack actuel) ?** Si non configuré, l'étape 3 nécessite un `add_secret` avant de builder.
