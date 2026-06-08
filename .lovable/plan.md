
## Goal
Bring `/org/lemtel/admin/*` to true bidirectional parity with FusionPBX: live device catalog, full customer/users/impersonation flow, real-time provisioning feedback, complete queues CRUD, CSV mass-import of users under a customer, and confirmation that every FusionPBX page is reachable from the admin shell.

## 1. Live device catalog from FusionPBX
- Extend `fusionpbx-proxy` with two read actions if not present: `list-device-vendors` and `list-device-templates` (proxies `/app/devices/device_vendors` + `/app/devices/device_templates` via the FusionPBX API).
- New hook `usePbxDeviceCatalog()` (TanStack Query, 1h stale) returning `{ vendors: string[], modelsByVendor: Record<string, { model: string, template: string }[]> }`.
- In `DeviceEditDialog`:
  - Vendor `<Select>` populated from the live catalog (fallback to static `pbxDeviceModels.ts` if the call fails so the dialog still works offline).
  - Model `<Select>` filtered by selected vendor.
  - Template auto-filled from the chosen model, editable.
  - MAC validated against `^[0-9a-fA-F]{12}$` after stripping `:`/`-`.
  - Submit calls `fusionpbx-proxy create-device` then `realtime-sync { kind: 'devices' }`, invalidates `['pbx','devices']` and `['pbx','device-catalog']`.

## 2. Device registration status panel (real-time)
- Add `DeviceProvisioningPanel` shown inside `DeviceEditDialog` after submit.
- Steps tracked with status badges + spinners:
  1. Validate input
  2. `fusionpbx-proxy create-device` → returns `device_uuid`
  3. `fusionpbx-proxy assign-extension` (if extension chosen)
  4. `fusionpbx-proxy get-registrations` polled every 3s for up to 60s, matched by MAC/extension → shows "Registered" with IP/UA when found
  5. `realtime-sync devices`
- Each step shows the raw proxy error message when it fails, plus a "Copy log" + "Open /platform/qa" link.
- After success the panel stays open with a "Done" button; the row in the table picks up live registration via existing 10s poll.

## 3. Customers — provision + users + impersonation (inside the page)
Replace `LemtelCustomers.tsx` with a real flow:
- "New customer" dialog → `create-organization` edge function with `{ name, slug, admin_email, admin_first_name, admin_last_name, billing_plan, fusionpbx_mode: 'lemtel', parent_org_id: LEMTEL_ORG, send_welcome: true }`. Shows the temp password once for the admin to copy.
- Row actions:
  - **Manage users** → opens `CustomerUsersDrawer` (right-side `Sheet`) listing `organization_members` + `org_members` for that customer. Inline "Invite user" form, role select (`customer_admin` / `agent` / `user`), remove. All writes via existing edge functions; never leaves the customer page.
  - **Mass import users (CSV)** → see section 5.
  - **Impersonate** → `useImpersonation().enter(orgId, name)` then navigate to `/org/{slug}/admin/dashboard`. Mount `ImpersonationBanner` in `AdminPortalLayout` so the orange exit bar appears.
  - **Open portal** → opens `/org/{slug}/portal` (or `brand_portal_domain`) in a new tab.
  - **Copy admin link**, **Edit**, **Disable** (`is_active=false`).
- Columns: Name, Slug, Admin email, Plan, FusionPBX domain, Users, Extensions, Created, Actions.

## 4. Call queues — full CRUD
Audit and fix `LemtelQueues.tsx` so every mutation routes through `fusionpbx-proxy`:
- Create / Edit → `create-queue` / `update-queue` (strategy, timeout, MOH, wrap-up, max wait, announce frequency, tier rules).
- Delete → `delete-queue` with confirm.
- Tiers panel → `list-queue-tiers` / `add-queue-tier` / `remove-queue-tier`.
- Agents panel → `list-queue-agents` / `create-queue-agent` / `delete-queue-agent`, with pause/unpause via `queue-pause`.
- Every write: `toast.error(error.message)` on failure, then `realtime-sync { kind: 'queues' }` and invalidate `['pbx','queues']`.
- Live stats column wired to `queue-stats` (already polled in `useQueueAgent`).

## 5. CSV mass-import of users (under a customer)
- In the customer's `Manage users` drawer add an **Import CSV** tab.
  - "Download template" button serves a FusionPBX-compatible CSV with headers:
    ```text
    extension,password,voicemail_password,first_name,last_name,email,call_group,user_record,enabled,description
    ```
  - File picker (drag & drop) accepts `.csv`, parsed client-side with `papaparse`, preview table with per-row validation.
  - "Import" calls a new edge function `import-pbx-users-csv` with `{ organization_id, rows }`. The function loops rows server-side and for each calls existing `fusionpbx-proxy` actions: `create-extension`, optional `create-voicemail`, then inserts `pbx_softphone_users` + `organization_members` + `user_roles('user')`. Returns `{ ok, failed: [{ row, error }] }`.
  - Drawer shows progress bar + per-row result. Final summary toast.
- The same flow works from the customer detail page only — users created always inherit `organization_id = customer.id`, never the parent Lemtel org.

## 6. FusionPBX page parity
Add a "FusionPBX modules" section to the `/org/lemtel/admin` sidebar so every existing page is reachable and grouped like FusionPBX itself:
```text
Accounts: Extensions, Devices, Voicemails, Ring Groups, Call Queues, Time Conditions
Dialplan: Inbound (DIDs), Outbound Routes, IVR Menus, Feature Codes
Apps: Call Center, Conference, Recordings, SMS
Status: Registrations, Active Calls, System Status, CDRs, Logs
Advanced: Domains, Variables, Default Settings (read-only mirror)
```
Each link maps to the existing page or, if missing, a stub that calls the matching proxy `list-*` action. Out of scope for this plan: building genuinely new feature pages — only wire up navigation + minimal read views for any that don't exist yet.

## 7. Bidirectional verification
- Shared `<PbxLiveBadge kind="…" />` next to every page title showing last `pbx_sync_jobs` row + manual Resync.
- After every successful write on Devices/Extensions/DIDs/IVR/RingGroups/Queues/Voicemail: trigger `realtime-sync` for that `kind` and invalidate the corresponding query key.
- Devices page: after create, the new row appears in the live table within the post-write `realtime-sync` (no full refresh required); MAC is shown with a green "Registered" badge once `get-registrations` returns it.

## Files to touch
- `supabase/functions/fusionpbx-proxy/index.ts` — add `list-device-vendors`, `list-device-templates` if missing.
- `supabase/functions/import-pbx-users-csv/index.ts` — new.
- `src/hooks/usePbxDeviceCatalog.ts` — new.
- `src/components/lemtel/DeviceEditDialog.tsx` — vendor/model from catalog + provisioning panel.
- `src/components/lemtel/DeviceProvisioningPanel.tsx` — new.
- `src/components/lemtel/PbxLiveBadge.tsx` — new.
- `src/pages/lemtel/LemtelDevices.tsx` — wire badge, ensure post-write sync.
- `src/pages/lemtel/LemtelQueues.tsx` — finish all mutations + tiers/agents panels.
- `src/pages/lemtel/LemtelCustomers.tsx` — rewrite for full provisioning + actions.
- `src/components/lemtel/CustomerUsersDrawer.tsx` — new (users list + invite + CSV import).
- `src/components/lemtel/CustomerCsvImport.tsx` — new.
- `src/components/sidebar/sidebarConfig.ts` — FusionPBX-style grouping.
- `src/components/layout/AdminPortalLayout.tsx` — mount `ImpersonationBanner`.

## Out of scope
- Landing / download / widget pages.
- New database migrations (all required tables, RLS, and edge functions already exist).
- Building net-new FusionPBX feature pages beyond navigation + minimal read views.

## Open questions
1. CSV password column: should the import use the password as provided, or always generate a strong random one and email it to the user (recommended for security)?
2. For impersonation, do you want the banner to also offer a "Open as admin in new tab" so you can keep your own session in the original tab?
