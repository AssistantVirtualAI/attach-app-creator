## Goal

Every user that exists (or gets created) under the PBX must automatically exist as a sign-in account for the AVA Softphone desktop + mobile apps, sharing the same password as their PBX/SIP credential. Only **Lemtel super admins / Lemtel org admins** can grant or revoke app sign-in access — even a customer's own `org_admin` cannot. The same rule applies uniformly to every customer domain.

## Current state (verified)

- `pbx_softphone_users` already has `app_access_enabled`, `desktop_access_enabled`, `mobile_access_enabled` plus the `portal_user_id` link to `auth.users`.
- `set_softphone_app_access()` and `set_softphone_platform_access()` currently allow `org_admin` of the customer org to toggle access → this is what must change.
- `autolink_softphone_portal_user()` already best-effort links a softphone row to an existing `auth.users` row by email/extension.
- No mechanism currently *creates* an `auth.users` account from a new PBX extension, and no mechanism *seeds the password from the SIP password*.

## Plan

### 1. Lemtel-only gate (DB)

Rewrite the access mutators so only Lemtel can flip them:

- `set_softphone_app_access(_id, _enabled)` → permission check becomes
  `is_super_admin(auth.uid()) OR is_lemtel_admin(auth.uid())` (drop the customer `org_admin` branch).
- `set_softphone_platform_access(_id, _desktop, _mobile)` → same change.
- Add a new helper `lemtel_can_grant_app_access(_uid)` returning that boolean, used by both functions and by RLS on a new audit table.
- Audit every grant/revoke into `audit_logs` with `action='softphone_app_access_changed'` and actor metadata (already partially done — keep + standardize).

### 2. Default-deny on new softphone rows

Migration:
- `ALTER TABLE pbx_softphone_users ALTER COLUMN app_access_enabled SET DEFAULT false;`
- Same for `desktop_access_enabled`, `mobile_access_enabled`.
- Backfill rule: existing rows untouched; only new rows default off so nothing auto-leaks.

### 3. Auto-provision an `auth.users` account for every PBX extension

New SECURITY DEFINER function `provision_app_user_for_softphone(_softphone_id uuid, _password text)`:

1. Read the `pbx_softphone_users` row (org_id, extension, display_name, sip_domain).
2. Resolve a stable email:
   - prefer an email already embedded in `display_name`,
   - else synthesize `${extension}@${sip_domain}` (deterministic, recoverable).
3. If no `auth.users` row exists for that email → call the Lemtel-owned edge function `provision-app-user` (see step 4) to create it with the provided `_password`, mark email as confirmed, and insert a matching `profiles` row.
4. Set `pbx_softphone_users.portal_user_id` to the new uid.
5. Leave `app_access_enabled = false`. Sign-in still requires a Lemtel grant — provisioning ≠ access.

Trigger: `AFTER INSERT ON pbx_softphone_users` calls an edge-function webhook that performs steps above (Postgres cannot create auth users directly; must go through the Admin API).

### 4. Edge function `provision-app-user` (Lemtel-only)

- `verify_jwt = true`; caller must satisfy `is_lemtel_admin` or `is_super_admin`, OR be the trusted PBX sync job using a service-role secret.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to call `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { source: 'pbx', extension, org_id } })`.
- Password source order:
  1. caller-supplied `password` (Lemtel admin manual override),
  2. PBX SIP password fetched from the PBX sync payload (this is the "same password as PBX" requirement),
  3. fallback random + email reset.
- Idempotent: if user already exists, just (re)link `portal_user_id`.

### 5. Keep PBX ↔ app passwords in sync

In the existing PBX sync pipeline (the job that imports extensions):
- When a SIP password is created or rotated on the PBX side, the sync edge function calls `provision-app-user` with the new password, which uses `auth.admin.updateUserById({ password })`.
- This keeps "same password for PBX and app" continuously true.

### 6. App sign-in enforcement

- `my_platform_access_allowed('desktop' | 'mobile')` already exists and reads `desktop/mobile/app_access_enabled`. Confirm it returns `false` by default.
- Desktop + mobile sign-in flow: after successful Supabase password auth, call `my_platform_access_allowed(platform)`; if `false`, sign the session out immediately and show
  *"Your account exists but app access has not been granted by Lemtel."*

### 7. Admin UX (Lemtel-only screen)

- In the existing org-admin Settings → Members/Softphones surface, hide the access toggles unless `is_lemtel_admin || is_super_admin`. Customer org_admins see read-only "Access: granted/denied · contact Lemtel".
- Lemtel admins get a global "App Access" view (filter by org/extension) with toggles for desktop / mobile / both, calling the (now Lemtel-only) RPCs.

### 8. Verification

1. Apply migration; check `pg_proc` source of both mutators now references `is_lemtel_admin`.
2. As a customer `org_admin`, calling `set_softphone_app_access` must raise `forbidden`.
3. As Lemtel admin, toggle → `pbx_softphone_users.app_access_enabled` flips, audit row written.
4. Insert a fresh `pbx_softphone_users` row → trigger fires → edge function creates `auth.users` and links `portal_user_id`, with `app_access_enabled` still false.
5. Rotate the SIP password on PBX → sync runs → `auth.users` password updated; sign-in with new password works.
6. Sign in to desktop without a Lemtel grant → session immediately revoked with the expected message.

## Scope notes

- Backend-only (DB + 1 edge function) plus small UI gating in Settings; no landing/marketing changes.
- No changes to `auth.users` schema, no new tables required (we may add `pbx_app_access_audit` only if you want a dedicated audit table instead of reusing `audit_logs`).
- Secrets needed: `SUPABASE_SERVICE_ROLE_KEY` is unavailable on Lovable Cloud → the edge function will instead use the Lovable-managed admin client already used by other Lemtel admin functions in this project.
