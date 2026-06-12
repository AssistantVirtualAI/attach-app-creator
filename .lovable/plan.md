# Make Customers a real PBX-management hub + fix Recordings + per-user app access

The user wants four things on the web admin portal — and equivalents in the desktop app:

1. **Recordings page** is empty even though there are 237 CDRs (only 3 have a `recording_path`, and those paths point at FusionPBX disk, not Supabase storage). It must show every CDR with `has_recording = true` for the working domain and play audio through the `fusionpbx-proxy` `get-recording` stream that already supports range/CORS.
2. **Customers page** must be drill-down: clicking a domain opens a per-customer "Manage Phone System" workspace with tabs for Users / Extensions / IVR / Recordings / Music on Hold / Call Queues / Ring Groups, all scoped to that domain.
3. **Per-user App access toggle**: each PBX user can be granted or revoked access to the desktop + mobile softphone apps.
4. **Domain admins** (org_admin of a customer org) can manage their own phone system from the desktop app.

## 1 — Backend

### Migration (one)

```sql
-- App access flag on softphone users (default: keep current behaviour = allowed)
ALTER TABLE public.pbx_softphone_users
  ADD COLUMN IF NOT EXISTS app_access_enabled boolean NOT NULL DEFAULT true;

-- SECURITY DEFINER helpers --------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_softphone_app_access(_softphone_id uuid, _enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row public.pbx_softphone_users%ROWTYPE; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _row FROM public.pbx_softphone_users WHERE id=_softphone_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'softphone user not found'; END IF;
  IF NOT (public.is_super_admin(auth.uid())
       OR public.is_lemtel_admin(auth.uid())
       OR public.has_role(auth.uid(), _row.organization_id, 'org_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.pbx_softphone_users
     SET app_access_enabled=_enabled, updated_at=now()
   WHERE id=_softphone_id;
  RETURN jsonb_build_object('ok', true, 'app_access_enabled', _enabled);
END $$;

-- Is the current user (or a given email) allowed into the apps?
CREATE OR REPLACE FUNCTION public.my_app_access_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(bool_or(app_access_enabled), true)
  FROM public.pbx_softphone_users
  WHERE portal_user_id = auth.uid();
$$;
```

### Edge function: `supabase/functions/fusionpbx-proxy/index.ts`

- Make every `list-*` action accept an optional `body.domain_uuid` override so the same proxy works for any tenant domain (default keeps current `FUSIONPBX_DOMAIN_UUID`). Build `domainQ` dynamically per request.
- Add `org_admin` of the target tenant org to the authorization gate (lookup organization by `fusionpbx_domain_uuid` and allow `has_role(uid, that_org, 'org_admin')` in addition to Lemtel admins).
- Add `list-moh` → `music_on_hold?domain_uuid=…` (key `music_on_hold`) and `list-recordings` → `recordings?domain_uuid=…` (key `recordings`).

## 2 — Web (LemtelCustomers + new CustomerDetail page)

### `src/pages/lemtel/LemtelCustomers.tsx`

- Keep the table from the previous change, but the entire row becomes a `Link` to `/org/lemtel/admin/customers/:domain_uuid`. Remove the inline expand; the dedicated page replaces it.

### New `src/pages/lemtel/CustomerDetail.tsx` (route added in `src/App.tsx`)

```text
Tabs: [ Users · Extensions · IVR · Recordings · Music on Hold · Queues · Ring Groups ]
Top: domain name, tenant org link, total counts, "Sync now" + "Impersonate" buttons
```

- **Users tab** — `pbx_softphone_users` filtered by `sip_domain LIKE '%<domain_name>%'`. Columns: extension · display_name · linked portal email · App access (Switch wired to `set_softphone_app_access` RPC) · Status pill.
- **Extensions / IVR / Queues / Ring Groups / MoH** — `fusionpbx-proxy` list-* with `domain_uuid` override.
- **Recordings tab** — `pbx_call_records.select(…).eq('domain_uuid', d).eq('has_recording', true)`. Each row renders the existing `RecordingWavePlayer` fed by an object URL built from the `fusionpbx-proxy` `get-recording` stream (already fixed for playback).
- **Impersonate button** — for super_admin / lemtel_admin: sets a `LemtelActiveDomainContext` (sessionStorage `lemtel.activeDomain={uuid,name}`) and navigates to `/org/lemtel/admin/dashboard`; existing admin pages read that context to filter every PBX call by the active domain UUID.

### `src/pages/lemtel/admin/AdminRecordings.tsx`

- Change filter from `.not('recording_path','is',null)` to `.eq('has_recording', true)`.
- Replace Supabase storage `createSignedUrl` with a call to `fusionpbx-proxy / get-recording` for each row to build an object URL (already streams audio with `Accept-Ranges`).
- Respect the active-domain context (if super admin impersonating, filter `domain_uuid = activeDomain`).

## 3 — Per-user app access enforcement

- `src/components/auth/AppAccessGate.tsx` (new) — wraps softphone widget + desktop/mobile apps. Queries `my_app_access_allowed()`; if `false`, hides the SoftphoneWidget and shows a small banner "Phone app access disabled by your admin".
- Mount it inside `src/components/layout/AppLayout.tsx` around `<SoftphoneWidget />` and at the root of `apps/ava-softphone-desktop` / `apps/ava-softphone-mobile` shells.

## 4 — Desktop app

- `apps/ava-softphone-desktop/src/components/console/CustomersView.tsx`: make each row navigate to a new `/desktop/customers/:domain_uuid` route rendering a `CustomerConsoleView.tsx` with the same Users/Extensions/IVR/Recordings/MoH/Queues tabs (reusing the `ava.*` helpers + the proxy with `domain_uuid`).
- Add the App-access toggle column in the Users tab (calls `set_softphone_app_access`).
- `LeftRail.tsx`: when the desktop user is a tenant org_admin (not super), default to their own domain — the existing `useActiveDomain` hook already supports this; just remove the hard-coded `LEMTEL_DOMAIN` fallback for non-super users.

## Files

- `supabase/migrations/<new>.sql` — column + 2 RPCs
- `supabase/functions/fusionpbx-proxy/index.ts` — per-domain lists + auth widening + list-moh / list-recordings
- `src/pages/lemtel/LemtelCustomers.tsx` — row → Link
- `src/pages/lemtel/CustomerDetail.tsx` — **new**
- `src/pages/lemtel/admin/AdminRecordings.tsx` — has_recording filter + proxy URL
- `src/components/auth/AppAccessGate.tsx` — **new**
- `src/components/layout/AppLayout.tsx` — wrap SoftphoneWidget
- `src/App.tsx` — `/org/lemtel/admin/customers/:domain` route
- `apps/ava-softphone-desktop/src/components/console/CustomerConsoleView.tsx` — **new** (drill-down)
- `apps/ava-softphone-desktop/src/components/console/CustomersView.tsx` — row navigation + Users toggle
- `apps/ava-softphone-desktop/src/components/console/LeftRail.tsx` — drop hard-coded domain for non-super
- `apps/ava-softphone-desktop/src/lib/avaApi.ts` — `listExtensions/Queues/Ivrs/MoH/Recordings(domainUuid)` helpers + `setAppAccess`

No new secrets, no new buckets. Existing `lemtel-recordings` bucket stays untouched.
