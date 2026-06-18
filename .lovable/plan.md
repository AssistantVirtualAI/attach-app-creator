## Phase 3 — Contacts + Customer Management

Scope is bounded to: `apps/ava-softphone-desktop/src/components/console/ContactsView.tsx`, `src/pages/lemtel/LemtelCustomers.tsx`, `src/pages/lemtel/CustomerDetail.tsx`, one new edge function, and one DB migration. **No edits** to `vite.config.ts`, `electron-builder.yml`, `.github/workflows/`, or `supabase/config.toml`.

---

### Bug 1 — Desktop Contacts page is empty

`ContactsView.tsx` currently merges `ava.contacts()` + `ava.extensions()` + `localStorage` manual list. The problem is workspace users have no `contacts` source and `ava.extensions()` only returns the LeMTel-org extensions (not the user's own org), and there is no persisted `contacts` table.

**Fix**
1. **New migration** — create `public.org_contacts`:
   ```
   id uuid pk, organization_id uuid not null, owner_user_id uuid,
   name text not null, phone text, email text, company text,
   notes text, favorite bool default false,
   source text default 'manual', external_id text,
   created_at, updated_at
   ```
   GRANTs to `authenticated`/`service_role`; RLS so users can read/write rows scoped to their `organization_id` (using existing `has_org_access` helper).
2. **Rewrite `loadAll()` in `ContactsView.tsx`** to merge 4 sources, each behind `try/catch`, deduped by phone:
   - **Internal extensions** — query `pbx_softphone_users` for current org via the existing `useOrgId()` resolver: `select extension,display_name,status,last_seen_at,portal_user_id` where `organization_id = orgId`. Render online dot from `status`/`last_seen_at` (5-min window, matching `OrgChatView` logic).
   - **PBX synced contacts** — `fusionpbx-proxy { action: 'sync-extensions' }` triggered only if no rows yet (graceful no-op for non-admins).
   - **org_contacts** — `select * from org_contacts where organization_id = orgId`.
   - **Zoho CRM** — call a new lightweight edge function `crm-contacts-list` that returns Zoho Contacts (Name, Phone, Email, Account) when the Zoho connector is linked; returns `[]` otherwise so the page never errors.
3. **UI per row**: name, ext/phone, online dot (green ≥ now-5min, grey otherwise), `Call` button (dispatches existing `lemtel:dial-number` window event), `★ favorite` toggle (writes back to `org_contacts`).
4. **"+ New Contact" dialog** — fields: name, phone, email, company, notes → insert into `org_contacts` (replaces the localStorage path, kept as fallback if insert fails).
5. Keep manual localStorage as a read-only legacy migration path: on first load, push existing LS rows into `org_contacts` then clear LS.

---

### Bug 2 — Customer creation: domain config incomplete

`LemtelCustomers.tsx` already calls `pbx-write` → `create-domain` and `setup_customer_organization`. What's missing per the bug: the form only collects `name`, `domain`, `adminEmail`. Phone numbers, address, and admin password are not captured, and the migration to add corresponding columns is missing.

**Fix**
1. **Migration** — add columns to `lemtel_customers`:
   `company_name text`, `address text`, `phone_numbers text[] default '{}'`, `domain_uuid text`, `domain_name text`, `admin_email text`.
   Backfill `domain_uuid`/`domain_name` from `organizations.fusionpbx_domain_uuid` where it can be resolved.
2. **Form expansion** in `LemtelCustomers.tsx` create dialog:
   - Company name (defaults to `name`)
   - SIP Domain (auto-`slugify(company).lemtel.tel`, editable — existing)
   - Phone numbers to port (chip input → `text[]`)
   - Address (textarea)
   - Admin email (existing) + Admin password (`min 12`, optional — when provided, edge function provisions the auth user with that password rather than emailing a magic link)
3. **`handleCreate` flow update** — after `create-domain` + `setup_customer_organization`, also:
   - `insert into lemtel_customers (...)` with new fields + returned `domain_uuid`/`domain_name`.
   - For each phone number, call existing `pbx-write` → `assign-number` (or queue via `lemtel_dids` insert) — best-effort, surface failures as `toast.warning`.
   - If `admin_password` is set, call new edge function `customer-provision-admin` (service role) that creates the auth user with that password + assigns `org_admin` role; otherwise keep current `customer-invite-admin` magic-link flow.
4. Validate domain string against `/^[a-z0-9-]+\.lemtel\.tel$/` before submit.

---

### Bug 3 — Add users to customer domain

`CustomerDetail.tsx` already has a Users tab + `handleAddUser` calling `customer-users-import`. What's missing per the bug: explicit "Set SIP password" field, phone-number assignment per extension, and the welcome-email send.

**Fix (all in `CustomerDetail.tsx` + edge function patch)**
1. Expand `addForm` state to: `extension`, `display_name`, `email`, `sip_password` (optional — auto-generate strong 16-char if blank), `assign_phone_number` (dropdown of unassigned numbers in `lemtel_dids` for this customer), `send_welcome_email` (default true).
2. Add inputs to the existing "Add User" dialog.
3. Pass new fields to `customer-users-import` body. Update that edge function (already exists) to:
   - Forward `sip_password` to `fusionpbx-proxy { action: 'create-extension', params: { ..., password: sip_password } }`.
   - If `assign_phone_number` set, call `fusionpbx-proxy { action: 'assign-number', params: { number, extension, domain_uuid } }` (action already exists in proxy; verify and add if missing — read-only inspection step at implementation time).
   - If `send_welcome_email`, invoke existing `send-transactional-email` with template `customer-welcome` (scaffold the template if absent — kebab-case `.tsx` under `_shared/transactional-email-templates/`, registered in `registry.ts`) and `templateData: { extension, sip_password, sip_domain, portal_url }`.
4. Show generated password in a one-time toast after creation (clipboard copy button), never persist in client state.

---

### Out of scope
- No changes to `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**`, `supabase/config.toml`.
- Mobile contacts UI — not in the bug list.
- Zoho CRM write-back (read-only sync only).
- Bulk number porting workflows (manual entry only this pass).

### Verification
- Type-check the changed files (`bunx tsc --noEmit`).
- Run the existing Vitest suite to ensure no regressions.
- Manual: create a test customer with all new fields → confirm `lemtel_customers` row, `pbx_domains` row, `organizations.fusionpbx_domain_uuid` link, and that adding an extension creates a SIP user + sends welcome email.
