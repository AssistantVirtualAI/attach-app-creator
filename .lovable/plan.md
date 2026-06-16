Multi-phase upgrade of the AVA Statistic desktop app (`apps/ava-softphone-desktop`) covering responsiveness, real-data wiring, full call-center programming, per-domain access control, and a cleaner visual.

## Current state (audited)

- Desktop has `ConsoleLayout` (≥980px) with `LeftRail` admin items behind `useDesktopRole`, and a compact `SoftphonePane` for narrow widths.
- `useDesktopRole` only inspects `user_roles` — it does NOT recognize `is_lemtel_admin` or `has_role(_,_, 'org_admin')` properly per Lemtel domain, so eligible admins land in "normal" mode.
- `AdminView` has a `QueuesTable` but only allows enable-toggle + basic update; no agent management, no live waiting list, no supervisor monitoring.
- `CallCenterStatusBar` (login / pause / logout) is implemented but currently only mounts inside `ContactsView` — it never appears on Home / Calls / mobile.
- Mobile / narrow layout: gear (`onOpenSettings`) fires `lemtel:nav` → `'settings'`, but in `SoftphonePane` mode `App.tsx` flips a separate `mobileSettings` flag — the **availability switch and profile menu live in `ProfileMenu` inside `SoftphonePane` header**, which is hidden on the narrowest widths.
- "Synced X ago" / "SYNC…" badges are present in `LeftRail`, `ConsoleLayout` topbar, `HomeDashboard`, `CallCenterStatusBar` parent screens, `CustomersView`, `AdminView`. User wants them removed visually.
- Background CDR sync timer (5min) keeps running — keep it, just hide the chrome.

## Phase 1 — Visual cleanup & true mobile responsiveness

- Remove every "Synced …", "SYNC", "Sync now" pill/button surface from `LeftRail`, `ConsoleLayout` topbar (compact + wide), `HomeDashboard`, `AdminView`, `CustomersView`, `PBXLiveView`. Keep the underlying sync hooks running silently; only the chrome disappears.
- Replace the colored "PBX status" glow strip with a single quiet 1-px accent that doesn't shout.
- Introduce 3 responsive breakpoints driven by container width, not just `window.innerWidth`:
  - `xs` <520 → softphone only + bottom-tabbar (Phone / Recents / Voicemail / More).
  - `sm` 520-979 → softphone + compact left rail (icon-only) + drawer for views.
  - `md+` ≥980 → existing `ConsoleLayout`.
- Compact top bar: surface a permanent **availability pill** + **avatar** that opens `ProfileMenu` (profile, status, sign out, settings). Wire the gear button so it actually opens `SettingsPage` on every width.
- Audit and fix `SoftphonePane` to keep dial pad, call controls, and tab strip usable down to 320 px wide.

## Phase 2 — Per-domain access control & profile

- Rewrite `useDesktopRole` to resolve, per active tenant, in one shot:
  - `is_super_admin(uid)` → super_admin
  - `is_lemtel_admin(uid)` → lemtel_admin (treated as admin for the Lemtel domain only)
  - `has_role(uid, current_org_id, 'org_admin' | 'manager' | 'reseller_admin')` → org_admin for that domain
  - `pbx_softphone_users.cc_role` for call-center capability (agent / supervisor / admin)
  - `pbx_softphone_users.{desktop_access_enabled, app_access_enabled}` → app entry gate
- Block sign-in into the desktop console when `desktop_access_enabled = false` (show a "your admin hasn't approved desktop access yet" screen with a retry button).
- "Manage as" switcher (super_admin / lemtel_admin only) — pick another tenant; `useTenant` already exposes the active org. Surface in `ProfileMenu`.
- `ProfileMenu` becomes the canonical home for: avatar + name, edit profile, change extension password, change presence, dark/light, language, sign out, "Switch tenant" for admins.

## Phase 3 — Real-data wiring of every existing page

Audit each view, replace remaining mock/static fallbacks with `pbx_*` tables filtered by `useTenant().orgId`:

- `HomeDashboard` → live KPIs: today's calls, voicemails, missed, queue waiting (from `cc_queue_stats` for the current org).
- `CallsView` / `RecordingsView` / `VoicemailView` → already query Supabase; verify org-scoping + add empty/error/loading states and pagination.
- `MessagesView` → `pbx_sms_threads` for the active org only.
- `ContactsView` → org-scoped extensions + customer contacts.
- `CustomersView` → already queries `organizations`; add filtering to only show child tenants under the signed-in admin (super_admin sees all, org_admin sees own + descendants via `get_accessible_org_ids`).
- `ReportsView` / `PBXLiveView` / `AdminView` → strip mock paths, surface clear "no data" states.

## Phase 4 — Call Queues as a full call-center surface

Brand-new view `QueuesView` (replaces the basic `QueuesTable` in `AdminView`) split by role:

**Available to every queue member (agent / supervisor / admin):**
- "My queues" list with my current state (Available / Pause / Lunch / Wrap / Logged out) + one-tap toggle.
- Live waiting panel per queue: callers, wait-duration ticker, position, caller-ID.
- Live KPIs per queue: waiting, longest wait, answered today, abandoned, agents available/total — pulled from `cc_queue_stats` with realtime channel + 15 s polling fallback.
- Pause reasons from `cc_pause_reasons` (Break / Lunch / Training / Custom).

**Supervisor extras** (`cc_role in ('supervisor','admin')` or admin/super_admin):
- All queues live dashboard (grid of queue cards with the same KPIs).
- For each active call in a queue: **Listen / Whisper / Barge / Kick & continue** buttons that call `fusionpbx-proxy` `monitor-call` / `eavesdrop` actions and log to `cc_monitor_sessions`.
- Force agent state (force-pause / force-unpause / force-logout) via `update-queue-agent`.
- "Move agents between queues" multi-select: tier add/remove via `add-queue-tier` / `remove-queue-tier`. Drag-and-drop in the desktop layout, multi-pick on mobile.

**Admin extras** (org_admin / lemtel_admin / super_admin):
- Full queue CRUD with routing controls (strategy, tier rules, wrap-up, announce, MoH, abandoned handling) — mirroring the portal `LemtelQueues` editor so the same model works in both surfaces.
- Bulk import / export of agent-to-queue assignments.

All writes flow through the existing `fusionpbx-proxy` edge function actions; no new server functions needed. Realtime via `pbx_queue_agent_state`, `cc_queue_stats`, `pbx_call_records` channels.

## Phase 5 — Permanent availability + profile on every screen

- Mount the new `AvailabilityPill` and `ProfileMenu` in `TitleBar` so they're reachable in compact, drawer-open, and full layouts.
- Pill cycles: Available → Pause (with reason picker) → Lunch → Logged out, and reflects realtime updates from `pbx_softphone_users.cc_status`.
- Persist last manual status to `user_presence` + `pbx_softphone_users.cc_status` so the portal stays in sync.

## Phase 6 — Polish & QA

- Update `useTenant` so it never silently falls back to `LEMTEL_ORG_ID` for non-Lemtel users — show an explicit "no tenant assigned" screen with a request-access action.
- Strip remaining "Phase X" / "Coming in Phase 2" placeholders.
- Empty / error / skeleton states across every list (replaces the current console-warn-only paths).
- Playwright smoke tests for: compact mobile shell, queue join/pause/listen flow, super_admin tenant switch, desktop-access-denied screen.

## Technical notes

- No DB migrations expected — every required column (`cc_role`, `cc_status`, `cc_queues`, `desktop_access_enabled`, `app_access_enabled`) already exists on `pbx_softphone_users`, and helpers (`is_super_admin`, `is_lemtel_admin`, `has_role`, `get_accessible_org_ids`, `toggle_queue_pause`, `set_softphone_platform_access`, `current_user_org_ids`) are already in place.
- New edge-function actions needed in `fusionpbx-proxy`: `monitor-call` (eavesdrop=listen, whisper, three-way=barge), `kick-agent`. Everything else (tiers, queue update, agent state) is already implemented.
- Shared types between portal `LemtelQueues` and desktop `QueuesView` extracted into `apps/ava-softphone-desktop/src/lib/queueTypes.ts` so the two surfaces don't drift.

## Out of scope

- New billing flow for desktop seats.
- Native push notifications (separate Electron work).
- Re-skinning the portal — this plan only changes the desktop app surface.
