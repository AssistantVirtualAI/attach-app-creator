## Plan: Fix dialer freeze, SIP 403 loop, and transcription/AI

### 1. Desktop SIP 403 keep-alive loop — circuit breaker
File: `apps/ava-softphone-desktop/src/lib/sip/jssipProvider.ts`

- Add `authBlocked: { code: 401|403|407; reason: string; since: number } | null` flag.
- In `registrationFailed` handler: when `status_code` is 401 / 403 / 407, set `authBlocked`, stop `keepAliveTimer`, do NOT call `ua.register()` from the `unregistered` handler.
- In `kickReconnect` and `startKeepAlive`: short-circuit while `authBlocked` is set — log once, do not call `register()`/`start()`. (Keeps WebSocket alive but stops the credential-failure storm.)
- Clear `authBlocked` only on:
  - explicit `restart()` (manual user action), or
  - a successful `softphone-sync-password` invocation that bumps `config.password` (detected by `sameConfig` returning false → fresh `init`).
- Add a user-visible banner in `SoftphonePane.tsx` when `snap.authBlocked`: text + button "Refresh SIP credentials" that calls `softphone-sync-password` (force_local_to_pbx) then `sipProvider.restart()`.
- Mirror the same `authBlocked` short-circuit in `src/lib/softphone/jssipProvider.ts` (web softphone) so the bug can't reappear in the web app.

### 2. Wide-page dialer freeze on Answer
File: `apps/ava-softphone-desktop/src/components/SoftphonePane.tsx`

- Symptom matches the existing wide-mode comment on `handleCall` (line ~269): wide-mode side panels re-render synchronously with the JsSIP session and freeze the UI.
- Apply the same defer pattern to Answer:
  - Wrap `sp.answer()` call sites (IncomingCall `onAnswer={sp.answer}` at line 539 and the keyboard `Enter` handler at line 168) into a small `deferredAnswer()` helper that does `setTimeout(() => sp.answer(), 0)` after toggling a local `answering` busy flag.
  - Disable Answer button while `answering` so double-clicks can't double-attach the session.
- In `jssipProvider.attachSession`: ensure `setSinkId` / track attachment is wrapped in `queueMicrotask` and any heavy snapshot updates batched (single `update()` call, not three).
- Also normalize the same pattern in the web `SoftphoneWidget.tsx` Answer button so the freeze doesn't recur on the web preview.

### 3. Transcription "Bucket not found" + AI `anthropic_404`
Files: `supabase/functions/ai-transcribe-call/index.ts`, `supabase/functions/ai-analyze-call/index.ts`

- **Anthropic 404**: model id `claude-sonnet-4-20250514` is invalid → 404. Remove the Anthropic branch from `ai-analyze-call` and always use the Lovable AI Gateway (`google/gemini-2.5-flash` or `google/gemini-2.5-pro` for long transcripts). Drop `ANTHROPIC_API_KEY` lookups so a stale secret can't reintroduce the bad model id. Audit-log entry stays, but `provider="lovable-ai"`.
- **Storage bucket not found**:
  - Resolve the correct recordings bucket up front: query `storage.buckets` for `pbx-recordings` (then fallbacks `recordings`, `call-recordings`). Cache result for the request.
  - If the parsed bucket from `recording_path` doesn't exist, skip Step 2 cleanly (no `storage:Bucket not found` error in `fetchErrors`) and jump straight to fusionpbx-proxy `get-recording`.
  - When `recording_path` is missing or points to a non-existent bucket AND the fusionpbx-proxy returns no audio, return a typed reason `recording-not-synced` (instead of generic `no-audio`) so the UI shows "Recording not yet synced from PBX — try again in a few minutes" instead of a scary `storage:Bucket not found`.
- **UI side** (`src/components/portal/RecordingWavePlayer.tsx` or the AI panel that displays the transcription status): when reason === `recording-not-synced`, replace "fetch errors: storage:Bucket not found" with the friendly message + a "Retry sync" button that calls `fusionpbx-proxy` `sync-all` for recordings on the current domain.

### 4. Safeguards
- Add `provider_credentials_audit` entry on every 401/403/407 SIP failure (one per minute max) so we can trace future credential drift.
- Add a unit test under `apps/ava-softphone-desktop/src/lib/__tests__/` that simulates a `registrationFailed` with status 403 and asserts `keepAliveTimer` stops and `kickReconnect` becomes a no-op until `restart()`.

### Files
- Edit: `apps/ava-softphone-desktop/src/lib/sip/jssipProvider.ts`, `apps/ava-softphone-desktop/src/components/SoftphonePane.tsx`, `src/lib/softphone/jssipProvider.ts`, `src/components/softphone/SoftphoneWidget.tsx`, `supabase/functions/ai-transcribe-call/index.ts`, `supabase/functions/ai-analyze-call/index.ts`.
- Possibly edit the recording/transcription panel component that renders "fetch errors: …".
- New: `apps/ava-softphone-desktop/src/lib/__tests__/sip.authBlocked.test.ts`.

### Out of scope
- Backfilling `recording_path` rows that were stored with a wrong bucket name (separate data migration if needed after this lands).
- Reworking PBX → storage recording upload pipeline.