# AVA Softphone Desktop — Phase 5 Plan

Status of prior phases:
- Phase 1 (v1.1) — Console shell, left rail, Home, AI panel, Command Palette
- Phase 2 (v1.2) — Calls, Messages, AI Workspace, Admin, typed `avaApi`
- Phase 3 (v1.3) — Voicemail, Recordings, Contacts
- Phase 3.1 — AI feedback, playback, filters, bulk export, detail panels
- Phase 3.2 — Supabase wiring, JsSIP config, GH Actions, PostCSS lock
- Phase 4 (v1.4) — Incoming-call toast + OS notification, persistent dock,
  ⌘M/⌘H/Enter/Esc shortcuts, Settings as console view, message templates,
  Queue Optimizer / Voice Agent Manager / Coaching Insights, version sync
- Phase 4.1 (v1.4.1) — Tagged OS notifications auto-clear on answer/hangup,
  template search + categories + per-contact defaults, dock state restored
  via sessionStorage across navigation

---

## Phase 5 — Live SIP & Real Data (target v1.5)

### 5.1  Real JsSIP integration (replace mock SIP)
- Wire `SoftphonePane` to JsSIP using the existing `SIP.domain` / `SIP.wssUrl`
  config and the `softphone-credentials` Edge Function.
- Emit `callBus` events from real SIP session listeners (`newRTCSession`,
  `accepted`, `ended`, `failed`, `hold`, `unhold`).
- Wire mute through the local `MediaStreamTrack.enabled` flag.
- DTMF send during active calls (numeric keypad + keyboard digits).
- Outbound call from Dialer + Contacts "Call" button → `callBus` outgoing.

### 5.2  Live data swap (drop mocks)
- Flip `MOCK = false` in `avaApi.ts`.
- Replace mock data sources in:
  - CallsView ← `pbx_call_records`
  - MessagesView ← `pbx_sms_threads` (+ realtime channel for new messages)
  - VoicemailView ← `pbx_call_records` filtered to voicemail
  - RecordingsView ← `pbx_call_records` with recording URL
  - ContactsView ← `pbx_softphone_users` / CRM contacts
  - HomeDashboard metrics ← aggregated query
- Add a thin React Query layer for caching + background refresh.
- Realtime via Supabase channels for incoming SMS, new voicemail, call updates.

### 5.3  Audio device persistence
- Persist mic / speaker / ringer selections in `electron-store`.
- Re-apply on app launch and after device hot-plug (navigator.mediaDevices
  `devicechange` listener).
- Test-tone button per device in Settings → Audio.

### 5.4  Push-to-talk & global shortcuts
- Electron `globalShortcut` for Answer / Hangup / Mute even when the window
  is unfocused (configurable in Settings).
- Optional push-to-talk hold key.

### 5.5  AI Workspace real backend
- Queue Optimizer ← FusionPBX queue stats (via `fusionpbx-proxy`).
- Voice Agent Manager ← list/edit AVA + ElevenLabs agents
  (CRUD against `ava_voice_agents` table — to create).
- Coaching Insights ← aggregated `pbx_ai_insights` per agent.

### 5.6  Notifications: SMS + voicemail
- New SMS → tagged notification (`lemtel-sms-<threadId>`),
  click opens that thread.
- New voicemail → notification, click opens Voicemail view.
- Mute/Do-Not-Disturb toggle in Settings.

### 5.7  Offline & resilience
- Cache thread list, contacts, recent call log in IndexedDB.
- Reconnect banner when WSS drops; auto-resubscribe to realtime.
- Outbound SMS queue: stash drafts that failed to send.

### 5.8  Packaging polish
- Code signing recipes (Apple notarization, Windows Authenticode) documented
  in `.github/workflows/release-desktop.yml`.
- AppImage + .deb + .dmg via electron-builder once codesigning is wired
  (replaces the current `.tar.gz` / `.zip` fallback).
- Auto-update channel switcher (stable / beta) in Settings.

### 5.9  Accessibility & polish
- Full keyboard focus rings on left rail + dock.
- Screen-reader labels for call controls and incoming toast.
- High-contrast theme variant.
- i18n scaffold (FR / EN strings extracted to `src/lib/i18n`).

---

## Suggested order
1. 5.1 SIP → 5.2 Live data (unblocks the rest)
2. 5.6 SMS/voicemail notifications + 5.3 Audio persistence
3. 5.5 AI workspace real backend
4. 5.4 Global shortcuts, 5.7 Offline, 5.8 Packaging
5. 5.9 A11y/polish as a final pass

Each sub-phase can ship as its own minor version bump (1.5.0 → 1.5.x).
