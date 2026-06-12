# Desktop App: Full PBX Management + Futuristic Redesign

Two parallel tracks: (1) reach full feature parity with the web portal so every PBX-side action is editable from the desktop app, (2) restyle the entire console UI to a futuristic, elegant, modern look that scales from narrow (compact rail) to wide (full console) gracefully.

## Track 1 — Full PBX management parity

Current `AdminView.tsx` only ships 6 sections (Extensions, Devices, Numbers, IVRs, Queues, Ring Groups) and most are read-only `Table` wrappers. Web portal has a much wider surface. Bring all of it into the desktop app, all wired through `fusionpbx-proxy` so edits hit the live PBX.

### Sections to add / upgrade

| Section | Current | Target |
|---|---|---|
| Extensions | Edit modal exists | Add create / delete / bulk-enable, register status badge |
| Devices | Read-only | Create / edit / delete, assign extension, reboot, provisioning URL |
| Phone Numbers (DIDs) | Read-only | Edit destination, IVR/queue/ext routing, CNAM, fax toggle |
| IVRs | Edit modal | Add option editor (digit → action), greeting upload, timeout/invalid actions |
| Call Queues | Edit modal | Add agent membership editor (add/remove/penalty), MOH picker, wrap-up timer |
| Ring Groups | Read-only | Member editor with order, strategy, no-answer destination |
| **Gateways** (NEW) | — | List, enable/disable, restart, edit credentials, view registration |
| **Time Conditions** (NEW) | — | Schedule editor with multiple match conditions and true/false destinations |
| **Dialplans** (NEW) | — | List + edit XML/conditions, enable/disable |
| **Hold Music** (NEW) | — | Upload, preview, assign to queues |
| **Voicemail Boxes** (NEW) | — | List per extension, edit PIN/email/greeting, view voicemails |
| **Call Recordings Rules** (NEW) | — | Per-extension/queue recording on/off, retention |
| **Conferences** (NEW) | — | List rooms, edit PIN, kick participants |
| **Feature Codes** (NEW) | — | List/enable/disable, edit code |
| **Live Registrations** (NEW) | — | Real-time SIP registration status per extension, force unregister |
| **SIP Profiles** (NEW) | — | List, restart, view status (read-only for non-superadmin) |
| Sync | Status panel | Show last successful per-resource sync + retry button per resource |

### Wiring

- All writes go through `supabase.functions.invoke('fusionpbx-proxy', { action: '<verb>-<resource>', ... })`. Add any missing actions in `fusionpbx-proxy/index.ts` (create/update/delete for the new resources, plus `restart-gateway`, `reboot-device`, `force-unregister`, `upload-moh`, `upload-greeting`).
- Reads go through Supabase tables (`pbx_gateways`, `pbx_time_conditions`, `pbx_dialplans`, `pbx_hold_music`, `pbx_voicemails`, `pbx_voicemail_settings`, `pbx_call_recording_rules`, `pbx_conferences`, `pbx_feature_codes`, `pbx_sip_profiles`, `pbx_devices`, `pbx_ring_groups`, `pbx_phone_number_assignments`) — all already exist per the supabase-tables list.
- Live registration view subscribes to `pbx_extensions` Realtime updates of the `registered` / `last_register` columns.
- Tenant scoping: every query/mutation passes `organization_id` from `getMeContext()` and `domain_uuid` from the resolved org → no Lemtel-only hardcodes for multi-tenant flows (keep current Lemtel constants only as fallback).

### Refactor

Split monolithic `AdminView.tsx` (~600 lines) into one file per section under `components/console/admin/` (`ExtensionsSection.tsx`, `GatewaysSection.tsx`, …). Shared `<ResourceTable />`, `<EditDrawer />`, `<ConfirmDelete />` primitives in `components/console/admin/_shared/`.

## Track 2 — Futuristic redesign (responsive)

### Visual direction

- **Aesthetic**: dark cyberpunk-glass — deep midnight base (`#05060d`), translucent panels with backdrop-blur, hairline borders in cool ice-blue, single saturated accent (`#23d6ff`) plus warning amber (`#ffb84a`).
- **Typography**: keep Inter for body, introduce **Space Grotesk** for headings/numerals (extension numbers, call durations, KPI counters); JetBrains Mono for SIP/log data.
- **Surfaces**: layered glass cards with subtle gradient borders (`linear-gradient(135deg, rgba(35,214,255,.4), transparent 60%)` via mask), soft inner glow on focus, depth via 3-stop shadow.
- **Motion**: 180ms ease-out transitions on hover, view transitions between sections (slide+fade 120ms), pulsing register dot, animated waveform on active calls.
- **Iconography**: stroke-based 1.5px line icons (replace current path icons with a consistent Lucide set in `RowIcons`/`TabIcons`).

### Components to restyle

- `ConsoleLayout`, `LeftRail`, `PageHeader`, `ActiveCallDock`, `CommandPalette`, `IncomingCallToast`, `HomeDashboard`, all `*View.tsx`, admin tables, dialer in `SoftphonePane`, `SettingsPage`, `SetupWizard`, `TitleBar`, `UpdateBanner`, status pills.
- Replace inline `style={{}}` color literals with semantic tokens in `lib/theme.ts` (`surface.glass`, `surface.glassHover`, `border.hairline`, `accent.cyan`, `accent.amber`, `text.ice`, `text.muted`).

### Responsive behavior

- Breakpoints: `compact` <820px (current `CompactRail`), `standard` 820–1280px (rail + single content pane), `wide` ≥1280px (rail + content + contextual right pane: active call dock / AI panel / details drawer).
- Admin tables: cards on compact, dense rows on standard, multi-column with inline edit on wide.
- Dialer collapses into a floating launcher button on compact, persistent right pane on wide.
- All edit modals become bottom sheets on compact, side drawers on standard, centered modals on wide.

### Theme migration

Extend `lib/theme.ts` with the new token set, write a small CSS-in-JS helper `glass(level)` for panel backgrounds, and refactor existing components to consume tokens instead of literals. No hardcoded `#fff` / `#000`.

## Technical details

- New edge function actions in `supabase/functions/fusionpbx-proxy/index.ts`: `list-gateways` (no `domain_uuid` filter), `create-gateway`, `update-gateway`, `delete-gateway`, `restart-gateway`, `reboot-device`, `force-unregister`, `crud-time-condition`, `crud-dialplan`, `upload-moh`, `upload-greeting`, `crud-conference`, `crud-feature-code`, voicemail PIN/email update.
- Add Realtime publication for `pbx_extensions` register columns and `pbx_sync_jobs` so the desktop UI live-updates without polling.
- Type-safe wrappers in `apps/ava-softphone-desktop/src/lib/avaApi.ts` for every new action.
- Build verification: `apps/ava-softphone-desktop` Vite build must succeed and Electron packaging (`@electron/packager`) must produce a working bundle (test the existing `electron/main.cjs` path).

## Files touched (estimate)

- New: `components/console/admin/{Extensions,Devices,Numbers,Ivrs,Queues,RingGroups,Gateways,TimeConditions,Dialplans,HoldMusic,Voicemails,Recordings,Conferences,FeatureCodes,Registrations,SipProfiles,Sync}Section.tsx`, `_shared/{ResourceTable,EditDrawer,ConfirmDelete,FieldRow}.tsx`
- Edited: `AdminView.tsx` (becomes router), `LeftRail.tsx`, `ConsoleLayout.tsx`, `PageHeader.tsx`, all `*View.tsx`, `SoftphonePane.tsx`, `SettingsPage.tsx`, `TitleBar.tsx`, `lib/theme.ts`, `lib/avaApi.ts`, `index.tsx` global CSS
- Backend: `supabase/functions/fusionpbx-proxy/index.ts`, 1 migration (Realtime publication additions, no schema changes)

## Out of scope

- Web portal changes (only desktop app).
- Schema changes — all target tables already exist.
- Touching landing pages (locked per memory).

## Open questions before I build

1. Should the new sections appear for **all tenants' admins**, or only for super-admins / Lemtel staff initially?
2. For the redesign, do you want me to first show 3 rendered design directions to pick from, or trust the cyberpunk-glass direction above and ship it directly?
