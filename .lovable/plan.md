# Remaining Telephony Phases

Phases 1, 2, 4 are done (hooks, voicemail backend + portal UI, team presence + chat). Three phases remain.

## Phase 3 — Unified Telephony Settings

New page `src/pages/telephony/TelephonySettings.tsx` mounted at `/org/lemtel/telephony/settings` with tabbed sections, all wired to existing hooks:

- **Call Forwarding** (`useCallForwarding`) — always/busy/no-answer/unavailable destinations, ring timeout
- **Do Not Disturb / Recording** (`useRecordingRules`) — toggle inbound/outbound recording, announcement
- **Voicemail** (`useVoicemailSettings`) — PIN, email/SMS/push notifications, transcription toggle, greetings shortcut
- **Queue membership** (`useQueueAgent`) — pause/unpause per queue, status
- **Devices & Presence** — list `pbx_softphone_users.active_platforms`, manual status override via `upsert_user_presence`

Sidebar: add "Settings" item under Telephony group.

## Phase 5 — Advanced Call Control Grid (Desktop)

In `apps/ava-softphone-desktop/`:
- New `screens/CallControlScreen.tsx`: 3-col grid showing active calls, hold queue, parked calls
- BLF panel (busy-lamp field) using `useTeamPresence` — color dots per extension, click-to-call
- Transfer dialog (blind/attended) hitting existing FusionPBX proxy actions
- Conference builder: drag participants from BLF into active call
- Keyboard shortcuts (1-9 line keys, T transfer, H hold, C conference)

No new backend — uses existing `fusionpbx-proxy` and SIP.js bridge already in desktop app.

## Phase 6 — Mobile Native Call UX

In `apps/ava-softphone-mobile/`:
- `screens/IncomingCallSheet.tsx` — full-screen framer-motion sheet, accept/decline/SMS-reply
- CallKit/ConnectionService stubs (Capacitor plugin placeholders, real native bridge deferred)
- CarPlay/Android Auto manifest entries (config only)
- Push deep-link handler routing voicemail/SMS notifications to correct screen
- Background presence ping every 60s via `update_platform_seen` RPC

## Version bumps

`apps/ava-softphone-desktop/package.json` and `apps/ava-softphone-mobile/package.json` → `2.0.0`.

## Out of scope

Real native CallKit/CarPlay bridges (require Xcode/Android Studio builds). Phase 6 ships JS-side scaffolding only.
