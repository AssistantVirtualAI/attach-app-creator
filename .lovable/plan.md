# Call Center Module — Lemtel

Major feature spanning DB, edge functions, portal UI, desktop, and mobile. Delivered in 4 phases to keep scope reviewable; each phase ships independently.

## Phase 1 — Schema, RLS, seed data

Single migration:
- ALTER `pbx_softphone_users` add `cc_role`, `cc_queues`, `cc_status`, `cc_pause_reason`, `cc_calls_today`, `cc_avg_handle_time`, `cc_logged_in_at`
- CREATE `cc_queue_stats`, `cc_agent_activity`, `cc_monitor_sessions`, `cc_pause_reasons` (+ GRANT + RLS scoped via `current_user_org_ids()` to avoid recursion)
- Helper `public.is_cc_supervisor(uuid)` SECURITY DEFINER (checks `cc_role in ('supervisor','admin')`)
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE cc_queue_stats, cc_agent_activity, pbx_softphone_users`
- Seed default pause reasons for Lemtel org (separate insert tool call after migration)

## Phase 2 — Edge functions

**`call-center-sync`** (new): `sync-queues`, `agent-login`, `agent-logout`, `agent-pause`, `agent-unpause`, `monitor-start|stop`, `whisper-start`, `barge-in`, `get-wallboard`, `force-answer`, `transfer-call`. Calls FusionPBX API `/app/api/7/fifo`, `/fifo_agent_status`, `/call_active`, `/cmd`. Logs to `cc_agent_activity` and `cc_monitor_sessions`.

**`cc-alerts`** (new): every-minute cron. Reads `cc_queue_stats` + agent durations, sends push/email/SMS via existing Resend + Telnyx flows when thresholds exceeded (queue depth, SLA, long calls, long pauses, all-offline).

**`fusionpbx-proxy`** (extend): pass-through `cc-*` actions delegating to `call-center-sync` so existing client code keeps one entrypoint.

Cron schedule via `supabase--insert` (not migration — contains URL/key):
- `sync-cc-stats` every 10s → `call-center-sync` `sync-queues`
- `cc-alerts-tick` every minute → `cc-alerts`

## Phase 3 — Portal UI (`/org/lemtel/callcenter`)

New top-level Telephony sub-section with role-gated tabs:

- `src/pages/callcenter/CallCenterAgent.tsx` — status bar, queue pills, incoming-call banner, active-call panel with ACW + disposition, stats grid
- `src/pages/callcenter/CallCenterWallboard.tsx` — 5 KPI cards, queue tabs, agent grid with Listen/Whisper/Barge buttons, 60-min timeline (recharts bar)
- `src/pages/callcenter/CallCenterAdmin.tsx` — tabs: Queues / Routing / IVR builder / Reports
  - Queues: CRUD against FusionPBX via proxy + agent drag-drop (dnd-kit)
  - Routing: business-hours + holiday calendar, VIP/block lists, skills
  - IVR: visual builder using `@xyflow/react` (already in stack)
  - Reports: daily/agent/queue tabs with PDF (jspdf) + CSV export + schedule dialog
- Sidebar: "Call Center" group under telephony (lemtelOnly), shows Agent for agents, Wallboard for supervisors, Admin for admins
- Hooks: `useCallCenterRole`, `useWallboard` (realtime), `useAgentStatus`, `usePauseReasons`
- Route guard: redirect non-CC users away

## Phase 4 — Desktop + Mobile + Settings

**Desktop (`apps/ava-softphone-desktop`)**:
- `components/CallCenterStatusBar.tsx` mounted above `ConsoleLayout` when `cc_role !== 'none'`
- `components/CallCenterWallboard.tsx` standalone window route (`?view=wallboard`) for supervisors
- Native notifications via `electronAPI` for cc-alerts

**Mobile (`apps/ava-softphone-mobile`)**:
- `screens/CallCenterAgentScreen.tsx` — large status toggle, queue carousel, pause-reason sheet, ACW + disposition after hangup
- `screens/CallCenterWallboardScreen.tsx` — scrollable agent rows with Monitor button
- `components/PauseReasonSheet.tsx`
- New bottom tab "CC" gated by role
- Push deep-link `kind: 'cc_alert'` → wallboard

**Settings panel** added to existing `TelephonyUserPreferences.tsx`: new "Call Center" tab with role/queues display, skills tag input, auto-answer toggle + delay, ACW mode, break limits, performance goals.

**Version bumps**: desktop & mobile package.json → `2.1.0`.

## Notes / scope boundaries

- Listen/Whisper/Barge depends on FusionPBX ESL `eavesdrop` app being enabled in the dialplan; if absent, buttons return a clear error toast (no client-side SIP forking).
- IVR builder ships with node palette + save/load to `pbx_ivr_menus`; live "Deploy" pushes to FusionPBX in a follow-up if dialplan XML generation is needed.
- Report PDF generation runs client-side (jspdf) to avoid new edge function; "Schedule Email" stores config in `cc_report_schedules` and is wired to existing `admin-email-notifications` cron.
- Real native CallKit takeover for the mobile incoming-call screen is JS-only (full-screen sheet) — true OS-level call UI is deferred.
