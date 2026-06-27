# Fix Call Recording + Transcription (Lemtel mobile)

## Problem 1 — Record button errors

**Investigate first** (build mode):
- `ios/App/App/CapacitorSip.swift`: confirm `startRecording` / `stopRecording` are in `pluginMethods` and implemented. Currently `startRecord` exists but UI calls `startRecording` — name mismatch is the likely cause.
- `src/lib/sip/nativeSipProvider.ts`: verify `startRecording` / `stopRecording` are exported and forward to the native plugin with `{ callId }`.
- Capture exact error via `console.error` in the catch block of the Record button handler so it appears in dev logs.

**Fix**:
1. In `CapacitorSip.swift`: add/rename `startRecording` and `stopRecording` `@objc` methods; register both in `pluginMethods`. Implementation calls FusionPBX REST `POST /api/v2/cmd/record_start` (and `record_stop`) with `uuid=<activeCallId>` via the existing `fusionpbx-proxy` edge function (don't put PBX creds on device).
2. In `nativeSipProvider.ts`: export `startRecording(callId)` / `stopRecording(callId)` that call `CapacitorPjsip.startRecording({ callId })`.
3. In the record button handler (`ActiveCallSheet.tsx`): surface the real error via toast + `console.error`, flip `isRecording` only on success.

## Problem 2 — Transcription fails (RECORDING_NOT_FOUND)

**Edge function changes**:

`supabase/functions/fusionpbx-proxy/index.ts`:
- New action `findRecording({ callUuid, domain })` that tries paths in order:
  1. CDR `record_path` + `record_name` from DB
  2. `/var/lib/freeswitch/recordings/<domain>/archive/<YYYY>/<Mon>/<DD>/<uuid>.{mp3,wav}`
  3. `/var/lib/freeswitch/recordings/<domain>/<uuid>.{mp3,wav}`
  4. `/tmp/<uuid>.{mp3,wav}`
- Log every attempt: full URL, HTTP status, response body snippet.
- Return `{ found, path, size, attempts: [...] }`.
- New action `healthCheck` that hits FusionPBX login endpoint and returns `{ ok, status, expiresAt }`.

`supabase/functions/ai-transcribe-call/index.ts`:
- Call `fusionpbx-proxy:findRecording` first; if not found, return structured error `{ code: 'RECORDING_NOT_FOUND', attempts }`.
- Log: fetch URL, HTTP status, content-length, error body.
- On 401/403 from PBX → return `{ code: 'PBX_AUTH_FAILED' }` so UI prompts to refresh creds.
- Keep STT chain: `openai/gpt-4o-mini-transcribe` via Lovable AI Gateway (per project standard) with Claude post-processing.

**Auto-trigger + UI**:
- In `useSoftphoneNative.ts` on `callEnded` (recorded calls only): wait 10s, invoke `ai-transcribe-call` with `{ callUuid }`.
- `CallDetailScreen.tsx`: render specific error from edge function — `RECORDING_NOT_FOUND` → "Enregistrement introuvable sur le PBX (chemins testés: …)"; `PBX_AUTH_FAILED` → "Identifiants FusionPBX expirés"; generic → message + retry button.

## Files
**Modified**: `ios/App/App/CapacitorSip.swift`, `src/lib/sip/nativeSipProvider.ts`, `src/components/lemtel/ActiveCallSheet.tsx`, `src/hooks/useSoftphoneNative.ts`, `src/components/lemtel/CallDetailScreen.tsx`, `supabase/functions/fusionpbx-proxy/index.ts`, `supabase/functions/ai-transcribe-call/index.ts`.

**Secrets check**: verify `FUSIONPBX_USERNAME`, `FUSIONPBX_PASSWORD`, `FUSIONPBX_BASE_URL`, `LOVABLE_API_KEY` exist; request refresh via `add_secret` only if health-check fails.

## Out of scope
Planiprêt mobile, route changes, Lemtel SIP signaling/audio path.
