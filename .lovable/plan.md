# Teams-style team chat (Slack-style, AVA-branded)

Reuses the existing `org_chat_*` tables, `user_presence`, `org_chat_reads`, `chat-attachments` storage bucket, and the `org-chat` edge function. Two UIs (web admin + desktop softphone) stay in perfect sync via Postgres Realtime + Realtime broadcast channels.

## 1. Backend (small additions only)

Single migration:
- `org_chat_typing` (ephemeral) — `channel_id, user_id, expires_at` with auto-expiry, RLS scoped to channel members. Used for typing dots; written via realtime `presence` channel primarily, table as fallback.
- `org_chat_message_pins` — pinned messages per channel with `pinned_by`, `pinned_at` (replaces array column for richer UX).
- New RPCs:
  - `create_group_chat(_name text, _member_ids uuid[])` → enforces caller is member, returns channel (replaces direct insert from desktop).
  - `mark_channel_read(_channel_id uuid)` → upserts into `org_chat_reads`.
  - `get_unread_counts()` → returns `{channel_id, unread}[]` for sidebar badges.
  - `pin_message(_message_id uuid)` / `unpin_message(_message_id uuid)`.
- Add to `org-chat` edge function: `create_group`, `mark_read`, `unread_counts`, `pin`/`unpin`, `typing` (broadcasts on realtime channel `chat:{channel_id}` only — no DB write).
- Realtime publication: add `org_chat_message_pins` and `org_chat_reads`.

No schema breaks — existing columns (`reactions`, `attachments`, `parent_message_id`, `reply_count`, `tsv`, `edited_at`, `pinned_messages`) are kept.

## 2. Shared chat hook layer (`src/hooks/useOrgChat.ts`)

Extend the existing hook with:
- `useUnreadCounts()` — polled + invalidated on new message.
- `useTyping(channelId)` — subscribes to realtime broadcast `chat:{id}` event `typing`, returns `{ typingUsers }`; exposes `sendTyping()` (throttled 2s).
- `useReadReceipts(channelId)` — subscribes to `org_chat_reads`, returns last-read-at per user.
- `usePinned(channelId)` — channel pins with optimistic toggle.
- `useGroupChat()` — `createGroup({name, members})` via edge fn.
- `useChatCallActions()` — wraps `lemtel:start-call` (desktop) / posts to softphone bridge (web) for "Call" buttons on DMs and groups.

## 3. Web UI — `src/pages/my/OrgChat.tsx` rewrite (Slack-style, AVA tokens)

```text
┌──────────────────────────────────────────────────────────────┐
│ AVA-glass top bar: workspace name • search • new chat       │
├──────────┬───────────────────────────────────────────────────┤
│ Sidebar  │  Channel header (name, members, 📞 call, pin)    │
│          ├───────────────────────────────────────────────────┤
│ Channels │                                                   │
│  # gen.. │  Message stream                                   │
│  # ops   │   • avatar + name + presence dot                  │
│  🔒 mkt  │   • markdown content                              │
│          │   • reactions row, "Reply in thread", edit/del    │
│ Groups   │   • attachment previews (img inline / file card)  │
│  👥 …    │   • date dividers, unread separator               │
│          │                                                   │
│ Direct   │  Typing: "Alice is typing…"                       │
│  🟢 Bob  │  Read receipts row under last own message         │
│  ⚪ Sue  │                                                   │
│          ├───────────────────────────────────────────────────┤
│ + New    │  Composer: 📎 file • 😊 emoji • @mention picker  │
│          │            multiline, ⌘↵ send                     │
└──────────┴───────────────────────────────────────────────────┘
            Right panel (slide-in) for active thread
```

Components (new, under `src/components/chat/`):
- `ChatSidebar.tsx` — channels, groups, DMs with unread badges + presence dots; "+ New chat" opens picker (DM / group / channel).
- `ChatHeader.tsx` — title, member avatars, **call** button, pin drawer trigger, info.
- `MessageList.tsx` — virtualized list, date dividers, unread marker, grouping consecutive messages by sender.
- `MessageItem.tsx` — avatar, name, time, markdown body, hover actions (react/reply/edit/delete/pin), reaction chips.
- `ThreadPanel.tsx` — right side panel using `useThread`.
- `Composer.tsx` — textarea, attachments dropzone (uses existing `uploadAttachment`), `@mention` autocomplete from directory, emoji picker, typing broadcast.
- `MentionPicker.tsx`, `EmojiPicker.tsx` (lightweight).
- `NewChatDialog.tsx` — tabs: DM / Group / Channel.

Styling uses semantic tokens from `index.css` (no hardcoded colors); AVA cyberpunk-glass cards, primary `#0023e6` accents, Inter body, dense Slack-like rows.

## 4. Desktop UI — `apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx` rewrite

Same component vocabulary, lighter (no react-query) — uses the desktop's own supabase client. Reuses backend actions through `supabase.functions.invoke('org-chat', ...)`. Adds: threads side panel, reactions hover bar, mentions, attachments upload, typing dots, unread badges, pinned drawer, **📞 call** button wired to `window.dispatchEvent('lemtel:start-call', { to })`.

## 5. Calling integration

- DM header → call button dials the other member's extension via existing `lemtel:start-call`.
- Group header → "Call group" creates an ad-hoc conference by dialing the FreeSWITCH conference extension `conf:{channel_id}` (config already supports dynamic conferences); a system message is posted in the channel so other members can join with one click.
- Web app reuses the same event channel through the softphone bridge iframe.

## 6. Realtime channels used

- `postgres_changes` on `org_chat_messages`, `org_chat_channels`, `org_chat_message_pins`, `org_chat_reads`, `user_presence` — unchanged subscriptions for sync.
- Realtime broadcast `chat:{channel_id}` events: `typing`, `stop_typing` (no DB writes — keeps it cheap).

## 7. Out of scope (this pass)

- Voice/video huddles inside the chat UI (calling still uses the softphone).
- E2E encryption, message scheduling, channel folders.
- Bot/app marketplace.

## Files touched

```text
supabase/migrations/<new>.sql                          (pins, typing, RPCs, realtime)
supabase/functions/org-chat/index.ts                   (+ create_group, mark_read, unread_counts, pin/unpin, typing)
src/hooks/useOrgChat.ts                                (+ unread/typing/pins/group hooks)
src/pages/my/OrgChat.tsx                               (rewrite using new components)
src/components/chat/*                                  (NEW: Sidebar, Header, MessageList, MessageItem, ThreadPanel, Composer, MentionPicker, EmojiPicker, NewChatDialog)
src/pages/telephony/TelephonyTeam.tsx                  (point to new hook signatures if needed)
apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx   (rewrite, same feature set)
apps/ava-softphone-desktop/src/components/chat/*       (NEW: mirror components, no react-query)
```

After implementation: typecheck the project, send/receive across web + desktop, verify DMs, group creation, threads, reactions, mentions, edit/delete, file upload + image preview, typing dots, unread badges, presence dots, search, pin/unpin, and the DM/group call buttons.
