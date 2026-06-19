## Goal
Wire all mobile screens to the user's real SIP domain context via a single shared hook, and fix data loading + navigation across Recordings, Team Chat, Contacts, Voicemail, Queues, and SMS.

## 1. Shared hook
Create `apps/ava-softphone-mobile/src/hooks/useMobileCredentials.ts`:
- Read stored creds via existing `Store.get()` (from `lib/creds.ts`).
- If `extension`/`domainUuid` missing, call `hydrateSoftphoneCredentials('mobile')` (already implemented).
- Returns `{ extension, sipDomain, domainUuid, organizationId, wssUrl, userId, accessToken, loading }`.
- All screens below gate their effects on `credentials?.domainUuid`.

## 2. RecordingsScreen
- List: `pbx_call_records` filtered by `domain_uuid = credentials.domainUuid`, ordered by `start_stamp desc limit 50`.
- Play via `supabase.functions.invoke('fusionpbx-proxy', { body: { action: 'get-recording', xml_cdr_uuid, recording_name: record_name+'.mp3', recording_path, domain_uuid } })`.
- Decode `audio_base64` → Blob → object URL → `<audio>` element.
- On `data.error === 'Recording expired'` (or proxy 404), show "Recording expired — file deleted from PBX after retention period".

## 3. TeamChatScreen
- Domain members: `pbx_softphone_users` joined with `profiles` filtered by `domain_uuid`.
- Presence: `user_presence` for those `portal_user_id`s; green dot if `last_seen < 5min`.
- Channel list: "General" (org-wide channel from `org_chat_channels`), DMs per member, group channels the user belongs to.
- Messages from `org_chat_messages` by `channel_id`, ascending.
- Realtime: `supabase.channel('chat-'+channelId).on('postgres_changes', INSERT on org_chat_messages filter channel_id=eq.<id>)`.

## 4. ContactsScreen
- `pbx_softphone_users` (extension, sip_domain, portal_user_id, profiles) filtered by `domain_uuid`.
- Presence join → status dot.
- Buttons: Call → `sp.call(extension)`; Message → navigate to TeamChat DM with that user.
- Local search by name/extension.

## 5. VoicemailScreen
- List via `fusionpbx-proxy` `{ action: 'list-voicemails', domain_uuid, extension }`.
- Greeting editor: textarea + voice dropdown (GET `/v1/voices` through an existing edge function proxy if available — otherwise reuse a server function; do not expose `ELEVENLABS_API_KEY` to the client).
- Preview button → TTS via existing ElevenLabs edge function → inline playback.
- "Set as Greeting" → upload generated audio to PBX as voicemail greeting via `fusionpbx-proxy`.
- Per-voicemail: inline play, delete, transcribe buttons.

## 6. QueuesScreen
- List via `fusionpbx-proxy` `{ action: 'list-queues', domain_uuid }`; combine with existing `pbx_queue_agent_state` realtime to render agent counts/waiting/user status.
- Buttons: Join/Pause/Leave invoke `fusionpbx-proxy` with `queue-login` / `queue-pause` / `queue-logout` + `queue_uuid` + `extension`.
- Keep realtime sub on `pbx_queue_agent_state` for current user.

## 7. MessagesScreen (SMS)
- Threads from `pbx_sms_threads` filtered by `organization_id` (already used) — confirm filter uses `credentials.organizationId` from hook.
- Send via `twilio-send-sms` edge function.
- Keep existing realtime + search.

## 8. Navigation audit
- Verify every top pill and bottom nav target in `BottomTabs.tsx` and `MobileApp.tsx` routes correctly: Voicemail, Recordings, Contacts, SMS, Queues, Settings, Home, Calls, AVA, Chat, More.
- Confirm each screen is imported and route registered; fix any missing wiring.

## Constraints
- Do not touch `vite.config.ts`, `electron-builder.yml`, `.github/workflows/`.
- Do not touch landing page.
- All data fetches gated on `credentials` from `useMobileCredentials`.

## Technical notes
- Edge functions used: `softphone-credentials`, `fusionpbx-proxy`, `twilio-send-sms`, ElevenLabs TTS proxy (server-side; client never reads `ELEVENLABS_API_KEY`).
- Tables: `pbx_call_records`, `pbx_softphone_users`, `profiles`, `user_presence`, `org_chat_channels`, `org_chat_messages`, `pbx_queue_agent_state`, `pbx_sms_threads`, `pbx_sms_messages`.
- Realtime channels created in `useEffect` with cleanup `supabase.removeChannel`.
