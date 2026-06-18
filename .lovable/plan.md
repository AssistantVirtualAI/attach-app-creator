## Plan: Tenant audit logging, per-tenant scoping & full FusionPBX field mapping

### 1. Audit log for tenant portal access
- Add new edge function call site: when "Open tenant portal" or impersonation triggers in `CustomerDetail.tsx`, write to `telecom_audit_logs` (or `audit_logs`) via existing `audit-log` function with action `lemtel.open_tenant_portal` / `lemtel.impersonate_tenant`, including `domain_uuid`, `domain_name`, target `org_id` (if any), and actor user id.
- Surface entries in `ProviderAuditLog.tsx` with filter by action type.

### 2. Per-tenant permissioning after impersonation
- In `start-impersonation` edge function: ensure issued session token carries `organization_id` matching the linked tenant org, and that `pbx_call_records` / `pbx_call_recordings` RLS policies scope by `domain_uuid` belonging to that org.
- Audit RLS on `pbx_call_records` and `pbx_call_recordings`: add a `domain_uuid IN (SELECT domain_uuid FROM pbx_domains WHERE org_id = current org)` predicate using a `SECURITY DEFINER` helper `public.user_can_access_pbx_domain(_uuid)`.
- Client: in `CustomerDetail.tsx`, every query against `pbx_call_records`/`pbx_call_recordings` must always pass `.eq('domain_uuid', customer.domain_uuid)` — add a single `useTenantScope(domain_uuid)` helper to avoid drift.

### 3. Tenants page visual grouping
- In `CustomerDetail.tsx`: wrap the TabsList + content in a `TenantHeader` card showing tenant name, domain, linked-org chip, and a **sync status strip** (last sync timestamp + per-resource pill: extensions / IVR / queues / devices / CDR / recordings / MOH) sourced from `pbx_sync_jobs` (latest row per `resource`).
- Add explicit loading skeletons (per tab) and standardized error banners with retry.
- Group edit dialogs under a consistent header "{Tenant name} › {Resource}" so dialogs visibly belong to the active tenant.

### 4. Full FusionPBX field mapping layer
- New file `src/lib/fusionpbx/fieldMaps.ts` exporting a typed schema per resource (`extensions`, `ivr_menus`, `ivr_menu_options`, `call_queues`, `ring_groups`, `devices`, `device_lines`, `device_keys`, `destinations`, `voicemail`). Each entry: `{ key, label, type, group, required, default, readOnly }` mirroring FusionPBX v5 column list.
- `PbxRowEditDialog.tsx` and a new `IvrEditDialog.tsx` render groups via this schema so "All fields" dialog matches FusionPBX exactly.
- IVR voicemail PIN: route through `pbx-write` action `update-extension` with `voicemail_password`, `voicemail_enabled`, never `create-extension`. Add a dedicated `ResetVoicemailPinDialog` that calls `update-extension` only.
- `pbx-write` extended with `update-ivr-full`, `update-device-full`, `update-queue-full`, `update-ringgroup-full`, `update-destination-full` accepting the full field payload; server validates allowed keys against the schema and forwards to FusionPBX API.

### 5. Device create scoped to selected tenant
- `DeviceCreateDialog.tsx`: always pass `domain_uuid` from the open tenant; `pbx-write` action `create-device` must reject if `domain_uuid` is missing or doesn't belong to the actor's accessible tenants.
- Remove any code path that auto-creates a `lemtel_customers` or `pbx_domains` row when creating a device.
- After successful create, call `fusionpbx-sync-config` with `{ resource: 'devices', domain_uuid }` and then refetch the devices list (invalidate React Query key `['pbx-devices', domain_uuid]`).

### 6. Tenant-domain scope filter for History & Recordings
- Centralize the active tenant in `CustomerDetail.tsx` via a `TenantContext` providing `{ domain_uuid, domain_name, org_id }`.
- `CdrRow`/`RecordingRow` and the CDR/Recordings tab queries read `domain_uuid` from context; no query may run without it (guarded by `enabled: !!domain_uuid`).
- On tenant switch, clear React Query caches matching `domain_uuid` to prevent cross-tenant bleed.

### Files
- New: `src/lib/fusionpbx/fieldMaps.ts`, `src/components/lemtel/IvrEditDialog.tsx`, `src/components/lemtel/ResetVoicemailPinDialog.tsx`, `src/components/lemtel/TenantContext.tsx`, `src/components/lemtel/TenantSyncStatus.tsx`.
- Edited: `src/pages/lemtel/CustomerDetail.tsx`, `src/components/lemtel/PbxRowEditDialog.tsx`, `src/components/lemtel/DeviceCreateDialog.tsx`, `src/components/lemtel/ExtensionsPanel.tsx`, `src/pages/lemtel/ProviderAuditLog.tsx`.
- Edge functions: `supabase/functions/pbx-write/index.ts` (extend), `supabase/functions/start-impersonation/index.ts` (audit + scope), `supabase/functions/audit-log/index.ts` (new action types).
- Migration: RLS helper `user_can_access_pbx_domain`, tightened policies on `pbx_call_records`, `pbx_call_recordings`.

### Out of scope
- MOH editing (stays read-only).
- Reworking the FusionPBX sync engine itself; only resource-scoped refresh after writes.