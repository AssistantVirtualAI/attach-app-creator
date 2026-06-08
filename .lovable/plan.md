
# Desktop & Mobile Softphone — Real Data, Real Calls, Real Admin

## Root causes found in code

1. **Fake admin/calls data** — `apps/ava-softphone-desktop/src/lib/avaApi.ts` has `export const MOCK = true`. Every Admin / Calls / Voicemail / Recordings view in the wide console returns canned mock data.
2. **"Edge Function returned a non-2xx" on Transcribe & Analyze** — `RecordingsList.tsx` calls `ai-transcribe-call` with only `call_record_id` + `organization_id`, but the function **requires `recording_url`** and returns 400. Also, when no `recording_url` exists on the row, the analyze step has nothing to do.
3. **Call History empty** — `pbx_call_records` is only written on outbound dial; there's no scheduled pull of FusionPBX CDR. There's a `realtime-sync` function but nothing invokes it for `kind:'cdr'/'voicemail'` on app open.
4. **SDP 488 Not Acceptable Here** — JsSIP UA in `jssipProvider.ts` calls `ua.call(target, { mediaConstraints: { audio: true } })` with no `pcConfig` / codec preference. Browser offers Opus-only with DTLS-SRTP. FusionPBX trunk expects PCMU/PCMA (or SDES). Need explicit `pcConfig` (iceServers, bundlePolicy) **and** an SDP munger that re-orders `m=audio` to advertise PCMU/PCMA/Opus and strips unsupported codecs. Without this, FusionPBX returns 488.
5. **Black screen after call** — when the session fails (488 above), `attachSession` keeps the audio element bound to a dead `RTCPeerConnection`. The renderer doesn't crash, but the `<audio>` srcObject is never cleared, and the Electron `BrowserWindow` can repaint black if the active call dock has `position:fixed` over the layout. Need to clear `audioEl.srcObject = null` in `resetCall()` and unmount the active-call dock on `ended`.
6. **Admin / chatbot can't manage the PBX from the app** — `AIPanel.tsx` and mobile `AIScreen.tsx` are stub chat panes with no tool calling. There is no edge function that lets a chat model call `fusionpbx-proxy` actions on behalf of the user.

## What I'll build

### 1. Kill fake data, wire to live backend
- Flip `MOCK = false` in `avaApi.ts`.
- Rewrite each `ava.*` helper to call the existing edge functions / `_safe` views:
  - `ava.extensions` → `fusionpbx-proxy { action:'list-extensions' }`
  - `ava.devices` → `fusionpbx-proxy { action:'list-devices' }`
  - `ava.phoneNumbers` → `fusionpbx-proxy { action:'list-numbers' }`
  - `ava.queues` / `ava.ringGroups` / `ava.ivrs` → matching `list-*` actions
  - `ava.syncStatus` → `realtime-sync { action:'status' }`
  - `ava.calls` → `pbx_call_records` for current org (paginated)
- Every list view gets: loading state, empty state, error toast, manual Refresh, and post-write `realtime-sync`.
- `HomeDashboard` reads counters from `mobile-dashboard` (already exists) instead of placeholders.

### 2. Fix "Transcribe & Analyze" edge function flow
- `ai-transcribe-call/index.ts`: stop requiring `recording_url` in the body. Look it up server-side from `pbx_call_records.recording_url` for the given `call_record_id`. Return a clear `{ error: 'NO_RECORDING_YET', retry_after:'…' }` 200 when the row has no URL (so the UI can show "Recording not yet available — try again later" instead of a generic toast).
- Update `RecordingsList.tsx` to handle that explicit response and to call the new `ai-pipeline` function below.
- New `ai-pipeline` edge function: orchestrates transcribe → analyze in one call so the client makes a single POST. Uses `EdgeRuntime.waitUntil` and writes a job row to `pbx_ai_jobs` (existing or new). Client polls `pbx_ai_jobs.status` (no second function call needed; PostgREST + realtime).

### 3. Sync FusionPBX CDR + voicemail on app open
- On wide-console mount, invoke `realtime-sync { kind:'cdr', organization_id }` once + every 60s.
- Same for `kind:'voicemail'` and `kind:'recordings'`.
- Show last-sync timestamp + spinner in `CallsView`, `VoicemailView`, `RecordingsView`.

### 4. Fix SDP 488 and black-screen-after-call
In `apps/ava-softphone-desktop/src/lib/sip/jssipProvider.ts`:
- Pass `pcConfig` to `JsSIP.UA`:
  ```ts
  pcConfig: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    rtcpMuxPolicy: 'require',
    bundlePolicy: 'max-bundle',
  }
  ```
- Add SDP munging on `peerconnection`'s `createOffer` to:
  - reorder `m=audio` codecs as `PCMU PCMA OPUS telephone-event`
  - drop video m-lines
  - keep `a=rtcp-mux` + `UDP/TLS/RTP/SAVPF`
- Apply same change in the mobile JsSIP provider (`apps/ava-softphone-mobile/src/lib/sip/jssipProvider.ts`).
- In `resetCall()`: `if (this.audioEl) this.audioEl.srcObject = null;` and clear `ActiveCallDock` via callBus event `call:ended`. Verify `IncomingCallToast` and `ActiveCallDock` unmount on `callState === 'ended'`.

### 5. Chatbot that actually controls the phone system
- New edge function `pbx-chat-agent`:
  - Uses Lovable AI Gateway (`google/gemini-2.5-flash`) with tool calling.
  - Tools wrap a whitelist of `fusionpbx-proxy` actions: `list-extensions`, `create-extension`, `list-devices`, `create-device`, `list-queues`, `add-queue-agent`, `queue-pause`, `list-numbers`, `route-number`, `start-call`, `transfer-call`, `read-voicemail-summary`, `read-recording-summary`.
  - Auth: verifies the caller's JWT and elevates only to actions allowed by their `user_roles.role` (super_admin / org_admin / agent).
  - Streams responses via `toUIMessageStreamResponse`.
- Desktop `AIPanel.tsx` (wide) + `AIWorkspace.tsx` + mobile `AIScreen.tsx`: replace the stub with the AI SDK `useChat` transport pointed at `pbx-chat-agent`. Render `message.parts` with markdown. Show executed tool calls inline ("✓ Created extension 305", "✓ Paused queue agent").
- Conversation persistence in `pbx_ai_conversations` (one row per thread) with realtime so admin and mobile see the same history.

### 6. Mobile parity (narrow softphone surface)
- Reuse the same SIP fix above (mobile already shares `useSoftphone`).
- `CallsScreen`, `VoicemailScreen`, `RecentsScreen`, `MessagesScreen` already call `mobileApi.*`; ensure those endpoints return real rows (they do — they hit `pbx_call_records` and `pbx_voicemails`). Add the same 60s `realtime-sync` ping in `MobileApp.tsx`'s foreground handler.
- `SettingsScreen` already toggles DND / forwarding via `mobile-settings-*` — verified working; no change.

### 7. Verification
- Build the renderer; load the desktop app at narrow width → confirm phone tab, history, voicemail, recordings, SMS all show live rows.
- Expand to wide → confirm Admin tables show real extensions/devices/queues, chatbot can create an extension end-to-end.
- Place a real call → confirm SDP offer includes `PCMU PCMA opus` and the call connects (no 488).
- Click "Transcribe & Analyze" on a recording → confirm job row appears, transcript and insights land in `pbx_call_transcripts` / `pbx_ai_insights`.

## Files I will touch

Frontend (desktop):
- `apps/ava-softphone-desktop/src/lib/avaApi.ts` (kill MOCK, wire to backend)
- `apps/ava-softphone-desktop/src/lib/sip/jssipProvider.ts` (pcConfig, SDP munger, resetCall fix)
- `apps/ava-softphone-desktop/src/components/console/AdminView.tsx` (real data + actions)
- `apps/ava-softphone-desktop/src/components/console/HomeDashboard.tsx` (real KPIs)
- `apps/ava-softphone-desktop/src/components/console/AIPanel.tsx` + `AIWorkspace.tsx` (useChat → `pbx-chat-agent`)
- `apps/ava-softphone-desktop/src/components/console/CallsView.tsx`, `VoicemailView.tsx`, `RecordingsView.tsx` (sync ping + empty/error states)
- `apps/ava-softphone-desktop/src/components/RecordingsList.tsx` (use `ai-pipeline`, handle NO_RECORDING_YET)
- `apps/ava-softphone-desktop/src/components/console/ConsoleLayout.tsx` (mount cdr/voicemail sync interval)

Frontend (mobile):
- `apps/ava-softphone-mobile/src/lib/sip/jssipProvider.ts` (same SDP fix)
- `apps/ava-softphone-mobile/src/screens/AIScreen.tsx` (useChat → `pbx-chat-agent`)
- `apps/ava-softphone-mobile/src/MobileApp.tsx` (60s foreground sync)

Edge functions:
- `supabase/functions/ai-transcribe-call/index.ts` (lookup recording_url, NO_RECORDING_YET response)
- **New** `supabase/functions/ai-pipeline/index.ts` (orchestrate transcribe→analyze with `EdgeRuntime.waitUntil` + `pbx_ai_jobs`)
- **New** `supabase/functions/pbx-chat-agent/index.ts` (Lovable AI Gateway + tool calling → fusionpbx-proxy)
- `supabase/functions/realtime-sync/index.ts` (ensure `kind:'cdr' | 'voicemail' | 'recordings'` paths exist; add if missing)

DB (single migration):
- `pbx_ai_jobs` table (id, organization_id, call_record_id, status, result jsonb, error text, created_at) with GRANTs + RLS scoped to org members.
- `pbx_ai_conversations` table (id, organization_id, user_id, messages jsonb, updated_at) with GRANTs + RLS.

## Out of scope
- Landing page / download page changes.
- Native iOS/Android build / signing.
- Replacing JsSIP with another stack.

## Open questions
1. **Codec policy** — confirm FusionPBX trunk's allowed codecs. I'll default to ordering **PCMU, PCMA, opus, telephone-event**. If your trunk is opus-only, the SDP munger will need a different order.
2. **Chatbot scope** — should the chatbot be allowed to *delete* extensions/queues/numbers, or read+create+update only? Default I'll implement: **read + create + update**, no destructive actions.
