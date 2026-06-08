
## Goal
Make the Lemtel admin phone-system pages fully bidirectional with FusionPBX: create / edit / delete from the UI, and pull live state back. Surface the existing customer + impersonation flow on `/org/lemtel/admin/*` so you can actually use it.

## What's wrong today
- **Devices** (`LemtelDevices.tsx`, 62 lines): read-only table, no "New device" button, no edit dialog. The proxy already supports `create-device` / `update-device` / `delete-device` — the UI just never calls them.
- **Queues** (`LemtelQueues.tsx`): has CRUD scaffolding but it isn't reliably calling `create-queue` / `update-queue` / tier + agent endpoints, and errors are swallowed.
- **Customers**: `LemtelCustomers.tsx` only inserts into `public.clients`. It does NOT call `create-organization` edge function, so no FusionPBX domain is provisioned, no admin user is created, and no per-customer portal link appears. The richer flow (organizations + users + impersonation) lives under `/org/lemtel/master/organizations` (`MasterOrganizations.tsx`) and isn't linked from the admin nav you're on.
- **Impersonation**: `ImpersonationBanner` + `useImpersonation().enter()` are only used in `master/*` and `reseller/*` shells. The admin shell at `/org/lemtel/admin/*` doesn't render the banner or offer an "Impersonate" button per customer.

## Plan

### 1. Devices — full bidirectional CRUD
- Add a **"New device"** button on `LemtelDevices.tsx` opening a `DeviceEditDialog`.
- Fields: label, MAC address (validated), vendor (select from `src/data/pbxDeviceModels.ts` — Yealink / Polycom / Grandstream / Cisco / Fanvil / Snom), model (filtered by vendor), template (auto-suggested), assigned extension (dropdown from `pbx_extensions`), enabled toggle.
- On submit → `supabase.functions.invoke('fusionpbx-proxy', { body: { action: 'create-device', params: {...} } })` then invalidate `['pbx','devices']`.
- Row actions: **Edit** (same dialog → `update-device`), **Delete** (confirm → `delete-device`), **Resync** (calls `realtime-sync` with `kind: 'devices'`).
- Show live registration via `get-registrations` polled every 10s (reuse pattern from `useQueueAgent`).
- Add a `PbxRefreshButton kind="devices"` (already imported) — confirm it actually triggers the proxy sync.

### 2. Queues — finish bidirectional CRUD
- Audit `LemtelQueues.tsx` and ensure every mutation goes through the proxy:
  - Create/Edit queue → `create-queue` / `update-queue` with strategy, timeout, MOH, wrap-up, max wait.
  - Tiers panel → `list-queue-tiers` / `add-queue-tier` / `remove-queue-tier`.
  - Agents panel → `list-queue-agents` / `create-queue-agent` / `delete-queue-agent`.
  - Delete queue → `delete-queue` with confirm.
- Surface proxy errors via `toast.error(error.message)` instead of swallowing them.
- After every write: invalidate `['pbx','queues']` and re-fetch live stats via existing `queue-stats` action.

### 3. Customers — full org provisioning + portal link + impersonation
Replace the current "insert into `clients`" dialog with the real `create-organization` flow that already exists:
- New customer dialog calls edge function `create-organization` with `{ name, admin_email, plan, parent_org_id: LEMTEL_ORG }`. That function already: creates FusionPBX domain via `fusionpbx-proxy createDomain`, inserts `organizations`, creates the admin auth user, inserts `org_members` + `organization_members`, audits, and sends welcome email.
- Customers table columns: Name, Admin email, Plan, FusionPBX domain, Users count, Created, **Actions**.
- Row actions:
  - **Open portal** → opens `/org/{slug}/portal` in new tab (uses `brand_portal_domain` if set).
  - **Manage users** → drawer listing `organization_members` for that org with **Invite user** (calls existing invite edge function), role select, and remove.
  - **Impersonate** → calls `useImpersonation().enter(orgId, name)` (which already invokes `start-impersonation` and writes audit) then navigates to `/org/{slug}/admin`.
  - **Edit settings**, **Delete** (soft-disable via `is_active=false`).
- Add `ImpersonationBanner` to the admin shell (`LemtelAdminPage`) so the orange "Exit impersonation" bar is visible while impersonating from `/org/lemtel/admin/customers`.

### 4. Bidirectional guarantees across the phone-system pages
For Extensions, DIDs, IVR, Ring Groups, Devices, Queues, Voicemail:
- All write operations route through `fusionpbx-proxy` (no direct table writes that bypass PBX).
- After each successful write, trigger `realtime-sync` for that `kind` so the local cache row matches PBX immediately.
- Add a shared `<PbxLiveBadge>` next to each page title showing last sync timestamp from `pbx_sync_jobs` + a manual "Resync" button (reuse existing `PbxRefreshButton`).
- Surface proxy failures with `toast.error` + a "View logs" link to `/platform/qa`.

### 5. Navigation
- Add **Customers** and **Devices** to the `/org/lemtel/admin` sidebar (they exist as routes but may not be in the nav). Add **Queues** if missing.
- Add a "Customer admin link" copy-to-clipboard button per row in Customers.

## Out of scope
- No changes to widget / landing / download pages.
- No new migrations expected; all backend pieces (`create-organization`, `start-impersonation`, proxy CRUD actions, `org_members`, audit) already exist.

## Files to touch
- `src/pages/lemtel/LemtelDevices.tsx` (rebuild with CRUD)
- `src/components/lemtel/DeviceEditDialog.tsx` (new)
- `src/pages/lemtel/LemtelQueues.tsx` (wire mutations to proxy, error surfacing)
- `src/pages/lemtel/LemtelCustomers.tsx` (replace with org-provisioning + users drawer + impersonate)
- `src/components/lemtel/CustomerUsersDrawer.tsx` (new)
- `src/components/lemtel/admin/LemtelAdminPage.tsx` (or equivalent shell) — mount `ImpersonationBanner`, add nav items
- `src/components/lemtel/PbxLiveBadge.tsx` (new, optional)

## Confirmation needed
1. Should "New customer" actually provision a FusionPBX domain immediately (recommended), or just create the org row and let you provision later?
2. For Devices, should the vendor/model list be the static `pbxDeviceModels.ts` catalog, or do you want me to also pull provisioning templates live from FusionPBX (`device_templates`) for whatever your PBX has installed?
