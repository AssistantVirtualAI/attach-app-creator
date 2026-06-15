# Remaining Phases B–D + Presence — Implementation Plan

## Phase B — Workspace sidebar shell rewrite

Replace the current top tab bar in `PortalShells` (user workspace shell) with a collapsible left sidebar using shadcn `Sidebar` (`collapsible="icon"`). Mobile (Capacitor + small viewports) keeps a bottom tab bar fallback.

Layout:
```text
┌─Sidebar──────┬──────── Header (trigger + breadcrumbs + UserAvatarMenu) ─────┐
│ Workspace    │                                                              │
│  Dashboard   │                                                              │
│  Softphone   │                       <Outlet/>                              │
│  Calls       │                                                              │
│  Voicemail   │                                                              │
│  Recordings  │                                                              │
│  SMS         │                                                              │
│ Collaboration│                                                              │
│  Org Chat    │                                                              │
│  Contacts    │                                                              │
│ Tools        │                                                              │
│  Profile     │                                                              │
│  Settings    │                                                              │
│  AI Insights │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

New files:
- `src/components/portals/WorkspaceSidebar.tsx` — sections gated by `usePlatformAccess` + role; active route via `NavLink`; persists collapsed state in `localStorage("ava.sidebar.collapsed")`.
- `src/components/portals/UserAvatarMenu.tsx` — avatar, name, status pill; menu: Profile, Settings, Change password, Admin Portal (if super/lemtel admin), Sign out.
- Rewrite `src/components/portals/PortalShells.tsx` user shell to use `SidebarProvider` + `WorkspaceSidebar` + header with `SidebarTrigger`.

Admin shells keep current chrome; just inject `UserAvatarMenu` consistently.

## Phase C — `/my/settings` change-password + profile section

New page `src/pages/my/Settings.tsx` with three tabs (shadcn `Tabs`):
1. **Profile** — full name, avatar (uploads to `organization-assets`), status emoji default.
2. **Security** — change password form (`supabase.auth.updateUser({ password })` with confirm + zxcvbn-style strength meter), sign-out-all-sessions button.
3. **Notifications & Devices** — `user_notification_prefs` toggles + linked desktop/mobile platforms (read-only from `pbx_softphone_users.active_platforms`).

Wire `/my/settings` route. Existing `/profile` redirects to `/my/settings?tab=profile`.

## Phase D — Recordings RLS + extension-mapping audit (deeper)

Currently `AdminRecordings` "mine" scope returns empty even when the PBX has recordings. Root causes to fix:

1. **Mapping**: confirm `pbx_softphone_users.portal_user_id` is set for the signed-in user. Add a maintenance edge function `audit-my-recordings` that returns: resolved extension(s), domain, count of `pbx_call_records` where caller/callee matches, count of `pbx_call_recordings` joined, list of missing mappings.
2. **RLS**: review `pbx_call_recordings` policies — add policy `recordings_user_self` allowing SELECT when the row joins a `pbx_call_records` where the resolved extension matches caller/destination AND domain matches. Use the existing `is_my_extension_call` SECURITY DEFINER helper (already present) to avoid recursion.
3. **Backfill**: ensure `pbx_call_recordings_mirror_flags` trigger has run; expose a "Re-link my recordings" button on `/my/recordings` that calls the audit function and the existing reconcile function.
4. **UI**: new `/my/recordings` page (separate from admin) with date filter, search, play button via existing `pbxRecordingAudio`, transcript panel. Empty state explains exactly why (no mapping, no PBX recordings, RLS blocked).

Migration:
- New policy on `pbx_call_recordings` for user self-access.
- Optional: index `pbx_call_recordings (organization_id, pbx_uuid)` if missing.

## Phase E — Presence: manual override + auto `on_call` from softphone

1. **Manual override**: extend `UserAvatarMenu` with status submenu (Available, Busy, In meeting, Away, Do not disturb, Offline) + custom emoji/message field. Persists via existing `upsert_user_presence` RPC.
2. **Auto `on_call`**: hook into `useSoftphone` lifecycle — on session start call `upsert_user_presence({ call_state: 'on_call', status: previous })`; on session end revert to previous status (cache previous in `sessionStorage("ava.presence.prev")`).
3. **Heartbeat** already running from Phase A (`useChatHeartbeat` 30s). Add visibility/idle detection: after 5 min idle → `status='away'`; on focus return → revert.
4. **Desktop parity**: emit same presence updates from the Electron softphone via the existing supabase client wired in `apps/ava-softphone-desktop`.

## Acceptance checks
- Sidebar collapses to icon strip, state persisted across reload.
- `UserAvatarMenu` opens reliably (no z-index regression), shows correct super-admin "Admin Portal" link.
- `/my/settings` Security tab successfully changes password and signs other sessions out.
- A user with a recording in the PBX sees it under `/my/recordings`; empty state names the reason when none.
- Setting status to "Busy" persists across pages and is visible to teammates in Org Chat directory; placing a call flips status to `on_call` and reverts on hangup.

## Files touched (summary)
- new: `WorkspaceSidebar.tsx`, `UserAvatarMenu.tsx`, `src/pages/my/Settings.tsx`, `src/pages/my/Recordings.tsx`, `supabase/functions/audit-my-recordings/index.ts`.
- edit: `PortalShells.tsx`, `useSoftphone` (presence hooks), `App.tsx` routes, `useOrgChat` (idle detect), Electron softphone presence wiring.
- migration: recordings self-access RLS policy.

Order: B → C → E → D (D depends on knowing whether mapping or RLS is the blocker — audit function runs first inside D).
