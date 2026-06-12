## Plan: Fix "Aucun canal" + Team Chat with Members & DMs

### 1. Database migration
- Add missing column `org_chat_channels.archived_at TIMESTAMPTZ` (fixes the "column does not exist" error).
- Add `channel_type` value `'direct'` support (text column already, no enum change needed).
- Index: `(organization_id) WHERE archived_at IS NULL`.

### 2. Auto-create "general" channel on load
- In `OrgChatView.tsx`, before fetching channels, call existing RPC `ensure_general_channel(_org_id, _user_id)` — guarantees the user always sees at least one channel.

### 3. New left-side People panel
- Query `pbx_softphone_users` (org-scoped) joined with `user_presence` for live status (online / busy / away / offline) and `display_name`/`extension`.
- Show colored status dot + name; click a person → open or create a 1-to-1 DM channel.

### 4. DM channel creation
- Lookup helper: find existing `channel_type='direct'` channel whose `members` array equals `{me, them}`; if none, insert one (name = `dm:<sortedIds>`, `channel_type='direct'`, members = both ids).
- DMs are hidden from the "Channels" list and shown only in the People panel.

### 5. Group chat creation
- "+ New group" button → modal with name input + multi-select from the same member list → insert `channel_type='private'` channel with selected members + me.

### 6. Realtime presence
- Subscribe to `user_presence` postgres_changes for the org so the People panel updates live (cleanup channel on unmount).

### Files touched
- `supabase/migrations/<new>.sql` (add column + index)
- `apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx` (People panel, DM/group creation, ensure_general_channel call)

### Out of scope
- No changes to mobile app, AdminView, or any other previously-edited file.
