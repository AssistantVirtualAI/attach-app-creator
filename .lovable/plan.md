
# PBX ↔ Portal Full Parity Plan

Goal: every page that exists in the FusionPBX GUI for the `lemtel.lemtel.tel` domain (and any other domains) is visible in the portal with **complete** historical data, and every editable field can be modified in the portal and pushed back to FusionPBX (bidirectional sync).

## Current gap (verified against DB)

| Object             | In PBX | In portal mirror |
|--------------------|--------|------------------|
| Call recordings    | ~1500+ | **0**            |
| Voicemails         | many   | **0**            |
| Domains/customers  | many   | **0**            |
| Gateways           | 13     | **0**            |
| Destinations (inbound routes) | many | **0**  |
| Dialplans          | many   | **0**            |
| Time conditions    | many   | **0**            |
| Conferences        | some   | **0**            |
| Hold music (MoH)   | some   | **0**            |
| SIP profiles       | 2      | **0**            |
| IVR options        | many   | **0** (menus 13) |
| CDRs               | ~5000+ | 239 (partial)    |
| Extensions         | 21     | 21 ✅            |
| Devices            | 17     | 17 ✅            |
| Ring groups        | 9      | 9 ✅             |
| Queues             | 3      | 3 ✅             |
| Feature codes      | 4      | 4 ✅             |

## Architecture (applies to every phase)

```text
FusionPBX REST  ──► fusionpbx-proxy (read)  ──► pbx_<object> mirror table  ──► portal page
                                                     ▲
                                                     │ realtime invalidation
portal page  ──► pbx-write (RBAC + audit)  ──► fusionpbx-proxy (write) ──► FusionPBX
```

- Every list-* action gets **paginated full pull** (loop `page_number` until empty, default page size 250) so we never see "20 rows only".
- Every write action goes through `pbx-write` for RBAC, audit, mirror upsert, and `pbx_object_owner` linkage.
- Cron `cron-pbx-sync` runs every 5 min per object type to keep mirrors fresh.
- A "Refresh from PBX" button on each page forces an immediate sync for that object.
- A "Pushed at" / "Synced at" badge on each row shows direction + last sync.

## Phase 1 — Sync foundation (one-time, blocks everything else)

1. Add `paginate(action, opts)` helper to `fusionpbx-proxy` that walks all pages until empty for any list endpoint.
2. Add missing list endpoints: `list-time-conditions`, `list-feature-codes`, `list-extension-detail` (per-extension full config).
3. Expand `sync-all` to:
   - call each list endpoint with pagination
   - upsert into the matching `pbx_*` table by `(organization_id, pbx_uuid)`
   - delete local rows whose `pbx_uuid` no longer exists in PBX (true mirror)
4. Schedule `cron-pbx-sync` per kind every 5 min; add per-kind sync job rows in `pbx_sync_jobs` with status + lag metric.
5. Generic `pbx-write` wrapper extensions: support `delete` for every object; ensure mirror row is deleted on success.

## Phase 2 — Recordings & CDRs (highest user pain)

- Mirror table `pbx_call_recordings` filled from `list-recordings` (paginated) + linked to `pbx_call_records.pbx_uuid`.
- Backfill all historical CDRs: extend `sync-cdrs` to walk all pages until `start_at < cutoff` (default = first record).
- Recordings page (`/org/lemtel/admin/recordings`, exists as part of analytics) shows: caller, destination, length, date, direction, **Play / Download / Delete**.
- Play already calls `fusionpbx-proxy get-recording` (fixed earlier). Add Delete → `pbx-write delete-recording`.
- Filters: date range, direction, extension, caller number, has-recording.
- CSV export of current filter.

## Phase 3 — Voicemails

- Mirror `pbx_voicemails` from paginated `list-voicemails` + per-extension `pbx_voicemail_settings`.
- Voicemail page: list, mark read/unread, download audio, delete (writes back to PBX), forward to email toggle, PIN reset.
- Voicemail Greetings: upload/replace via `voicemail-greetings` bucket then push to PBX.

## Phase 4 — Customers / Domains

- Mirror `pbx_domains` from paginated `list-domains`.
- `LemtelCustomers.tsx` page becomes the domain admin:
  - List all active domains (description, enabled, extension count, MoH, gateway count).
  - Create new domain → `create-domain` (creates domain on PBX + spins up org-side `pbx_softphone_users` tenant if requested).
  - Edit description / enabled / default settings.
  - Delete (with confirmation + cascade warning).
- Per-customer drill-in card already exists (`CustomerDetail.tsx`) — wire it to the live mirror.

## Phase 5 — IVR Menus

- Mirror `pbx_ivrs` (already 13) + new sync for `pbx_ivr_options` (DTMF → destination).
- IVR editor page:
  - List menus with greeting, timeout, max-failures.
  - Visual option editor: digit, action (extension / ring-group / queue / IVR / hangup), destination picker.
  - Upload greeting audio to `lemtel-ivr-audio` bucket → push to PBX.
  - Reorder / add / delete options.
- Write path: `create-ivr`, `update-ivr`, `delete-ivr`, `create-ivr-option`, `update-ivr-option`, `delete-ivr-option`.

## Phase 6 — Inbound Routes (Destinations) + Dialplans + Time Conditions

- Mirror `pbx_destinations`, `pbx_dialplans`, `pbx_time_conditions`.
- Destinations page: DID → target (extension / IVR / queue / ring group / time condition / voicemail / external number). Full CRUD.
- Time condition editor: weekday / hour ranges → match destination + fallback. Maps to FusionPBX time conditions.
- Dialplan list (read-only first, edit later): show context, order, expression. Edit XML for super-admin only.

## Phase 7 — Gateways & SIP profiles

- Mirror `pbx_gateways` (paginated, multi-domain fallback already added) + `pbx_sip_profiles`.
- Gateways page: list with status (Running/Down), proxy, realm, register flag.
  - Create new (provider templates: VoIP.ms, Telnyx, generic).
  - Edit proxy / realm / register / expire / retry.
  - Start / Stop / Toggle (calls `update-gateways` action).
  - Delete.
- SIP profiles: read-only viewer + reload button.

## Phase 8 — Ring Groups, Queues, Conferences, MoH, Feature Codes

- Already mirrored for ring groups / queues / feature codes — add **edit + create + delete** UI.
- Add mirror + CRUD for `pbx_conferences` and `pbx_hold_music` (upload audio to `lemtel-recordings` or new MoH bucket).
- Queue agent management: add/remove agents per queue, pause/unpause (RPC already exists).

## Phase 9 — Extensions enrichment

- Existing page already lists 21. Extend per-extension dialog to expose every FusionPBX field group: voicemail, call forwarding, follow-me, CID overrides, hot-desk, advanced (limit max, toll allow, accountcode), recording mode.
- Use new `get-extension` action to lazy-load full config on dialog open.
- "Apply to all extensions in domain" bulk action (recording mode, voicemail email, etc.).

## Phase 10 — Bidirectional & resilience polish

- Webhook ingest: FusionPBX → `fusionpbx-webhook` already exists. Map every event type (extension.created, gateway.updated, recording.created, voicemail.created, cdr.completed, …) to the right mirror upsert so PBX-side edits land in the portal within seconds.
- Conflict resolver: if both sides changed an object since `last_synced_at`, prompt admin (PBX-wins / Portal-wins / Merge) and audit the choice.
- Per-page "Sync now" + "Last synced X ago" indicator, with global health page (`/org/lemtel/admin/sync-health`) listing every object kind, lag, last error.
- Drift detector (already exists) extended to flag count mismatches per kind.

## Phase 11 — Permissions, audit, RLS

- Every new mirror table: `GRANT SELECT` to authenticated (scoped via RLS `current_user_org_ids()`), `GRANT ALL` to service_role.
- Every write action recorded in `audit_logs` (already done in `pbx-write`).
- Super-admin / lemtel-admin / org_admin matrix verified per page.

## Phase 12 — UX consistency pass

- Same table component across every PBX page (search, column toggle, CSV export, pagination 50/100/250, sort).
- Empty-state CTA: "Sync from PBX" if mirror is empty.
- Toast feedback: created / updated / deleted / synced.
- Mobile-friendly columns (collapse non-essential on <768px).

## Rollout order (recommended)

1. Phase 1 (sync engine) — must ship first.
2. Phase 2 (recordings & CDR backfill) — directly addresses the "I only see 20 rows" complaint.
3. Phase 3 (voicemails) — same shape, low risk.
4. Phase 4 (customers/domains) — unlocks multi-domain UI.
5. Phase 5 (IVR) — visible business value.
6. Phase 6 → 9 — back-office.
7. Phase 10 → 12 — hardening & polish.

Each phase is independently shippable. After Phase 1 + 2 you will already see every recording for the `lemtel.lemtel.tel` domain in the portal.
