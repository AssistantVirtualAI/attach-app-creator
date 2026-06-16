
# Customers Management — A-to-Z per-domain PBX control

## Goals
- One screen at `/org/lemtel/admin/customers` to create, edit, disable, delete and **impersonate** any customer (one customer = one FusionPBX domain + optional tenant org).
- Each customer gets its own portal URL (`/c/:slug`) and a `Manage as this customer` action that locks the whole `/console/*` shell to that domain.
- Lemtel super_admin / lemtel_admin can do everything from A→Z: extensions, devices, users, IVRs, queues, ring groups, time conditions, MoH, voicemail, DIDs, call forwarding, CDR + recordings, call history — all the existing console pages, but scoped to the impersonated domain.
- Bulk-add users from CSV per customer.

## 1. Customers list page (rewrite of `LemtelCustomers.tsx`)

Top bar: search · `+ New Customer` · `Refresh` · `Sync all`.

Table columns: Customer name · Domain · Linked tenant · Extensions · Users · Status · Last synced · Actions.

Row actions (icon buttons):
- `Open` → `/org/lemtel/admin/customers/:domainUuid` (existing detail page, expanded).
- `Manage as` → enter impersonation, redirect to `/console`.
- `Portal link` → copy `/c/:slug` (uses the tenant org slug, generated if missing).
- `Edit` / `Disable` / `Delete`.

`+ New Customer` dialog:
1. Customer name + auto-slug + domain `<slug>.lemtel.tel`.
2. Optional: create a tenant organization at the same time (default ON). When ON, server creates org via `setup_customer_organization` RPC and stores `fusionpbx_domain_uuid` on it.
3. Optional Admin email — invites that user as `org_admin` of the new tenant.
4. On submit calls `pbx-write create-domain`, then RPC to link the new domain to the new org row.

## 2. Customer Detail page (extend `CustomerDetail.tsx`)

Keep current tabs and add the missing telephony surfaces so an admin can run the whole PBX without leaving:

Tabs (left→right):
- Overview (counts, last sync, alerts) — new
- Users (existing) + `Import CSV` + `Add user` + `Send portal invite`
- Extensions · Devices · IVR · Queues · Ring Groups · Time Conditions · MoH · Voicemail · DIDs · Inbound Routes · Outbound Rules
- Call History (CDR) · Recordings (existing) · Live Calls
- Settings (domain description / enabled, regional, billing notes)
- Audit (per-domain admin actions)

`Import CSV` accepts `extension,name,email,password,voicemail_pin,outbound_cid` and calls a new edge function `customer-users-import` that loops over the rows: creates the FusionPBX extension (via `pbx-write create-extension`), upserts the local `pbx_softphone_users` row, and links to a profile by email when one exists. Returns a per-row success/error report.

`Add user` is the single-row version of the same flow.

`Send portal invite` calls `supabase.auth.admin.inviteUserByEmail` from an edge function and pre-assigns `org_admin` / `user` role on the tenant org.

## 3. Impersonation (replace the sessionStorage hack)

Use the existing `ImpersonationProvider` (already in `src/contexts/ImpersonationContext.tsx`) and wire it into the Lemtel admin shell:
- `Manage as` calls `enter(orgId, name, { domainUuid, slug })`.
- `<ImpersonationBanner />` mounts on every `/console/*` and `/org/lemtel/admin/*` page when active, with `Exit` button.
- All console hooks/queries (`usePbxData`, `useSoftphoneUsers`, `useLiveRegistrations`, etc.) read `useImpersonation()` and substitute the active `organization_id` + `domain_uuid` so every page (Extensions, Devices, IVRs, Queues, CDR, Recordings, Voicemail, etc.) auto-scopes to the impersonated domain.
- Edge functions that already accept `organization_id` / `domain_uuid` in the body keep working unchanged.

## 4. Backend pieces

Migrations:
- `setup_customer_organization(_name, _slug, _domain_uuid, _admin_email)` SECURITY DEFINER RPC — creates org row, billing, role, links domain UUID, optionally invites admin. Guarded by `is_lemtel_admin` / `is_super_admin`.
- Add `fusionpbx_domain_uuid` index on `organizations` (if missing) and constrain uniqueness.
- Extend `pbx_admin_actions` usage: every customer write logs an audit row with `entity_type='customer'`.

Edge functions:
- `customer-users-import` — bulk CSV importer.
- `customer-invite-admin` — wraps Supabase Auth `inviteUserByEmail` + role assignment.
- Extend `pbx-write` with: `create-extension-batch`, `update-domain-status`, `delete-domain-cascade` (deletes local rows + PBX domain).

## 5. Routes & nav

- Existing `/org/lemtel/admin/customers` and `/org/lemtel/admin/customers/:domainUuid` kept and rebuilt.
- New public per-customer portal route `/c/:slug` that resolves slug→org_id and reuses the standard portal login.
- Sidebar entry under Lemtel admin already exists; mark the row as primary entry-point.

## Out of scope for this round
- Customer billing portal / Stripe per-customer.
- Reseller hierarchy beyond what `multi-tenant-reseller-v4` already provides.
- Number porting workflows.

## Open questions
1. When a customer is created, should we **always** create a matching tenant org row, or keep it optional?
2. For the per-customer portal URL — use the tenant org `slug` (e.g. `/c/acme`) or the domain (`/c/acme.lemtel.tel`)?
3. CSV import: should missing extensions on FusionPBX be **created**, or only rows that already exist on the PBX be matched and linked?
4. Should the impersonation banner also restrict destructive actions (delete domain, delete tenant) while impersonating?
