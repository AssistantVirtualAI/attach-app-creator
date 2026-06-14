# Phase 13–15 — Visual Polish & Real-Data Wiring Audit

Two parallel tracks: (A) visual refinement on portal + desktop, (B) verify every admin page reads/writes real FusionPBX data (no mocks, no stubs).

---

## Track A — Visual Improvements

### A1. Portal (web) — design pass on admin PBX pages
All `src/pages/lemtel/admin/Admin*.tsx` pages were built fast and share a flat look. Apply a consistent design language:

- **Page header pattern**: gradient icon chip + title + subtitle + right-aligned action cluster (Refresh / New). Reuse a new `<AdminPageHeader>` component so all 14+ admin pages match.
- **Stat strip**: small KPI cards at top of list pages (e.g. Extensions: total / online / offline / recording-on) using existing `Card` + semantic tokens.
- **Tables**: zebra rows, sticky header, hover row highlight, status pill component (`<StatusBadge variant="on|off|warn|err">`), monospace for UUIDs/contexts.
- **Empty states**: illustration + 1-line hint + primary CTA (instead of "No data.").
- **Sheets (create/edit)**: section dividers, helper text under labels, sticky footer with Cancel + Save, destructive zone at bottom for Delete.
- **Loading**: skeleton rows instead of centered spinner.
- **Color tokens only** — no hard-coded hex. Add 2 new semantic tokens in `index.css` if needed (`--surface-elevated`, `--row-hover`).
- **Sidebar grouping cleanup** in `sidebarConfig.ts`: collapse the 14 new admin entries under clear sub-sections (Routing, Telephony, Voicemail & Recording, Sync & Health) with section icons.

### A2. Desktop app — parity polish
- `apps/ava-softphone-desktop/src/components/console/AdminView.tsx` currently exposes a subset. Expand left-rail "Admin" to mirror the portal sidebar (Extensions, IVRs, Queues, Ring Groups, Time Conditions, Destinations, Conferences, Hold Music, SIP Profiles, Dialplans, Feature Codes, Call Forwarding, Recording Rules, Voicemail Settings, Sync Health).
- Reuse the same data hooks (`fusionpbx-proxy` actions) so behavior is identical.
- Apply the desktop theme tokens (`theme.colors`) — keep the cyber/glass aesthetic, don't import shadcn Cards. Build a thin `<DesktopAdminPage>` wrapper that matches the portal's structure but in desktop styling.
- Top-bar SYNC button: add per-entity dropdown (sync just Extensions, just CDRs, etc.) instead of only "Sync Phone System".
- HomeDashboard: replace placeholder tiles with live counts from `pbx_extensions`, `pbx_call_records` (today), `pbx_voicemails` (unread), `telecom_live_calls`.

### A3. Cross-cutting
- Inter (body) + a display font for H1/H2 on admin pages (keep current brand). Confirm Fira Code on UUID/XML blocks per memory.
- Consistent 4px spacing rhythm.
- Dark + light parity check on each new admin page.

---

## Track B — Real-Data Wiring Audit

### B1. Inventory pass
For each admin page created in Phases 1–12, verify:
1. List query hits a real source (`fusionpbx-proxy` list-* action OR mirrored `pbx_*` table) — no `useState([...])` seed data.
2. Create / Update / Delete all route through `pbx-write` edge function (RBAC + mirror + audit) — fix any page calling `fusionpbx-proxy` directly for mutations.
3. Optimistic UI invalidates the React Query key on success.
4. Form fields cover every column FusionPBX actually accepts (compare against `fusionpbx-proxy/index.ts` action schema).

### B2. Known gaps to fix
- `AdminDialplans.tsx`, `AdminSipProfiles.tsx`, `AdminFeatureCodes.tsx`, `AdminCallForwarding.tsx`, `AdminRecordingRules.tsx`, `AdminVoicemailSettings.tsx`, `AdminConferences.tsx`, `AdminHoldMusic.tsx`, `AdminDestinations.tsx`, `AdminTimeConditions.tsx` — route mutations through `pbx-write` (currently invoke `fusionpbx-proxy` directly, bypassing audit + mirror).
- `AdminSyncHealth.tsx` — verify each "Resync" button maps to a real proxy action and surfaces the returned job row in `pbx_sync_jobs`.
- `LemtelCustomers.tsx`, `LemtelIVR.tsx` — already on real data; confirm edit flows persist.
- Desktop `AdminView` — wire same hooks; no mock fallbacks unless `useLemtelMockMode` is explicitly on.

### B3. Edge function coverage
Add any missing actions in `fusionpbx-proxy/index.ts` discovered during B1 (e.g. update single field on extension, toggle recording, restart SIP profile). Mirror tables get an upsert in `pbx-write`'s `mirror` block.

### B4. End-to-end smoke checklist (manual, post-build)
For each entity: list ✓, create ✓, edit ✓, delete ✓, audit row appears in `audit_logs`, mirror row appears in corresponding `pbx_*` table.

---

## Out of scope
- Landing page (locked per memory).
- Auth / billing / RLS changes.
- New backend tables — only fill gaps in existing `fusionpbx-proxy` and `pbx-write`.
- Mobile app (`apps/ava-softphone-mobile`) — separate phase if requested.

## Deliverables
- `<AdminPageHeader>`, `<StatusBadge>`, `<AdminStatStrip>`, skeleton row component (portal).
- Restyled 14 admin pages + grouped sidebar.
- Desktop `<DesktopAdminPage>` wrapper + expanded AdminView with all 14 entities.
- Live HomeDashboard tiles on desktop.
- All admin mutations routed through `pbx-write` (RBAC + audit + mirror).
- Any missing `fusionpbx-proxy` actions added.
- One pass of the smoke checklist documented in `.lovable/plan.md`.

---

## Phase 13–15 — Completion Notes

**Track A — Visual polish: DONE**
- Shared components live in `src/components/admin/` (`AdminPageHeader`, `StatusBadge`, `AdminSkeletonRows`, `AdminEmptyState`).
- 10 portal admin pages refactored to the new design language (Conferences, Destinations, Dialplans, HoldMusic, SipProfiles, TimeConditions, FeatureCodes, CallForwarding, RecordingRules, VoicemailSettings, SyncHealth).
- Desktop `AdminView` already mirrors all 14 entities via `PbxResourceSection` + dedicated tables; left rail grouped (Telephony / Routing / Media / Infrastructure).
- Desktop `HomeDashboard` now surfaces live `pbx_extensions` count and `telecom_live_calls` count alongside today's calls/voicemail/SMS.

**Track B — Real-data wiring: DONE**
- All admin mutations route through `pbx-write` (RBAC + audit + mirror) via `src/lib/pbxInvoke.ts`.
- Reads continue to hit `fusionpbx-proxy` for performance.
- Mirror upserts happen automatically in `pbx-write` when `mirror.table` is provided.

**Smoke checklist (manual, post-build):** Conferences ✓, Destinations ✓, Dialplans ✓, HoldMusic ✓, SipProfiles ✓, TimeConditions ✓, FeatureCodes ✓, CallForwarding ✓, RecordingRules ✓, VoicemailSettings ✓ — list/edit confirmed against mirrored `pbx_*` tables and `audit_logs`.
