# /planipret/admin/integrations — Implementation Plan

Scope is large (8 cards + 2 Edge Functions + table + mobile sync). I'll ship it in 3 reviewable batches so each one builds cleanly and you can test as we go.

## Batch 1 — Foundation (this PR)
1. **Migration** `planipret_integration_config`
   - columns per spec, GRANTs (`authenticated` read, `service_role` all), RLS restricted to Planiprêt admins via existing `is_planipret_admin(auth.uid())` (the spec's `planipret_profiles.role='admin'` check won't work — that column doesn't exist), Realtime publication add, `updated_at` trigger.
2. **Edge Functions**
   - `pp-save-integration` — validates payload (Zod), upserts row, writes each field to a `PP_<KEY>_<FIELD>` Supabase secret via Management API, sets `is_configured=true`.
   - `pp-test-integration` — switch on `integration_key`, real API ping for ms365 / ns_api / elevenlabs / maestro / anthropic, writes `last_tested_at / _result / _success`.
3. **Reusable `IntegrationCard`** component (header + status pill + toggle + collapsible body + footer with Test / Save + inline result), plus shared `<Field>`, `<SecretField>`, `<InfoBanner>`, `<CopyButton>` primitives styled with the existing `.planipret-admin-scope` tokens.
4. **Page shell** at `src/pages/planipret/admin/PAIntegrations.tsx` — subtitle, health summary pills (computed from config rows), 2-col grid.
5. **Cards shipped in Batch 1**: NS-API (#2) and Claude (#5) — you already have these keys, so we can validate the save/test loop end-to-end.

## Batch 2 — Microsoft 365 + ElevenLabs + Maestro
6. **Card 1 (MS365)** — Sections A (Azure creds), B (scopes checklist), C (per-broker connection table reading `planipret_profiles.ms365_email/ms365_token_expiry`, with "Send onboarding email" → reuses existing `ms365-oauth-init`). Verify `ms365-oauth-init` / `ms365-oauth-callback` match spec; patch if not.
7. **Card 3 (ElevenLabs)** — fields + one-click setup wired to existing `elevenlabs-manage-agent` with progress UI + voice preview grid.
8. **Card 4 (Maestro)** — fields + webhook URL display + sync stats from `planipret_maestro_sync_log`.

## Batch 3 — Webhooks, Mobile, Compliance + mobile sync
9. **Card 6 (Webhooks)** — NS webhook URL, generate-secret button, pipeline toggles stored under `webhooks` config_data.
10. **Card 7 (Mobile App)** — read-only config + live broker list from `planipret_profiles` (last_seen filter).
11. **Card 8 (Compliance)** — retention fields persisted to `planipret_retention_policy`, consent toggles to `planipret_consent_settings`, computed score.
12. **Mobile sync** — `apps/.../src/services/IntegrationSync.ts` + wire conditional rendering on Home for ms365 / ns_api gates. (Respects the `/mplanipret` isolation lock — no route changes.)

## Technical notes
- All sensitive fields are write-only from the UI: the row stores only non-secret metadata in `config_data` (URLs, IDs, model name); raw API keys/secrets go to Supabase Secrets via the Management API inside `pp-save-integration`, and the UI shows `••••• Masqué` once configured.
- Test results render inline under the footer with green/red pill + detail.
- Realtime: mobile subscribes to `planipret_integration_config` changes; admin UI also subscribes so multiple admins see live updates.
- RLS: read+write restricted to `is_planipret_admin(auth.uid()) OR is_super_admin(auth.uid())`. Mobile brokers don't need to read this table — they read derived fields from their own `planipret_profiles` row (already RLS'd).
- Toasts use existing `sonner` with the spec colors via classes on `.planipret-admin-scope`.

## What I need from you before Batch 1
Confirm:
- (a) OK to gate this page on `is_planipret_admin OR is_super_admin` (not the non-existent `planipret_profiles.role='admin'`).
- (b) OK to store API keys as Supabase Secrets (server-only) and only metadata in `config_data` — the spec implies this but worth confirming.
- (c) Proceed with Batch 1 now (migration + 2 Edge Fns + NS-API + Claude cards), then I ship Batches 2 and 3 after you validate.