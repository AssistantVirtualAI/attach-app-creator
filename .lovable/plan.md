## Scope

Fix the per-domain tenant page (`src/pages/lemtel/CustomerDetail.tsx` + related dialogs) so every PBX area is visible, editable end-to-end against FusionPBX, and the tenant-access actions work as intended. No new orgs created from this page.

## 1. Tab visibility / layout

Problem (screenshot): `TabsList` uses `flex flex-wrap` inside a fixed card; the second row of tabs (Phone Numbers, Call History, Recordings, Music on Hold) is clipped behind the content card.

- Replace `TabsList flex flex-wrap` with a single-row horizontally scrollable bar: `overflow-x-auto whitespace-nowrap` + a `min-w-max` inner flex, plus chevron-style fade. Keep all 10 tabs reachable.
- Make the active tab visually obvious (gradient underline matching the cyberpunk theme).
- Add a sticky sub-toolbar inside each tab card so action buttons (`+ New`, `Sync now`, filters) don't shift content.

## 2. Replace inline "Edit" with the full FusionPBX form (extensions)

The pencil/Edit in `ExtensionsPanel` currently opens a 2-field popup (description, caller ID). It must open the existing rich `src/components/lemtel/ExtensionEditDialog.tsx` (already loads `get-extension` and saves via `update-extension` with all FusionPBX fields: caller ID name/number, SIP password, voicemail password/enabled, DND, forward-all, call timeout, description, enabled, etc.).

- In `ExtensionsPanel`, delete the inline edit dialog and state (`editing`, `editDesc`, `editCid`, `saveEdit`).
- Mount `<ExtensionEditDialog>` instead; pass the live extension row mapped to the shape it expects (`pbx_uuid` = `extension_uuid`, `effective_cid_name`, `effective_cid_number`, etc.). After save, call `onChanged()` to refetch.
- Keep the bulk Enable/Disable/Reset VM/Delete toolbar and the per-row VM/Power/Delete quick actions.

## 3. Fix "Reset VM" creating a phantom extension

Current `callUpdate` posts `voicemail_password` + `voicemail_enabled=true` via `pbx-write update-extension`. Symptom suggests `extension_uuid` is being dropped on some rows, so FusionPBX inserts a new row.

- In `ExtensionsPanel.callUpdate`, hard-fail when `ext.extension_uuid` is falsy (toast + abort) and never send the row without it.
- Switch to the same payload shape `ExtensionEditDialog` uses (`{action:'update-extension', extension_uuid, extension, fields:{voicemail_password, voicemail_enabled:true}}` via `fusionpbx-proxy` directly) so the proxy path that worked for the dialog is the single source of truth.
- After reset, refetch and toast `PIN set to {extension}`.

## 4. IVR Edit = full FusionPBX form, fully synced

Replace the inline 3-column `EditableList` for IVR with a dedicated `IvrEditDialog` modeled on `IvrCreateDialog`:
- Loads the live row from `fusionpbx-proxy list-ivrs` (already cached) + fetches `ivr_menu_options` via `sync-ivr-options` / direct list.
- Fields: name, extension, greet long/short (text + audio file selector reusing `lemtel_ivr_audio`), exit action, direct-dial, timeout, invalid action, max failures/timeouts, enabled, description — i.e. parity with the FusionPBX `ivr_menus` table columns the proxy accepts (the proxy `update-ivr` forwards arbitrary fields via `writeCollection`).
- Save calls `update-ivr` with the full diff; cancel discards. Re-uses the existing `IvrOptionsDialog` for per-digit options.
- Keep create flow via existing `IvrCreateDialog`; add Edit button next to Options.

## 5. Devices — full management & "Add device"

Devices tab currently has no create button and only edits 2 fields.

- Add `+ New Device` button opening a new `DeviceCreateDialog` (POST `create-device` via pbx-write). Fields: MAC, template (dropdown from `pbxDeviceModels` data file already in repo), label/description, assigned extension (`device_user_uuid`), enabled.
- Replace `EditableList` row for devices with a `DeviceEditDialog` (parity with FusionPBX `devices` columns: mac, label, vendor, model, template, profile, enabled, description, plus device line: user_uuid/extension assignment, server, register name, register password, sip authorize, sip transport, sip port). Reuses `update-device`.
- Keep toggle enable/disable + delete inline.

## 6. Other tabs get the same "full-form Edit" pattern

For Queues, Ring Groups, Destinations, MOH: add a per-row `Edit` button that opens a dialog rendering every field the corresponding FusionPBX endpoint returns (auto-generated from the row keys so we don't miss columns), with typed widgets for known booleans/enums. Save via existing `update-queue` / `update-ring-group` / `update-destination` (MOH stays read-only — the proxy has no `update-moh`).

Cancel reverts unsaved changes. Save invalidates the matching `['fpbx', …]` query.

## 7. Call History & Recordings — make them appear

Both tabs already exist but are gated by `tab === 'history' | 'recordings'`. After fix #1 the tabs become reachable. Additional fixes:

- Show a clear empty state with `Sync now` (calls `sync-all` with `resources:['cdrs']` + `sync-voicemail-messages`) when zero rows; spinner while syncing.
- Default page size 50 with "Load more" up to 1000.
- Keep the search/date/extension filters already added.

## 8. "Link tenant org" → "Open tenant portal" (no org creation)

Rename and rework: the action must NOT create an `organizations` row inside Ava.

- Always show one primary button: **Open tenant portal** (works for every domain).
- Click sets `sessionStorage.lemtel.activeDomain = { uuid, name }` and navigates to `/c/{domain_name}` (the existing public-facing tenant portal route) inside a new tab, scoped to that domain. Logged-in Lemtel admins see the portal in admin view via the existing `useImpersonation` domain scope (no `organizations.id` required — pass the domain UUID).
- Drop the `setup_customer_organization` dialog (`linkOpen`, `linkName`, `linkEmail`) and the "No tenant org" amber pill. Replace the pill with a small "Domain: {domain_name}" chip.
- Keep "Invite admin" only when an `org` exists from the existing `get_org_by_fusionpbx_domain` lookup (real Ava org membership for that domain).

## 9. Data normalization (already partly done)

Extend the `normalize/pretty` helpers to coerce all imported PBX fields:
- Booleans: `'true'/'false'/0/1/null` → `on/off`.
- Phone numbers: E.164 best-effort via existing `lib/pbx/sources.ts` helpers if present, else raw.
- Empty/missing → `—`.
- Timestamps: localized `formatDistanceToNow` with fallback when null.

All edit inputs accept these normalized strings and round-trip them through the FusionPBX update payload unchanged when the user doesn't touch the field.

## Files

- `src/pages/lemtel/CustomerDetail.tsx` — tabs layout, Open tenant portal flow, wire new dialogs, remove Link/Linking state.
- `src/components/lemtel/ExtensionsPanel.tsx` — drop inline edit dialog, mount `ExtensionEditDialog`, harden `callUpdate` to require `extension_uuid`, route VM reset through proxy.
- New: `src/components/lemtel/IvrEditDialog.tsx`, `src/components/lemtel/DeviceCreateDialog.tsx`, `src/components/lemtel/DeviceEditDialog.tsx`, `src/components/lemtel/PbxRowEditDialog.tsx` (generic full-fields editor used for Queues / Ring Groups / Destinations).
- Minor: re-use `src/data/pbxDeviceModels.ts` for the device template dropdown.

## Out of scope

- Backend / edge-function changes. `fusionpbx-proxy` already supports `update-*` / `create-device` / `create-ivr`. MOH has no PBX write endpoint and stays read-only.
- Public tenant portal page itself (already exists at `/c/:domain`).
