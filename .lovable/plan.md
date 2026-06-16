# Plan — Universal Extension Sign-in + Auto Data Pull

## Goals
1. **Any extension** whose desktop/mobile app access is enabled by a Lemtel admin can sign in — not only extensions that happen to already be linked to a portal user account.
2. Once signed in, the app **auto-pulls everything tied to that extension**: CDRs, call recordings, voicemails, transcripts, SMS, presence — and keeps them fresh.

---

## Current state (what's blocking it)

- `SetupWizard` requires `supabase.auth.signInWithPassword` against an existing Supabase auth user, then gates on `my_platform_access_allowed('desktop')`.
- `pbx_softphone_users.portal_user_id` is the link between the SIP extension and the auth user. If it's `NULL`, the extension has **no way to sign in** even when `desktop_access_enabled = true`.
- `triggerCdrSync` only fires `fusionpbx-proxy sync-cdrs` (CDRs only). Recordings, voicemails, transcripts, SMS are not synced on login.
- RLS already supports extension-scoped reads via `is_my_extension_call` / `can_access_voicemail`, so once `portal_user_id` is set, reads work.

---

## Part 1 — Universal Extension Sign-in

### 1.1 Two supported sign-in modes in `SetupWizard`
- **Mode A — Email + password** (existing flow, kept as-is for users who already have a portal account).
- **Mode B — Extension + SIP password / PIN** (new). User enters `extension` + `sip_password` (or assigned PIN). This is the only credential most extensions have.

Wizard gets a toggle: "Sign in with email" ↔ "Sign in with extension".

### 1.2 New edge function `extension-signin`
Server-side (service role) so it can read `sip_password` and mint sessions.

Flow:
1. Receive `{ extension, password, sip_domain? }`.
2. Look up the matching `pbx_softphone_users` row (`extension` + optional `sip_domain`).
3. Reject if not found, if `app_access_enabled = false`, or if `desktop_access_enabled = false`.
4. Verify the password against `sip_password` (constant-time compare). Optional fallback: a hashed PIN column `app_login_pin_hash` (see 1.3) so admins can issue a separate app PIN without exposing SIP.
5. If `portal_user_id IS NULL`, **auto-provision**:
   - Compute a deterministic email: `ext-{extension}@{sip_domain or 'lemtel.tel'}` (or use `display_name` if it's already an email).
   - `supabase.auth.admin.createUser({ email, email_confirm: true, password: random })`.
   - Update the softphone row: `portal_user_id = new user.id`.
   - Insert into `organization_members` if missing.
6. Generate a session: `supabase.auth.admin.generateLink({ type: 'magiclink', email })` → extract the access/refresh tokens (or use `signInWithPassword` after setting a known password).
7. Return `{ access_token, refresh_token, extension, display_name, sip_domain, wss_url, organization_id }`.

Client then calls `supabase.auth.setSession(...)` and proceeds exactly like email login.

### 1.3 Migration — optional app PIN column
Add `app_login_pin_hash text` to `pbx_softphone_users` so admins can set an app-only PIN without sharing SIP secrets. Admin UI in `AdminView` gets a "Set app PIN" action that calls a new security-definer function `set_softphone_app_pin(_id, _pin)` (bcrypt via `crypt(pin, gen_salt('bf'))`).

### 1.4 Admin UX
In `AdminView` extension list, surface for every row:
- "App access" toggle (already exists via `set_softphone_app_access`).
- "Set app PIN" button.
- A copy-to-clipboard helper showing the **sign-in identifier** (extension + sip_domain) the user should type.

### 1.5 Gate hardening
`my_platform_access_allowed('desktop')` already checks the row. Keep it as a second-line check after `extension-signin` returns, so a revoked extension can't reuse a stale token forever — `App.tsx` revalidates on every cold start and signs out if it returns `false`.

---

## Part 2 — Auto-pull All Extension Data on Sign-in

### 2.1 New client hook `useExtensionDataSync(orgId, extension)`
Mounted once in `ConsoleLayout` after a session is active. On mount and on a 5-minute interval it fans out:

| Source | Edge function call | Purpose |
|---|---|---|
| CDRs | `fusionpbx-proxy { action: 'sync-cdrs', organization_id, extension, limit: 500 }` | Backfill missed/answered calls |
| Recordings | `fusionpbx-proxy { action: 'sync-recordings', organization_id, extension }` | Pull `pbx_call_recordings` rows + signed URLs |
| Voicemails | `fusionpbx-proxy { action: 'sync-voicemails', organization_id, extension }` | Populate `pbx_voicemails` |
| Transcripts | `pbx-ai { action: 'sync-transcripts', extension }` | Pull any ready transcripts |
| SMS threads | `pbx-sms { action: 'sync-threads', extension }` | Refresh `pbx_sms_threads` |
| Presence | `update_platform_seen('desktop')` RPC | Mark me online |

Each call is idempotent (uses `pbx_dedup_key` etc.). Failures retry with backoff, surface as a non-blocking toast.

### 2.2 Extend `fusionpbx-proxy` actions
Add `sync-recordings` and `sync-voicemails` branches (filtered by extension) if not already present. Use existing FusionPBX REST calls + `upsert` on `pbx_call_recordings` / `pbx_voicemails`.

### 2.3 Realtime subscriptions
After the initial pull, open Supabase Realtime channels on each table filtered by `organization_id = :orgId AND extension = :ext` so new rows appear without polling:
- `pbx_call_records`
- `pbx_call_recordings`
- `pbx_voicemails`
- `pbx_sms_messages`

Wire into existing views (`CallsView`, `RecordingsView`, `VoicemailView`, `MessagesView`) by exposing a small `useExtensionStream(table)` hook.

### 2.4 First-login deeper backfill
If the freshly-linked extension has zero rows in `pbx_call_records`, kick a one-time deeper sync (`limit: 2000`, last 90 days) and show a "Importing your history…" progress chip in the dashboard until it completes.

### 2.5 Verification surfaces
- Dashboard "Live Phone-System Brief" already shows totals — confirms data landed.
- New diagnostic in `AdminView → My account` button: runs `audit_my_recordings_access()` RPC and shows row counts for CDRs / recordings / voicemails so the user can confirm visibility.

---

## Technical Notes

- **Security**: `sip_password` never leaves the edge function; only the minted Supabase session is returned. PIN column stores bcrypt hash only. RLS unchanged — once `portal_user_id` is linked, existing `is_my_extension_call` policies cover reads.
- **Auto-link trigger** (`autolink_softphone_portal_user`) already exists for email matches; the new `extension-signin` does the link explicitly when no email match is possible.
- **No new tables**. One column added (`app_login_pin_hash`), one new edge function (`extension-signin`), one new client hook (`useExtensionDataSync`), one new sub-action set in `fusionpbx-proxy`.
- **Backwards compatible**: existing email/password users keep working unchanged.

---

## Deliverables checklist
- [ ] Migration: `app_login_pin_hash` column + `set_softphone_app_pin` SECURITY DEFINER function.
- [ ] Edge function: `supabase/functions/extension-signin/index.ts`.
- [ ] Edge function: extend `fusionpbx-proxy` with `sync-recordings` and `sync-voicemails`.
- [ ] Client: `SetupWizard` mode toggle + extension-signin call.
- [ ] Client: `useExtensionDataSync` hook mounted in `ConsoleLayout`.
- [ ] Client: realtime subscriptions in Calls / Recordings / Voicemails / Messages views.
- [ ] Admin UI: "Set app PIN" + sign-in identifier display.
- [ ] Dashboard: first-login backfill progress chip.

## Out of scope
- Mobile app (same plan applies but ships separately).
- Changing FusionPBX itself.
- Any landing-page or web-portal changes.
