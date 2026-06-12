# Desktop App Full Audit & Fix Plan

Goal: Verify every view of the desktop app works end-to-end with real data, on both wide (ConsoleLayout) and compact (SoftphonePane) layouts. Fix gaps as found, in a single coordinated pass.

## Phase 1 — Audit (read-only, per view)

For each view I'll check: (a) data source wired to real Supabase tables / `fusionpbx-proxy`, (b) loading + empty + error states, (c) admin actions actually hit edge functions, (d) RLS lets the current user read it, (e) renders correctly in compact mode.

Wide layout — `ConsoleLayout`:
1. **HomeDashboard** — KPIs, today's calls, voicemail counters via `useDashboardStats` / `get_my_extension_summary`.
2. **Dialer (SoftphonePane)** — SIP registration, JsSIP provider, mic permissions, DTMF.
3. **CallsView** — `pbx_call_records` list, filters, click → details, notes/tags via `set_call_notes`.
4. **MessagesView / SmsThreads** — `pbx_sms_threads` + `pbx_sms_messages`, send via Telnyx/Twilio edge fn.
5. **VoicemailView** — `pbx_voicemails`, audio playback from `voicemail-audio` bucket, mark read, AI transcription.
6. **RecordingsView** — `pbx_call_recordings`, signed URLs via `fusionpbx-proxy` `get-recording`, **playback controls + AI transcribe**.
7. **AIWorkspace / AIInsights** — pull `pbx_ai_insights` / `agent_insights` with real aggregates (no mocks).
8. **ContactsView** — `pbx_softphone_users` (org-scoped) + presence join.
9. **OrgChatView** — channels, DMs, group create, presence dots (just rebuilt).
10. **AdminView** — extensions, IVRs, queues, ring groups, devices via `fusionpbx-proxy`. Verify 20 extensions sync, edit/create/delete works.
11. **TelecomSettingsView** — gateways, SIP profiles, dialplan, business hours.
12. **AdminAIChatView + AIPanel** — `telecom-admin-ai-agent`, retry/backoff, tool execution against PBX.
13. **ReportsView** — call analytics, queue stats from `cc_queue_stats`, agent activity.
14. **SettingsPage** — profile, devices, sign-out.

Compact layout — `SoftphonePane`:
15. Tab parity: Dialer, Recents, Voicemail, Recordings, Messages, Contacts, AIInsights, Portal, Settings — confirm each tab loads same data as wide.

## Phase 2 — Fix categories (applied as discovered)

- **Missing/mock data → real queries**: replace any placeholder list with Supabase query scoped by `current_user_org_ids()`.
- **Admin PBX endpoints**: ensure every Admin CRUD calls `fusionpbx-proxy` actions (`list-extensions`, `create-extension`, `update-extension`, `delete-extension`, same for `ivr`, `queue`, `ring-group`, `device`, `gateway`, `dialplan`). Add missing actions to the edge function if any UI button has no backend.
- **Extensions discrepancy (20 vs 3)**: trigger a `sync-extensions` against FusionPBX domain UUID, then read from `pbx_extensions`. Check if the proxy is filtering by wrong domain or if RLS hides rows.
- **Recording playback**: unify into a reusable `<AudioPlayer>` with progress/duration, used by Voicemail + Recordings (wide + compact).
- **AI transcription**: after playback success OR on-demand button → call `ai-transcribe-call` → store + display transcript and analysis inline. Retry on failure.
- **AI chatbot (admin)**: confirm `telecom-admin-ai-agent` tools cover read+write for extensions, IVR, queues, users, ring groups; surface errors with retry button (already added) and exponential backoff (already added).
- **AI Insights real data**: replace any hard-coded numbers with aggregates from `pbx_call_records`, `cc_queue_stats`, `pbx_ai_insights`.
- **Compact parity**: each mobile-side tab uses the same hooks/queries as the wide view (DRY into `hooks/`).

## Phase 3 — Verification checklist

For each view I'll verify in the running preview:
- Loads with real org data (not empty / not mock).
- Admin actions round-trip (create → list shows new row → edit → delete).
- Audio plays with progress bar and duration.
- Transcription + AI summary appear after playback.
- Chatbot answers org questions ("how many users", "list IVRs", "pause queue X") without non-2xx.
- Works at <640px (compact) and ≥980px (wide).

## Technical notes

- Read-only first; queue findings; then apply edits in one batch per view to minimize churn.
- Will not touch `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**`, `package.json` repository field.
- No auto-push to GitHub.
- Branding stays "AVA Statistic"; never mention Lovable.
- Use existing security-definer functions (`current_user_org_ids`, `has_role`, `can_access_org`) — do not weaken RLS.

## Out of scope

- New marketing/landing changes.
- Schema migrations beyond what's strictly required to back a missing UI (will ask before adding any).
- Mobile app (`ava-softphone-mobile`) — only touched if a shared hook is refactored.

## Deliverable

A working desktop app where every left-rail view shows real, current data; admin can fully manage the PBX; recordings/voicemails play with transcripts; AI chatbot answers reliably — verified in both wide and compact layouts.
