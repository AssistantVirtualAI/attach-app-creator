# Fix Desktop & Mobile App — Real Data, IA Admin, Recordings

An audit of the apps found the exact causes of the broken pages. Plan below.

## 1. IA Admin page (chatbot that manages the phone system)
- Fix `AIPanel.tsx`: stop hardcoding the Lemtel org ID — resolve the user's real organization; switch to `supabase.functions.invoke()` so auth tokens auto-refresh (no more "Unauthorized").
- Unify the admin check between `AIPanel` and `AdminAIChatView` (currently two different methods give different results).
- Upgrade the `telecom-admin-ai-agent` edge function so the chatbot can actually MANAGE the phone system, not just read:
  - Add tool/actions for extensions, call queues, IVRs, ring groups, business hours (propose → confirm → execute flow, with audit log in `telecom_admin_ai_actions`). Today only 2 tables are whitelisted; everything else is silently skipped.
  - Fix org resolution so members in `organization_members` are accepted.
  - Update the system prompt (it currently tells the AI it's read-only).

## 2. Real data for YOUR extension (desktop)
- Remove the hardcoded `extension_uuid` filter in `avaApi.ts` — it forces every user to see one fixed extension's calls. Replace with a per-user lookup (from `pbx_softphone_users` via `portal_user_id`).
- Remove the dead duplicate fetch in `getMeContext()`.
- Contacts page: it currently queries the SIP-users table with fields that don't exist, so it shows nothing. Fix it to load real team extensions + call-derived contacts, and make notes/tags save to a valid place.
- Team chat: add error handling around channel bootstrap and org resolution so channels load reliably; implement real unread counts.

## 3. Recording playback + AI analysis
- Keep playback working but move the hardcoded PBX key/username (`key=...&username=mhassoun`, currently exposed in the app bundle) into the `fusionpbx-proxy` edge function — the app fetches audio through the secure proxy instead.
- Add an "Analyze with AI" action: edge function downloads the recording, transcribes/analyzes it (AI), stores the transcript + summary on the call record, and the chatbot can reference it.

## 4. Mobile app real data
- Fix the mobile API base URL — it points at `avastatistic.ca/functions/v1/...` (404s), so everything silently falls back to mock data. Point it at the real backend functions.
- Replace the fully-static mobile AI screen (fake names like "Marie Tremblay") with real data: queues, agents, insights for your extension.
- Mobile contacts/dashboard: wire to the same real endpoints as desktop.

## Technical details
- Files: `apps/ava-softphone-desktop/src/lib/avaApi.ts`, `components/console/AIPanel.tsx`, `AdminAIChatView.tsx`, `OrgChatView.tsx`, `ContactsView.tsx`, `RecordingsView.tsx`; `apps/ava-softphone-mobile/src/lib/mobileApi.ts`, `AIScreen.tsx`; edge functions `telecom-admin-ai-agent`, `fusionpbx-proxy`, new `ai-analyze-recording`.
- Untouched per your constraints: `vite.config.ts`, `electron-builder.yml`, `.github/workflows/`, `package.json` repository field.
- The exposed PBX recording key should ideally be rotated on your PBX after we move it server-side.

## Verification
- Test the edge function end-to-end (chat + manage actions), confirm recordings play and AI analysis returns a transcript, and confirm extensions/queues/IVRs load real rows for your org.