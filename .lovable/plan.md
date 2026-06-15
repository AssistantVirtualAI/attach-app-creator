# AVA ↔ FusionPBX Alignment — Phased Implementation Plan

Goal: Make AVA a reliable, editable mirror of FusionPBX (`lemtel.lemtel.tel`), with clear inventories, org/domain-scoped reads, and an admin-grade desktop console — without overwriting existing Lovable work.

## Non-negotiable rules (apply to every phase)

- Additive only: new columns, new RPCs, new components. No destructive rewrites.
- All PBX reads/writes resolve `organization_id` → `domain_uuid` from current org context. No hard-coded Lemtel constants in new code paths.
- Every PBX write: confirm dialog → `audit_logs` entry → rollback path where feasible.
- Demo/seed data must carry `is_demo=true` and be filtered out by default (badge if shown).
- Dashboards/AI insights must label data source (CDR / live registrations / ElevenLabs / Telnyx / FusionPBX).

---

## Phase 0 — Diagnostics & source-of-truth audit (read-only)

Build a single internal admin page `/org/lemtel/telephony/_diagnostics` that, per inventory (extensions, users, devices, destinations, DIDs, registrations, voice agents), shows:

- Source table queried + filter used (org_id, domain_uuid).
- Row count in Supabase vs. live FusionPBX count (via proxy).
- Last sync job status from `pbx_sync_jobs`.
- Delta list (PBX-only / AVA-only / both).

Deliverable: a one-screen truth report explaining the 19 vs 0 vs 4 vs 17 discrepancy. No data writes.

---

## Phase 1 — Domain/org resolution normalization

- Add a shared resolver helper in the `fusionpbx-proxy` edge function: `resolveDomain({ organization_id, domain_uuid })` → always returns the correct `domain_uuid` for the org (fall back to vault only when org has none configured, and log a warning instead of silently using it).
- Update every `list-*`, `sync-*`, and `get-*-live` action to call the resolver first (the pattern currently only used by `get-registrations-live`).
- Frontend: ensure every `supabase.functions.invoke('fusionpbx-proxy', …)` call passes `organization_id` from the active org context. Add a tiny `usePbxProxy()` wrapper that injects it automatically.
- Backfill: re-run `sync-all` for `lemtel` and verify `pbx_extensions` is populated to 19.

---

## Phase 2 — Inventory separation & schema clarity

Rename UI labels and clearly split three inventories:

1. **PBX Admin Users** (FusionPBX backoffice accounts) — new read-only page sourced from a new `pbx_admin_users` table + sync action.
2. **SIP Extensions** — existing `pbx_extensions`, page renamed "Extensions (SIP)".
3. **AVA App Users** — existing `pbx_softphone_users`, page renamed "App / Desktop / Mobile Users".

Schema additions (additive migration) on inventory tables (`pbx_extensions`, `pbx_softphone_users`, `pbx_devices`, `pbx_destinations`, `phone_numbers`):

- `source text` ('fusionpbx' | 'ava' | 'demo' | 'historical')
- `pbx_uuid text`, `domain_uuid text`
- `last_pbx_seen_at timestamptz`
- `sync_status text` ('synced' | 'drift' | 'orphan' | 'pending')
- `is_demo boolean default false`

Add default RLS-safe views `*_real` filtering `is_demo=false AND source <> 'historical'`. UI queries the `_real` views by default with a "show demo / historical" toggle.

---

## Phase 3 — Extensions, Devices, Destinations backfill

- Idempotent backfill edge functions: `backfill-extensions`, `backfill-devices`, `backfill-destinations` — upsert from FusionPBX into AVA tables stamping `source='fusionpbx'`, `pbx_uuid`, `domain_uuid`, `last_pbx_seen_at`.
- Mark AVA rows missing from PBX as `sync_status='orphan'` (not deleted).
- Verification: Extensions page shows 19; Devices reconciled to 13 PBX + N marked historical/demo.

---

## Phase 4 — DIDs ↔ Inbound Routes unification

- New view `phone_numbers_unified` joining `phone_numbers` (provider inventory) with `pbx_destinations` (inbound routes) on E.164.
- Page "Phone Numbers" reads the unified view; columns show provider, DID, inbound destination type/target, status.
- Action buttons: "Attach to destination", "Detach", with confirmation + audit log.

---

## Phase 5 — Live registrations & live calls

- Generalize the `get-registrations-live` org→domain resolution; same treatment for `get-active-calls-live`.
- Page "Registrations" shows live PBX count vs. AVA known extensions; flags mismatches.
- If live endpoint unavailable, show explicit reason banner (resolver result, HTTP status) instead of "0".

---

## Phase 6 — Editable admin pages with confirmation + audit + rollback

For Extensions, IVR, Ring Groups, Call Queues, Business Hours / Time Conditions, Devices, Voicemail settings, Inbound Routes:

- Add edit/create/delete dialogs gated by `org_admin` / `is_lemtel_admin`.
- Standard write pipeline: optimistic UI → `pbx-write` edge function → FusionPBX API → on success: update AVA mirror + insert `audit_logs` row with `before`/`after` JSON → on failure: revert and toast.
- Rollback button on audit log row replays `before` payload.

---

## Phase 7 — ElevenLabs voice agents integration

- New tables (or extend existing): `voice_agents`, `voice_agent_conversations`, `voice_agent_transcripts` keyed by ElevenLabs agent_id.
- Edge function `elevenlabs-sync` pulls agents + recent conversations + transcripts; links them to SIP routes (`sip.rtc.elevenlabs.io`) already present in PBX.
- Voice Agents page lists real agents, conversation count, last activity, sample transcript; audio playback via signed URLs.

---

## Phase 8 — AI Insights pipeline completeness

- Worker chain on new CDR: recording fetch → transcription → analysis → upsert `pbx_ai_insights` (sentiment, topics, missed-call reason, coaching).
- AI Insights page cites source per metric (CDR id, recording id, transcript id).
- "Reprocess" action for selected calls with progress and audit entry.

---

## Phase 9 — Desktop / softphone Command Center

Module structure inside the existing desktop app (permission-gated):

- Softphone (existing) — keep WebRTC/SIP dialer, add transfer/hold/DTMF polish, voicemail inbox.
- My Workspace — my calls, my recordings, my transcripts, my SMS, my desktop/mobile access toggle (read-only view of current grant).
- Admin PBX — embedded admin pages from Phase 6 in a desktop-friendly shell.
- Live Monitoring — active calls, registrations, queues wallboard, agent status.
- AI Insights (Phase 8) and Chatbot (Phase 10).

Visual states: per-row badge "PBX real / AVA draft / Demo" using `source` column.

---

## Phase 10 — Admin chatbot (read+confirm-write)

- Tool-using agent (Lovable AI Gateway) with allowlisted tools: `search_extensions`, `search_calls`, `get_registrations`, `propose_write(...)`.
- Writes are *proposals only*: chatbot returns a diff card; admin clicks Confirm → goes through the Phase 6 write pipeline.
- Every answer cites the source table/row ids it used.

---

## Phase 11 — Dashboards source labeling & demo isolation

- Update admin dashboard tiles to read from `_real` views; each tile shows a tooltip with source (`pbx_call_records`, `telecom_live_calls`, ElevenLabs, etc.).
- Global "Real data only" toggle persisted per user; demo rows hidden by default in prod.

---

## Sequencing & checkpoints

```text
P0 diagnostics ──► P1 resolver ──► P2 schema split ──► P3 backfill ──► verify 19 extensions
                                                                  └──► P4 DIDs ──► P5 live
                                                                              └──► P6 editable admin
P6 ──► P7 ElevenLabs ──► P8 AI insights ──► P9 desktop ──► P10 chatbot ──► P11 dashboards
```

Each phase ships behind a feature flag in `organizations.feature_flags` so it can be enabled per org and rolled back without code revert.

## Technical notes

- New edge functions: `backfill-extensions`, `backfill-devices`, `backfill-destinations`, `pbx-write`, `elevenlabs-sync`, `ai-insights-worker`, `chatbot-agent`.
- New/extended tables: `pbx_admin_users`, additive columns on 5 inventory tables, `voice_agents*` trio, `audit_logs` already exists.
- New views: `pbx_extensions_real`, `pbx_devices_real`, `pbx_destinations_real`, `phone_numbers_unified`.
- New RPCs: `pbx_apply_write(_payload jsonb)`, `pbx_rollback_audit(_audit_id uuid)`, `resolve_org_domain(_org uuid)`.
- Frontend additions: `usePbxProxy()`, `useOrgDomain()`, `<SourceBadge />`, `<ConfirmWriteDialog />`, `<AuditTrailDrawer />`.
- Strictly additive migrations; no column drops, no policy removals.

Ready to switch to build mode and start with Phase 0 + Phase 1 (the unblockers for the "0 extensions" symptom)?