
## Goal
Replace the generic "Edge Function returned a non-2xx status code" toast on the call detail (recording + transcription) with the real cause, and fix whatever the logs reveal.

## Note on function names
The actual functions in this project are `ns-recordings` and `ns-transcription` (not `ns-get-recording` / `ns-get-transcription`). Existing functions already do most of what the pasted prompt asks (JSON-with-attempts on failure), so the fix is smaller and targeted, not a rewrite.

## Steps

### 1. Check what's actually failing (before editing code)
- Read edge logs for `ns-recordings` and `ns-transcription` (last invocations for François Leblond's call, ext 1251, 2026-07-02 15:22:24).
- Confirm whether the non-2xx is coming from `authBroker` (401/403 — missing profile/extension mapping), from `nsBrokerFetch` (NS API 4xx/5xx), or from an uncaught throw.

### 2. `supabase/functions/ns-recordings/index.ts`
- Add verbose `console.log` (method, url, callId, NS status, byte size, auth outcome).
- On NS non-ok, return `200` JSON with `{ success:false, error, ns_status, hint, attempts:[…] }` (currently returns raw NS text only).
- Guarantee no uncaught throw hits the runtime (wrap `authBroker` errors in JSON 200 too, so the client always sees a parseable body instead of "non-2xx").

### 3. `supabase/functions/ns-transcription/index.ts`
- Add `console.log` for each attempt (path, status, keys of returned JSON).
- Extend `parseSegments` field list already looks OK; keep. Expand `attempts` debug to include a small preview of the CDR keys when the `cdr_field` attempt succeeds but has no transcript.
- Include `possible_reasons` array + `action_required` in the failure payload so the UI can show them.

### 4. `src/lib/planipret/nsApi.ts` → `recordingsApi.fetchAudio`
- When response is JSON (success or failure), read `error`, `hint`, `ns_status`, `attempts` and throw an `Error` whose message includes hint. Attach `attempts` to a `console.warn` for devs.
- When network throws or `res.ok` is false and body isn't JSON, include the HTTP status in the thrown message.

### 5. `src/components/planipret/mobile/call/CallRecordingPlayer.tsx`
- Store `errorHint` alongside `error` state; render both (error line + smaller hint line + Retry).
- Continue calling with just `callId` (server derives extension from the broker profile — no extra props needed).

### 6. Transcription caller (wherever `ns-transcription` is invoked in the mobile call detail — likely `MCalls.tsx`)
- Parse the JSON response for `error`, `hint`, `possible_reasons`, `action_required` and show them under the "Lancer la transcription IA" button instead of a toast that only says "non-2xx".

### 7. Verify
- Retry the failing call in the mobile preview; confirm the UI now shows a specific error (e.g. "Recording 404 on NS-API", "PORTAL_VOICE_TRANSCRIPTION_SENTIMENT not enabled", or the exact upstream code).
- Address the concrete cause the logs surface (usually one of: `authBroker` cannot resolve the broker profile/extension for the current user; NS returns 404 because the call was not recorded; NS key lacks recording scope).

## Out of scope
- Renaming functions to `ns-get-recording` / `ns-get-transcription` (pasted prompt uses different names — the project uses the existing ones).
- Rewriting `ns-webhook-receiver` schema / adding `ns_cdr_id` columns unless step 1 shows the recording lookup fails because the `callId` we send is wrong. If that's the case, a follow-up plan will cover it.
