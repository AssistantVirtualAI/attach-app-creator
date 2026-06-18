
# Plan — Lemtel customer onboarding end-to-end

Large scope. Shipped in 4 sequenced slices, each independently testable. I will execute slices 1→4 in order without stopping unless something blocks me.

## Slice 1 — Onboarding wizard (STEPS 1-2)

**Edge function `customer-provision` (new)** — single orchestrator so the UI doesn't juggle 7 sequential calls. Lemtel-admin-only.

Sequence inside the function:
1. Validate input (zod). Auto-derive SIP domain `slugify(company).lemtel.tel` if not provided.
2. `organizations` insert (name, slug, sip_domain, address fields, fusionpbx_domain_name).
3. `fusionpbx-proxy` → `create-domain`. Store returned `domain_uuid` on `organizations.fusionpbx_domain_uuid`.
4. `auth.admin.createUser` for admin email (random password, email confirmed) OR invite if exists.
5. `user_roles` insert `org_admin` + `organization_members` insert.
6. `billing_config` row (trial).
7. Optional: insert `phone_numbers` placeholder rows for `numbers_to_port[]` with status `pending_port`.
8. Invoke `customer-invite-admin` for welcome email (already deployed).
9. Mint two `app_login_tokens` (desktop + mobile) via existing `mint-app-login-token` function.
10. Return `{ organization_id, admin_email, temp_password, portal_url, desktop_invite_url, mobile_invite_url }`.

**UI — `src/pages/lemtel/LemtelCustomers.tsx`**: Replace "New Customer" dialog content with multi-step form using existing shadcn `Dialog`+`Form` (zod):
- Step 1: company + address
- Step 2: admin contact + auto-suggested SIP domain (editable)
- Step 3: numbers to port (dynamic array) + notes
- On submit → `supabase.functions.invoke('customer-provision', ...)`.

**Success screen** (new component `CustomerProvisionResult.tsx`): shows portal link, admin email + temp password (one-time reveal), Copy buttons for desktop/mobile invite URLs. Embeds `consume-app-login-token` deep links: `ava-desktop://invite?token=...` and `ava-mobile://invite?token=...` plus https fallback.

## Slice 2 — CustomerDetail tabs + Add User (STEPS 3-4)

**Page `src/pages/lemtel/CustomerDetail.tsx`** (extend if exists, else create) wired from row click in `LemtelCustomers`.

Tabs (shadcn `Tabs`):
- **Overview** — org info, sip_domain, fusionpbx_domain_uuid, address, phone numbers count, edit-in-place.
- **Users** — table from `pbx_softphone_users` filtered by `organization_id`. "Add User" dialog.
- **Phone System** — see Slice 3 (sub-tabs).
- **Call History** — reuse existing `AdminCallHistory` filtered by `organization_id` prop.
- **Recordings** — reuse existing `AdminRecordings` filtered by `organization_id`.
- **Settings** — domain settings (codec, dtmf, recording rule defaults) + `org_business_hours` editor.

**Add User flow** — new edge function `customer-add-user`:
1. Suggest next extension via SQL: `MAX(extension::int)+1` within domain, starting at 1001.
2. `auth.admin.createUser` (random password).
3. `user_roles` insert (role from form).
4. `fusionpbx-proxy` → `create-extension` with domain_uuid + SIP pwd.
5. `pbx_softphone_users` insert (extension, sip_domain, portal_user_id linked).
6. Send welcome email (Resend, reusing pattern from `customer-invite-admin`) — SIP creds + portal link.
7. Mint desktop + mobile `app_login_tokens` → return URLs.

UI dialog mirrors the slice-1 success screen.

## Slice 3 — Phone System CRUD (STEP 5)

Inside `CustomerDetail` "Phone System" tab, 4 sub-tabs. All writes routed through existing `usePbxAction` (`pbx-write` → `fusionpbx-proxy` with audit) — actions already supported per memory:

- **IVR**: list from `pbx_ivrs` + `pbx_ivr_options`. New IVR dialog: name, extension, greeting (textarea → `tts` field or file upload to Supabase Storage `pbx-ivr-audio` bucket); per-digit option editor; submit → `create-ivr` then loop `create-ivr-option`.
- **Ring Groups**: list from `pbx_ring_groups`. New dialog with member multi-select (from `pbx_extensions` of domain), per-member ring timeout, no-answer destination. Submit → `create-ring-group`.
- **Queues**: list from `pbx_call_queues`. New dialog with strategy, agents, max-wait, hold music. Submit → `create-queue` + loop `add-queue-tier`.
- **Phone Numbers**: list from `phone_numbers` filtered by `organization_id`. Assign (modal to pick from unassigned pool). Request Port → form that inserts into `number_porting_requests` (carrier, account number, PIN, numbers[], service address, desired date).

## Slice 4 — Small fixes

- **Recording CSRF in `fusionpbx-proxy`**: audit existing `get-recording` action; if it doesn't do (1) `GET /login.php` → parse `<input type=hidden name="csrf-name" value="csrf-val">`, (2) `POST /login.php` with username+password+csrf pair, (3) reuse `PHPSESSID` cookie for `GET /app/xml_cdr/download.php?id={uuid}` → return base64, then rewrite that path. Update `pbxRecordingAudio.ts` to call `{ action:'get-recording', xml_cdr_uuid }`.
- **Chat badge in `LeftRail.tsx`**: import `useOrgChat`, read `unreadCount`, render `Badge` next to MessageSquare icon when `>0`; clear on tab open (already handled by `mark_channel_read`).
- **Click-to-call in `ContactsView.tsx`**: ensure call button calls `sp.call(contact.phone_number)` from the shared `useSoftphone` instance; open `ActiveCallSheet` immediately.
- **Resend status panel** in `LemtelSettings` → Integrations tab: new edge function `resend-domain-status` (server-side fetch `https://api.resend.com/domains` with `RESEND_API_KEY`), returns `{ verified, status }` for `ava-telecom.ca`. UI shows green check or red warning + link to `https://resend.com/domains`.

## Files (high level)

New:
- `supabase/functions/customer-provision/index.ts`
- `supabase/functions/customer-add-user/index.ts`
- `supabase/functions/resend-domain-status/index.ts`
- `src/pages/lemtel/CustomerDetail.tsx` (+ tab components under `src/components/lemtel/customer-detail/`)
- `src/components/lemtel/CustomerProvisionResult.tsx`
- `src/components/lemtel/NewCustomerWizard.tsx`
- Migration: add `address_*`, `sip_domain` (if missing), `numbers_to_port` JSONB to `organizations`; create `number_porting_requests` if missing (the table already exists per supabase-tables list — will reuse).

Edited:
- `src/pages/lemtel/LemtelCustomers.tsx` — wizard + row click → detail.
- `supabase/functions/fusionpbx-proxy/index.ts` — fix `get-recording` CSRF flow if broken.
- `apps/ava-softphone-desktop/src/components/console/LeftRail.tsx` — unread badge.
- `apps/ava-softphone-desktop/src/components/console/ContactsView.tsx` — click-to-call wiring.
- `src/lib/pbxRecordingAudio.ts` — switch to `get-recording` action.
- `src/pages/lemtel/LemtelSettings.tsx` (or current integrations tab) — Resend status card.

## Out of scope (explicit)

- `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**` — untouched per directive.
- Landing page — locked.
- Lovable Emails infra — using Resend directly per prior decision.

Reply **approve** to start Slice 1, or tell me which slices to skip / reorder.
