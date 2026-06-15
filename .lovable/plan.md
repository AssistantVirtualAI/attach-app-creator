# Command Center — Phases 1 to 5

Status: Phase 4 and Phase 5 continued. Extensions now read from `pbx_extensions_safe`, the safe view excludes PBX credentials/raw payloads, `pbx-admin-chatbot` is deployed, and audit rollback drafting is wired through `rollback_admin_action`.

Phase 0 is shipped (audit table, sync columns, sources registry, SourceBadge, WriteScopeButton, usePlatformAccess, logAdminAction). This plan covers everything left from the master plan.

## Phase 1 — Desktop shell (Command Center)

New left-rail console shell for the desktop app, distinct from the user softphone shell. Lives in `apps/ava-softphone-desktop/`.

- New `src/components/console/ConsoleShell.tsx` with a collapsible left rail: Dashboard, Extensions, Devices, Live Registrations, Active Calls, CDR & Recordings, Voicemail, DIDs, Inbound Routes, IVRs, Ring Groups, Queues, AI (insights), Chatbot, Audit. Each item shows a `<SourceBadge>` next to its label.
- Rail items gated by role (`org_admin` / `lemtel_admin` / `super_admin`) using a new `useDesktopRole()` hook backed by `has_role` + `is_lemtel_admin`.
- New routes in `apps/ava-softphone-desktop/src/App.tsx` mounted under `/console/*` plus a top-right ProfileMenu that mirrors the web `UserAvatarMenu`.
- Header strip per page: page title, source kind badge, write-scope dropdown, "Last synced" + refresh.

## Phase 2 — Inventory pages (read of `_safe` views, write via WriteScopeButton)

For every entity in `PBX_SOURCES`, ship a Command Center page reusing one generic `<InventoryTable>` driven by a column descriptor file:

- Extensions, Devices, IVRs, IVR options, Ring Groups, Queues, DIDs, Inbound Routes, Time Conditions, Voicemail boxes.
- Each row: SourceBadge, edit dialog (push to PBX confirmation), delete (with audit log via `logAdminAction`).
- Each list page calls the right `sync-*` action on demand + auto when `last_synced_at > staleAfterSeconds`.
- Empty state always renders a diagnostic explaining why (no rows / RLS blocked / sync failed) just like Extensions does today.

## Phase 3 — Live operations

- Live Registrations page polling `fusionpbx-proxy?action=list-registrations` every 15 s.
- Active Calls page polling `get-active-calls-live` every 5 s, with hangup / transfer / monitor actions wired through new `fusionpbx-proxy` actions (`hangup-call`, `transfer-call`, `eavesdrop-call`) — each logs to `pbx_admin_actions` with `requires confirmation` modal.
- CDR & Recordings: paginated, filter by date/extension/queue; play recording via signed URL; "Analyze with AI" + "Transcribe" buttons calling existing edge functions and showing job status from `pbx_ai_jobs`.

## Phase 4 — AI Insights & Chatbot

- `Insights` page surfacing `pbx_ai_insights` + `topic_aggregates` with coverage chart (rows analyzed vs total CDR) even when nothing is processed yet (so user sees baseline).
- Chatbot panel (right drawer) consuming a new edge function `pbx-admin-chatbot` that:
  - resolves source by entity (e.g. "extension 300") via Postgres functions,
  - returns the row + a suggested action,
  - exposes a "Run action" button which triggers the matching `fusionpbx-proxy` write and logs `pbx_admin_actions`.

## Phase 5 — Audit & manual presence

- New `Audit` page listing `pbx_admin_actions` with filters (entity, actor, action, result, rollback).
- Per-row "Rollback" button (when `before_json` exists) that pushes the previous payload through the matching write action and records a new audit row with `rollback_of`.
- Manual presence override already shipped; this phase adds the auto `on_call` reset on desktop softphone disconnect events too.

## Acceptance (per the master spec)

- Source kind badge on every list page and detail header.
- Every write goes through `<WriteScopeButton>` and logs to `pbx_admin_actions`.
- Live pages refresh on the cadence declared in `PBX_SOURCES.staleAfterSeconds`.
- A desktop-blocked user no longer sees Command Center routes (gated by `usePlatformAccess`).
- AI Insights always renders coverage, even at 0 analyses.
- Chatbot returns a real source + confirmable action for "show me extension 300".

## Order of work

1. Phase 1 shell (no inventory yet) → ship and verify routes.
2. Phase 2 inventory pages reusing one shared table component.
3. Phase 3 live ops + recordings.
4. Phase 4 insights + chatbot.
5. Phase 5 audit + rollback.

## Technical notes

- New files: `apps/ava-softphone-desktop/src/components/console/ConsoleShell.tsx`, `…/components/console/InventoryTable.tsx`, `…/pages/console/*.tsx` (one per entity), `…/hooks/useDesktopRole.ts`, `supabase/functions/pbx-admin-chatbot/index.ts`.
- New edge actions in `fusionpbx-proxy`: `hangup-call`, `transfer-call`, `eavesdrop-call`.
- Migration: index `pbx_admin_actions(organization_id, created_at desc)` + RPC `rollback_admin_action(_id uuid)` (server-side guard) — done in Phase 5.
- All reads stay on `_safe` views; writes go through edge functions only.
