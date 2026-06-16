# Team Chat: Receipts, Edits, Search, Moderation

Adds four features across the shared backend and both web + desktop chat UIs.

## 1. Read receipts (per-message, per-user)

- New table `org_chat_message_receipts(message_id, user_id, read_at, PK(message_id,user_id))` with RLS scoped to channel access.
- RPC `mark_messages_read(_channel_id, _up_to)` — bulk-upserts receipts for every message in the channel up to `_up_to` (defaults to now), plus updates `org_chat_reads` for the unread badge.
- RPC `get_message_receipts(_message_id)` returns `{user_id, read_at}[]`.
- Realtime: add table to `supabase_realtime` publication.
- UI: small avatar stack / "Seen by N" under own messages (hover → list of names + timestamps). Auto-mark visible messages on scroll/focus.

## 2. Message editing + audit trail

- New column on `org_chat_messages`: `edited_at timestamptz`, `edit_count int default 0` (if missing).
- New table `org_chat_message_edits(id, message_id, edited_by, previous_content, new_content, edited_at)` — append-only.
- Trigger on `UPDATE` of `org_chat_messages.content`: when `OLD.content <> NEW.content`, insert into `org_chat_message_edits`, set `edited_at = now()`, increment `edit_count`. Skips when `sender_id` changes (system updates).
- `org-chat` edge function: new `edit_message` action — verifies `auth.uid() = sender_id`, updates content. Realtime row update propagates.
- RPC `get_message_edit_history(_message_id)` returns full history (sender or org admin only).
- UI: hover/dropdown on own message → "Edit"; inline editor; "(edited)" label with hover popover of history.

## 3. Global chat search

- Already have `tsv` column + trigger on `org_chat_messages` (french config) — reuse.
- RPC `search_chat(_q text, _limit int default 50)` → returns messages (with channel + sender metadata + snippet via `ts_headline`) the user can access, ordered by rank then recency.
- RPC `search_chat_users(_q text)` → returns directory members (name/email/extension/avatar) matching query within accessible orgs.
- UI: search bar in chat sidebar header → opens results panel with two sections (Messages, People). Clicking a message scrolls to it in its channel; clicking a person opens/creates a DM.

## 4. Moderation: block, report, hide

- `org_chat_blocks(blocker_id, blocked_user_id, created_at, PK(blocker_id, blocked_user_id))` — per-user; blocked users' DMs auto-hidden and their messages in shared channels rendered as collapsed "Hidden message" (expandable).
- `org_chat_reports(id, message_id, channel_id, organization_id, reporter_id, reason, status, created_at, reviewed_by, reviewed_at, resolution)` — RLS: reporter or org admin.
- `org_chat_messages.is_hidden boolean default false`, `hidden_by uuid`, `hidden_reason text`. Admin-only update via RPC `hide_chat_message(_message_id, _reason)` / `unhide_chat_message`.
- Edge function actions: `block_user`, `unblock_user`, `report_message`, `hide_message`, `unhide_message`, `list_reports` (admin).
- UI:
  - Message action menu: "Report", "Hide" (admin), "Block sender" (DM/group).
  - Hidden messages show placeholder + reason; admins can reveal/unhide.
  - Sidebar: filter out DMs with blocked users; blocked users' messages in group channels collapsed.
  - New "Reports" panel for org admins (badge count) listing open reports with one-click hide/dismiss.

## Files

- New migration `..._chat_receipts_edits_search_moderation.sql`
- `supabase/functions/org-chat/index.ts` — add 9 actions
- `src/hooks/useOrgChat.ts` — new hooks: `useMessageReceipts`, `useEditMessage`, `useChatSearch`, `useBlockedUsers`, `useReportMessage`, `useHideMessage`, `useReports`
- `src/pages/my/OrgChat.tsx` — wire search bar, receipts, edit UI, message action menu, reports panel
- `src/components/chat/*` — `MessageReceipts.tsx`, `MessageEditor.tsx`, `ChatSearchPanel.tsx`, `ModerationMenu.tsx`, `ReportsPanel.tsx`
- `apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx` — mirror the above (lighter, no react-query)

## Technical notes

- All RPCs `SECURITY DEFINER` with `current_user_org_ids()` membership check.
- Receipt writes batched (one upsert per channel mark-read event, not per message).
- Search uses `plainto_tsquery('french', _q)` + ILIKE fallback for short queries.
- Realtime publication updated for new tables: receipts, edits, blocks, reports.
- Admin check uses existing `has_role(auth.uid(), org_id, 'org_admin')` / `is_super_admin`.

## Out of scope

- DM-level encryption, per-message reactions on read receipts, moderator queue assignment, automated abuse classification.
