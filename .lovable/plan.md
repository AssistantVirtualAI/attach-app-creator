# Lemtel Telecom 2.0 — Enterprise Telephony Suite

Eight feature areas delivered across **desktop** (`apps/ava-softphone-desktop/`), **mobile** (`apps/ava-softphone-mobile/`), and the **portal** (`src/`), backed by shared Supabase schema, RLS, edge functions, and Realtime channels.

Delivered in 6 sequenced phases. Each phase is independently shippable and verified before the next starts. Versions bump to `2.0.0` at the end of Phase 6.

---

## Phase 1 — Foundation: schema, RLS, realtime, presence

Goal: every later phase reads/writes against a stable backend.

**Database migration** (single file):
- `org_chat_channels` — id, organization_id, name, description, channel_type (`public|private|dm`), created_by, members uuid[], pinned_messages uuid[], timestamps.
- `org_chat_messages` — id, organization_id, channel_id, sender_id, sender_name, sender_extension, recipient_id, message_type (`text|file|call_log|voicemail|ai_summary`), content, attachments jsonb, reactions jsonb, reply_to, read_by uuid[], edited_at, created_at.
- `user_presence` — user_id UNIQUE, organization_id, extension, status (`available|busy|away|dnd|offline|out_of_office`), status_message, status_emoji, return_at, call_state (`idle|ringing|active|held`), platform, last_seen_at.
- `pbx_voicemails` — id, organization_id, extension, mailbox, caller_number, caller_name, received_at, duration_seconds, audio_storage_path, transcript, ai_summary, ai_tags text[], folder (`inbox|archived|trash`), read_at, deleted_at.
- `pbx_voicemail_settings` — user_id UNIQUE, greeting_type (`default|custom|tts`), greeting_storage_path, greeting_tts_text, pin_hash, transcription_enabled, notify_email, notify_sms, notify_push, attach_audio_email.
- `pbx_call_forwarding` — user_id UNIQUE, organization_id, always_to, busy_to, no_answer_to, no_answer_seconds, offline_to, dnd_enabled, dnd_schedule jsonb, allow_from (`all|team|whitelist`), whitelist text[].
- `pbx_call_recording_rules` — user_id UNIQUE, record_all, record_inbound, record_outbound, announce, retention_days.
- `pbx_user_devices` — id, user_id, platform, device_name, last_active_at, push_token, current_session bool.
- `pbx_queue_agent_state` — user_id, queue_id, queue_name, paused, joined_at, last_call_at.
- `ALTER pbx_call_records ADD notes text, tags text[], crm_synced bool, recording_url text`.
- Extend `pbx_softphone_users`: `custom_status text`, `status_emoji text`, `out_of_office_until timestamptz`.

Each new public table gets the standard 4-step structure (CREATE → GRANT to `authenticated` + `service_role` → ENABLE RLS → CREATE POLICY). Policies scope every row to `organization_id IN (SELECT organization_id FROM pbx_softphone_users WHERE portal_user_id = auth.uid())` via a `SECURITY DEFINER` helper `current_user_org_ids()` to avoid recursion. Per-user tables (forwarding, voicemail settings, recording rules) restrict to `auth.uid()`.

**Realtime publication**: add `org_chat_messages`, `user_presence`, `pbx_voicemails`, `pbx_call_records`, `pbx_sms_messages`, `pbx_softphone_users` to `supabase_realtime` with `REPLICA IDENTITY FULL`.

**RPCs**:
- `upsert_user_presence(_status, _message, _emoji, _call_state, _platform)`
- `mark_voicemail_read(_id)`, `delete_voicemail(_id)`
- `set_call_notes(_call_id, _notes, _tags)`
- `toggle_queue_pause(_queue_id, _paused)`

**Storage buckets**:
- `voicemail-audio` (private) — RLS: read/write only by owner extension's org members.
- `voicemail-greetings` (private) — owner-only.
- `chat-attachments` (private) — org-scoped read, sender write.

**Shared hooks (portal + apps reuse the same SIP/presence code path)**:
- `src/hooks/usePresence.ts` — heartbeat every 30s + on JsSIP state change; broadcasts to `user_presence`.
- `src/hooks/useTeamPresence.ts` — Realtime subscription for org members.
- `src/hooks/useOrgChat.ts` — channels + messages + send/react/edit/delete.
- `src/hooks/useVoicemail.ts` — list + play + transcribe + delete.
- `src/hooks/useCallForwarding.ts`, `useRecordingRules.ts`, `useDevices.ts`, `useQueueAgent.ts`.

**Edge functions (new/updated)**:
- `fusionpbx-proxy` — add actions: `list-voicemails`, `download-voicemail`, `delete-voicemail`, `update-greeting`, `update-forwarding`, `set-dnd`, `blf-subscribe`, `queue-list`, `queue-pause`, `queue-stats`.
- `voicemail-sync` (cron-triggerable, also manual) — pulls FusionPBX voicemails into `pbx_voicemails` + storage, kicks off `ai-transcribe-call` for new audio.
- `voicemail-greeting-tts` — generates TTS greeting via ElevenLabs, uploads to bucket.
- `queue-blf-poll` — 5s polling fallback for BLF + queue stats when websocket BLF unavailable.

**Verify**: linter clean, RLS policies present on every new table, Realtime test from preview shows live row events.

---

## Phase 2 — Visual Voicemail (desktop + mobile + portal)

- `VoicemailScreen.tsx` shared shell (portal/desktop) + `VoicemailScreenMobile.tsx` (Capacitor swipe actions).
- List item: avatar, name/number, date+duration, transcript preview (2 lines), AI summary pill.
- Inline expand: waveform (use `wavesurfer.js`), scrubber, 1x/1.5x/2x speed, copy transcript, AI summarize button (calls `ai-transcribe-call` summary endpoint).
- Greeting section: preview / record (MediaRecorder) / upload / TTS-generate.
- Settings sub-card: transcription toggle, email/SMS/push notifications, attach-audio toggle.
- Hooks: `useVoicemail`, `useVoicemailSettings`. Realtime subscribe so new voicemails appear instantly with toast.
- Mobile: swipe-left actions (call back / SMS / delete / mark read) via `framer-motion` drag.

**Verify**: trigger `voicemail-sync` manually, confirm rows + audio in bucket + UI playback.

---

## Phase 3 — Settings Screen (all platforms)

Single `SettingsScreen.tsx` with sectioned navigation (sidebar on desktop, accordion on mobile):

1. **My Account** — profile edit (avatar upload → `organization-assets`), display name, extension/email read-only, role badge.
2. **Status** — presence picker writing through `usePresence`; custom status + emoji + return date for OOO; DND syncs to FusionPBX via `set-dnd` action.
3. **Calls → Forwarding** — bound to `pbx_call_forwarding`; Save calls `fusionpbx-proxy update-forwarding`.
4. **Calls → DND** — toggle + weekly schedule grid + allow-from list.
5. **Calls → Handling** — ring timeout, max simultaneous, call waiting, screening, caller ID dropdown sourced from `phone_numbers`.
6. **Calls → Voicemail** — links to Phase 2 settings card; PIN change RPC (`update_voicemail_pin`, bcrypt via edge fn).
7. **Calls → Recording** — `pbx_call_recording_rules` editor + storage usage progress bar (sums `recording_url` size).
8. **Audio & Devices** — `enumerateDevices()`-driven dropdowns, live mic meter (AudioContext analyser), test mic (record 3s + playback), test speaker (play 440 Hz tone), ringtone picker bound to `ringtonePlayer`.
9. **Notifications** — per-event toggles persisted to localStorage + `user_notification_prefs` table; quiet hours.
10. **Security** — 2FA setup placeholder (already prepped in auth memory), auto-lock interval, biometric toggle (mobile only via `@capacitor-community/biometric-auth`), Active Sessions list from `pbx_user_devices` with "Sign out other devices" calling `revoke_other_sessions` RPC.
11. **Integrations** — UI placeholder cards for M365, Google, HubSpot, Salesforce, Zoho. Connect buttons show "Coming soon" toast (per your choice).
12. **About** — version, project ref, extension, portal, debug log download (writes `electron-store` + console buffer to file on desktop; `Filesystem` plugin on mobile), check-for-updates wired to `electron-updater`.

**Verify**: every toggle round-trips to DB; forwarding update reflected in FusionPBX (call test extension while "always forward" set).

---

## Phase 4 — Team Presence & Team Chat

**TeamPresence.tsx**:
- Filter pills + search; sorted online-first.
- Avatar with animated status dot (pulse on `available`, line through on `dnd`).
- Hover/tap actions: Call (dials extension via `useSoftphone.call`), Chat (opens DM in TeamChat), Email.
- BLF overlay: red dot when `call_state='active'`, yellow flashing on `ringing`. Driven by `user_presence` + `queue-blf-poll` fallback.

**TeamChat.tsx**:
- Split panel desktop (sidebar 280px + chat pane); single-pane stacked on mobile with back nav.
- Sidebar: search, DMs, channels (`# general`, `# sales-team`, `# support`, `# announcements` seeded on org creation), team list.
- Chat pane: virtualized message list (`@tanstack/react-virtual`), reactions, threaded replies, @mentions with dropdown sourced from org members, #channel autocomplete, file attachments → `chat-attachments` bucket, message types rendered with distinct cards (call log, voicemail, AI summary).
- Composer: multiline, Enter to send, Shift+Enter newline, emoji picker, basic markdown (`**bold**`, `_italic_`, `` ` `` code, `- list`).
- Typing indicator via Realtime `broadcast` channel.
- Unread separator, date dividers ("Today", "Yesterday").
- Push notifications on @mention or DM (mobile via `@capacitor/push-notifications` token already registered; desktop via Electron `Notification`).

**Channel auto-seed**: on first chat open, edge function `seed-org-channels` ensures the 4 default channels exist.

**Verify**: two browser sessions in same org see messages + typing + reactions live.

---

## Phase 5 — Advanced Call Features + Queue Agent + Recording

- Active call UI gets 2×5 control grid: Mute, Speaker, Hold, Keypad, Transfer, Add Call, Record (toggles MediaRecorder + uploads to `lemtel-recordings`), Chat (opens TeamChat sidebar with current caller's DM), Notes (slide-up panel writing to `pbx_call_records.notes` via `set_call_notes` on hangup), Contacts.
- Transfer modal: tabs for Blind / Warm / Voicemail / IVR. Warm transfer holds current call, places consultation call, then completes via JsSIP `refer`.
- Add Call (3-way): second JsSIP session, then merge via FusionPBX conference bridge created on-the-fly through `fusionpbx-proxy create-conference`.
- Queue Agent header pill: present when user appears in any `pbx_queue_agent_state` row; toggle pause via RPC; mini-stats fed from `queue-stats` polled every 10s.
- Recording Rules section in Settings (Phase 3 #7) writes through to FusionPBX dialplan on save via `fusionpbx-proxy update-recording-rules`.

**Verify**: place a test call, hit Record, see file land in storage and metadata in `pbx_call_records.recording_url`; warm transfer between two extensions.

---

## Phase 6 — Mobile polish + version bump

- **Incoming call screen**: full-screen `IncomingCallSheet.tsx` with blur backdrop, large avatar, ring animation, slide-to-answer / slide-to-decline (framer-motion drag), Remind-me-in-1h (schedules local notification), quick SMS reply ("Can't talk now", "Call you back", "On my way").
- **CallKit / ConnectionService**: integrate `@capacitor-community/call-kit` (iOS) and a thin Android `ConnectionService` bridge plugin so calls appear on lock screen and respect Do Not Disturb. Document required native config in `native-config/`.
- **CarPlay / Android Auto**: minimal templates declared in `Info.plist` / `AndroidManifest.xml` snippets — call history + voice dial via Siri/Google Assistant intents.
- **Widgets**: iOS WidgetKit snippet + Android Glance snippet under `native-config/` for top-3 quick dial and status; documented for the user to enable in Xcode/Android Studio (cannot be built in sandbox).
- **Desktop console rail**: add Voicemail, Team, Messages (Team Chat sub-tab), Settings entries to `LeftRail.tsx` so the new screens are reachable.
- **Version bump**: desktop `package.json` → `2.0.0`; mobile `package.json` → `2.0.0`; portal `src/lib/version.ts` → `2.0.0`.
- **Smoke pass**: extend `scripts/smoke-electron.mjs` to navigate every new tab and assert renderer stays responsive.

**Verify**: full regression — login, call, hangup with notes, voicemail appears, presence updates across sessions, chat message round-trip, settings persist after relaunch.

---

## Technical notes

- **Shared code policy**: every new hook lives in `src/hooks/` and is re-exported from `apps/ava-softphone-desktop/src/hooks/` + `apps/ava-softphone-mobile/src/hooks/` thin wrappers, so business logic stays single-source. UI components are platform-specific shells importing the shared hook.
- **RLS pattern**: a `current_user_org_ids()` SECURITY DEFINER helper avoids recursive subqueries; all org-scoped policies call it.
- **Presence heartbeat**: 30s interval + on visibility change + on JsSIP `registered/unregistered/connecting/sessionStateChange`. Offline computed server-side via `last_seen_at < now() - interval '90 seconds'` in `team_presence_view`.
- **No client-side admin checks**: all role-gated actions (recording rules, channel create, queue pause for others) validated in edge functions via `has_role`.
- **Push notifications**: existing `pushNotifications.ts` extended with new `kind` values `chat`, `mention`, `voicemail_new`, `presence_request`.
- **Storage cleanup**: scheduled `voicemail-retention` edge function purges voicemails older than user's retention setting.
- **Backwards compatibility**: all schema additions are additive (`ADD COLUMN IF NOT EXISTS`, new tables) — existing portal Webphone view + call history continue to work unchanged after Phase 1.
- **Per-phase deliverable**: each phase ends with a working build on desktop + mobile + portal so you can validate before continuing.