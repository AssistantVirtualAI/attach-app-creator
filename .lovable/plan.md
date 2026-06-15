# Plan — Super-admin full portal, sidebar shell, recordings, Org Chat with presence

Five focused phases. Strictly additive; landing page untouched.

## Phase A — Login routing: super_admin → full admin portal
Today, signing in lands every user (including super_admins) on the extension/user workspace.

- Update post-login redirect logic (in `useAuth` / login pages) to:
  - If `has_role(uid, 'super_admin')` OR `is_lemtel_admin` → redirect to `/org/lemtel/admin` (full Lemtel admin portal).
  - Else if `org_admin` → org admin home.
  - Else → current `/workspace` (extension user UI).
- Add a "Switch to admin portal" entry in the user-workspace top bar when the signed-in user has admin rights (so they can flip between admin and personal workspace).

## Phase B — Sidebar shell for user workspace
Replace the current horizontal top tab bar (Home / Softphone / My Calls / Voicemail / Messages / Recordings / Org Chat / Telecom / AI Assistant / Downloads / Profile / Settings) with a collapsible left sidebar matching the admin sidebar style (shadcn `Sidebar`, `collapsible="icon"`).

- New `WorkspaceSidebar` with grouped sections:
  - Workspace: Home, Softphone, My Calls, Voicemail, Messages, Recordings
  - Collaboration: Org Chat, AI Assistant
  - Tools: Telecom, Downloads
- Header (top-right of workspace shell): avatar dropdown → Profile, Settings, Change password, Sign out. Avatar reads `profiles.avatar_url`; falls back to initials.
- Persist sidebar collapsed state in `localStorage`.

## Phase C — Profile page (self-only) + photo + password
- `/workspace/profile` shows only the signed-in user's profile (no other users). Avatar upload to `organization-assets` bucket under `avatars/{user_id}.{ext}`, writes `profiles.avatar_url`.
- `/workspace/settings` adds "Change password" section using `supabase.auth.updateUser({ password })` with current-password re-auth via `signInWithPassword`.
- Editable fields: display name, phone, language, timezone, notification prefs.

## Phase D — Recordings visible for the user's extension
Investigate why `/workspace/recordings` shows nothing for the signed-in extension, then:

- Resolve user's `extension_number` from `pbx_softphone_users` / `pbx_extensions` linked to `auth.uid()` and current `organization_id`.
- Query `pbx_call_recordings` filtered by `(caller_extension = X OR callee_extension = X)` AND `domain_uuid = resolved` AND `is_demo = false`.
- Add empty state ("No recordings for extension {X} in last 30 days") and date-range filter.
- Ensure RLS policy allows a user to read recordings where they were caller or callee (add policy if missing).
- Signed URL playback through edge function `get-recording-url` (no public bucket exposure).

## Phase E — Org Chat: directory + presence
Current Org Chat throws an error and shows no users.

- Fix the load error (check edge function / query against `org_chat_channels` and `profiles`); ensure it filters by current `organization_id`/domain.
- Directory panel listing every active member of the same org/domain from `org_members` joined with `profiles` and `user_presence`.
- Presence statuses: `available`, `busy`, `in_meeting`, `on_call`, `away`, `offline`. Driven by:
  - Heartbeat from client (updates `user_presence.last_seen_at` every 30s).
  - Auto `on_call` when softphone is in an active call.
  - Manual override dropdown in avatar menu (sets `user_presence.manual_status`).
- Clicking a user opens/creates a 1:1 DM channel in `org_chat_channels` and routes to it.
- Realtime updates via Supabase Realtime on `org_chat_messages` and `user_presence`.

## Technical notes
- Tables touched (no destructive changes): `profiles` (avatar_url already present), `user_presence` (manual_status column added if missing), `org_chat_channels` (ensure DM channel type), RLS policies for recordings.
- New edge functions: `get-recording-url` (signed URL), `ensure-dm-channel` (idempotent).
- New components: `WorkspaceSidebar`, `UserAvatarMenu`, `PresenceBadge`, `DirectoryPanel`, `ChangePasswordForm`, `AvatarUploader`.
- Routing change isolated to `useAuth` redirect resolver — landing page untouched.

## Order of execution
1. A (redirect) — unblocks your super_admin access immediately.
2. B (sidebar shell) + C (profile/password) — UX foundation.
3. D (recordings) — data fix.
4. E (Org Chat + presence) — biggest piece, last.
