# Full QA Sweep + Desktop/Mobile Parity

A systematic end-to-end test of every feature across web portal, desktop app, and mobile app — followed by fixing whatever fails and wiring any missing parity.

## Phase 1 — Inventory & instrumentation (read-only)

Catalog every feature surface so nothing is missed. Output a single QA matrix:

```text
| Feature                       | Web | Desktop | Mobile | Backend | Status |
| Auth (email, Google, 2FA)     |     |         |        |         |        |
| Tenant resolution             |     |         |        |         |        |
| Softphone register/call/hold  |     |         |        |         |        |
| Inbound ring + accept/reject  |     |         |        |         |        |
| Outbound dial (E.164)         |     |         |        |         |        |
| Transfer (blind/attended)     |     |         |        |         |        |
| DTMF / mute / hold            |     |         |        |         |        |
| Call recordings (play/download)|    |         |        |         |        |
| Voicemail (list/play/delete)  |     |         |        |         |        |
| SMS threads send/receive      |     |         |        |         |        |
| Org chat (channels, mentions) |     |         |        |         |        |
| Contacts CRUD                 |     |         |        |         |        |
| Customers (admin)             |     |         |        |         |        |
| Extensions CRUD               |     |         |        |         |        |
| Devices CRUD                  |     |         |        |         |        |
| Phone numbers / DIDs          |     |         |        |         |        |
| IVRs (greeting + options)     |     |         |        |         |        |
| Call queues + agent tiers     |     |         |        |         |        |
| Ring groups                   |     |         |        |         |        |
| Gateways + restart            |     |         |        |         |        |
| SIP profiles + restart        |     |         |        |         |        |
| Time conditions               |     |         |        |         |        |
| Dialplans                     |     |         |        |         |        |
| Hold music                    |     |         |        |         |        |
| Conferences                   |     |         |        |         |        |
| Feature codes                 |     |         |        |         |        |
| Live registrations            |     |         |        |         |        |
| Voicemail boxes config        |     |         |        |         |        |
| Recording rules               |     |         |        |         |        |
| Sync status / per-resource    |     |         |        |         |        |
| AI: call summary              |     |         |        |         |        |
| AI: rewrite / translate       |     |         |        |         |        |
| AI: greeting generator        |     |         |        |         |        |
| AI: admin command palette     |     |         |        |         |        |
| AI: landing chatbot           |     |         |        |         |        |
| Voice agents (Vapi/Retell/EL) |     |         |        |         |        |
| Outbound campaigns            |     |         |        |         |        |
| Leads pipeline                |     |         |        |         |        |
| Appointments + reminders      |     |         |        |         |        |
| Calendar integrations         |     |         |        |         |        |
| Knowledge base                |     |         |        |         |        |
| Reports / analytics           |     |         |        |         |        |
| Webhooks outbound             |     |         |        |         |        |
| API keys                      |     |         |        |         |        |
| Team / invitations            |     |         |        |         |        |
| Billing / Stripe checkout     |     |         |        |         |        |
| Branding / white-label        |     |         |        |         |        |
| Email templates               |     |         |        |         |        |
| Security audit run            |     |         |        |         |        |
| GDPR/HIPAA retention          |     |         |        |         |        |
| Notifications / presence      |     |         |        |         |        |
```

## Phase 2 — Backend health (parallel, fast)

For each Supabase edge function used by the app, hit it with a minimal valid payload and capture status + error:

- `fusionpbx-proxy` — actions: `ping`, `sync-status`, `list-extensions`, `list-gateways`, `list-sip-profiles`, `list-conferences`, `list-hold-music`, `list-dialplans`, `list-time-conditions`, `get-registrations`, `sync-cdrs`, `sync-all`, `get-recording`
- `realtime-sync`, `cron-pbx-sync`, `fusionpbx-sync-cdr`, `voicemail-sync`
- `call-center-sync`, `cc-alerts`
- `softphone-credentials`, `portal-guard-log`
- `appointment-reminders`
- `ava-admin-command`, `landing-chatbot`
- Stripe / billing / webhooks / Resend mailers
- AI: `ai-analyze-call`, `elevenlabs-greeting`, `telnyx-sms` (and any others discovered)

Also run `supabase--linter` to surface RLS/grant regressions.

## Phase 3 — Desktop app E2E

Boot the desktop app (Electron bundle from `apps/ava-softphone-desktop`) against the real backend with a test extension. Walk every Console view in order and exercise each interactive control:

1. `home`, `dialer`, `calls`, `messages`, `voicemail`, `recordings`, `ai`, `contacts`, `telecom`, `orgchat`
2. Admin sections (Extensions → Sync), including the 10 new ones (Gateways, SIP Profiles, Conferences, Hold Music, Dialplans, Time Conditions, Feature Codes, Voicemails, Recording Rules, Live Registrations). For each: list loads, search works, edit drawer saves, create works, delete works, custom actions (Restart Gateway, Restart SIP Profile) succeed.
3. Verify SoftphonePane: register status, place outbound call to known echo number, accept inbound (via `Cmd+Shift+I` simulate), DTMF, mute, hold, transfer, hangup. Confirm CDR row appears in `pbx_call_records`, recording playable in Recordings, voicemail visible if left.
4. Settings, theme toggle, audio device picker, sign-out flow, update banner.
5. Compact (<820px) vs wide (≥1280px) layouts — rail collapses, dialer/AI pane behavior, modals → bottom-sheets.

For each failure, capture the network call + Supabase row, file in the matrix.

## Phase 4 — Mobile parity audit

Open `apps/` for any mobile project (Capacitor / RN). Inventory which views from desktop exist on mobile. For each missing view in the matrix's Mobile column, decide:

- Port the desktop component (where layout fits)
- Add a mobile-specific wrapper (lists + bottom sheets)
- Defer with explicit "not on mobile" note

The deliverable is the matrix + a follow-up implementation list; building the missing mobile screens is a separate task because the mobile shell is large.

## Phase 5 — Web portal QA

Smoke-test the admin web portal for parity gaps with the desktop app: ensure every admin section the desktop has also exists on the web (Lemtel admin: `src/pages/lemtel/admin/*`). Note any drift; fix obvious ones (typically just adding a route or component import).

## Phase 6 — Fix loop

Group failures by type:

- **Backend errors** (4xx/5xx, RLS) → fix edge function or migration
- **UI bugs** (component crashes, missing data) → patch component
- **Wiring gaps** (button present but no handler) → wire
- **Parity gaps** (web has, desktop missing or vice versa) → port

Each fix gets a re-test entry in the matrix. Loop until matrix is green or items are explicitly deferred with reason.

## Phase 7 — Final verification

- Re-run the full test pass to confirm no regressions
- Re-run `supabase--linter`
- Re-package the Electron app (`@electron/packager`) and verify it boots and registers
- Output the final QA matrix as the deliverable

## Out of scope (will note but not build)

- Building a full mobile app from scratch if one doesn't exist (will only audit and report)
- Stress / load testing
- Penetration testing beyond the linter
- Landing page changes (locked)

## Risks & ground rules

- Destructive actions (delete extension, delete recording, restart gateway in prod) — I will use only the dedicated test extension/gateway already in the Lemtel domain, or skip and flag for manual test.
- Stripe live mode — only verify checkout-page redirect, never complete a charge.
- AI gateway costs — keep AI tests to one call per feature.
- Time budget: this is a deep sweep; expect ~50 distinct verifications and probably 10–20 fixes. I'll stream the matrix as I go.

## Open questions before I start

1. Is there an existing mobile app codebase (Capacitor, React Native, Expo) in this repo I should test, or is "mobile" purely future scope?
2. Do you want me to actually exercise live PBX writes (create/delete a test extension on `lemtel.lemtel.tel`) or run reads-only and only validate the write paths via dry-run/mocks?
3. Should fixes ship as I find them, or should I produce the full failure matrix first and then fix in a second pass?
