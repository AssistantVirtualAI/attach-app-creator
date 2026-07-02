## Goal
Improve /planipret/admin: better actions on Courtiers, complete + realtime Overview stats, redesigned Reports and AVA Analytics pulling all endpoint data, and remove every "Synchroniser NS-API" button — sync becomes fully automatic in real time across all admin pages.

## 1. Global auto-sync (remove all sync buttons)

- **Mount `usePlanipretNsAutoSync` once** in `src/pages/planipret/admin/PlanipretAdminLayout.tsx` so every admin page inherits background sync (5-min poll + focus trigger, already implemented). It emits `onQueued` events but each page keeps its own Realtime + reload logic, so nothing regresses.
- **Delete `<NsSyncBar />`** and every manual "Synchroniser NS-API" button in:
  - `PAOverview.tsx` (bar + inline button)
  - `PAUsers.tsx` (header button lines 183–196)
  - `PACalls.tsx`, `PAMessages.tsx`, `PARecordings.tsx`, `PAReports.tsx` (bar + inline buttons)
- Replace them with a small, passive "Sync auto · il y a Xs" pill (green dot + last-sync timestamp) rendered by a new `<NsSyncIndicator />` component. Reads `edge_function_logs.pp-admin-ns-sync` last success like `NsSyncBar` does today, but has no action button.
- Keep `NsSyncBar.tsx` as a thin re-export of the new indicator for backwards compatibility (or delete after callers are updated).

## 2. Courtiers — better actions

`src/pages/planipret/admin/PAUsers.tsx`:

- Replace the cramped 3-icon actions cell with a single **"Actions ▾" dropdown** (shadcn `DropdownMenu`) per row containing labelled items with icons:
  - Modifier le courtier
  - Réinitialiser le mot de passe (calls existing `pp-admin-user reset_password`)
  - Activer/Désactiver app mobile (toggles `mobile_app_enabled`)
  - Activer/Désactiver agent IA (toggles `voice_agent_enabled`)
  - Copier le courriel
  - Ouvrir l'app en tant que… (link `/mplanipret?impersonate=<id>`)
  - Voir les appels du courtier (navigates to `/planipret/admin/calls?user=<id>`)
  - Voir l'historique AVA (navigates to `/planipret/admin/ava?user=<id>`)
  - Supprimer le courtier (destructive style)
- NS-only rows show a reduced menu (only "Voir les appels", "Copier le courriel") with a "Courtier NS non lié — créer un compte" primary action that opens the existing add-user modal pre-filled.
- Enhance the bulk bar (already exists) with a matching "Actions groupées ▾" dropdown so single-row and multi-row UX match.

## 3. Overview — complete stats + realtime

`src/pages/planipret/admin/PAOverview.tsx`:

- Add missing KPIs currently absent from the hero grid, all wired to real endpoints:
  - **Appels manqués aujourd'hui** (from `planipret_phone_calls` where `direction = 'missed'`)
  - **Durée moyenne des appels** (period)
  - **Taux de réponse** (period)
  - **Rappels en retard** (from `planipret_reminders` where `scheduled_at < now`) — already computed for the list, promote to KPI
  - **Leads chauds actifs** (`lead_score ≥ 8`, last 7 days)
  - **Sessions AVA 7j** and **Emails analysés 7j** (from `ai_request_audit_log` + `planipret_ava_stats`)
  - **Courtiers en ligne** (from `planipret_profiles.last_seen_at` within 5 min) — add subscription
  - **Voicemails non lus** (already computed, promote position)
- Extend the Realtime channel to subscribe to **all** relevant tables (currently only 3): add `planipret_voicemails`, `planipret_reminders`, `planipret_ava_stats`, `ai_request_audit_log`, `planipret_phone_calls UPDATE` (for lead_score / duration updates). Debounce `load()` at 800 ms to avoid thrash.
- Add a small "● Live" indicator next to the header (green pulse when channel `SUBSCRIBED`).
- Remove the NsSyncBar row at the top of the page.

## 4. Rapports — visual refresh + full endpoint coverage

`src/pages/planipret/admin/PAReports.tsx`:

- Redesign layout into 3 clear tabs (shadcn `Tabs`): **Appels · Messages · AVA & Engagement**.
  - **Appels** tab keeps existing charts but adds: heatmap heures × jours (24×7 grid via existing call data), stacked bar entrant/sortant/manqué per broker, response-time p50/p90.
  - **Messages** tab (new): daily send/receive from `planipret_phone_messages`, top templates from `planipret_sms_templates`, per-broker table.
  - **AVA & Engagement** tab (new): pulls `planipret_ava_stats`, `planipret_ava_feedback`, `planipret_ava_actions` — analyses, leads détectés, urgent, taux de succès, satisfaction (👍/👎), heatmap of activity.
- Add missing endpoint pulls parallel to existing:
  - `planipret_phone_messages` (period)
  - `planipret_ava_stats`
  - `planipret_ava_feedback` (period)
  - `planipret_reminders` (period, for follow-up KPIs)
- Replace inline `RefreshCw` + "Synchroniser NS-API" button with the new passive indicator. Keep PDF/CSV export.
- Visual polish: gradient KPI cards matching Overview, sticky filter bar, larger chart cards, subtle grid lines, unified tooltip.

## 5. AVA Analytics — visual refresh + full data

`src/pages/planipret/admin/PAAva.tsx`:

- Replace the plain `Card`/`Table` layout with the Planiprêt admin visual language (`pp-card`, gradient KPI tiles like Overview, accent colors).
- Fetch and display all AVA endpoints currently unused on this screen:
  - `planipret_ava_actions` (recent proposed actions + status)
  - `planipret_ava_feedback` breakdown (`up`/`down`/`modified`/`skipped`) with a donut
  - `planipret_ava_prompts` / `ava-prompt-tuner` last run (already partial)
  - `ai_request_audit_log` filtered `action LIKE 'elevenlabs_tool:%'` for tool-call volume
  - Broker leaderboard by analyses + satisfaction
- Add charts (recharts): analyses per day (30 d), success vs error stacked bar per broker, satisfaction donut, tool-call mix.
- Realtime subscribe to `planipret_ava_feedback` INSERT + `planipret_ava_stats` UPDATE.
- Keep existing "Analyser les emails maintenant" and "Réentraîner AVA" primary actions.

## 6. Cleanup

- Remove imports of `NsSyncBar` from the six pages; delete the file if no callers remain.
- Update the admin sidebar in `PlanipretAdminLayout.tsx` to show a global "Sync auto · Xs" chip in the top-right of the shell (single source of truth).

## Technical notes (for devs)

- Realtime tables must already be in `supabase_realtime` publication; if any of the newly-subscribed tables (`planipret_ava_stats`, `planipret_reminders`, `planipret_voicemails`, `ai_request_audit_log`) are missing, add a small migration `ALTER PUBLICATION supabase_realtime ADD TABLE …`.
- The auto-sync hook is already idempotent (`inFlight` guard + `lastRun` throttle) so mounting it in the layout instead of per page cannot double-fire.
- No edge-function or backend changes required; every endpoint the new UI needs already exists (`pp-admin-ns-sync`, `pp-ns-users`, `pp-admin-user`, `ava-analyze-all`, `ava-prompt-tuner`, plus direct table reads).
- No changes to `apps/ava-softphone-mobile/` or any iOS native files.
