# Plan — Audit Fixes (AVA Main Dashboard / Planiprêt)

Scope: AVA Main Dashboard / Planiprêt only. **Lemtel Communications, working pages, auth, mobile, dashboards, and dark mode untouched.**

## 1. Claude API URL fix (CRITICAL, ~2 min)
Audit these edge functions and rewrite any Claude call to `POST https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, body `{ model, max_tokens, messages: [...] }`:
- `ai-analyze-call`, `maestro-ai-analysis`, `ava-agent-config`, `ava-tool-executor`, `ai-daily-brief`, `generate-voicemail-greeting`
- Default model: `claude-sonnet-4-5` (current stable Sonnet — `claude-sonnet-4-6` does not exist; will use the latest available and note it).
- Add a small shared helper `supabase/functions/_shared/anthropic.ts` so future drift can't happen.
- Deploy + smoke-test `ai-analyze-call` with a dummy transcript.

## 2. Realtime publications (~1 min)
Single migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE planipret_phone_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE planipret_phone_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE planipret_voicemails;
ALTER PUBLICATION supabase_realtime ADD TABLE planipret_team_messages;
```
Wrap in `DO $$ ... EXCEPTION WHEN duplicate_object` so re-runs are safe.

## 3. Graceful missing-secret handling in edge functions
For each function below: if the required secret is missing, return `{ success:false, error, setup_required:true, setup_url:"/planipret/admin/integrations" }` (HTTP 200, no crash). Log a warning.
- `ava-agent-config` → `ELEVENLABS_DEFAULT_AGENT_ID`
- `generate-voicemail-greeting` → `ELEVENLABS_AVA_VOICE_ID` (fallback `XB0fDUnXU5powFXDhCwa` Charlotte, never crash)
- `ms365-actions` (and any other ms365-* in repo) → `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`
- All `maestro-*` functions → `MAESTRO_API_URL/MAESTRO_API_KEY` → return `skip_maestro:true`; pipeline continues without Maestro
- `maestro-transcript` → `OPENAI_API_KEY` missing → return `whisper_available:false` instead of throwing

## 4. Integrations page setup forms (`/planipret/admin/integrations`)
Reuse existing cards; add a `MissingSecretBanner` component (red translucent card) at top of each affected card when secret is empty.

**ElevenLabs card**
- Banner if `ELEVENLABS_DEFAULT_AGENT_ID` missing.
- Button `🚀 Créer l'agent automatiquement` → invoke `elevenlabs-manage-agent` (`create_agent` → save secret → `sync_all_tools` → `update_voice` Charlotte).
- Manual input + `💾 Sauvegarder` (saves to secret via new `pp-secrets-admin` edge function — super_admin only).
- Voice ID field default `XB0fDUnXU5powFXDhCwa`, save button, `▶ Écouter Charlotte` preview (proxied via existing `elevenlabs-api-proxy`).

**Microsoft 365 card**
- 3 fields (Client ID, Client Secret, Tenant ID with default `common`) with the labeled help text from the brief.
- `💾 Sauvegarder` saves all 3, then tests `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` (client_credentials, scope `https://graph.microsoft.com/.default`).
- Collapsible "📋 Guide de création Azure App" with the 6 steps from the brief.

**Maestro card**
- 2 fields (URL, API Key), save + test `GET {url}/api/v1/clients?limit=1`.
- Contact block: "📧 Contacter l'équipe Kanguru — support@kanguru.ca".

**NS-API / Whisper card**
- New sub-section "🎙️ Transcription de secours (Whisper)".
- Input `OPENAI_API_KEY`, save + `🧪 Tester Whisper` (small static test audio).

**New edge function `pp-secrets-admin`** (super_admin gated):
- `POST` with `{ name, value }` → writes via Supabase Management API using the existing pattern in the repo (will check first); supports `test_*` ops.
- All secret-writing UI uses this single endpoint.

## 5. Audit page (`/planipret/admin/audit-checklist`) improvements
Without breaking existing structure:
- **Edge-function tests:** for AI fns (`ai-analyze-call`, `ai-daily-brief`, `maestro-ai-analysis`, `ava-agent-config`), replace real invocations with a presence probe (POST empty body, expect 200/400/405 ≠ 404). Pass label: `Déployée · {latency}ms`.
- **Rate-limit handling:** if error mentions "rate limit" / "429" / "retry after", mark as ⚠️ warning, not ❌.
- **Throttling:** `await delay(500)` between sections, `await delay(200)` between tests.
- **Realtime test:** query `pg_publication_tables` via a tiny `pp-audit-helpers` edge function (RPC alternative); show `3/3 tables en publication Realtime` and `[➕ Ajouter au Realtime]` button when missing.
- **Score breakdown card** (top): Database / Realtime / Secrets / Edge Functions / External APIs / Manual with X/Y and %.
- **Priority badges** on failed items (🔴/🟠/🟡/🟢) using the mapping in the brief.
- **Quick-fix buttons** next to each failed item (Create agent, Configure Azure, Email Kanguru `mailto:`, Add to Realtime, etc.).
- **Estimated time** per section.
- **"📋 Prochaines étapes recommandées"** card at bottom with the 7 prioritized actions.
- **Manual items:**
  - Per item: `[📋 Instructions]` expandable + `[✅ Marquer comme fait]` button persisted in `planipret_settings` (`jsonb` column `manual_checklist_state` if not present).
  - NS-API webhook item: copy-URL / copy-secret helpers + the 7-step guide from the brief.
  - ElevenLabs / Admin items: direct deep links.

## 6. New table `planipret_consent_settings`
Single migration: create with defaults from the brief, seed one row for `planipret.ca`, GRANTs (`authenticated` + `service_role`), enable RLS, super_admin/admin read+write policy.

## 7. Maestro pipeline orchestrator naming
- Inspect repo for `maestro-pipeline-test` and `maestro-pipeline-orchestrator`.
- If only `*-test` exists, create `maestro-pipeline-orchestrator` (copy of working code) and keep `*-test` as a thin alias.
- Update `ns-webhook-receiver` to call `maestro-pipeline-orchestrator`.

## 8. VoiceAgent component
When `ava-agent-config` returns `setup_required:true`, render inline message (no overlay) with `Contacter l'admin` `mailto:` button instead of crashing/empty UI.

---

## Order of implementation
1. Claude URL fix + shared helper + deploy + smoke test
2. Realtime + consent_settings migrations (one shot)
3. Graceful missing-secret returns in all edge functions
4. `pp-secrets-admin` edge function
5. Integrations page setup forms (ElevenLabs → Microsoft → Maestro → Whisper)
6. Audit page: breakdown + priorities + quick fixes + manual checklist persistence
7. Audit page: rate-limit + presence probes + Realtime test rewrite
8. Orchestrator rename / alias + webhook update
9. VoiceAgent setup_required handling
10. Run full audit, verify score improves

## Explicit non-changes
Lemtel Communications, working edge functions (52 passing), NS-API integration, ElevenLabs TTS path, auth/routing, mobile screens, dashboards, dark mode/design tokens, overall audit page structure.