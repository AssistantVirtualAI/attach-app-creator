## Goal

Make the desktop app a true admin console for the FusionPBX system: pull every PBX domain as a "Customer", play recordings reliably, and surface the full Extensions / Call Queues / IVR (with ElevenLabs) / Voice Agents management UIs.

## 1. Customers (PBX domains) page

- Add `get-domains` (and ensure `list-domains` returns full payload: `domain_uuid`, `domain_name`, `domain_description`, `domain_enabled`) in `supabase/functions/fusionpbx-proxy/index.ts`.
- Add desktop sidebar entry `customers` in `LeftRail.tsx` (ADMIN_ITEMS only).
- New `CustomersView.tsx` (`apps/ava-softphone-desktop/src/components/console/`):
  - Calls `fusionpbx-proxy` → `list-domains`, joins each domain with local `organizations` (by `pbx_domain_uuid`), and the count of extensions / numbers / queues per domain (from `pbx_extensions`, `pbx_phone_number_assignments`, `pbx_call_queues`).
  - Columns: Domain, Customer name (org link), Status, Extensions, Numbers, Last activity, Actions (Sync, Open).
  - "Open" sets the working domain in a small context (`useActiveDomain`) so Admin tabs filter by that domain instead of the hard-coded `LEMTEL_DOMAIN`.
- Wire `App.tsx` route case for `'customers'`.

## 2. Recording playback (works in desktop)

Root cause: `getRecordingAudioUrl` fetches the file via `fusionpbx-proxy` `get-recording`, which returns the binary stream. That works in browsers but Electron's `fetch` + the proxy currently returns a non-CORS-friendly stream with no `Content-Length` and sometimes a 401 because the proxy strips auth on streaming responses. The `<audio>` element then can't play the resulting blob URL.

Fix:
- In `fusionpbx-proxy/index.ts` `get-recording` branch:
  - Buffer the response (`await r.arrayBuffer()`), forward `Content-Length`, `Accept-Ranges: bytes`, and proper `Content-Type` (`audio/wav`, `audio/mpeg`, `audio/ogg` based on extension).
  - Return 404 JSON when PBX gives 404 instead of streaming empty body.
- Add an alternative path: if `record_path`/`record_name` missing, try `xml_cdr_uuid` → fetch `xml_cdr/{uuid}/recording` from FusionPBX.
- In `avaApi.getRecordingAudioUrl`:
  - Convert returned blob to an object URL with explicit MIME (`new Blob([buf], { type })`).
  - Revoke previous URL on new selection (already partially done in `RecordingsView`).
  - Fallback: if blob is empty or fetch fails, call a new `pbx-recording-signed-url` helper that uploads the blob to the `lemtel-recordings` Storage bucket and returns a signed URL (works in any audio element, including the small softphone window).
- Persist `recording_url` back to `pbx_call_records` after first successful fetch so subsequent plays are instant.

## 3. Full PBX management — make every feature usable

Extensions / Queues / IVRs already exist but lack key actions. Add the missing CRUD and bind them to the active domain (from §1) instead of the hard-coded one.

### Extensions
- "+ New" button → modal posting `create-extension` to fusionpbx-proxy (already implemented backend-side).
- Add Delete, Reset password (`extension_password`), Assign to portal user (uses existing `admin_link_softphone_by_email` RPC).
- Show registration state from `pbx_softphone_users.status` + last seen.

### Call Queues
- "+ New" creates queue + auto-create matching extension.
- Edit modal: add agents table with add/remove (already loads agents). New `add-queue-agent` / `remove-queue-agent` actions in proxy (POST `call_center_tiers`).
- Show real-time SLA / waiting from `cc_queue_stats` like in web portal.

### IVRs + ElevenLabs
- Edit modal: add "Options" tab listing `pbx_ivr_options` (digit → action). CRUD via `update-ivr-option` / `delete-ivr-option`.
- "Generate with ElevenLabs" button next to Greeting:
  - Calls existing `elevenlabs-generate-greeting` edge function (voice picker pulled from `elevenlabs-api-proxy` → `list-voices`).
  - Uploads MP3 to `lemtel-ivr-audio` bucket, then PUTs `ivr_menu_greet_long` = `recording::<filename>` on FusionPBX.
- "Test playback" plays the generated audio inside the modal.

### Voice Agents (new desktop page)
- Add `voice-agents` admin entry in `LeftRail.tsx`.
- New `VoiceAgentsView.tsx`:
  - Reads `lemtel_voice_agents` + `voice_agent_bindings` (already populated).
  - Lists ElevenLabs agents (via `elevenlabs-convai-agent-config` proxy) and shows binding (`extension`, `did`, `ivr_option`).
  - Bind/Unbind UI writes to `voice_agent_bindings` and the matching FusionPBX dialplan via `pbx-write` edge function.
  - Status pills: voice, language, model, last call timestamp from `pbx_call_records.raw_data->agent_id`.

## Technical notes

- All edge-function changes stay in `fusionpbx-proxy` and `elevenlabs-*` proxies — no new edge functions needed.
- All DB reads go through existing tables (`pbx_extensions`, `pbx_call_queues`, `pbx_ivrs`, `pbx_ivr_options`, `lemtel_voice_agents`, `voice_agent_bindings`, `organizations`) — no migration required.
- Domain switching is local state (no schema change). When user opens a Customer, AdminView replaces `LEMTEL_DOMAIN` constant with the active domain id.
- Recording fix is backwards compatible — old rows with `recording_url` keep working; new rows get cached URLs after first play.

## Files

- New: `apps/ava-softphone-desktop/src/components/console/CustomersView.tsx`, `VoiceAgentsView.tsx`, `hooks/useActiveDomain.ts`.
- Edited: `LeftRail.tsx`, `App.tsx` (routing), `AdminView.tsx` (use active domain + new CRUD), `lib/avaApi.ts` (recording url improvements + domains list).
- Edited edge: `supabase/functions/fusionpbx-proxy/index.ts` (recording stream fix, get-domains, queue-agent CRUD, ivr-option CRUD).
