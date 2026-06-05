
# Lemtel Telecom Module — Integration Plan

Adds a new module to the existing AVA Statistic portal without rebuilding anything. All routes, sidebar entries, tables, and edge functions are scoped to the Lemtel organization only.

## Scoping rule (applies everywhere)
- A single org gate: `useLemtelAccess()` hook checks `selectedOrg.slug === 'lemtel'` (or matches a `LEMTEL_ORG_ID` constant resolved at runtime from `organizations` table).
- Sidebar group, routes, and edge function calls all short-circuit if the user is not in the Lemtel org (or `super_admin`).
- All Lemtel tables include `organization_id` defaulting to the Lemtel org id, with RLS policies that require membership in that org.

## Phase 1 — Foundation (this build)

### 1. Database migration
Create tables (all with `organization_id uuid NOT NULL` + RLS scoped to Lemtel org members via `has_role`/`organization_members`):
- `lemtel_config` (key/value, admin-only write)
- `lemtel_customers`
- `lemtel_dids`
- `lemtel_cdrs_cache`
- `lemtel_transcriptions`
- `lemtel_voice_agents`
- `lemtel_sms_threads`
- `lemtel_softphone_users` (sip_password stored encrypted via pgsodium / never read client-side)
- `lemtel_ivr_audio`

Each: GRANTs for `authenticated` + `service_role`, RLS enabled, policies restricted to Lemtel org members. Sensitive columns (`sip_password`, all `lemtel_config.value` for keys, recording URLs) readable only by `service_role` via `_safe` views for client.

Storage buckets (private): `lemtel-ivr-audio`, `lemtel-recordings`.

Enable Realtime on `lemtel_sms_threads`, `lemtel_cdrs_cache`, `lemtel_softphone_users`.

### 2. Secrets
Add via secrets tool: `FUSIONPBX_URL`, `FUSIONPBX_USERNAME`, `FUSIONPBX_API_KEY`, `FUSIONPBX_WSS_URL`, `FUSIONPBX_DOMAIN`, `TELNYX_API_KEY`, `TELNYX_MESSAGING_PROFILE_ID`, `TELNYX_WEBHOOK_PUBLIC_KEY`, `ANTHROPIC_API_KEY`. ElevenLabs key already present.

### 3. Edge functions (stubs that work with mock mode)
- `fusionpbx-proxy` — JWT-verified, validates Lemtel membership, forwards `{endpoint, method, body}` to FusionPBX with API key as query params.
- `telnyx-sms` — POST send / GET history; logs to `lemtel_sms_threads`.
- `telnyx-webhook` (public, signature-verified) — upserts inbound SMS, broadcasts `lemtel-sms-inbox`.
- `ai-call-analysis` — Claude `claude-sonnet-4-20250514` transcript + JSON analysis → `lemtel_transcriptions`.
- `ivr-script-generator` — Claude script → ElevenLabs TTS → upload to `lemtel-ivr-audio` bucket.

### 4. Frontend skeleton
- New sidebar group `lemtel` added to `src/components/sidebar/sidebarConfig.ts`, conditionally rendered (new `lemtelOnly: true` flag handled in `AppLayout.tsx`).
- Admin items vs portal items split by role (`org_admin`/`super_admin` vs Lemtel customer portal user).
- Routes added to `App.tsx` under `/lemtel/*` and `/lemtel/portal/*` with a `<LemtelGuard>` wrapper.
- All admin and portal pages created as routed shells with titles + loading/empty states.

### 5. Phase 1 functional pages
- `/lemtel/settings` — full credential editor, test buttons per service, Mock Data toggle (stored in `lemtel_config`).
- `/lemtel/dashboard` — status banner, 4 stat cards, recent calls + SMS preview, agent perf chart (mock-first).
- `/lemtel/portal/calls` — CDR table with audio player, "Analyze" action calling `ai-call-analysis`.
- `/lemtel/messages` — 3-panel SMS UI wired to `telnyx-sms` + Realtime.
- Softphone widget v1: minimized button + DIAL tab, JsSIP registration to WSS, status dot.

### 6. Mock Data mode
Single `useMockMode()` hook reading `lemtel_config.mock_mode`. All hooks (`useLemtelCustomers`, `useLemtelCdrs`, etc.) return canned datasets when ON.

## Phase 2 (after Phase 1 sign-off)
Full softphone (all 4 tabs, hold/transfer/conference/DTMF), all customer portal pages, IVR visual builder + AI generation UI, voice agent analytics, BLF presence polling, PDF export, FR/EN i18n strings for the new module.

## Technical notes
- JsSIP loaded via CDN in `index.html`, typed via ambient `declare global` shim.
- Audio playback via `<audio>` + `setSinkId`; ringtone as base64 data URI.
- Telnyx webhook signature verified with Ed25519 public key.
- Claude calls use Anthropic REST API directly from edge functions (no SDK needed).
- Recharts already present for dashboard chart.
- Wavesurfer.js added via `bun add wavesurfer.js` in Phase 2 recordings page.

## Out of scope
- No changes to existing non-Lemtel pages, hooks, or org logic.
- No multi-org rollout of this module — Lemtel-only.

Reply "go" (or pick a Phase 1 subset to start with) and I'll implement.
