## Goal
1. Show every FusionPBX SIP gateway live (web + desktop) with create/edit/restart.
2. Provision an ElevenLabs SIP-trunk phone number that routes through a FusionPBX gateway, and bind it to a voice agent (auto + manual override).
3. Route all ElevenLabs server-side calls through the Lovable Connector Gateway.

---

## Phase 1 — FusionPBX gateways: live read + write

**Backend (`supabase/functions/fusionpbx-proxy/index.ts`)**
- Verify `list-gateways` now returns rows (permission was enabled server-side). Drop the cached-fallback noise message in `LemtelGateways.tsx` once live data flows.
- Add/finish actions: `create-gateway`, `update-gateway`, `delete-gateway`, `restart-gateway`, `start-gateway`, `stop-gateway` (all hit `/app/gateways/gateway_edit.php` or `fs_cli` REST equivalents already used for other PBX objects).
- On every write, mirror the row into `pbx_gateways` so the desktop reads stay instant.

**Web (`src/pages/lemtel/LemtelGateways.tsx`)**
- Replace placeholder banner with a real "Add gateway" drawer (name, proxy, realm, username, password, register on/off, profile, context, expire_seconds, retry_seconds, caller-id-in-from).
- Row actions: Edit, Start, Stop, Restart, Delete.
- Realtime subscribe to `pbx_gateways` so changes from desktop appear instantly.

**Desktop (`apps/ava-softphone-desktop/src/components/console/admin/PbxResourceSection.tsx`)**
- Wire the existing Gateways section to the same proxy actions; reuse the new drawer component (extract to `src/components/pbx/GatewayDrawer.tsx` for sharing).

---

## Phase 2 — ElevenLabs SIP trunk → FusionPBX

**Database migration** (single migration, with GRANTs + RLS)
- New table `voice_agent_gateway_routes` — columns: `organization_id`, `agent_id` (FK `agents.id`), `elevenlabs_phone_id`, `pbx_gateway_uuid` (FK `pbx_gateways.pbx_uuid`), `did_e164`, `direction` (`inbound`/`outbound`/`both`), `auto_bound` (bool), `manual_override` (bool), timestamps.
- Unique on `(organization_id, did_e164)`.
- Policies: org members read; org_admin/super_admin write.

**Backend — extend `supabase/functions/elevenlabs-phone-numbers/index.ts`**
- Add action `create_sip_trunk_via_pbx`:
  1. Read selected `pbx_gateway_uuid` from `pbx_gateways`; build SIP URI (`sip:<proxy>;transport=udp`), pull register username/password from gateway record (decrypt with `PBX_ENCRYPTION_KEY`).
  2. POST `/v1/convai/phone-numbers/sip-trunk` to ElevenLabs with that URI + creds + label + agent_id.
  3. Insert row into `voice_agent_gateway_routes` (auto_bound=true).
- Add action `bind_agent` to update `voice_agent_gateway_routes.agent_id` + flip `manual_override=true` and call ElevenLabs `assign_agent`.

**Auto-binding rule** (server-side in same function)
- When a new ElevenLabs phone number is provisioned and `voice_agent_gateway_routes` has no row, look up `pbx_phone_number_assignments` for the DID; if found, auto-bind the agent attached to that assignment.

**Frontend**
- New page `src/pages/lemtel/LemtelVoiceGateways.tsx` (linked in admin nav and desktop admin):
  - Card per ElevenLabs SIP trunk: shows DID, bound FusionPBX gateway, current agent, auto/manual badge.
  - "Create SIP trunk from gateway" CTA → drawer with gateway dropdown (from `pbx_gateways`), DID, agent dropdown (from `agents`), direction.
  - Per-row "Override agent" select that calls `bind_agent`.
- Desktop section "Voice Gateways" added to `PbxResourceSection.tsx`.

---

## Phase 3 — Lovable Connector Gateway for ElevenLabs

**Goal**: stop using `xi-api-key` directly; route through `https://connector-gateway.lovable.dev/elevenlabs/...` so OAuth/key rotation is automatic.

**Steps**
1. Verify ElevenLabs connection is linked via `standard_connectors--list_connections`; if not, call `standard_connectors--connect` with `connector_id: "elevenlabs"`.
2. Create shared helper `supabase/functions/_shared/elevenlabsGateway.ts` exporting `elevenlabsFetch(path, init)` that:
   - Reads `LOVABLE_API_KEY` + `ELEVENLABS_API_KEY` from env.
   - Calls `https://connector-gateway.lovable.dev/elevenlabs/${path}` with `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${ELEVENLABS_API_KEY}`.
   - Falls back to direct `api.elevenlabs.io` only if gateway returns `connector_no_gateway` (defensive).
3. Refactor every `fetch("https://api.elevenlabs.io/...")` in:
   - `elevenlabs-phone-numbers`
   - `elevenlabs-convai-agent-config`
   - `elevenlabs-convai-conversations`
   - `elevenlabs-convai-knowledge-base`
   - `elevenlabs-convai-analytics`
   - `elevenlabs-all-agents-analytics`
   - `elevenlabs-all-agents-conversations`
   - `elevenlabs-signed-url`
   - `elevenlabs-generate-greeting`
   - `elevenlabs-api-proxy`
   - `sync-elevenlabs-conversations`
   to use `elevenlabsFetch`.
4. Keep `ELEVENLABS_API_KEY` secret in place; it is now the gateway's `X-Connection-Api-Key`.

---

## Phase 4 — Verification

- Curl `fusionpbx-proxy { action: "list-gateways" }` → expect ≥1 row.
- Curl `elevenlabs-phone-numbers { action: "list" }` through new gateway helper → 200.
- Create a test SIP trunk in `LemtelVoiceGateways` and place a test call from desktop softphone; confirm CDR lands and `voice_agent_gateway_routes` row created.
- Confirm Realtime updates the web Gateways list when desktop restarts a gateway.

---

## Out of scope
- New billing tiers / plan gating for SIP trunks.
- Migrating Vapi/Retell to the connector gateway (only ElevenLabs requested).
- Landing page changes.

## Risks
- ElevenLabs SIP-trunk endpoint requires the agent be already created — handled by requiring agent selection in the drawer.
- FusionPBX gateway passwords are encrypted at rest with `PBX_ENCRYPTION_KEY`; the create-SIP-trunk path must decrypt server-side only.
