# Email Login + NS-API Identity Migration

Migrate 355 Planiprêt brokers from extension@domain SIP login to email+password / Microsoft SSO, with NS extensions auto-resolved behind the scenes.

## 1. Database (migration)

Add to `planipret_profiles`:
- `ns_extension`, `ns_domain` (default `planipret.ca`), `ns_sip_username`
- `ns_sip_password_ref` (Vault secret name, not plaintext)
- `ns_linked`, `ns_linked_at`, `ns_link_method`
- `auth_method`, `login_email`

New table `planipret_ns_migration_log` (broker_id, ns_extension, ns_email_from_api, portal_email, match_status, match_confidence, reviewed). GRANTs + RLS (admin-only via `has_role`).

**SIP password storage**: use Supabase Vault — store secret name in column, decrypt only inside `ns-resolve-sip-credentials` Edge Function. Never returned to admin UI.

## 2. Edge Functions (new)

- **`ns-email-migration-match`** — paginates `/domains/planipret.ca/users` (all ~355), matches against `planipret_profiles.email` (exact case-insensitive trimmed → auto-link; local-part fuzzy → review queue; else no_match). Writes log rows. Returns summary counts.
- **`ns-resolve-sip-credentials`** — input `broker_id`; reads `ns_extension`/`ns_sip_username`; ensures softphone device exists on NS-API (GET then POST device if missing); stores password in Vault on first generation; returns `{ sip_username, sip_domain, sip_proxy, sip_password }` once over TLS, no logging.
- **`ns-manual-link`** — admin endpoint to confirm/reject fuzzy matches, link by extension lookup, or create new broker from NS data.
- **`pp-broker-onboarding-email`** — sends Resend email per broker with their email + extension; tracks send status in migration log.

Auth-guard all with `has_role(auth.uid(),'admin')` via service-role client.

## 3. Admin UI — `/planipret/admin/integrations` (NS-API card) + column in `/planipret/admin/users`

New section **"Migration — Lier courriels aux extensions"**:

- **Panel A**: `[▶ Lancer la correspondance automatique]` button → calls match function, shows progress.
- **Panel B**: 4 stat cards (auto-linked / fuzzy pending / no_match NS / no_match portal).
- **Panel C**: Manual review table from `planipret_ns_migration_log` with per-row actions:
  - Fuzzy → side-by-side emails, Confirm/Reject.
  - NS-only → link to existing broker dropdown OR create new broker (reuse existing modal pre-filled).
  - Portal-only → extension input + validate-and-link.
- **Panel D**: `[📧 Envoyer les instructions de connexion]` bulk email button (after migration complete).
- **PAUsers column** `🔗 NS lié`: ✅ Lié (ext XXXX) or ⚠️ Non lié (opens manual link modal).

## 4. Mobile login redesign (`/mplanipret`)

Replace current screen. Equal-weight options:
1. `🔵 Se connecter avec Microsoft` (existing MS SSO).
2. `── ou ──`
3. Email + password form (placeholder `prenom.nom@planipret.ca`, show/hide toggle, `Mot de passe oublié?`).

**Remove**: any extension@domain field, any SIP password field.

## 5. Post-login resolver flow

After `supabase.auth.signInWithPassword` OR Microsoft SSO succeeds:
1. Fetch profile `ns_linked` + extension.
2. If `ns_linked=false` → one-time "Configuration requise" screen: extension input → calls `ns-manual-link` self-service.
3. If linked → call `ns-resolve-sip-credentials`, configure PJSIP silently, show `🟢 En ligne — Extension XXXX` pill on Home.

## 6. Password management

- Add/Edit broker modal: confirm `Mot de passe initial` calls `supabase.auth.admin.createUser({email, password, email_confirm:true})` then upserts profile linked to that auth uid.
- Row action **Réinitialiser le mot de passe** (admin trigger reset email or set temp password).
- Mobile **forgot password**: `resetPasswordForEmail` with `redirectTo: ${origin}/mplanipret/reset-password`; build that page.

## 7. Onboarding email (Step 6)

French template per spec, sent via Resend connector (already configured) — broker first name, login email, extension. Status tracked in migration log (`onboarding_email_sent_at`).

## 8. Verification

Document QA steps in admin UI: run match → resolve queue → confirm 355 ✅ → test 2-3 brokers end-to-end (email/pwd + MS SSO) → confirm SIP auto-registers → only then trigger bulk email.

## Technical notes

- NS-API pagination: use `start`/`limit` (1-based) per existing `pp-ns-users` convention; loop until `< limit`.
- All NS-API calls reuse existing `pp-ns-*` helpers / static key auth.
- Vault encryption: `vault.create_secret(value, name)` → store name in `ns_sip_password_ref`; decrypt via `vault.decrypted_secrets` view inside edge function only.
- Idempotent: re-running auto-match skips already-linked rows; new brokers picked up automatically.
- No changes to landing page or Lemtel paths.
