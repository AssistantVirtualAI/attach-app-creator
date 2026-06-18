## Scope

Rework `src/pages/lemtel/CustomerDetail.tsx` (the per-domain admin page reached from the Customers list) so each domain is fully readable, syncable and editable against FusionPBX, and fix the "Manage as this tenant" button.

## Changes

### 1. Remove the Users tab

- Drop the `users` tab and all of its UI (CSV import, Add user dialog, invite-admin section, `spUsers` table, related state). The remaining tabs already cover what's needed.
- Set the default `tab` to `extensions` (current default is `users`).
- Keep `customer-invite-admin` reachable from the top header as a small "Invite admin" button (so admin promotion isn't lost) — it has no dependency on the Users tab.

### 2. Complete domain sync (one-click, all resources)

- Rewrite `syncAll` to call `fusionpbx-proxy` `sync-all` with **all** supported resources: `['extensions','devices','ivrs','queues','ring_groups','gateways','destinations','users','cdrs']`, followed by `sync-ivr-options` and `sync-voicemail-messages` for the same domain. Sequential so the toast can show progress per phase.
- The "Sync" button in the header becomes "Full sync from PBX" with a small spinner + stats toast (`X extensions, Y queues, …` from the `stats` object the function returns).
- Invalidate every `['fpbx', …, domainUuid]` query plus DB-backed queries (`pbx_extensions`, `pbx_call_records`, `pbx_voicemails`) after sync.

### 3. Editable / manageable tabs

Replace the read-only `SimpleList` usages with real management tables. All write actions go through `pbx-write` `update-*` / `delete-*` and refetch on success.

- **Extensions tab**: reuse the new `ExtensionsPanel`-style UI (checkbox multi-select, inline Edit / Enable-Disable / Reset-VM, bulk actions, retry + Sync now) that already exists in `LemtelCustomers.tsx`. Extract it to `src/components/lemtel/ExtensionsPanel.tsx` so both pages share it.
- **IVR tab**: keep current table; add Enable/Disable toggle (`update-ivr` with `ivr_menu_enabled`) and Delete (`delete-ivr`) per row, alongside the existing "Manage options".
- **Queues tab**: editable table with columns Name / Extension / Strategy / Enabled / Actions (toggle enabled, delete). Wired to `update-queue` / `delete-queue`.
- **Ring Groups tab**: editable table (toggle enabled, delete) → `update-ring-group` / `delete-ring-group`.
- **Devices tab (new)**: list `list-devices`; columns MAC / template / extension / enabled; actions edit description + toggle enabled + delete via `update-device` / `delete-device`.
- **Destinations tab (new)**: list `list-destinations`; columns Number / Context / Destination action / Enabled; inline edit destination target + enable/disable.
- **Recordings tab**: keep current Play/Hide UI; add a Delete button (DB delete on `pbx_call_records.recording_path` cleared) — non-destructive on PBX, just hides locally.
- **Music on Hold tab**: keep read-only list (no PBX write action available); add an upload button stub that calls existing `lemtel_ivr_audio`-style storage helper if present, otherwise hide if no helper exists.
- **Phone Numbers tab**: already managed by `PhoneNumbersTab` — no change.

### 4. Fix "Manage as this tenant"

The button is disabled because `org` is null when the FusionPBX domain has no matching `organizations` row.

- Detect that case and replace the disabled button with a **"Link tenant org"** action. It opens a small dialog with one field (org name, prefilled from `domain_description` or domain prefix) and calls the existing `setup_customer_organization(_name, _slug, _domain_uuid, _domain_name, _admin_email)` RPC. On success it refetches the org query so the button enables.
- When `org` exists, keep the current `impersonate()` flow but: (a) navigate to `/domain/${org.slug}/admin/dashboard` when a slug exists (matches the LemtelCustomers row click), falling back to `/console`; (b) await both `sessionStorage.setItem` and `impersonation.enter` before navigating so the next page boots with the right tenant context.
- Add an inline status pill near the title: green "Linked: {org.name}" or amber "No tenant org — click Link tenant org".

### 5. Code hygiene

- Remove now-unused imports (`Upload`, `UserPlus`, `Mail`, `SendAppInviteButtons`, `customer-users-import` calls, CSV parsing helpers) after deleting the Users tab.
- Extract repetitive `pbx-write` toggle/delete helpers into a small local `usePbxAction(domainUuid)` hook inside the file.

## Out of scope

- Backend / edge-function changes. `sync-all`, `update-*`, `delete-*` actions already exist in `fusionpbx-proxy` / `pbx-write`.
- The other Lemtel admin pages (Customers list etc.) — already handled in the previous turn.
- Auth/RLS changes.

## Files touched

- `src/pages/lemtel/CustomerDetail.tsx` (main rewrite)
- New: `src/components/lemtel/ExtensionsPanel.tsx` (extracted from `LemtelCustomers.tsx`)
- `src/pages/lemtel/LemtelCustomers.tsx` (swap inline `ExtensionsPanel` → import the shared component)
