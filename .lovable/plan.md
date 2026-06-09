# AVA / Lemtel — Phased Implementation Plan

Progress: ✅ Phase 1 (design tokens + primitives + `/_design` dev route) — done.


Goal: ship the "futuristic glass telecom cockpit + real‑time PBX sync" plan **without breaking** anything already in production (auth, RLS, routes, OrganizationContext, LanguageContext, FusionPBX integration, softphone, reports, desktop app).

Strategy: build **additively** — new tokens, new shell components, new tables/views, new sync edge functions — then progressively switch pages to the new shell behind feature flags. No mass rename, no destructive migrations, no behavior change without verification.

---

## Ground rules (apply to every phase)

- **Landing locked**: never touch `src/pages/Landing.tsx` or `src/components/landing/**`.
- **No data loss**: every new table is additive. Existing tables (`pbx_*`, `organizations`, `user_roles`, `organization_members`, `_safe` views) stay intact; we extend, never replace.
- **Frontend reads from `_safe` views**, sensitive writes go through edge functions (rule already in memory).
- **i18n**: every new string goes through `useTranslation()` (FR/EN) — no hardcoded copy.
- **Security**: every new `public` table gets `GRANT` + `ENABLE RLS` + policies in the same migration; no `anon` SELECT unless explicitly public.
- **No regression checkpoint** at the end of every phase: smoke-test login, role redirect, sidebar nav for super_admin / org_admin / agent / customer.

---

## Phase 1 — Design System Foundation (glass tokens + primitives)

Pure additive UI work. Zero schema changes.

- Extend `src/index.css` + `tailwind.config.ts` with new HSL tokens (no new hex literals in components):
  - `--bg-cockpit`, `--surface-glass`, `--surface-glass-strong`, `--border-glass`, `--border-neon`, `--accent-cyan`, `--accent-violet`, `--state-success/warning/danger`, `--shadow-glass`, `--shadow-glow-cyan`.
  - Keep current `--primary` (#0023e6) as semantic primary; cyan/violet are accents only.
- Add primitives under `src/components/ui-cockpit/`:
  - `GlassCard`, `KpiCard`, `StatusChip`, `NeonButton`, `GlassTable`, `LiveBadge`, `EmptyStateBranded`, `SectionHeader`.
  - Each is a thin wrapper over existing shadcn primitives (`Card`, `Button`, `Table`, `Badge`) so we keep one underlying component library.
- Add motion utilities (120–180ms) and a single shimmer/scan animation reused by every "live" indicator.
- Storybook-style preview page at `/_design` (dev only, gated by `import.meta.env.DEV`) showing all primitives.
- Acceptance: pages still render identically; only new components are available for opt-in use.

---

## Phase 2 — Cockpit Shell (sidebar, top bar, role groups)

Wrap, don't replace.

- New `src/components/cockpit/CockpitShell.tsx` built on top of the existing shadcn `Sidebar` (already in `src/components/sidebar/`).
- Reuse `sidebarConfig.ts` but extend with **groups** (Command Center / Telecom / AI Voice / CRM / Reports / Administration / Support) and per-item `roles[]` + optional `liveBadgeKey`.
- Live badges fed by a single `useLiveCounters()` hook (active calls, unread voicemail, alerts) backed by realtime subscriptions added in Phase 4 — render `0` / hidden until that phase ships.
- Org switcher stays as-is (single-workspace memory rule respected: hidden when user belongs to exactly one org).
- New `AppLayout` variant `CockpitLayout` opt-in via prop on each route; default `AppLayout` keeps current look. Switch routes in batches in Phase 3.
- Acceptance: any page wrapped in `CockpitLayout` shows the glass shell; non-wrapped pages are untouched.

---

## Phase 3 — Role Dashboards & Page Migration

Migrate the 7 highest-impact screens to `CockpitLayout` + new primitives. One PR per screen, each independently revertable.

Order (matches the plan's priority table):
1. `PortalChooser` + `PostLoginRedirect` — confirm role routing still lands on the right home.
2. `SuperAdminDashboard` → multi-org KPI grid, sync health tile (placeholder until Phase 5), PBX status.
3. `pages/portals/PlatformDashboard.tsx` (org admin) → extensions / numbers / queues / voicemail KPIs.
4. `LemtelDashboard` / `TelephonyDashboard` → unified Command Center for telecom.
5. `pages/portals/MyDashboardLanding.tsx` (agent) → my calls / voicemail / availability toggle.
6. `pages/portals/CustomerDashboard.tsx` → restricted self‑service view (no cross-tenant data).
7. `CallCenterWallboard` → live queue tiles (data wiring in Phase 5).

Each migration only changes layout + presentation. Data hooks, RLS, and routes stay identical.

---

## Phase 4 — Normalized Telecom Data Layer (additive)

Reconcile against existing `pbx_*` tables; do **not** drop or rename them. Introduce a thin normalized layer + views that the new UI reads from.

New tables (each with `organization_id`, RLS via `current_user_org_ids()` / `has_role()`, GRANTs, `service_role` full access):
- `telecom_live_calls` — current active calls (one row per channel, upserted by sync).
- `telecom_sync_jobs` — every sync run: source, target, started_at, finished_at, status, error, rows_in, rows_out, retries.
- `telecom_sync_health` — latest heartbeat per source (pbx, voicemail, recordings, cdr).
- `telecom_audit_logs` — admin telecom actions (extension created, routing changed, working hours updated, etc.). Distinct from existing generic `audit_logs`.

New **read-only views** (no new storage) over existing tables, so the UI has one stable contract:
- `telecom_extensions_v` ← `pbx_extensions` + `pbx_softphone_users` (joined, no credentials).
- `telecom_cdr_v` ← `pbx_call_records` filtered to the safe column set.
- `telecom_voicemails_v` ← `pbx_voicemails` + transcript + AI summary status.
- `telecom_recordings_v` ← `pbx_call_recordings` with signed-url marker only (URLs minted server-side).
- `telecom_queues_v` ← `pbx_call_queues` + `pbx_queue_agent_state` + `pbx_queue_agents`.
- `telecom_routing_v` ← `pbx_call_forwarding` + `org_business_hours` + `holiday_schedules`.

Migration rule: every view explicitly excludes credential columns (`password`, `sip_password`, `platform_api_key`, `key_hash`, `voicemail_password`, `wss_url`, `sip_domain`). Existing REVOKEs on those columns stay.

Acceptance: new tables + views exist, RLS verified by selecting as anon (must return empty/forbidden), as authenticated org member (own org only), as super_admin (all).

---

## Phase 5 — PBX Sync Service (hybrid: live + reconciliation)

All sync logic lives in edge functions; secrets stay server-side.

Edge functions (new, under `supabase/functions/`):
- `pbx-sync-extensions` — pulls FusionPBX extensions/devices, upserts into `pbx_extensions` + `pbx_softphone_users`, logs to `telecom_sync_jobs`.
- `pbx-sync-cdr` — fetches recent CDRs, dedups by `sip_call_id`, writes to `pbx_call_records`, logs job.
- `pbx-sync-voicemail` — voicemail metadata + audio object key (no URL); kicks `pbx_ai_jobs` for transcription/summary.
- `pbx-sync-recordings` — recording metadata only; playback URL is minted per request by `recording-signed-url`.
- `pbx-live-events` — receives FreeSWITCH/ESL events (or webhook bridge) and upserts `telecom_live_calls` + broadcasts via Supabase Realtime.
- `pbx-reconcile` — hourly job: compares Supabase vs FusionPBX truth (counts, last 24h CDR diff), writes drift to `telecom_sync_jobs`, raises alerts in `alert_notifications`.

Scheduling: `pg_cron` calls each `pbx-sync-*` (every 1–5 min depending on stream) — installed via `supabase--insert`, NOT a migration (per project rule about user-specific URL + anon key).

Realtime: enable `supabase_realtime` publication on `telecom_live_calls`, `pbx_voicemails`, `alert_notifications`, `telecom_sync_jobs` (RLS already enforced).

Frontend additions:
- `useLiveCalls(orgId)`, `useSyncHealth()`, `useUnreadVoicemail()` hooks driving the live badges from Phase 2.
- New page `pages/platform/SyncHealth.tsx` (super_admin + org_admin) showing PBX connection, last successful sync per source, retry queue, error feed.

Acceptance: making a call updates `telecom_live_calls` within a few seconds; hanging up moves it to `pbx_call_records`; Sync Health page reflects heartbeats; no page needs manual refresh.

---

## Phase 6 — AI Voicemail + AVA Admin Assistant (extend, don't rebuild)

Both already exist (`pbx_voicemails`, `pbx_ai_jobs`, `telecom_admin_ai_actions`, `generate-voicemail-greeting`, `telecom-admin-ai-agent`). Phase 6 polishes and exposes them in the cockpit.

- AI Voicemail Inbox page: list voicemails with status chip (received → transcribing → summarized), playback (signed URL), AI summary, sentiment, "assign to me / create follow-up task" actions writing to `leads` or `appointments`.
- Admin AI Chat: extend the existing `AdminAIChatView` pattern (desktop) into the web portal at `/admin/ava` for org_admin/super_admin. Reuse the existing two-step propose → confirm flow already enforced by `telecom-admin-ai-actions` table. Destructive ops (delete extension, change live routing) require explicit re-typed confirmation + audit-log entry in `telecom_audit_logs`.
- Lovable AI gateway via the existing `LOVABLE_API_KEY` (never exposed client-side).

Acceptance: a new voicemail appears in the inbox without refresh; summary populates when the AI job completes; admin chat refuses destructive actions without confirmation; every confirmed action is in `telecom_audit_logs`.

---

## Phase 7 — QA, Security, Performance, Launch

- Role matrix tests: super_admin / org_admin / manager / agent / customer — verify each role sees only its menus + data on every migrated page.
- Multi-tenant isolation: scripted check that user from org A receives zero rows from org B via every new view + realtime channel.
- PBX failure tests: kill sync, verify Sync Health turns red, retries fire, UI shows degraded state instead of empty silence.
- i18n sweep: every new string in `src/locales/en.json` + `fr.json`.
- `supabase--linter` clean (no new warnings introduced).
- `security--run_security_scan` clean for the new tables/views.
- Lighthouse pass on the new dashboards; tables paginated; realtime channels unsubscribed on unmount.
- Update `mem://features/*` index entries for the new cockpit + sync layer.

---

## What this plan deliberately does NOT do

- Does not rename or drop any existing table, view, route, hook, or page.
- Does not replace the current `AppLayout` globally — `CockpitLayout` is opt-in per route.
- Does not touch landing, marketing pages, or the locked desktop app code already shipped.
- Does not introduce a second component library — all new primitives wrap existing shadcn.
- Does not store new secrets in the client — all PBX/FusionPBX/AI calls stay in edge functions.

---

## Technical appendix

- New folders: `src/components/ui-cockpit/`, `src/components/cockpit/`, `supabase/functions/pbx-sync-*`, `supabase/functions/pbx-live-events`, `supabase/functions/pbx-reconcile`, `supabase/functions/recording-signed-url`.
- New tables: `telecom_live_calls`, `telecom_sync_jobs`, `telecom_sync_health`, `telecom_audit_logs`.
- New views: `telecom_extensions_v`, `telecom_cdr_v`, `telecom_voicemails_v`, `telecom_recordings_v`, `telecom_queues_v`, `telecom_routing_v`.
- Realtime publication adds: `telecom_live_calls`, `pbx_voicemails`, `alert_notifications`, `telecom_sync_jobs`.
- New hooks: `useLiveCalls`, `useSyncHealth`, `useUnreadVoicemail`, `useLiveCounters`, `useRoleMenu`.
- New routes: `/sync-health`, `/admin/ava`, `/_design` (dev only).
- pg_cron schedule rows installed via `supabase--insert` (not migration), one per sync function.