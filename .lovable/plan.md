# Plan multi-phases — Recordings, Transcriptions & Call Management (NS-API v2)

Objectif : aligner tout le stack sur les endpoints officiels `docs.ns-api.com` avec auth `Bearer NS_API_KEY`, corriger la racine du problème (`ns_callid` non persisté correctement) et restaurer la page recordings.

## Prérequis (à confirmer avant Phase 1)
- **Secret `NS_API_KEY`** (Bearer statique) — nécessaire, à confirmer présent sinon `add_secret` requis.
- `NS_API_BASE_URL` = `https://voice.ava-telecom.ca/ns-api/v2` ✅
- `NS_DEFAULT_DOMAIN` = `planipret.ca` ✅

---

## Phase 1 — Diagnostic (indispensable avant tout code)
**But** : identifier le nom exact du champ CDR contenant le `callid` NS-API.

1. Créer Edge Function temporaire `ns-debug-cdr` :
   - `GET {base}/domains/{domain}/cdrs?limit=1` avec Bearer.
   - Retourne `Object.keys(cdr)` + `cdr_raw` + `http_status`.
2. Ajouter bouton temporaire **[🔍 Debug CDR Fields]** sur `/planipret/admin/recordings` :
   - Log la row la plus récente de `planipret_phone_calls`.
   - Invoke `ns-debug-cdr` et affiche le JSON brut dans un `<pre>`.
3. **Livrable** : capture des champs bruts → décision sur `ns_callid` mapping.

---

## Phase 2 — Schema DB
Migration :
```sql
ALTER TABLE planipret_phone_calls
  ADD COLUMN IF NOT EXISTS ns_callid text,
  ADD COLUMN IF NOT EXISTS ns_orig_callid text,
  ADD COLUMN IF NOT EXISTS ns_term_callid text;
CREATE INDEX IF NOT EXISTS idx_calls_ns_callid ON planipret_phone_calls(ns_callid);
```

---

## Phase 3 — CDR sync
Mettre à jour `pp-admin-ns-sync` + `ns-webhook-receiver` pour persister (avec les noms exacts confirmés en Phase 1, valeurs par défaut ci-dessous) :
```
ns_orig_callid ← cdr["orig-callid"]
ns_term_callid ← cdr["term-callid"]
ns_callid      ← orig-callid ?? term-callid ?? id
```
Backfill optionnel via update SQL sur `metadata->>'orig-callid'` pour les anciens appels.

---

## Phase 4 — Recording endpoint
Réécrire `ns-get-recording` (ou refondre `ns-recordings` existant) avec la cascade officielle :
1. `GET /domains/{d}/users/{ext}/recordings/{callid}` — si `ns_extension` connu.
2. `GET /domains/~/users/~/recordings/{callid}` — fallback tilde.
3. `GET /domains/{d}/recordings/{callid}` — fallback domain-level.

Comportement :
- Résout `callid` depuis `call_db_id` via lookup DB si non fourni.
- Si `Content-Type: audio/*|octet-stream` → stream direct (Accept-Ranges).
- Si JSON → suit `url`/`recording-url`/`media-url`/`file`/`download-url` puis GET.
- Sinon renvoie `404 { error:"RECORDING_NOT_FOUND", attempts, possible_causes }`.

---

## Phase 5 — Transcription endpoint
Réécrire `ns-get-transcription` :
- `GET /domains/{d}/transcriptions?callid=…` avec variantes (`call-id`, `orig-callid`).
- Parse en `segments[{speaker,text}]` (string / array / object).
- Si vide → `404 { action_required: "activer PORTAL_VOICE_TRANSCRIPTION_SENTIMENT" }`.

---

## Phase 6 — Call control (nouveau)
Créer `ns-call-action` :
- `hangup` / `reject` → `DELETE /domains/{d}/calls/{callid}`
- `hold` / `unhold` / `answer` / `transfer` → `PUT /domains/{d}/calls/{callid}` avec `{ action, destination? }`
- Validation Zod des actions ; retour `{ success, status, data }`.

---

## Phase 7 — Frontend `/planipret/admin/recordings`
- Restaurer la liste : `planipret_phone_calls` où `ns_callid IS NOT NULL` OU `has_recording = true`.
- Bouton **▶ Écouter** → `supabase.functions.invoke('ns-get-recording', { body: { call_db_id, ns_callid, ns_extension } })`.
- Bouton **📝 Transcrire** → `ns-get-transcription` (mêmes params).
- Player inline via `CallRecordingPlayer` (expand row, pas de modal).
- États UI clairs :
  - `ns_callid` manquant → "⚠️ Identifiant NS-API manquant" + [🔄 Sync CDR]
  - 404 recording → "📵 Enregistrement non disponible"
  - Transcript vide → "📝 Activez PORTAL_VOICE_TRANSCRIPTION_SENTIMENT" + [📧 Contacter Clinton]
  - Recording OK + transcript KO → player + bouton Claude désactivé + tooltip

---

## Phase 8 — Couche Claude (post-transcript)
Après un transcript NS-API valide, invoke `pp-admin-transcribe` (ou nouvelle `ai-call-coaching`) avec Lovable AI Gateway pour retourner JSON strict :
```json
{
  "corrected_transcript": [{"speaker","text"}],
  "call_notes": { "summary", "client_needs", "key_info", "outcome" },
  "coaching": { "score", "strengths", "improvements", "coaching_message" }
}
```
Affichage : transcript corrigé + card notes + score coaching.

---

## Phase 9 — Test end-to-end
Cas de test : Scott He ext 110 (2026-04-03).
- ✅ `ns_callid` présent en DB après re-sync.
- ✅ `ns-get-recording` stream l'audio.
- ✅ `ns-get-transcription` retourne segments.
- ✅ Claude retourne coaching JSON valide.
- Nettoyage : supprimer `ns-debug-cdr` + bouton diagnostic.

---

## Question bloquante
Le secret **`NS_API_KEY`** (Bearer statique) est-il configuré ? Le stack actuel utilise `NS_API_USER`/`NS_API_PASSWORD` + JWT via `_shared/ns-broker.ts`. Deux options :
1. **Ajouter `NS_API_KEY`** et utiliser Bearer direct dans les 4 nouvelles/refondues fonctions (recommandé, aligné doc).
2. **Continuer avec le broker JWT existant** (`nsBrokerFetch`) — fonctionne aussi mais divergent de la spec.

Merci de confirmer l'option avant de builder Phase 1.
