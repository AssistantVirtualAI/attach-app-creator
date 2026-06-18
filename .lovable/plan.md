# Plan: Provider Credentials Hardening + Mobile Realtime/Theme

## 1. Provider Credentials Audit Log
- New table `provider_credentials_audit` (org_id, actor_user_id, actor_email, provider, action [create/update/delete/view/test], field_changed, ip, user_agent, created_at). RLS: only org admins + super_admin SELECT; service_role INSERT.
- Edge function `provider-credentials-audit-log` writes entries (called from `ProviderCredentials.tsx` on save/test/view).
- New tab "Audit Log" in `src/pages/lemtel/ProviderCredentials.tsx` showing paginated table with filters (provider, action, date range, actor).

## 2. Encryption-at-Rest + Field-Level Protection
- Store credentials in new table `provider_credentials_encrypted` (org_id, provider, ciphertext bytea, iv, auth_tag, key_version, updated_by). 
- Edge function `provider-credentials-vault` with actions `get/set/delete/list`:
  - AES-256-GCM via Deno `crypto.subtle`, key from secret `PROVIDER_CRED_ENCRYPTION_KEY` (request via add_secret if missing).
  - Field-level: each secret field encrypted individually so we can return masked values without decrypt.
  - Returns masked values by default; full reveal requires `reveal: true` + writes audit entry.
- Refactor `ProviderCredentials.tsx`:
  - Save/load through vault function (never store raw in frontend state after save).
  - Masking helper: show last 4 chars only; eye toggle calls reveal endpoint → auto-rehide after 30s.
  - "View instructions" modal per provider with step-by-step guide (Twilio/Telnyx/Skyetel/VoIP.ms) — links, screenshots placeholders, copy buttons for callback URLs.

## 3. Mobile "Calling Features" Screen
- New `apps/ava-softphone-mobile/src/screens/FeaturesScreen.tsx`: grid of feature cards (Hold, Mute, Transfer Blind, Transfer Attended, 3-Way Conf, Record, Park, Unpark, DND, Call Forwarding, DTMF, Voicemail, Call Waiting, Blocklist).
- Each card: icon, label, short description, availability badge (Available / Requires Active Call / Premium / Coming Soon), long-press tooltip via `<TooltipSheet>`.
- Add tab entry in bottom nav (or under MoreScreen as "Features").
- Availability rules derived from `useSoftphone()` state (call active, hold supported, license tier).

## 4. Realtime Per-Extension CDR
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_call_records;` and ensure REPLICA IDENTITY FULL.
- New hook `apps/ava-softphone-mobile/src/hooks/useRealtimeCDR.ts`:
  - Subscribes to `postgres_changes` filtered by `extension=eq.<ext>`.
  - Merges into local list; falls back to one initial fetch via `mobileApi.calls()`.
  - Cleanup on unmount.
- Replace 15s polling block in `CallsScreen.tsx` with the hook; keep `visibilitychange` as a soft refetch only.

## 5. Dark Theme Verification
- Audit `ActiveCallSheet.tsx` for each state (ringing, active, hold, transfer-in-progress, ended) — verify token usage, no hardcoded white/black, contrast AA.
- Add explicit state-scoped classes: `.state-ringing`, `.state-active`, `.state-hold`, `.state-transfer`, `.state-ended` in `styles.css` using existing tokens (cyan pulse for ringing, blue for active, amber for hold, violet for transfer, muted for ended).
- Sweep `CallsScreen`, `DialerScreen`, `MoreScreen`, `SettingsScreen` for residual hardcoded colors; convert to tokens.

## Technical Notes
- Files added: `provider-credentials-vault/index.ts`, `provider-credentials-audit-log/index.ts`, `FeaturesScreen.tsx`, `useRealtimeCDR.ts`, `ProviderInstructionsModal.tsx`, `AuditLogTab.tsx`.
- Migrations: 2 (audit table + encrypted table + realtime publication).
- Secret: `PROVIDER_CRED_ENCRYPTION_KEY` (32-byte base64) — will request via add_secret.
- No changes to landing, electron config, or workflows.

Approve to proceed.