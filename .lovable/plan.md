# Fix Extensions page + add PBX Users page

## Current state

- DB already has 21 rows in `pbx_extensions` for Lemtel, but every row has `sync_status = pending` and `last_synced_at = NULL`, one row has an empty `extension`, and `9999` is duplicated. So either:
  - the page renders but looks empty because of stale/blank rows + an active type filter, or
  - the current viewer is not a Lemtel member / super_admin and the three RLS policies on `pbx_extensions` hide everything.
- The sync route only fetches FusionPBX `/extensions`. FusionPBX also exposes domain `Users` (the admins/operators attached to the domain) — we never pull that, so there is no "Users" page to mirror what the PBX shows.

## What to build

### 1. Make `/org/lemtel/admin/extensions` actually show the extensions

- Add a diagnostic banner on `LemtelExtensions.tsx` that, when `all.length === 0`, calls a new SECURITY DEFINER function `audit_my_pbx_extensions_access()` and shows: row count visible to the user, whether they are `is_super_admin` / `is_lemtel_admin` / `is_lemtel_member`, and the last `sync-extensions` job result. This turns "nothing appears" into an actionable message.
- Force a fresh sync when the page mounts if `last_synced_at` is `NULL` for every row OR the most recent sync job is older than 30 min, instead of only on the user clicking "Resync".
- After sync, run a cleanup migration:
  - delete the row where `extension = ''` or `extension IS NULL`,
  - de-duplicate `(organization_id, extension)` keeping the row with the newest `last_synced_at` / `updated_at`,
  - add a partial unique index `(organization_id, extension) WHERE extension <> ''` so duplicates can't come back.
- In the mapper inside `fusionpbx-proxy` `sync-extensions`, set `sync_status = 'synced'` and `last_synced_at = now()` on every upsert so the "Last synced" header stops saying "never".
- Reset the type filter when it would hide every row (defensive: if `exts.length === 0 && all.length > 0 && typeFilter`, auto-clear it).

### 2. Add a real "PBX Users" page

FusionPBX `Users` (domain users) are different from `Extensions`. Mirror them in their own page:

- New migration: `pbx_domain_users` table with `organization_id`, `pbx_uuid` (user_uuid), `username`, `email`, `status`, `api_key`, `user_enabled`, `last_login_at`, `groups jsonb`, `last_synced_at`, `sync_status`, `raw_data jsonb`, unique `(organization_id, pbx_uuid)`. GRANTs for `authenticated` + `service_role`. RLS: same three policies pattern (`lemtel_staff_select`, `org_members_select`, `org_admin_modify`).
- New `sync-users` action in `fusionpbx-proxy` calling `users?domain_uuid=...` with a `mapUser` mapper, registered through the existing `genericSync`.
- New page `src/pages/lemtel/LemtelPbxUsers.tsx` modeled on `LemtelExtensions.tsx`: list, search, type/status badges, "Resync from PBX" button, link-to-portal-user button (reuses `admin_link_softphone_by_email` when a matching extension exists).
- Sidebar entry under the same Lemtel admin section: `Users` → `/org/lemtel/admin/users`, plus route in `App.tsx` wrapped in `LemtelAdminPage`.
- Update `SyncEverythingButton` to also fire `sync-users`.

### 3. Make the two pages feel like FusionPBX

- On `LemtelExtensions.tsx`, add a small tab strip at the top: `Extensions` (current page) | `Users` (links to the new page) so admins can switch the way they do in FusionPBX.
- Show a `SourceBadge` (already in `src/components/pbx/SourceBadge.tsx`) next to each row with `live`/`synced`/`stale` based on `last_synced_at` so admins immediately see what is fresh vs stale.

## Acceptance

- Opening `/org/lemtel/admin/extensions` as a Lemtel admin shows all extensions (no empty list), with a non-"never" last-synced timestamp.
- If the list is still empty, the page tells the user exactly why (no membership, sync failed with X, etc.).
- A new `/org/lemtel/admin/users` page lists the FusionPBX domain users for Lemtel and offers a "Resync from PBX" button.
- "Sync everything" pulls extensions AND users in one click.
- No duplicate `9999` row, no empty-extension row.

## Technical notes

- Files touched: `src/pages/lemtel/LemtelExtensions.tsx`, new `src/pages/lemtel/LemtelPbxUsers.tsx`, `src/hooks/usePbxData.ts` (add `usePbxDomainUsers`), `src/components/sidebar/sidebarConfig.ts`, `src/App.tsx`, `src/components/lemtel/SyncEverythingButton.tsx`, `supabase/functions/fusionpbx-proxy/index.ts`.
- Migrations: cleanup `pbx_extensions` duplicates + partial unique index; create `pbx_domain_users` with GRANTs + RLS; create `audit_my_pbx_extensions_access()` SECURITY DEFINER helper.
