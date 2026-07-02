
## Problems observed

1. **Recordings** — 666 calls in `planipret_phone_calls`, `0` with `recording_url`. Latest `pp-admin-ns-sync` runs return `fetched: 666, recordings: 0, upserted: 0`. Root cause: `syncRecordings()` extracts the call ID with a narrow key list; the CDR-recordings items coming from `/domains/{d}/cdrs/recordings` use the same NS-API v2 CDR field names (`orig-callid`, `orig-call-id`, `call-orig-call-id`) that `syncCalls`'s `nsCallId()` handles, but `syncRecordings` looks up only a subset AND aborts (`continue`) when the id key isn't found. Also the recording-access-url resolver only runs for rows already in the batch; existing calls never get their `recording_url` back-filled.

2. **AVA Analytics empty** — `planipret_ava_email_analyses`, `planipret_ava_action_log`, `planipret_ava_feedback` all have 0 rows. No email has ever been analyzed because no manual/scheduled run has produced data yet.

3. **Overview / Reports** — user didn't specify what is missing; both pages already query all the expected data. Since the recording fix will re-populate calls and enrich metadata, several derived widgets (recordings count, transcripts) will start filling in. I'll leave the layout alone until the user names a specific gap.

## Changes

### A. `supabase/functions/pp-admin-ns-sync/index.ts` — recordings sync
- Replace the narrow id extraction in `syncRecordings` with the same `nsCallId()` fallback used in `syncCalls` so every row synthesizes a stable id from ext+time+from+to+duration when a raw id isn't present.
- Widen the recording-URL extraction: try `recordingUrl(rec)` first, then `fetchRecordingAccessUrl(domain, rec)` (which already calls `/domains/{d}/recordings/{callId}` and reads `file-access-url`).
- After the sync loop, **also back-fill existing `planipret_phone_calls` rows** for the same window that still have `recording_url IS NULL`: for each row with a `metadata.recording_api_path` or a resolvable call id, call `fetchRecordingAccessUrl` and update the row. Bounded (max ~200 lookups per run) to keep runtime sane.
- Persist `metadata.recording_api_path` on every CDR row inside `syncCalls` (already partially there) so the on-demand fetch below can use it.

### B. `supabase/functions/pp-ns-recordings/index.ts` — on-demand lookup safety net
- Already exists. Add a `resolve` action that, given a `call_id`, calls NS-API `/domains/{domain}/recordings/{call_id}`, extracts `file-access-url`, saves it into `planipret_phone_calls.recording_url` for that broker's row, and returns the URL. This lets the UI recover a missing recording per-click.

### C. `src/pages/planipret/admin/PARecordings.tsx`
- When a row's `recording_url` is null or the audio 404s, show a "Récupérer l'enregistrement" button in the drawer that calls `pp-ns-recordings` with `action: "resolve"`, then refreshes the row.
- Broaden the list query to include calls where `metadata->>'recording_api_path' is not null` OR `recording_url is not null`, so calls that have a recording path but no resolved URL still surface and can be resolved on click.

### D. AVA Analytics manual run — `src/pages/planipret/admin/PAAva.tsx`
- Add a second action button "Analyser les emails maintenant" next to "Réentraîner AVA".
- It calls a new/existing edge function `ava-email-analyzer` with `{ mode: "all_brokers", lookback_days: 7 }`. If the function doesn't accept that shape, add a small wrapper edge function `ava-analyze-all` that:
  - Selects all `planipret_profiles` with `ms365_access_token_encrypted IS NOT NULL` (or equivalent M365-connected flag),
  - Invokes `ava-email-analyzer` per broker in parallel (chunks of 4),
  - Returns `{ analyzed_brokers, total_emails, errors }`.
- Toast progress; on success call `load()` so the KPI grid and table repopulate.

## Verification

- Run `pp-admin-ns-sync` from the Recordings page, wait for the run to finish, then re-query `select count(*) from planipret_phone_calls where recording_url is not null` — expect > 0.
- Click a call row → the audio element loads.
- Click "Analyser les emails maintenant" → after completion, `select count(*) from planipret_ava_email_analyses` > 0 and the AVA page shows KPIs.

## Out of scope (until user clarifies)

- Overview/Reports layout changes — waiting on specifics.
- ava-email-analyzer scheduler / M365 token audit — separate follow-up if manual pass reveals no broker is connected.
