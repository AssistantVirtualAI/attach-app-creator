# Customer Portal v3.0.0 — Admin & End-User Dashboard

A complete RingCentral/Webex-class management surface for the Lemtel organization, layered on the existing `pbx_*` schema and `fusionpbx-proxy` edge function. Split into 7 sequential phases so each can be reviewed before the next ships.

## Phase 1 — Foundations & Routing

- New route trees in `src/App.tsx`:
  - `/org/lemtel/admin/*` (guarded by `is_lemtel_admin`)
  - `/org/lemtel/my/*` (any authenticated Lemtel member)
- Two new layouts: `AdminPortalLayout`, `UserPortalLayout` with dedicated sidebars (per spec).
- Update `sidebarConfig.ts` with the two sidebar trees.
- Shared header strip: org name, FusionPBX sync status pill (`🟢/🟡/🔴`), `[Sync Now]` button bound to new `useSyncStatus` hook.

## Phase 2 — Real-time Sync Engine

- Edge function `realtime-sync` with actions: `extensions`, `devices`, `dids`, `ivr`, `queues`, `ring-groups`, `cdrs`, `recordings`, `voicemails`. Each calls `fusionpbx-proxy` and upserts into the matching `pbx_*` table.
- Edge function `fusionpbx-webhook` to ingest push events (extension/call/voicemail/device).
- New table `pbx_sync_jobs` (kind, status, started_at, finished_at, error, stats jsonb) with RLS scoped to `current_user_org_ids()`.
- `pg_cron` job invoking `realtime-sync` every 5 minutes (via `supabase--insert`, not migration, since it embeds the anon key).
- Enable `supabase_realtime` publication on `pbx_extensions`, `pbx_call_records`, `pbx_call_queues`, `pbx_devices`, `pbx_voicemails`, `pbx_sync_jobs`.

## Phase 3 — Admin Dashboard & Live Activity

- `AdminDashboard.tsx` with the 6 KPI cards (calls today, active extensions, voicemails, avg duration, SLA, storage) auto-refreshing via React Query (30s) plus realtime subscription.
- `LiveActivityFeed.tsx` — scrolling event log fed from `pbx_call_records` + `pbx_voicemails` realtime channels.
- `ActiveCallsGrid.tsx` — live cards per in-progress call with monitor button (supervisor-gated via `is_cc_supervisor`).

## Phase 4 — Extensions, Devices, DIDs, Ring Groups

- `AdminExtensions.tsx`: enhanced table with presence column (joined from `user_presence`), inline actions, and 5-step `AddExtensionWizard` (basic → call → voicemail → forwarding → softphone). Wizard calls `fusionpbx-proxy` + `setup_new_user_organization`-style RPC to create portal account and dispatches welcome email via existing Resend integration.
- `AdminDevices.tsx`: provisioning UI for all brand/model lists in the spec, MAC formatter, QR code generation (`qrcode.react`), `[Provision]/[Reboot]/[Re-provision]/[Factory Reset]` actions through `fusionpbx-proxy`.
- `AdminDIDs.tsx`: DID routing editor + SMS/Fax capability toggles.
- `AdminRingGroups.tsx`: drag-and-drop member ordering (`@dnd-kit/sortable`), strategy/timeout/fail-action editors.

## Phase 5 — Recordings, Voicemail, Queues, IVR

- `AdminRecordings.tsx`: waveform player (`wavesurfer.js`), transcript + AI insights panels, bulk select with ZIP export edge function `recordings-bulk-export`, shareable link generator with TTL (signed URL).
- `AdminVoicemail.tsx`: per-extension grouped inbox, inline player, AI greeting generator wired to existing ElevenLabs connector through a new `voicemail-greeting-tts` edge function.
- `AdminQueues.tsx`: queue cards with live stats, drag agents in/out, full settings modal (timing, overflow, announcements, recording, virtual callback). Music-on-hold library manager + AI music generator using ElevenLabs Music API in `moh-generate` edge function; uploads stored in new `lemtel-moh` bucket.
- `AdminIVR.tsx`: visual builder with `@xyflow/react` (already in deps). Node palette per spec; serializer converts graph → FusionPBX dialplan XML pushed via `fusionpbx-proxy`. Test-mode simulator walks the graph client-side.

## Phase 6 — Reports, Settings, Download Center

- `AdminReports.tsx`: Recharts dashboards (volume trend, hourly heatmap, extension perf, disposition pie, SLA area), advanced CDR table with CSV/Excel/PDF export (`xlsx`, `jspdf`) and scheduled-export config stored in new `pbx_report_schedules` table reusing the existing `cc-alerts` cron pattern.
- `AdminSettings.tsx`: tabs for Organization, Phone System (codec drag-order, recording defaults, retention), Notifications, Integrations (M365/Google/HubSpot/Salesforce/Zoho placeholders with connector buttons; Telnyx + ElevenLabs status read from `fetch_secrets`).
- `DownloadCenter.tsx` (shared admin + user): pulls latest release metadata from GitHub API for desktop builds, mobile store badges, Chrome extension link, dynamic system requirements block. User variant pre-fills extension/email and generates a QR for mobile auto-config.

## Phase 7 — User Portal (`/my/*`) & Version Bump

- `MyDashboard.tsx` with personal KPI cards + status selector hooked to `upsert_user_presence`.
- `MyCalls.tsx`, `MyRecordings.tsx`, `MyVoicemail.tsx`, `MySMS.tsx` — same components as admin counterparts but filtered to current user's extension via `pbx_softphone_users.portal_user_id = auth.uid()`.
- `MySettings.tsx`: caller ID, forwarding (write-through to `fusionpbx-proxy` + `useCallForwarding`), DND with schedule, voicemail PIN/greeting, ring timeout/call-waiting, "My Devices" list from `pbx_devices`.
- Bump root `package.json` to `3.0.0`. Update `mem://index.md` Core line referencing the new portal split.

## Technical Notes

- All new tables follow the project's standard: `CREATE TABLE` → `GRANT … TO authenticated, service_role` → `ENABLE RLS` → policies scoped through `current_user_org_ids()` / `is_lemtel_admin`.
- Frontend reads only from `_safe` views where credentials could leak (per Core memory). New `pbx_devices_safe`, `pbx_dids_safe`, `pbx_ivr_safe` views added in Phase 4/5 migrations.
- Sync status pill polls `pbx_sync_jobs` order by `started_at desc limit 1` via realtime; no extra cron beyond the 5-min `realtime-sync` tick.
- No new runtime secrets needed — ElevenLabs, Telnyx, FusionPBX, Resend, Lovable AI keys all already present.
- New npm deps: `wavesurfer.js`, `qrcode.react`, `xlsx`. (`@xyflow/react`, `jspdf`, `framer-motion`, `recharts`, `@dnd-kit/sortable` already installed.)

```text
[FusionPBX] ──webhook──▶ fusionpbx-webhook ─┐
     ▲                                       ├──▶ pbx_* tables ──▶ Supabase Realtime ──▶ React Query cache ──▶ UI
     │  pg_cron 5min ─▶ realtime-sync ──────┘
     └── fusionpbx-proxy ◀── Admin/User write actions
```

Approve to start with Phase 1.