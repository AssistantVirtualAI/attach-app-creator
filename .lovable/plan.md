# Plan — Wire real data into the main Dashboard

Goal: make `/dashboard` (`src/pages/Dashboard.tsx`) show real, organization-scoped data from every active source already in the database — not only ElevenLabs — with consistent date-range filtering, period comparisons, and live refresh.

## Scope

In scope:
- The main app dashboard at `/dashboard` (`src/pages/Dashboard.tsx`).
- Hooks: `useDashboardMetrics`, `useDashboardAgentMetrics`, `TelephonyStatsCard`, `AlertsSection`, `AIInsightsWidget`, `AIPriorityActions`, `RecentActivity`, `MetricsGrid`, `ConversationsChart`, `QuickStatsBanner`.
- Aggregation edge function `dashboard-insights` (extend it instead of running 10 queries from the browser).

Out of scope (separate pages already wired): Super Admin, Lemtel, Reseller, Telephony, Customer, Console dashboards. Touched only if they share a hook we modify.

## Data sources to connect

Currently wired: `agents_safe`, `clients`, ElevenLabs analytics + conversations, `agent_insights`.

Currently missing or partial (all org-scoped via `organization_id`):

1. **Conversations table** (`conversations`) — local fallback + cross-platform total, not just ElevenLabs API.
2. **Voice / phone** — `pbx_call_records`, `pbx_voicemails`, `twilio_active_calls`, `telecom_live_calls`, `phone_numbers` (counts + today/this-week/trend).
3. **Leads pipeline** (`leads`) — new this period, by status, conversion %.
4. **Appointments** (`appointments`, `appointment_reminders`) — upcoming count, no-show rate.
5. **Campaigns** (`outbound_campaigns`, `campaign_calls`) — active campaigns, calls dialed, success %.
6. **Handoffs** (`handoff_requests`) — pending + avg wait.
7. **SMS** (`pbx_sms_messages`, `lemtel_sms_threads`) — sent/received counts.
8. **Webhooks health** (`webhook_delivery_logs`, `webhook_events`) — failure count last 24h → feeds `AlertsSection`.
9. **Team activity** (`org_members`, `user_presence`) — online members.
10. **Knowledge base** (`knowledge_base_items`) — total items, recently added.
11. **Billing snapshot** (`billing_config`, `organizations.subscription_*`) — plan, trial days left, usage vs. limit.

## Implementation

### 1. New aggregator edge function `dashboard-overview`
Single POST `{ organizationId, startDate, endDate }` → returns one JSON blob with:
- `conversations`: total / today / week / trend, by platform, by status, sentiment, peak hours.
- `voice`: inbound/outbound calls, avg duration, missed, voicemails unread, active calls now.
- `leads`: new, by status, conversion %, top sources.
- `appointments`: upcoming 7d, today, no-shows last period.
- `campaigns`: active, dialed, answered %, scheduled.
- `handoffs`: pending, avg wait sec, resolved.
- `messaging`: SMS in/out, chat messages last 24h.
- `team`: total members, online now (from `user_presence`).
- `health`: webhook failures 24h, integration errors, agent insights critical count.
- `billing`: plan name, status, trial_ends_at, conversation usage vs limit.
- `previousPeriod`: same shape for trend math.

Server-side SQL with `count(*) FILTER (WHERE ...)` so the browser fires one request, not twelve. `SECURITY DEFINER` RPC per domain where helpful; otherwise direct service-role queries inside the function, gated by `current_user_org_ids()`.

### 2. Extend `useDashboardMetrics`
- Add fields for voice, leads, appointments, campaigns, handoffs, messaging, team, billing, health.
- Call `dashboard-overview` first; keep ElevenLabs analytics call for chart parity; merge.
- Compute trends from `previousPeriod` payload server-side (remove client-side trend stubs that return 0).
- Respect `dateRange` everywhere — drop the hard-coded "7d" fallbacks that ignore it.

### 3. Dashboard layout updates (`src/pages/Dashboard.tsx`)
Add new tiles using existing card primitives — no design overhaul, matches the current glass-card look.

```
[ Hero header — unchanged ]
[ QuickStatsBanner — add: active calls, pending handoffs ]
[ DataSourceIndicator ]
[ AIInsights | MetricsGrid (conversations/satisfaction/duration/resolution) ]
[ ConversationsChart ]
[ NEW: Voice & Telephony row ]
   ├─ Inbound/Outbound today + trend
   ├─ Missed calls + voicemails unread
   └─ Active calls now (live)
[ NEW: Leads & Pipeline row ]
   ├─ New leads + conversion %
   └─ Pipeline by status (mini bar)
[ NEW: Campaigns & Appointments row ]
   ├─ Active campaigns + dial success
   └─ Upcoming appointments 7d
[ TelephonyStatsCard — keep for Lemtel members ]
[ AIPriorityActions | AlertsSection (now driven by webhook/integration health) ]
[ Agent Performance | Recent Activity (cross-source: calls + chats + leads) | Quick Actions ]
[ NEW: Team & Workspace footer — online members, KB items, plan/usage ]
```

### 4. RecentActivity becomes cross-source
Union conversations + recent leads + recent calls + recent appointments, sorted by timestamp. Returned from `dashboard-overview` as one list with a `type` discriminator.

### 5. AlertsSection — real signals
Replace today's `agent_insights`-only query with:
- Webhook failure spikes from `webhook_delivery_logs`.
- Integration health from `organization_integrations.last_error`.
- Trial expiry / over-limit from billing snapshot.
- Critical `agent_insights` (kept).

### 6. Realtime
Subscribe (Supabase Realtime) to `conversations`, `pbx_call_records`, `leads`, `handoff_requests` insert events to invalidate the dashboard query — replaces the blunt 30 s polling for the live-feel tiles. Keep 60 s polling as a safety net.

### 7. Empty / loading / "no integration" states
Every new tile renders a skeleton during load and a friendly empty card with a CTA when the underlying integration isn't connected (e.g. "Connect a phone number" for voice tile).

## Files

New:
- `supabase/functions/dashboard-overview/index.ts`
- `src/components/dashboard/VoiceStatsRow.tsx`
- `src/components/dashboard/LeadsStatsRow.tsx`
- `src/components/dashboard/CampaignsAppointmentsRow.tsx`
- `src/components/dashboard/WorkspaceFooter.tsx`
- `src/hooks/useDashboardRealtime.ts`

Edited:
- `src/pages/Dashboard.tsx` — layout additions only.
- `src/hooks/useDashboardMetrics.ts` — extended shape + new call.
- `src/components/dashboard/QuickStatsBanner.tsx` — 2 new chips.
- `src/components/dashboard/RecentActivity.tsx` — render cross-source items.
- `src/components/dashboard/AlertsSection.tsx` — real alert sources.
- `supabase/config.toml` — register the new edge function (`verify_jwt = true`).

## Acceptance

- Every tile shows a non-zero value when the underlying table has data for the selected org and date range.
- Changing the date range updates every tile (no stale "7d" hard-codes).
- Inserting a row in `conversations` / `pbx_call_records` / `leads` updates the dashboard within a few seconds without manual refresh.
- Tiles render an empty-state CTA — not a zero — when the source integration isn't connected.
- Single network request to `dashboard-overview` powers the new tiles (verified in the network panel).
