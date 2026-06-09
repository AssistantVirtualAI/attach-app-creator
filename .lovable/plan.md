
# Phase 5 + Fixes — Implementation Plan

Five tracks shipped in order. Each track is self-contained and can be verified before moving on.

## Track A — Fix the cropped Voice Agents page

The screenshot shows `Voice Agents` clipped behind the sidebar with a giant empty band. Cause: `LemtelAdminPage` wraps `LemtelVoiceAgents`, but the page itself already assumes a full container. Add a max-width inner wrapper, remove the duplicated outer padding, and let the page header sit inside `CockpitLayout`'s `header` slot using `SectionHeader` so the title is no longer cut.

- Refactor `src/pages/lemtel/LemtelVoiceAgents.tsx` to use `SectionHeader` + `GlassCard` primitives.
- Ensure `LemtelAdminPage` passes a single padding container (`px-6 py-6 max-w-7xl mx-auto`).
- Visual QA on 1021×660 viewport.

## Track B — Light theme + shiny glass buttons

- Extend `src/index.css` with `:root` (light) tokens mirroring the existing dark cockpit tokens (`--cockpit-bg-1/2/3`, `--cockpit-cyan`, `--cockpit-violet`) tuned for a white base.
- Add a `--glass-tint` token (white/8% dark, white/65% light) and use it in `GlassCard`, `NeonButton`, `CockpitShell` sidebar surfaces.
- Add a new `glass` and `glass-shiny` variant to `NeonButton` (gradient sheen + inset highlight + `backdrop-blur-xl`).
- Update sidebar (`AppLayout`, `SidebarNavGroup`, `SidebarFooter`) to read from semantic tokens only — no hard-coded `bg-cockpit-bg-2`.
- Verify both themes via `useTheme` toggle on the org dashboard and client portal.

## Track C — Restore the Voice Agents section in the sidebar

The legacy `agents` group still exists, but the org sidebar only shows a single `Voice Agents` row. Add an `org-voice-agents` group right under `Phone System`:

```text
🤖 Voice Agents
  ├─ Agents                 /org/lemtel/admin/agents
  ├─ Agent Builder          /org/lemtel/admin/agent-builder
  ├─ Conversations          /org/lemtel/admin/va-conversations
  ├─ Knowledge Base         /org/lemtel/admin/knowledge-base
  ├─ Voice Clients          /org/lemtel/admin/voice-clients      (NEW)
  └─ Voice Agent Reports    /org/lemtel/admin/va-reports
```

Routes already exist for most of these in `src/App.tsx`; wire the missing two (`voice-clients`, `va-conversations`, `va-reports`) to existing components (`Conversations`, `AgentReports`) wrapped in `LemtelAdminPage`.

## Track D — `voice_agent_clients` table + assignment UI

Separate table (per your answer). Schema:

```sql
CREATE TABLE public.voice_agent_clients (
  id uuid PK,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  company text,
  notes text,
  status text DEFAULT 'active',
  created_at, updated_at
);

CREATE TABLE public.voice_agent_assignments (
  id uuid PK,
  organization_id uuid NOT NULL,
  voice_agent_id uuid NOT NULL,           -- references agents.id OR pbx_softphone_users.id (polymorphic via source)
  source text NOT NULL CHECK (source IN ('agents','pbx_softphone_users')),
  client_id uuid,                          -- voice_agent_clients.id
  phone_client_id uuid,                    -- clients.id (existing phone-system clients)
  assigned_at timestamptz DEFAULT now(),
  CHECK ((client_id IS NOT NULL) <> (phone_client_id IS NOT NULL))
);
```

Both tables: GRANTs + RLS scoped to `current_user_org_ids()` and `is_lemtel_admin()`.

UI:
- New page `src/pages/lemtel/LemtelVoiceAgentClients.tsx` — CRUD list of voice-agent-only clients (GlassTable).
- Existing voice agent row → "Assign" action opens a dialog with two tabs: *Phone-System Client* (picks from `clients` table) and *Voice-Agent Client* (picks from `voice_agent_clients`).
- Assigned clients shown as chips on each agent row.

## Track E — Phase 5: real FusionPBX sync + live UI

All edge functions hit FusionPBX directly using the existing secrets (`FUSIONPBX_API_URL`, `FUSIONPBX_API_KEY`, `FUSIONPBX_DOMAIN_UUID`, `FUSIONPBX_USERNAME`, `FUSIONPBX_SIP_DOMAIN`, `FUSIONPBX_WSS_URL`).

### Edge functions (new)

1. `pbx-sync-extensions` — pulls `/app/extensions/extension_edit.php?action=json` (or v_extensions REST), upserts `pbx_extensions`, writes `telecom_sync_jobs` + `telecom_sync_health`.
2. `pbx-sync-cdr` — pulls CDR since `last_synced_at`, upserts `pbx_call_records`.
3. `pbx-sync-voicemail` — pulls voicemails + downloads new audio into the `voicemail-audio` bucket, upserts `pbx_voicemails`.
4. `pbx-sync-recordings` — mirrors recording metadata into `pbx_call_recordings`.
5. `pbx-live-events` — subscribes to FusionPBX Event Socket (WSS), maintains `telecom_live_calls` in real time (CHANNEL_CREATE / CHANNEL_ANSWER / CHANNEL_HANGUP).
6. `pbx-reconcile` — nightly job: removes stale `telecom_live_calls` rows, marks missed sync jobs as failed, refreshes `telecom_sync_health.last_heartbeat_at`.

Shared helper `supabase/functions/_shared/fusionpbx.ts` (auth, retries, sync-job logging). All functions log to `telecom_audit_logs` for admin-visible actions.

### Scheduling

Use Supabase cron (`pg_cron` already enabled). Add via `supabase--insert`:
- `pbx-sync-extensions`: every 5 min
- `pbx-sync-cdr`: every 2 min
- `pbx-sync-voicemail`: every minute
- `pbx-sync-recordings`: every 5 min
- `pbx-reconcile`: hourly

`pbx-live-events` runs as a long-lived function woken by a 1-minute keepalive cron.

### Frontend wiring

- `useLiveCounters` already reads from `telecom_live_calls`, `pbx_voicemails`, `handoff_requests` — extend with realtime subscriptions on each.
- New `useSyncHealth` hook reads `telecom_sync_health`, shows last heartbeat + lag.
- New page `src/pages/lemtel/admin/TelecomSyncHealth.tsx` — health dashboard with per-source `LiveBadge`, last run, error message, "Run now" button (invokes the corresponding edge function).
- Add sidebar item `Sync Health` under Administration.

### Verification

- Trigger each edge function once with `supabase--curl_edge_functions`.
- Check `telecom_sync_jobs` rows + `telecom_sync_health.status='ok'`.
- Open `/org/lemtel/admin/sync-health` and confirm live badges + heartbeat.
- Make a test call → row appears in `telecom_live_calls`, sidebar `Live Calls` badge increments in <2s.

---

## Files touched

**New**
- `supabase/functions/_shared/fusionpbx.ts`
- `supabase/functions/pbx-sync-{extensions,cdr,voicemail,recordings,reconcile}/index.ts`
- `supabase/functions/pbx-live-events/index.ts`
- `src/hooks/useSyncHealth.ts`
- `src/pages/lemtel/admin/TelecomSyncHealth.tsx`
- `src/pages/lemtel/LemtelVoiceAgentClients.tsx`
- `src/components/voice-agents/AssignClientDialog.tsx`
- 1 migration (voice_agent_clients + voice_agent_assignments + cron jobs)

**Edited**
- `src/index.css`, `tailwind.config.ts` (light tokens, glass tints)
- `src/components/ui-cockpit/NeonButton.tsx`, `GlassCard.tsx` (glass-shiny variant)
- `src/components/sidebar/sidebarConfig.ts` (Voice Agents group + Sync Health)
- `src/components/layout/AppLayout.tsx`, `SidebarNavGroup.tsx`, `SidebarFooter.tsx` (semantic tokens)
- `src/pages/lemtel/LemtelVoiceAgents.tsx` (layout fix + assign chips)
- `src/App.tsx` (new routes)
- `src/hooks/useLiveCounters.ts` (realtime)
- `.lovable/plan.md` (mark Phase 5 done)

**Untouched (CI/CD-protected)**
- All of `.github/workflows/**`, `apps/ava-softphone-desktop/electron-builder.yml`, and `apps/ava-softphone-desktop/package.json` (`repository` field).

Approve to start; I'll ship in the order A → B → C → D → E so the UI is usable before the data layer comes online.
