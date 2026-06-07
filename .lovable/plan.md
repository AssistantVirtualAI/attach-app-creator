# Phase 2 — Visual Voicemail

Build end-to-end voicemail across portal, desktop, and mobile, backed by FusionPBX sync and ElevenLabs greeting TTS. Uses the Phase 1 schema (`pbx_voicemails`, `pbx_voicemail_settings`, `voicemail-audio`, `voicemail-greetings`).

## Edge functions

1. **`fusionpbx-proxy`** — extend with voicemail actions:
   - `list-voicemails` — pull mailbox messages for an extension
   - `download-voicemail` — fetch audio bytes (stream to Storage)
   - `delete-voicemail` — remove from FusionPBX + mark row deleted
   - `update-greeting` — upload/select active greeting
   - `update-voicemail-settings` — transcription/notify flags
2. **`voicemail-sync`** — invoked on cron (every 2 min) and manually from UI. For each `pbx_softphone_users` row: calls `list-voicemails`, diffs against `pbx_voicemails`, downloads new audio into `voicemail-audio/{org}/{ext}/{uuid}.wav`, inserts row, then enqueues transcription via existing `ai-transcribe-call` (writes `transcript`, `ai_summary`).
3. **`voicemail-greeting-tts`** — ElevenLabs TTS (`eleven_multilingual_v2`, voice from settings). Saves MP3 to `voicemail-greetings/{org}/{ext}/{slug}.mp3` and calls `fusionpbx-proxy update-greeting`.
4. **Cron**: pg_cron `*/2 * * * *` → `voicemail-sync` (registered via `supabase--insert`).

## Shared components (`src/components/voicemail/`)

- `VoicemailList.tsx` — virtualized list, unread dot, avatar, caller name/number resolved from `pbx_contacts`, relative time, duration, transcript snippet, AI summary pill.
- `VoicemailPlayer.tsx` — `wavesurfer.js` waveform, scrubber, 1×/1.5×/2× speed, download, copy transcript, "Summarize with AI" button.
- `VoicemailItem.tsx` — row that expands inline to host the player.
- `GreetingManager.tsx` — list/upload/record/TTS-generate greetings, set active.
- `VoicemailSettings.tsx` — toggles (auto-transcribe, email notify, SMS notify, push notify, attach audio), PIN change.
- Hook reuse: `useVoicemail`, `useVoicemailSettings` (already in `src/hooks/`).

## Portal — `src/pages/telephony/`

- `Voicemail.tsx` (route `/org/:slug/telephony/voicemail`) — two-pane: list left, player + transcript right; Settings dialog; Greetings dialog; "Sync now" button calls `voicemail-sync`.
- Add nav entry + icon to telephony sidebar; realtime subscribe to `pbx_voicemails` with toast on insert.

## Desktop — `apps/ava-softphone-desktop/src/`

- `screens/VoicemailScreen.tsx` — reuses shared components via the existing portal path alias; integrates with notification badge in tray icon (unread count from `useVoicemail`).
- Bottom-tab entry "Voicemail" with badge.

## Mobile — `apps/ava-softphone-mobile/src/`

- `screens/VoicemailScreenMobile.tsx` — single-column list with `framer-motion` swipe-left (Delete) / swipe-right (Mark read) actions, full-screen player sheet, native share, push deep-link.
- Tab entry with badge.

## Realtime & notifications

- All three apps subscribe to `pbx_voicemails` (insert → toast + badge increment, update → refresh row).
- `useVoicemailSettings` controls whether server-side push/email fires (handled in `voicemail-sync`).

## Verification

1. Linter clean (`supabase--linter`).
2. Insert a fixture voicemail row → confirm list + player render in portal, desktop, mobile.
3. Trigger `voicemail-sync` manually → confirm Storage object, row, transcript populated.
4. Generate TTS greeting → confirm Storage upload + FusionPBX update call logged.
5. Realtime: insert row from SQL → toast appears in open clients.

## Out of scope (later phases)

- Settings screen (Phase 3), Team chat/presence (Phase 4), call control grid (Phase 5), mobile incoming-call sheet & CallKit (Phase 6).
