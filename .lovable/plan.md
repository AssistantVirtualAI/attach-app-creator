## Goal
Let admins **create new** Extensions, IVRs, Call Queues (and confirm Ring Groups/Devices/etc) directly from the desktop admin console — not just edit existing ones.

## Current state
- `PbxResourceSection` already supports full CRUD (`+ New`, edit, delete) and routes through `fusionpbx-proxy` `create-${kind}` / `update-${kind}` / `delete-${kind}`. Devices, Phone Numbers, Ring Groups, Conferences, Hold Music, Dialplans, Time Conditions, Gateways already use it — so they already have "+ New".
- `fusionpbx-proxy` already implements `create-extension`, `create-ivr`, `create-ivr-option`, `create-queue`, `create-queue-agent`, plus update/delete counterparts.
- `pbxFieldSchemas.ts` already exposes `EXTENSION_GROUPS`, `IVR_GROUPS`, `QUEUE_GROUPS`, `RING_GROUP_GROUPS` (portal-parity).
- BUT: Extensions, IVRs, and Call Queues currently render through bespoke read-only-ish components (`ExtensionsTable`, `IvrsTable`, `QueuesTable` in `AdminView.tsx`) that don't expose a create button.

## Changes (desktop app only)

### 1. Extensions — replace `ExtensionsTable` with `PbxResourceSection`
- `kind="extensions"` `actionKind="extension"` `uuidField="extension_uuid"`
- `fieldGroups={EXTENSION_GROUPS}` `rules={EXTENSION_RULES}` (already defined)
- Columns: Extension, Effective Caller-ID, User Context, Enabled.
- Keep any existing row actions worth preserving (e.g., "Reset password", "View devices") by passing `rowActions`. If the legacy table only had Edit, drop it.

### 2. IVRs — replace `IvrsTable` with `PbxResourceSection`
- `kind="ivr-menus"` `actionKind="ivr"` `uuidField="ivr_menu_uuid"`
- `fieldGroups={IVR_GROUPS}`.
- Preserve "Manage Options" / TTS greeting row actions from the old component (call the same `create-ivr-option` / TTS endpoints).

### 3. Call Queues — replace `QueuesTable` with `PbxResourceSection`
- `kind="call-queues"` `actionKind="queue"` `uuidField="queue_uuid"`
- `fieldGroups={QUEUE_GROUPS}` `sheetWidth={720}`.
- Preserve "Agents" row action (opens existing agent picker that uses `create-queue-agent`).

### 4. Guard rails
- All three new sections inherit the existing conflict-merge dialog, audit log writes, validation, schema-mismatch banner, and theme-aware styling already in `PbxResourceSection` / `PbxEditSheet`.
- `canCreate` defaults to `true`; only render the "+ New" button when the user has admin role (existing `useDesktopRole` check around the AdminView shell — confirm it already gates the section).
- New records POST via `fusionpbx-proxy` exactly like the portal does, so portal ↔ desktop parity is preserved.

### 5. Remove dead code
- Delete the three legacy local components (`ExtensionsTable`, `IvrsTable`, `QueuesTable`) plus any helpers used only by them.

## Verification
- Build the desktop app (`bun run build` in `apps/ava-softphone-desktop`).
- In the running app: open Admin → Extensions / IVRs / Queues, click **+ New**, fill required fields, save → confirm row appears, then edit & delete also work.
- Confirm record shows up in the portal table for the same org (auto-sync event fires).
- Existing tests in `pbxSchemaParity.test.ts` continue to pass.

## Out of scope
- New fields beyond what the schema groups already cover.
- Portal-side changes.
- Backend / fusionpbx-proxy changes (all needed actions already exist).
