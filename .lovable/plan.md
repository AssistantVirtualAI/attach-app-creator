## Goal

Make recordings play automatically by consuming the `file-access-url` field returned by NS-API v2, and improve the transcription endpoint to surface a clear status.

## Current state

`ns-get-recording` already tries user/domain endpoints and calls `pickAudioUrl(parsed)` which reads `file-access-url`. Two real problems remain:

1. When the parsed URL is absolute (ucstack signed URL with `?auth=...`), the code refetches it with the NS Bearer header. ucstack rejects/redirects extra auth in some cases and we lose diagnostic info.
2. On failure we don't return the recording metadata (`call-recording-status`, `file-size-kilobytes`), so we can't tell "not recorded" from "still processing".

`ns-get-transcription` returns `TRANSCRIPT_NOT_AVAILABLE` because `PORTAL_VOICE_TRANSCRIPTION_SENTIMENT` is not enabled on the NS domain. The function itself needs to (a) not throw, (b) return a clear payload for the UI, (c) try a few more field names before giving up.

## Changes

### 1. `supabase/functions/ns-get-recording/index.ts`

- When the JSON response contains `file-access-url` (or equivalent), fetch that URL:
  - First attempt: **no Authorization header** (URL is already signed with `?auth=`).
  - Fallback attempt: with NS `Authorization: Bearer` header.
- Capture full recording metadata from the first successful JSON hit: `call-recording-status`, `file-size-kilobytes`, `file-duration-seconds`, `call-recording-remote-wav`.
- On no-audio outcome, return status 200 with:
  - `error: "NO_FILE_ACCESS_URL"` when metadata found but URL empty (include `recording_status`, `file_size_kb`, `duration_sec`, `recording_meta`).
  - `error: "RECORDING_NOT_FOUND"` when nothing came back (existing payload, keep 200 so the frontend `invoke` doesn't throw).
- Keep all existing endpoint cascade + callid variants; only the download step and error payload change.

### 2. `supabase/functions/ns-get-transcription/index.ts`

- Broaden field extraction: accept `transcription-text`, `transcript`, `text`, `asr-text`, `sentiment-transcript`.
- Return 200 with `{ success:false, error:"TRANSCRIPT_NOT_AVAILABLE", action_required, attempts }` (already partially done — verify no throw path remains).
- Add a lightweight probe of `/domains/{domain}/transcriptions?callid=…` and `/users/{ext}/transcriptions?callid=…`, log status + first 200 chars of body for diagnosis.

### 3. `src/pages/planipret/admin/PARecordings.tsx` (frontend)

In `resolveRecording`, distinguish error codes to show a helpful message instead of a generic toast:

- `MISSING_CALLID` → "Identifiant d'appel manquant — resynchroniser le CDR".
- `NO_FILE_ACCESS_URL` → "Enregistrement en traitement (status: X, size: Y kB)".
- `RECORDING_NOT_FOUND` → "Aucun enregistrement pour cet appel".
- Other → existing message fallback.

No change to CDR sync in this pass — we already store `ns_callid`, `ns_orig_callid`, `ns_term_callid` and the function tries all three.

## Out of scope

- Enabling `PORTAL_VOICE_TRANSCRIPTION_SENTIMENT` on the NS domain (server-side toggle by Clinton — not a code change).
- CDR sync field mapping changes.

## Test

1. Open a recorded call (Jean-Eric Gagnon ext 1040, 6m54s) → modal auto-loads audio via `file-access-url`.
2. Open a non-recorded call → toast shows "Aucun enregistrement" without runtime error.
3. Open any call → transcription section shows either transcript or the "activation NS requise" notice, no runtime error.
