# Customer Portal v3.0.0 — Phases 3-7

Continuing the approved v3.0.0 plan. Phases 1-2 (foundations, layouts, sync engine, dashboards, cron) already shipped. Below is the work remaining, grouped so each phase is independently reviewable.

## Phase 3 — Admin Dashboard polish & Live Activity

- `ActiveCallsGrid.tsx` — live in-progress call cards driven by `pbx_call_records` realtime where `end_at IS NULL`; supervisor-only `[Monitor]` button gated by `is_cc_supervisor`.
- Storage gauge wired to a new `storage-usage` edge function that sums `lemtel-recordings` + `voicemail-audio` bucket sizes for the org.
- Yesterday-vs-today delta on Calls Today KPI, plus week-over-week deltas for Avg Duration and SLA.

## Phase 4 — Extensions, Devices, DIDs, Ring Groups

- `AddExtensionWizard.tsx` (5 steps: basic → call → voicemail → forwarding → softphone) called from `AdminExtensions` toolbar. Submits through `fusionpbx-proxy` `create-extension` then provisions a portal account via a new `provision-portal-user` edge function and triggers the existing Resend welcome email template.
- Replace `AdminDevices` with full device manager: brand/model taxonomy file `src/data/pbxDeviceModels.ts` covering Poly, Yealink, Grandstream, Cisco, Snom, Fanvil, Aastra/Mitel, AudioCodes, Htek, Escene. MAC formatter, `qrcode.react` provisioning QR, `[Reboot]/[Re-provision]/[Factory Reset]` buttons hitting `fusionpbx-proxy`.
- `AdminDIDs` enhancements: destination type editor (Extension/Queue/RingGroup/IVR/VM/Conference), SMS + Fax toggles.
- `AdminRingGroups` — drag-ordered members via `@dnd-kit/sortable`, strategy/timeout/fail-action editors.

## Phase 5 — Recordings, Voicemail, Queues, IVR

- `AdminRecordings` rebuild: `wavesurfer.js` waveform player, per-row transcript + AI insights panels, bulk selection with new `recordings-bulk-export` edge function (zip via Deno `compress`), signed share-link generator (24h/7d/30d TTL).
- `AdminVoicemail` per-extension grouped inbox, inline player, greeting recorder/uploader, AI greeting generator → new `voicemail-greeting-tts` edge function using ElevenLabs.
- `AdminQueues` enhancements: live stats cards, drag agents in/out, full settings modal (timing, overflow, announcements, recording, virtual queue/callback). New `MohLibrary` tab + `moh-generate` edge function using ElevenLabs Music API; uploads stored in new `lemtel-moh` bucket (migration adds bucket + RLS policies on `storage.objects`).
- `AdminIVR` v2: `@xyflow/react` visual builder with node palette (Play, Menu, Transfer, TimeCondition, CallerIdCheck, Queue, AIAgent, Voicemail, Loop, Hangup). Client-side simulator + serializer that posts dialplan XML to `fusionpbx-proxy`.

## Phase 6 — Reports, Settings, Download Center

- `AdminReports` (replaces current `LemtelAnalytics` mount): Recharts Volume Trend, Hourly Heatmap, Extension Performance, Disposition Pie, SLA Area. Advanced CDR table with sortable columns, CSV/Excel/PDF export using `xlsx` + `jspdf`. New table `pbx_report_schedules` + UI for daily/weekly scheduled email digests (Resend).
- `AdminSettings` tabbed page: Organization (logo/timezone/lang), Phone System (codec drag-order, recording defaults, retention), Notifications (admin alert recipients), Integrations (M365/Google/HubSpot/Salesforce/Zoho connector buttons; Telnyx + ElevenLabs status from `fetch_secrets`).
- `DownloadCenter` page (mounted at `/org/lemtel/admin/downloads` and `/org/lemtel/my/downloads`): pulls latest release metadata from GitHub Releases API, store badges for iOS/Android, Chrome Web Store badge, dynamic system requirements. User variant pre-fills extension/email and renders QR for mobile auto-config.

## Phase 7 — User Portal (`/my/*`) full surface

- `MyCalls.tsx`, `MyRecordings.tsx`, `MyVoicemail.tsx`, `MySMS.tsx` — same components as the admin counterparts but scoped to current user's extension via `pbx_softphone_users.portal_user_id = auth.uid()`.
- `MySettings.tsx` tabs: Caller ID, Call Forwarding (writes through `fusionpbx-proxy` + existing `useCallForwarding`), DND with schedule, Voicemail (PIN, notifications, transcription, greeting), Call Settings (ring timeout, call waiting), My Devices list.
- Presence selector in `UserPortalLayout` header bound to `upsert_user_presence`.
- Update sidebar config: admin sidebar shows the full admin item list under "Lemtel Admin"; user sidebar shows the `/my/*` items under "My Workspace".

## Technical Notes

- All new tables follow CREATE → GRANT → ENABLE RLS → POLICY, scoped via `current_user_org_ids()` or `is_lemtel_admin`.
- New `lemtel-moh` bucket: private, RLS lets org members read/write their org's prefix.
- New runtime secrets: none — Resend, ElevenLabs, FusionPBX, Lovable AI already configured.
- New npm deps: `wavesurfer.js`, `qrcode.react`, `xlsx`. `jspdf`, `@xyflow/react`, `@dnd-kit/sortable`, `recharts`, `framer-motion` already installed.
- All sensitive reads continue through `_safe` views per Core memory.

```text
Phase 3 ─▶ Phase 4 ─▶ Phase 5 ─▶ Phase 6 ─▶ Phase 7
   (dashboard)  (config)    (UC features)  (reports/settings)  (user portal)
```

Approve to ship Phase 3 first, then continue sequentially through 7.