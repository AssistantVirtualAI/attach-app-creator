# AVA × FusionPBX — Real Data, Safe Writes, Reliable Sync

Scope: backend + data layer only. No visual redesign. No AI voice agent changes. Keep all routes, glass styling, auth, Electron, tenant isolation.

---

## 1. CDR uniqueness fix (migration)

**Verified DB state on `pbx_call_records`:**
- `UNIQUE (pbx_uuid)` (global, cross-tenant — wrong)
- `UNIQUE (organization_id, pbx_uuid) WHERE pbx_uuid IS NOT NULL` (good)
- `UNIQUE (organization_id, sip_call_id) WHERE sip_call_id IS NOT NULL` ← **blocks transfers / legs / voicemail / retries that share a SIP call id**

**Migration:**
1. `DROP INDEX pbx_call_records_org_sip_call_id_uniq` — multiple legs may legitimately share `sip_call_id`.
2. `DROP INDEX pbx_call_records_pbx_uuid_key` — replaced by the org-scoped index.
3. Add deterministic fallback hash column `pbx_dedup_key TEXT GENERATED ALWAYS AS (...) STORED` = `md5(organization_id || coalesce(pbx_uuid, sip_call_id||'|'||start_stamp||'|'||destination_number||'|'||extension||'|'||direction||'|'||duration))`.
4. `CREATE UNIQUE INDEX pbx_call_records_dedup_uniq ON pbx_call_records (organization_id, pbx_dedup_key)`.
5. Replace non-unique `idx_pbx_call_records_org_start` (dup of `pbx_call_records_org_start_idx`) — drop the duplicate.

Upserts in `fusionpbx-proxy` keep `onConflict: "organization_id,pbx_uuid"` (already correct); rows without `pbx_uuid` fall through to the generated `pbx_dedup_key` index.

## 2. Recording resolver hardening (Edge Function)

Centralize in `_shared/recordingUrl.ts`:
- Force host = `pbxnode.lemtel.tel`; strip any `portal.lemtel.tel`.
- Try in order, returning the first 200:
  1. `/app/xml_cdr/xml_cdr_download.php?id={xml_cdr_uuid}&t=bin`
  2. `/app/xml_cdr/download.php?id={xml_cdr_uuid}`
  3. `/app/recordings/{recording_name}`
- Use the existing PHPSESSID login flow; fall back to `Authorization: Basic <API_KEY>`.
- `get-recording-signed-url` returns: `{ url, source, name, duration_s, size_bytes, available, attempted: [...] }`.

Mirror table `pbx_call_recordings` gains: `recording_name`, `recording_path`, `recording_url`, `duration_s`, `available`, `transcript_status`, `summary_status`, `sentiment`, `last_checked_at`. Backfill from `pbx_call_records` via a new proxy action `sync-recording-meta` that walks recent CDRs with `has_recording=true`.

## 3. Sync Health — real per-entity status

Today only entities that emit `pbx_sync_jobs` rows show data. Add proxy actions and matching `pbx_sync_jobs` writes so every Sync Health row resolves:

| Entity | Proxy action | Notes |
|---|---|---|
| Extensions | `sync-extensions` (new) | upsert into `pbx_extensions` |
| Devices | `sync-devices` (new) | |
| Ring Groups | `sync-ring-groups` (new) | |
| Call Queues / Queue Agents | `sync-queues`, `sync-queue-agents` (new) | |
| IVRs / IVR options | existing `sync-ivr-options` + new `sync-ivrs` | |
| Destinations | `sync-destinations` (new) | |
| Time Conditions / Conferences / Hold Music / Gateways | `sync-*` (new, thin wrappers) | |
| Voicemail | existing `sync-voicemail-messages` | |
| Recordings | existing `list-recordings` → new `sync-recordings` | |
| CDRs | existing `sync-cdrs` / `backfill-cdrs` | |
| Registrations / Active Calls / System Health / Services | live-only (no mirror); Sync Health renders `live` badge with last poll ts | |

`pbx_sync_jobs` gains: `fetched`, `upserted`, `skipped`, `endpoint`, `duration_ms`. Sync Health page renders all six columns + retry button (already wired to proxy actions).

## 4. Live PBX state via short-cached polling

Module-scope caches in `fusionpbx-proxy` (per `domain_uuid`, TTL noted):
- `get-registrations-live` (15 s) — already shipped.
- `get-active-calls-live` (5 s) — wraps `commands: show channels as json`.
- `get-system-health-live` (10 s) — uses authenticated PHPSESSID to scrape FusionPBX dashboard widget endpoints (`/app/dashboard/dashboard_widget.php?widget=…`) for CPU %, memory %, disk %, uptime, services. If a widget returns non-2xx, payload reports `{ available: false, source }` per metric — the UI shows "unavailable" instead of fabricated values.
- `get-system-services-live` (15 s) — `sofia status` + key `commands: status` parsing.

## 5. AdminDashboard — remove placeholders

Replace the synthesized `cpu/net/active` series in `src/pages/lemtel/admin/AdminDashboard.tsx`:
- Active Calls chart ← real `get-active-calls-live.count` rolled into a 20-point sparkline.
- System CPU Status ← `get-system-health-live.cpu_percent`.
- System Network Status ← `get-system-health-live.network_rx_kbps + tx_kbps` normalized.
- When a metric is `available: false`, render a muted "Unavailable" overlay (no fake numbers).
- Registrations tile ← `get-registrations-live` (`registered / total`).
- Recent/Missed Calls and Voicemails tiles already query mirrors — verified correct.
- New Messages = unread SMS + unread voicemail (already correct).

## 6. Realtime mirrors

Single shared subscription hook `useOrgRealtime(table, orgId, qkeyToInvalidate)`. Enable in publication:
`pbx_call_records, pbx_call_recordings, pbx_voicemails, pbx_extensions, pbx_devices, pbx_ring_groups, pbx_call_queues, pbx_sync_jobs, pbx_sms_messages, pbx_sms_threads, audit_logs`.
Pages (Media Center, CDR, Recordings, Voicemails, Sync Health, Messages, AdminDashboard) subscribe via the hook and invalidate React-Query keys instead of polling. Server-cached short polling reserved for live state in §4.

## 7. Write/Edit coverage via `pbx-write` (already present) + proxy

Audit and complete CRUD for: extensions, devices, phone numbers, inbound routes, destinations, ring groups, IVRs + options, time conditions, call queues + agents, voicemail settings/messages/greetings, conferences, music-on-hold, gateways, SIP profiles, dialplans, feature codes, call forwarding, contacts, recording rules, PBX settings. For each:
- Read via cached proxy list action, write via `pbx-write` server-side function.
- Role gate: super_admin OR `is_lemtel_admin(auth.uid())` OR `has_role(auth.uid(), org, 'org_admin')`.
- Tenant scoping: `domain_uuid` resolved from `organizations.fusionpbx_domain_uuid`; reject mismatched payloads.
- Every successful write → `audit_logs` insert (`organization_id, user_id, action='pbx.<resource>.<op>', resource_type, resource_id, metadata`).
- End-user write surface limited to: own forwarding, own voicemail settings/greetings, own devices, mark voicemail read.

## 8. Media Center wiring

- Sync button already routed to `fusionpbx-proxy:sync-cdrs` (shipped).
- Add a secondary "Backfill" action (already in Admin Sync Health) callable from Media Center under an admin-only toggle.
- Recordings tab uses the new resolver; voicemails tab subscribes to realtime.

## 9. Files touched

- `supabase/migrations/<ts>_cdr_uniqueness_fix.sql` (§1)
- `supabase/migrations/<ts>_recording_meta_columns.sql` + `realtime_publication.sql` (§2, §6)
- `supabase/functions/fusionpbx-proxy/index.ts` — new actions §3, §4, §7; sync-job stats columns
- `supabase/functions/_shared/recordingUrl.ts` (new) and `pbx-write/index.ts` (extend CRUD coverage)
- `src/hooks/useOrgRealtime.ts` (new) and call-site invalidation in: AdminDashboard, AdminSyncHealth, TelephonyMediaCenter, AdminRecordings, AdminVoicemails, LemtelPortalCalls
- `src/pages/lemtel/admin/AdminDashboard.tsx` — swap placeholders for live endpoints
- `src/pages/lemtel/admin/AdminSystemStatus.tsx` — add CPU/Mem/Disk/Services panels backed by `get-system-health-live`
- `src/pages/lemtel/admin/AdminSyncHealth.tsx` — extend ENTITIES list + stats columns

## 10. Verification

- DB: insert two CDRs sharing `sip_call_id` with different `pbx_uuid` → both persist.
- Backfill 1000 CDRs → `pbx_sync_jobs` shows fetched/upserted/duration, cursor advances and resumes.
- AdminDashboard: registrations match FusionPBX (~1041/1314); when system-health widget 401s, panels show "Unavailable" (not "1234").
- Sync Health: every row resolves to `completed | failed | completed_with_errors | live`; retry button triggers proxy and refreshes.
- Tenant isolation: a non-Lemtel admin calling `pbx-write` against Lemtel domain → 403, audit row absent.

## Out of scope (explicit)

- No changes to AI voice agents, ElevenLabs/Retell/Vapi flows, landing page, or visual design tokens.
- No new authentication surfaces.
- Host-level metrics that FusionPBX itself cannot expose remain "Unavailable" rather than synthesized.
