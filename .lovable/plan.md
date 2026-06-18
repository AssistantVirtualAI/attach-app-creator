## Phase 4 — Customer Phone System Management (FusionPBX Parity)

Goal: scope existing IVR / Ring Group / Queue / DID pages per-customer-domain, add greeting upload + TTS + test-call to IVR, add a porting workflow + per-number CID, and lock the customer portal to a single domain while letting admins switch domains.

The underlying `fusionpbx-proxy` already supports every CRUD action we need (`create/update/delete-ivr[-option]`, `create/update/delete-queue`, `add/remove-queue-tier`, `create/update/delete-ring-group`, `create/update/delete-destination`, `sync-*`, etc.). The work is mostly UI scoping + a few new actions/tables.

### 1. Domain context (foundation)

Add `useActiveDomain()` hook reading `sessionStorage['lemtel.activeDomain']` (already populated by `CustomerPortalGate` and `CustomerDetail.impersonate`). It returns `{ uuid, name, org_id, isAdmin }`. For super-admin we also expose a `<DomainSwitcher />` dropdown (lists `pbx_domains` via `fusionpbx-proxy list-domains`) that updates sessionStorage and refreshes the page.

Refactor `LemtelIVR`, `LemtelQueues`, `TelephonyRingGroups`, `LemtelDIDs` to use `org_id` and `domain_uuid` from the hook (replacing hard-coded `LEMTEL_ORG`). All `fusionpbx-proxy` calls add `domain_uuid` in `params`. Tanstack-query keys gain the `domainUuid` segment so switching domains refetches.

### 2. IVR per customer (`LemtelIVR.tsx`)

Already has create / edit / delete / option routing. Add:

- **Greeting upload**: file picker → upload to `lemtel-ivr-audio` storage bucket (new) → call `fusionpbx-proxy upload-recording` (already exists) → set `ivr_menu_greet_long` to the recording filename.
- **Text-to-speech**: textbox + voice picker → new `fusionpbx-proxy` action `generate-ivr-tts` that calls Lovable AI Gateway TTS (or ElevenLabs if connected) → uploads the resulting WAV through the same recording path.
- **Test IVR**: button → calls new `fusionpbx-proxy` action `test-ivr` which originates a call from the user's extension to the IVR menu via FusionPBX `originate` API.
- Option destination dropdown extended with `extension | ring_group | voicemail | ivr | external` choices (mapping to FusionPBX dial strings already supported in `ivr_menu_option_action`).

### 3. Ring Groups per customer (`TelephonyRingGroups.tsx`)

- Strip `LEMTEL_ORG`, use active domain.
- Add members editor: extension picker + per-row timeout + ordering for `sequential`.
- "No-answer destination" dropdown (extension / voicemail / IVR / external).
- Live status panel reading `pbx_queue_agent_state` + `telecom_live_calls` filtered by `ring_group_uuid`.

### 4. Call Queues per customer (`LemtelQueues.tsx`)

- Already has create / update / delete + tier (agent) management. Scope to active domain.
- Add hold-music dropdown (already partly there) + max-wait + callback fields → already mapped to `queue_*` columns; expose them in the form.
- Live stats card (already uses `cc_queue_stats`) scoped to the domain.
- Supervisor barge: new "Listen / Whisper / Barge" buttons on each active call, calling existing `fusionpbx-proxy eavesdrop-call` with mode (`eavesdrop|w|b`).

### 5. Phone numbers + porting (`LemtelDIDs.tsx`)

- Domain-scoped DID list (already in `lemtel_dids`, add filter by `organization_id`).
- Inline per-row "Assign to" dropdown → `extension | ivr | ring_group | queue | voicemail` updating `assigned_type/assigned_id` + calling `create/update-destination` with the right action string.
- "Outbound caller ID" field per DID stored on `lemtel_dids.outbound_cid_name/_number`.
- **New porting workflow**:
  - DB migration: `public.number_porting_requests` (organization_id, current_carrier, account_number, pin, numbers text[], service_address jsonb, status enum `submitted|in_review|approved|rejected|completed`, notes, attachments jsonb). RLS: members read own org, super_admin read all, service_role all. Grants as required.
  - "Request porting" dialog in DIDs page with the form.
  - Admin queue page (`/org/lemtel/admin/porting`) listing requests with status transitions.

### 6. Customer admin access

- `CustomerPortalGate` already sets the active domain in sessionStorage and routes to `/console`. Add a `useEffect` guard on all console pages that redirects to `/auth` if no `activeDomain` and the user has no super-admin role.
- Add `DomainSwitcher` in the admin header (only visible when `has_role(super_admin)`). For tenant users the switcher is hidden; their domain comes from their org membership.
- All queries (`pbx_extensions`, `pbx_call_records`, recordings, IVRs, queues, ring groups, DIDs) already filter by `organization_id`; existing RLS policies enforce this. We just route through the active org_id from the hook.

### 7. Files touched

- New: `src/hooks/useActiveDomain.ts`, `src/components/lemtel/DomainSwitcher.tsx`, `src/pages/lemtel/admin/PortingQueue.tsx`, one migration for `number_porting_requests` + `lemtel-ivr-audio` bucket.
- Edited: `LemtelIVR.tsx`, `LemtelQueues.tsx`, `TelephonyRingGroups.tsx`, `LemtelDIDs.tsx`, `CustomerDetail.tsx` (link the four pages to the current domain), `fusionpbx-proxy/index.ts` (`generate-ivr-tts`, `test-ivr`).
- Not touched: `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**`.

### Technical notes

- `fusionpbx-proxy` originate/eavesdrop use FusionPBX's `event_socket` already wrapped in the function.
- TTS: prefer Lovable AI Gateway (`google/gemini-2.5-flash-tts` style endpoint) so no extra secret needed; fall back to ElevenLabs if `ELEVENLABS_API_KEY` is set.
- Storage bucket `lemtel-ivr-audio` private + RLS by `organization_id` prefix; signed URLs for playback.
- Porting attachments stored in `lemtel-porting-docs` bucket (private).
