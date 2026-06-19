## Multi-Platform Bug Fix Plan

### Bug 1 — Live CDR sync
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE pbx_call_records, pbx_call_recordings, org_chat_messages, user_presence, pbx_softphone_users;` + `ALTER TABLE ... REPLICA IDENTITY FULL`.
- `useRealtimeCDR.ts` (mobile) & `useRealtimeSync.ts` (desktop): start in `connecting` state; only surface "temporarily unavailable" after first failed subscribe attempt (not on mount).
- Portal: add `useOrgRealtime` subscriptions on `pbx_call_records` in `TelephonyRecordings.tsx` and admin CDR pages.
- Auto-sync after call end: in `useSoftphone` end-call handler, `setTimeout(8000)` → invoke `fusionpbx-proxy` `sync-cdrs` → dispatch `lemtel:phone-sync-complete`.

### Bug 2 — Recordings + AI analysis
- Create bucket via `supabase--storage_create_bucket` (`call-recordings`, private).
- Rewrite `fusionpbx-proxy` `get-recording` action: PHP login flow (CSRF → POST login → GET `xml_cdr/download.php?id={uuid}` with PHPSESSID) → stream `audio/mpeg`. No bucket-first lookup.
- Idempotent pipeline already exists in `ai-transcribe-call` + `ai-analyze-call`; ensure they write `transcription`, `summary`, `sentiment`, `coaching_score`, `coaching_notes` to `pbx_ai_insights` (single source of truth).
- Add unified `CallIntelligencePanel` rendering (transcript expandable, summary, sentiment badge, score /10, coaching bullets) in: mobile `CallDetailScreen`, desktop `RecordingsView`, portal `TelephonyRecordings`, user portal call detail. All subscribe to `pbx_ai_insights` realtime → auto-update.

### Bug 3 — Domain chat `deleted_at`
- Migration: `ALTER TABLE org_chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ` + RLS policy `SELECT USING (deleted_at IS NULL)` + update existing queries to filter.
- Standardize channel name `org-chat-${organization_id}` on table `org_chat_messages` across desktop `OrgChatView`, mobile `ChatScreen`, portal `OrgChat`, user portal `Chat`.
- Sidebar: load members from `profiles` + `user_roles` joined with `user_presence` (online if `last_seen_at > now() - 5min`). Click member → open/create private channel via existing `create_group_chat` RPC with 2 members.
- Presence ping: every 60s call `upsert_user_presence('online', ...)` on all platforms (already exists in `usePresencePing` — extend to desktop + portal).

### Bug 4 — Desktop Admin wide mode
- In `AdminView.tsx` wide layout: left = domains list (existing), right = tabbed panel (Extensions / IVRs / Ring Groups / Queues / Registrations / Call History) for selected domain.
- Reuse hooks/actions from `src/pages/lemtel/admin/` (extensions CRUD via `fusionpbx-proxy` actions `create-extension`, `update-extension`, `delete-extension`, `list-active-calls`, `list-registrations`).
- New components under `apps/ava-softphone-desktop/src/components/console/admin/`: `DomainExtensionsPanel`, `DomainIVRsPanel`, `DomainRingGroupsPanel`, `DomainQueuesPanel`, `DomainRegistrationsPanel`, `DomainCallHistoryPanel`.

### Cross-platform realtime guarantee
Single migration enables realtime on `pbx_call_records`, `pbx_ai_insights`, `org_chat_messages`, `user_presence`, `pbx_softphone_users`. All UIs subscribe via existing `useOrgRealtime` / dedicated hooks → ≤2s propagation.

### Files touched (no edits to vite.config / electron-builder / .github)
- Migrations (realtime + `deleted_at` + RLS)
- `supabase/functions/fusionpbx-proxy/index.ts` (get-recording PHP flow)
- Storage bucket create
- Mobile: `useRealtimeCDR.ts`, `RealtimeStatusPill.tsx`, `ChatScreen.tsx`, `CallDetailScreen.tsx`, `useSoftphone.ts`
- Desktop: `useRealtimeSync.ts`, `AdminView.tsx`, `ConsoleLayout.tsx`, `OrgChatView.tsx`, new admin panels, `RecordingsView.tsx`
- Portal: `TelephonyRecordings.tsx`, `OrgChat` page, `CallIntelligencePanel.tsx`
- User portal: chat + call detail pages

### Confirm before build
This is a large change set across 4 platforms + backend. Approve to proceed, or tell me which bug(s) to tackle first (recommend order: Bug 3 schema → Bug 1 realtime → Bug 2 recordings/AI → Bug 4 desktop admin).
