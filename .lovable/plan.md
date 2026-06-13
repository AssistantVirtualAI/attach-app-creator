# Unified Password (Portal = Desktop = Mobile = PBX)

## Goal
Each user has **one password** that works for the portal login, the desktop app, the mobile app, and the SIP/PBX extension. Changing it in any one place updates the others. Existing users are migrated silently so the password they already use on their phone keeps working everywhere.

## Current state (what we found)
- **Portal login password** lives in Supabase Auth (`auth.users`, hashed — not readable).
- **SIP / extension password** lives in `pbx_softphone_users.sip_password` (plain text, service-role only) and mirrored in FusionPBX itself. Lemtel users may also have it in `lemtel_softphone_users.sip_password` (legacy column `n`).
- Desktop and mobile apps log in with the **portal** password, then call the `softphone-credentials` edge function to fetch the **SIP** password separately. The two are independent today.
- Provisioning is done by `provision-softphone-user` (generates SIP password, emails a magic-link to set the portal password). No sync between the two.

## Decisions (from your answers)
- **Source of truth going forward:** the portal password the user already uses.
- **Existing users:** silently overwrite — they keep using the password currently on their phone (which is the only one we can actually read), and that becomes their new portal password too.
- **Future changes:** bidirectional. Changing it on the PBX/admin side updates the portal login; changing it from the portal updates the PBX.

> Note on backfill direction: portal passwords are one-way hashed and cannot be read, so the only feasible one-time alignment is **PBX → portal** (push the existing `sip_password` into Supabase Auth for each linked user). After that initial alignment, ongoing changes flow in both directions per your preference.

## What we'll build

### 1. One-time backfill (existing users)
- Edge function `unify-passwords-backfill` (super-admin only) iterates every `pbx_softphone_users` row that has both `portal_user_id` and `sip_password`.
- For each, calls `auth.admin.updateUserById(portal_user_id, { password: sip_password })` using the service role.
- Mirrors the same value into `lemtel_softphone_users.sip_password` when a row exists for that extension.
- Writes an audit row (`pbx_softphone_portal_audit`, action `password_unified`) and returns a summary `{ updated, skipped, errors[] }`.
- Admin UI: a one-click "Unify all extension passwords" button in the Super Admin → PBX section.

### 2. Provisioning flow (new users)
- Update `provision-softphone-user` so that the generated SIP password is **also** set as the user's Supabase Auth password (`auth.admin.createUser({ password })` or `updateUserById` if the user already exists), instead of sending a magic-link "set your password" email.
- Welcome email is updated to include the password once (clearly labeled as the single password for portal/desktop/mobile/phone).

### 3. Bidirectional sync (ongoing)
- **PBX → Portal**: a single shared helper `setUnifiedPassword(userId, newPassword)` (edge function `set-unified-password`) updates, in order:
  1. `auth.admin.updateUserById` (portal),
  2. `pbx_softphone_users.sip_password` (+ `lemtel_softphone_users` mirror),
  3. FusionPBX extension via `fusionpbx-proxy update-extension`.
- All existing entry points are routed through this helper:
  - Admin "Reset SIP password" buttons in `PbxResourceSection` / `AdminView` / portal admin pages.
  - User "Change password" form in the portal profile page.
  - `provision-softphone-user` (initial creation).
- **Portal → PBX**: a Postgres trigger on `auth.users` is not allowed, so we expose a thin Edge Function `portal-password-changed` that the portal's "Change password" form calls right after `supabase.auth.updateUser({ password })` succeeds. It runs steps (2) and (3) above. (Supabase password-reset emails will additionally trigger the same hook from the `/reset-password` page after the new password is set.)

### 4. Safety & audit
- Every password change writes to `pbx_softphone_portal_audit` with actor, target user, source (`provision`, `admin_reset`, `user_self_serve`, `backfill`, `reset_link`).
- The unified password is never returned to the frontend except the one-time provisioning email; the SIP fetch path (`softphone-credentials`) stays unchanged.
- Backfill function is gated by `is_super_admin(auth.uid())`; per-user reset is gated by `is_lemtel_admin` or `org_admin` of the user's org, or the user themselves.

## Files / surfaces touched
- **New edge functions**: `unify-passwords-backfill`, `set-unified-password`, `portal-password-changed`.
- **Edited edge functions**: `provision-softphone-user` (use provided password as both portal + SIP, drop magic link path), `fusionpbx-proxy` (no change; already supports update-extension).
- **Frontend**:
  - `src/pages/ResetPassword.tsx` and the portal profile change-password form → call `portal-password-changed` after success.
  - Admin "Reset SIP password" actions (`apps/ava-softphone-desktop/src/components/console/admin/PbxResourceSection.tsx`, `src/pages/lemtel/admin/*`) → call `set-unified-password`.
  - New super-admin button: "Unify all extension passwords now".
- **No schema migration** is strictly required (columns already exist); we'll add one tiny migration only to add `password_synced_at timestamptz` to `pbx_softphone_users` for observability.

## Out of scope
- Forcing password complexity changes (we keep current rules).
- Rotating PBX_ENCRYPTION_KEY usage (currently unused; SIP password remains plaintext in DB, protected by column REVOKE + service-role-only access — same posture as today).
- Mobile/desktop UI changes for changing the password (still done from the portal; apps just pick up the new password on next login).
