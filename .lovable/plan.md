
## Goal

From the Extensions admin table, allow super_admin / lemtel_admin / org_admin to:
1. **Reset an extension's password** — generates a new unified password, pushes it to FusionPBX + `pbx_softphone_users` + Supabase Auth, shows it once.
2. **Link an existing email** to an extension so that user can sign into the portal/softphone with that email + SIP password.
3. **Send a welcome email** so the user can set their own password (magic-recovery link).
4. Works for **any organization / domain**, not just Lemtel.

## Changes

### 1. New Edge Function: `extension-welcome-send`
`supabase/functions/extension-welcome-send/index.ts`

Input: `{ organization_id, extension, email?, mode: 'welcome' | 'reset-only' | 'link-only' }`

Flow:
- RBAC: super_admin OR lemtel_admin OR org_admin of `organization_id`.
- Locate `pbx_softphone_users` row for `(org, extension)`; create/refresh if missing via existing provisioning helper.
- If `email` provided:
  - Look up `auth.users` by email; create user if missing (`admin.createUser` with a random password, `email_confirm: true`).
  - Link `pbx_softphone_users.portal_user_id` to that auth user (uses existing `admin_link_softphone_by_extension_email` RPC).
- Call `set-unified-password` internally with `use_current_sip_password: true` so Auth password === SIP password.
- If `mode === 'welcome'`, generate a Supabase recovery link (`admin.generateLink({ type: 'recovery' })`) and enqueue an email through the existing Lovable auth-email hook (or via `send-transactional-email` if scaffolded) with:
  - extension number, SIP domain, temporary SIP password, "Set your password" button pointing at `/reset-password`.
- Audit into `pbx_softphone_portal_audit` + `audit_logs`.

### 2. UI: extensions table row actions
`src/pages/lemtel/LemtelExtensions.tsx` + `src/components/lemtel/ExtensionEditDialog.tsx`

- Add a "…" actions menu per row:
  - **Reset password** → confirmation, then calls `softphone-reset-password` + surfaces the new password in a copy-once dialog.
  - **Link email…** → small dialog (email input) → invokes `extension-welcome-send` with `mode: 'link-only'` (or reuses `admin_link_softphone_by_extension_email` when the auth user already exists).
  - **Send welcome email** → calls `extension-welcome-send` with `mode: 'welcome'`; toast confirms.
- Show current linked email + status badge in the row (already partially there through `softphoneByExt`).

### 3. Generic (multi-org) admin extensions page
`src/pages/admin/AllExtensions.tsx` (new) mounted at `/admin/extensions` behind super_admin / lemtel_admin.

- Same table + row actions as above, but with an **Organization / Domain** selector fed by `get_org_pbx_mapping()` (already exists).
- Reuses the same hooks, parameterised by `organization_id` (extend `usePbxExtensions` / `usePbxSoftphoneUsers` to accept an override org id; today they're pinned to `LEMTEL_ORG`).
- Add sidebar entry "All PBX Extensions" for super/lemtel admins.

### 4. Small hook refactor
`src/hooks/usePbxData.ts` — accept optional `orgId` argument; default remains `LEMTEL_ORG` so existing Lemtel screens are unchanged.

### 5. Email template
Reuse existing Lovable auth email hook if scaffolded; otherwise scaffold the transactional template `extension-welcome` (subject: "Your Lemtel/AVA extension is ready" — bilingual FR/EN body with extension, domain, temp password, "Choose your password" CTA).

## Out of scope
- Bulk send-to-all buttons (can add later once single-row flow is validated).
- Changing FusionPBX v_users passwords (only extension SIP password is rotated — v_users login stays managed via existing tools).

## Files touched
- `supabase/functions/extension-welcome-send/index.ts` (new)
- `supabase/functions/_shared/email-templates/extension-welcome.tsx` (new, if auth-email-hook is scaffolded)
- `src/pages/lemtel/LemtelExtensions.tsx`
- `src/components/lemtel/ExtensionEditDialog.tsx`
- `src/components/lemtel/ExtensionActionsMenu.tsx` (new)
- `src/pages/admin/AllExtensions.tsx` (new)
- `src/hooks/usePbxData.ts`
- `src/components/sidebar/sidebarConfig.ts` (add "All PBX Extensions")
- Route registration in `src/App.tsx` / router file
