# CDR Sync + Live SIP Registrations — Hardening Plan

## 1. CDR sync — switch all callers to the modern proxy

**Verified state**
- Legacy unique constraint `pbx_call_records_org_sip_call_id_uniq` is **no longer present**. Current uniqueness is `UNIQUE (pbx_uuid)`. No DB migration required for the duplicate-key error described — the offending constraint is already gone. (If duplicates still surface in Sync Health, the cause is upstream code paths inserting rows without `pbx_uuid`.)
- `supabase/functions/fusionpbx-sync-cdr/index.ts` is mock-only and explicitly returns `"live CDR sync not yet wired to FusionPBX endpoint"`.
- Modern `fusionpbx-proxy` already exposes `list-cdrs`, `get-cdrs`, `sync-cdrs`, `backfill-cdrs`, all keyed on `xml_cdr_uuid` → upserted to `pbx_call_records.pbx_uuid`.
- Remaining frontend caller of the legacy function: `src/pages/telephony/TelephonyMediaCenter.tsx:87`.

**Changes**
1. **Replace legacy call site** in `TelephonyMediaCenter.tsx`:
   - Swap `functions.invoke("fusionpbx-sync-cdr", …)` → `functions.invoke("fusionpbx-proxy", { body: { action: "sync-cdrs", organization_id: orgId } })`.
2. **Neutralize `fusionpbx-sync-cdr`**: turn it into a thin wrapper that forwards to `fusionpbx-proxy` action `sync-cdrs`, preserving the existing `pbx_sync_jobs` row lifecycle (mock branch removed). Keeps backward compatibility for any external scheduler still hitting it.
3. **Standardize CDR id everywhere**: audit any insert/upsert into `pbx_call_records` that omits `pbx_uuid` (e.g. softphone-side `log_softphone_call`) and ensure callers pass the FusionPBX `xml_cdr_uuid` whenever available. The `pbx_uuid` UNIQUE index then guarantees idempotent upserts.
4. **Backfill UI** in Admin → Sync Health:
   - "Backfill historical CDRs" button → calls proxy action `backfill-cdrs` with `from` / `to` window.
   - Shows live progress (current offset, total inserted, last error) by polling `pbx_integrations.config.sync_cursor` and the most recent `pbx_sync_jobs` row.
   - Resumable: button re-uses the stored cursor so a re-click continues from where it stopped.

## 2. Live SIP registrations endpoint

**Verified state**
- Proxy already has `action: "get-registrations"` hitting `…/registrations?domain_uuid=…` live.
- Admin desktop (`AdminView.tsx:933`) calls it with `domain_uuid`; web `AdminRegistrations.tsx:33` calls it **without** `domain_uuid`, so FusionPBX returns global/empty data → "0 / 0".

**Changes**
1. **New proxy action** `get-registrations-live` in `fusionpbx-proxy/index.ts`:
   - Resolves `domain_uuid` from the org (`organizations.fusionpbx_domain_uuid`) when not provided.
   - Fetches `/registrations?domain_uuid=…` from FusionPBX.
   - **Normalizes** each row to: `{ extension, user, contact, agent, status, expires, hostname, network_ip, user_agent, sip_profile, ts }`.
   - **In-memory cache** keyed by `domain_uuid`, TTL 15 s (configurable 10–30 s), to shield the PBX from dashboard polling.
   - Returns `{ ok: true, count, registered, data: [...] , cached, fetched_at }`.
2. **Wire frontend**:
   - `src/pages/lemtel/admin/AdminRegistrations.tsx` → call `get-registrations-live` (sends `organization_id`, no manual domain).
   - `apps/ava-softphone-desktop/src/components/console/AdminView.tsx LiveRegistrationsTable` → same action; render the new normalized fields (add columns: Hostname, Network IP, User Agent).
   - Auto-refresh every 15 s; show `fetched_at` and a "Live" pulse.

## 3. Verification

- Click Sync in Media Center → confirm `pbx_sync_jobs` row marked `completed`, new rows in `pbx_call_records`, no duplicate errors.
- Trigger backfill over last 7 days → progress increments, resumable on stop.
- Open Registrations page on web + desktop → counts match FusionPBX (≈1041 / 1314), refresh every 15 s.

## Technical notes

- **No DB migration required.** The cited unique constraint already does not exist; do not recreate one on `(organization_id, sip_call_id)`. If a future composite fallback is needed it must be `(organization_id, sip_call_id) WHERE pbx_uuid IS NULL` (partial index) — flag-only, not in this plan.
- Cache for live registrations lives in the edge-function module scope (per-instance). Acceptable because freshness window is short and PBX load is the concern, not strict cross-instance coherence.
- Files touched:
  - `supabase/functions/fusionpbx-proxy/index.ts` (new action + helper)
  - `supabase/functions/fusionpbx-sync-cdr/index.ts` (wrap modern proxy)
  - `src/pages/telephony/TelephonyMediaCenter.tsx`
  - `src/pages/lemtel/admin/AdminSyncHealth.tsx` (backfill UI)
  - `src/pages/lemtel/admin/AdminRegistrations.tsx`
  - `apps/ava-softphone-desktop/src/components/console/AdminView.tsx`
