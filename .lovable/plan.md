# Fix layout spacing + load real Customers from FusionPBX

Two unrelated issues affect the web admin portal at `/org/lemtel/admin/*`:

## 1. The empty space between sidebar and main content

The previous fix only touched `src/App.css` (removed `#root` max-width) — but the actual offset comes from the admin shell. In `src/components/portal/LemtelPortalShells.tsx`, `AdminPortalLayout` and `UserPortalLayout` only wrap children with `<div className="space-y-5">` — fine — but `AppLayout` main uses `p-4 lg:p-6` while the Customers page itself adds its own padding-less container. The visible gap in the screenshot is the **gradient cockpit background showing through** because the page content is not stretched to `w-full`.

Fixes:
- `src/components/portal/LemtelPortalShells.tsx` → wrap children in `<div className="space-y-5 w-full max-w-none">` and make the shell header full-width.
- `src/components/layout/AppLayout.tsx` → change `<main>` content wrapper from `p-4 lg:p-6 flex-1 w-full max-w-full` to `px-4 lg:px-6 py-4 flex-1 w-full min-w-0` and remove the `space-y` ancestors that compress children.
- `src/pages/lemtel/LemtelCustomers.tsx` → ensure top container is `space-y-6 w-full` (and any sibling admin pages that use `<div className="space-y-6">` get the same `w-full`). This single change in `AdminPortalLayout` will cascade to every admin page since they all render through `LemtelAdminPage`.

No other admin pages need per-file edits — the shell change covers them all.

## 2. Customers page must list every FusionPBX domain + its PBX users

Today `src/pages/lemtel/LemtelCustomers.tsx` uses `usePbxClients()` which reads the local `clients` table — that's why the page shows "0 customers" even though FusionPBX has many domains. Replace with a real PBX-backed fetch.

Data flow:

```text
LemtelCustomers
   │
   ├── supabase.functions.invoke('fusionpbx-proxy', { action: 'list-domains' })
   │        → returns [{ domain_uuid, domain_name, domain_description, domain_enabled }]
   │
   ├── supabase.from('pbx_extensions').select('domain_uuid, extension, effective_caller_id_name, user_record')
   │        → grouped by domain_uuid for the expand-row "users" view
   │
   └── supabase.from('organizations').select('id,name,fusionpbx_domain_uuid')
            → optional join so we can show the linked tenant name
```

UI changes in `LemtelCustomers.tsx`:
- Remove `usePbxClients` and the local-clients dialog/delete logic; keep "New Customer" but route it through the existing `pbx-write / create-domain` edge function so creating a customer provisions a domain on FusionPBX directly (already implemented earlier).
- Table columns: Domain · Tenant · Extensions (count) · Numbers (count) · Status · Created · Actions.
- Add an expandable row per domain that lists the PBX extensions/users (extension number, caller id name, enabled). Reuse `pbx_extensions` rows already in the local cache; if none for a domain, call `fusionpbx-proxy` `list-extensions` lazily with `{ domain_uuid }`.
- Add a "Sync" per-row button → invokes `fusionpbx-proxy` `sync-all` with that domain's UUID so the local cache refreshes.

## Files touched

- `src/components/portal/LemtelPortalShells.tsx` — full-width wrapper
- `src/components/layout/AppLayout.tsx` — main padding/width tweak
- `src/pages/lemtel/LemtelCustomers.tsx` — rewrite data source to FusionPBX domains + expandable users
- (optional) `supabase/functions/fusionpbx-proxy/index.ts` — already supports `list-domains` and `list-extensions`; no edge function changes needed.

No DB migrations, no new edge functions, no new secrets.
