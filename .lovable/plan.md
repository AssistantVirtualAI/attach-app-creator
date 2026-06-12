# Live PBX Sync, Gateways & Full Remote Management

## Root causes found

1. **"Last sync 7 days ago"** — sync jobs are written with the wrong columns. `fusionpbx-proxy` writes `error_message` but the table column is `error`, and never sets `started_at`. `realtime-sync` writes `kind` / `finished_at` while the table uses `job_type` / `completed_at`. Result: every "completed" row has `started_at = NULL`, so the UI falls back to the last row that *did* set it (7 days old).
2. **Gateways page empty** — `list-gateways` is routed through the generic ADV map which appends `?domain_uuid=<lemtel-domain>`. In FusionPBX, **gateways are global** (`domain_uuid` is usually NULL or belongs to the system domain), so the filter returns 0 rows.
3. **No live sync loop** — there is no scheduled job. `realtime-sync` only runs when the user clicks "Sync Everything", and even then most kinds return `fetched: 0` because the proxy actions aren't wired to upserts (only `sync-cdrs` and `sync-config` actually write rows).
4. **Remote management gaps** — the admin UI reads from local `pbx_*` tables, but writes (extensions, IVRs, ring groups, queues, gateways, time conditions) are not all routed through `fusionpbx-proxy` create/update/delete actions, so the portal/desktop can view but not always change the live PBX.

## Plan

### 1. Fix sync-job logging (foundation for "live" status)
- `fusionpbx-proxy/index.ts`: every insert/update to `pbx_sync_jobs` uses `job_type`, `status`, `started_at = now()`, `completed_at`, `error` (drop `error_message`), `stats`.
- `realtime-sync/index.ts`: same column rename (`kind`→`job_type`, `finished_at`→`completed_at`).
- One-time cleanup: backfill `started_at = created_at` for existing NULL rows so the dashboard stops showing "7 days ago".

### 2. Make Gateways page work
- In `fusionpbx-proxy`, special-case `list-gateways` / `get-gateways` / `create-gateways` etc. to **omit** the `domain_uuid` filter (and accept an optional `domain_uuid` param when the caller wants per-tenant gateways).
- `LemtelGateways.tsx`: keep existing UI; add an inline edit drawer (proxy → host, proxy, username, password, register, expire-seconds, caller-id-in-from, enabled) and a "Create gateway" button calling `create-gateways`. Add Enable/Disable toggle and Delete with confirmation.
- Mirror the same page into the desktop app under "Admin → Gateways" (read + restart only on desktop).

### 3. True live sync (cron + realtime)
- Add a Postgres cron job (`pg_cron`) that calls `realtime-sync` every 2 minutes for the Lemtel org.
- Extend `realtime-sync` so each `kind` actually upserts into the corresponding `pbx_*` table:
  extensions, devices, ivr_menus, call_center_queues, ring_groups, gateways, phone_numbers (DIDs), cdrs, recordings, voicemails, registrations.
- Already-present `pbx_call_records` realtime publication powers the desktop `useRealtimeSync`; add `pbx_gateways`, `pbx_extensions`, `pbx_ivrs`, `pbx_call_queues`, `pbx_ring_groups`, `pbx_devices`, `pbx_phone_number_assignments`, `pbx_sync_jobs` to the same publication so both portal and desktop refresh instantly.
- Sidebar/topbar "Last sync" pill: derive from `max(completed_at)` across all kinds; show green dot when newest completed within 5 min, amber within 1 h, red otherwise.

### 4. Full remote management (portal + desktop)
For each resource below the portal/desktop will use `fusionpbx-proxy` for live writes and the local `pbx_*` tables as the cache that `realtime-sync` keeps fresh:

| Resource | List | Create | Update | Delete | Extra |
|---|---|---|---|---|---|
| Extensions | ✓ | ✓ | ✓ | ✓ | Reset password, toggle voicemail |
| Devices | ✓ | ✓ | ✓ | ✓ | Reboot (`commands` API) |
| Ring groups | ✓ | ✓ | ✓ | ✓ | Manage members |
| Call-center queues | ✓ | ✓ | ✓ | ✓ | Add/remove agents, pause |
| IVR menus | ✓ | ✓ | ✓ | ✓ | Upload audio to `lemtel-ivr-audio`, set options |
| Time conditions | ✓ | ✓ | ✓ | ✓ | Business-hour presets |
| Destinations / DIDs | ✓ | ✓ | ✓ | ✓ | Route to ext/IVR/RG/queue |
| Gateways | ✓ | ✓ | ✓ | ✓ | Restart, enable/disable |
| SIP profiles | ✓ | ✓ | ✓ | – | Restart |
| Hold music | ✓ | ✓ | ✓ | ✓ | Upload audio |
| Voicemails | ✓ | – | mark read/delete | ✓ | Play recording |
| Recordings | ✓ | – | – | ✓ | Play, download |
| Live registrations | ✓ | – | – | – | Surfaced on dashboard |

All write actions go through the existing `restart-gateway` / `pbxWrite` pattern; no direct DB writes from the client.

### 5. End-to-end test pass after deployment
- Run `realtime-sync { kind: 'all' }` once; verify each kind returns `fetched > 0` and a fresh `pbx_sync_jobs` row with `completed_at` set.
- Open Gateways page → confirm carrier rows appear (Telnyx/whatever is configured).
- From portal: create a test extension, edit, delete; verify it round-trips on the real PBX (call `list-extensions` and confirm).
- From desktop: confirm sync pill turns green, gateway list mirrors portal.
- Record a 15-second call → verify recording appears and plays in both portal and desktop within 2 min (cron tick).

## Technical notes (for review)

- The proxy already supports the ADV CRUD map; only the `domain_uuid` filter on gateway endpoints and the sync-job column names need to change.
- `pg_cron` is already used by the project for other jobs; we add one entry: `select cron.schedule('lemtel-live-sync','*/2 * * * *', $$ select net.http_post(...realtime-sync...) $$);`
- No new tables required; only column-name fixes and publication additions (migration).

## Files to touch

- `supabase/functions/fusionpbx-proxy/index.ts` (job-log columns, gateway filter bypass, missing write actions)
- `supabase/functions/realtime-sync/index.ts` (column rename + per-kind upserts)
- `src/pages/lemtel/LemtelGateways.tsx` (CRUD UI)
- `src/pages/lemtel/admin/*` (wire CRUD buttons where missing)
- `src/hooks/useSyncStatus.ts` / `src/components/lemtel/SyncEverythingButton.tsx` (status pill from `completed_at`)
- `apps/ava-softphone-desktop/src/...` (Gateways viewer + sync pill parity)
- One migration: backfill `started_at`, add tables to `supabase_realtime` publication, schedule cron.
