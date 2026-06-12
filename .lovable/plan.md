# Fix Desktop App – Chat, Recordings, AI Workspace, Admin, Contacts, Team Chat

## Problems (from your report)

1. **AVA Assistant** → `{"error":"Unauthorized"}` on "how many calls I missed yesterday", and other prompts return canned analysis instead of executing tools against your data.
2. **Recordings / CDRs** → old recordings appear, not filtered to your extension/org; "Load PBX audio" button does nothing; **"A real organization is required before AI analysis can run"** when clicking *Transcribe & Analyze*.
3. **AI Workspace page** → buttons do nothing; not connected to live PBX endpoints.
4. **Contacts (wide screen)** → internal company contacts missing, no "Add contact" action, layout broken.
5. **Team Chat** → completely non-functional.
6. **Admin → Extensions** → infinite loading; no data from PBX; cannot push changes.
7. **Recording playback** on wide page → Play button doesn't play; visual broken.

## Root causes identified

- `apps/ava-softphone-desktop/src/lib/avaApi.ts → recordings()` queries `pbx_call_records` with no `organization_id`/extension filter and **never sets `organization_id` on the returned `RecordingItem`** → that is the exact source of the "A real organization is required" error in `RecordingsList.tsx:47`.
- `mapCdrToRecording` builds `recordingUrl = https://pbxnode.lemtel.tel/{path}/{name}` (no auth, CORS-blocked) → playback button silently fails. The working path is `fusionpbx-proxy { action: 'get-recording' }` (already implemented in `getRecordingAudioUrl`) — must always go through it.
- `ava-admin-command` edge function requires `is_super_admin` OR `is_lemtel_admin`; the desktop user likely isn't flagged in `user_roles` for the current session → `Unauthorized`. Also need to ensure tools are actually invoked (right model + `stopWhen` + correct `convertToModelMessages`).
- `AIWorkspace.tsx`, `OrgChatView.tsx`, `ContactsView.tsx`, and the admin Extensions tab are using stub data / unmapped endpoints.

## Fixes

### 1. Recordings – scope + playback + analyze
- Resolve the active user's `organization_id` + `extension` once at app boot (from `pbx_softphone_users` for `portal_user_id = auth.uid()`), expose via a small `useMe()` cache.
- In `recordings()`:
  - Add filters: `organization_id=eq.{orgId}` and `or(extension.eq.{ext},caller_number.eq.{ext},destination_number.eq.{ext})`.
  - Default range to last 30 days; allow `Range` chips already in UI.
- In `mapCdrToRecording`: include `organization_id`, `recording_path`, `recording_name`; **do NOT** set a raw `https://pbxnode.lemtel.tel/...` URL (drop `recordingUrl`).
- In `RecordingsList.play()`: always call `ava.getRecordingAudioUrl()` (proxy). Show toast on failure with the proxy status.
- Fix the wide-screen player layout (currently overflows in the detail panel) and wire Play/Pause to the same blob URL.

### 2. AVA Assistant chat – Unauthorized + tool execution
- `ava-admin-command/index.ts`:
  - Allow non-admin org members in **read-only mode** (list tools only, no `propose/execute`) so "how many missed yesterday" works for any authenticated user with a softphone account.
  - Scope every tool query by the caller's `organization_id` (derived from `pbx_softphone_users`).
  - Add tools: `count_missed_calls(range)`, `list_calls(range, direction?)`, `summary_today()`, `find_recording(phone, day)`.
  - Use `stopWhen: stepCountIs(8)` and `convertToModelMessages` so the model actually calls tools instead of fabricating answers.
- Frontend (`AIPanel.tsx`): stream the response using `useChat` against the SSE endpoint (no longer raw `functions.invoke`), render markdown.

### 3. AI Workspace
- `AIWorkspace.tsx`: wire the four action cards to real edge functions: `telecom-admin-ai-agent` (analyze KPIs), `ai-analyze-call` (last 24h batch), `ai-transcribe-call` (retro-transcribe missing), `fusionpbx-proxy { action: 'sync-all' }`.
- Show toasts + result panels (counts, errors) on each card.

### 4. Admin → Extensions (and other admin tabs)
- Switch `ava.extensions/devices/ivrs/queues/ringGroups/phoneNumbers` to `fusionpbx-proxy { action: 'list-<resource>' }` first (live PBX), fall back to `pbx_*` mirror tables only if proxy fails.
- Add **Save** mutations on Extension row edits → `fusionpbx-proxy { action: 'update-extension', params }` then refresh.
- Add a small `AdminLoader` empty state so a stuck fetch is visible instead of an infinite spinner.

### 5. Contacts (wide screen)
- `ContactsView.tsx`: two-column layout `[directory | detail]`. Directory groups: **Company** (all `pbx_extensions` enabled), **External** (`pbx_softphone_users.contacts` / CRM table).
- Add **+ New Contact** button (top-right) opening a modal that inserts into the contacts table.
- Fix overflow/spacing tokens (currently using fixed `width: 320`).

### 6. Team Chat
- `OrgChatView.tsx`: subscribe to `org_chat_channels`/`org_chat_messages` for the current org, render markdown, post via `supabase.from('org_chat_messages').insert(...)`, mark read in `org_chat_reads`. Add Realtime channel for live updates.

## Files to change

- `apps/ava-softphone-desktop/src/lib/avaApi.ts` (recordings filters, mapping, admin endpoints)
- `apps/ava-softphone-desktop/src/lib/useMe.ts` (new – org/ext cache)
- `apps/ava-softphone-desktop/src/components/RecordingsList.tsx` (playback + visual)
- `apps/ava-softphone-desktop/src/components/console/RecordingsView.tsx` (wide-screen player)
- `apps/ava-softphone-desktop/src/components/console/AIPanel.tsx` + `AIWorkspace.tsx`
- `apps/ava-softphone-desktop/src/components/console/ContactsView.tsx`
- `apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx`
- `apps/ava-softphone-desktop/src/components/console/admin/*` (extensions list/edit)
- `supabase/functions/ava-admin-command/index.ts` (read-only mode + new tools + org scoping)
- `supabase/functions/fusionpbx-proxy/index.ts` (add `list-extensions`/`update-extension` if missing)

## Quick confirmation before I build

I'll target the **desktop console app** (`apps/ava-softphone-desktop`) only. Tell me if any of these are wrong:

- Allow the AVA Assistant chat to answer read-only data questions for **any logged-in softphone user** (not just admins). Admin-only stays for *propose/execute* of changes.
- Filter recordings/CDRs to the user's **extension** by default, with a "show all org" toggle for admins.
- Use `fusionpbx-proxy` as the source of truth for admin lists (Extensions/IVR/Queues), with DB mirror as fallback.
