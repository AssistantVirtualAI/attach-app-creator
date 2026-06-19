# Final Verification + Fix Plan — All Platforms

Goal: verify each reported bug end-to-end and fix anything that isn't actually working across Desktop, Mobile, Admin Portal, and User Portal. Constraint: do NOT touch `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`.

Work is split into 6 phases. Each phase ends with an explicit verification step before moving on.

---

## Phase 0 — Audit (read-only, no changes)

Goal: confirm current state so we only fix what's actually broken.

1. Inspect realtime CDR code paths:
   - `apps/ava-softphone-desktop/src/components/console/CallsView.tsx`
   - `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx` (and `RecordingsScreen.tsx`)
   - `src/pages/lemtel/admin/AdminDashboard.tsx`
   - User portal CDR view under `src/pages/lemtel/`
   - Any shared `useRealtimeCDR` hook
2. Inspect chat code paths:
   - Desktop `OrgChatView`, mobile `TeamChatScreen`, portal `OrgChat`
3. Inspect `supabase/functions/fusionpbx-proxy/index.ts` for: `get-recording`, `get-recording-signed-url`, `list-extensions`, `list-active-calls`.
4. Inspect storage + DB state via read queries:
   - `storage.buckets` for `call-recordings`
   - `pg_publication_tables` for `supabase_realtime`
   - `org_chat_messages` columns (look for `deleted_at`)
   - `pbx_call_records` columns (transcription/ai_summary/sentiment/score/coaching_points/analyzed/analyzed_at)
   - Existence of `general` channel for Lemtel org

Deliverable: a short pass/fail list per bug feeding the phases below.

---

## Phase 1 — Database + Storage foundations (single migration)

Only run statements whose audit shows them missing.

1. Add missing columns:
   - `org_chat_messages.deleted_at TIMESTAMPTZ`
   - On `pbx_call_records`: `transcription`, `ai_summary`, `sentiment`, `call_score`, `coaching_points jsonb`, `analyzed boolean default false`, `analyzed_at timestamptz`
2. Add tables to realtime publication (idempotent DO block):
   `pbx_call_records`, `org_chat_messages`, `user_presence`, `pbx_ai_insights`, `pbx_queue_agent_state`
3. Ensure REPLICA IDENTITY FULL on `pbx_call_records` and `org_chat_messages` (needed for UPDATE payloads).
4. Create `call-recordings` storage bucket (private) via the storage tool if missing, plus RLS policies on `storage.objects` allowing service_role write and authenticated read for own org.
5. Seed `general` chat channel for Lemtel org `71755d33-…` if missing (via insert tool, not migration).

Verification: re-run audit queries; all should pass.

---

## Phase 2 — CDR realtime unification (Bug 1)

1. Create/normalize a single shared hook used by all 4 platforms:
   - Desktop + mobile already import from their own apps — keep per-app file, but make the logic identical.
   - Initial transport state = `'connecting'` (yellow).
   - On `SUBSCRIBED` → `'live'` (green). On `CHANNEL_ERROR` → `'unavailable'` (red). On `TIMED_OUT`/`CLOSED` → keep `'connecting'` and retry.
   - Channel name: `cdr-live-${domainUuid}`.
   - Filter: `domain_uuid=eq.${domainUuid}` on INSERT + UPDATE of `pbx_call_records`.
   - Cleanup via `removeChannel` in effect teardown.
2. Update status badge components in all 4 platforms to render the 3-state indicator and never default to "unavailable".
3. Files to touch:
   - `apps/ava-softphone-desktop/src/components/console/CallsView.tsx` (+ any hook it uses)
   - `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx`
   - `src/pages/lemtel/admin/AdminDashboard.tsx`
   - User portal CDR view (exact file confirmed in Phase 0)

Verification: place a test row insert via SQL; confirm UI updates without refresh on each platform, badge goes Connecting → Live.

---

## Phase 3 — Recording download + transcription pipeline (Bug 2)

1. In `supabase/functions/fusionpbx-proxy/index.ts`, ensure the `get-recording` action implements full PHP CSRF flow:
   - GET `/login.php`, parse hidden CSRF `name`/`value`.
   - POST `/login.php` with url-encoded `username`, `password`, CSRF — capture `PHPSESSID`.
   - GET `/app/xml_cdr/download.php?id={xml_cdr_uuid}` with `Cookie: PHPSESSID=…`.
   - Stream the audio/mpeg body, upload to `call-recordings` bucket under `${org_id}/${call_id}.mp3`, create a signed URL, return it.
   - Cache the PHPSESSID in memory for reuse across invocations.
2. `get-recording-signed-url` action: return existing object's signed URL if already uploaded.
3. Transcription worker / edge function: on success, UPDATE `pbx_call_records` with `transcription`, `ai_summary`, `sentiment`, `call_score`, `coaching_points`, `analyzed=true`, `analyzed_at=now()` — single UPDATE so realtime fires once.
4. UI: desktop CallsView, mobile RecordingsScreen, portal recording panel — all subscribe to `pbx_call_records` UPDATE and re-render when `analyzed` flips.

Verification: trigger Transcribe on a call with a known recording UUID; confirm bucket object exists, row updates, all platforms reflect change within 60s without refresh.

---

## Phase 4 — Domain chat (Bug 3)

1. Confirm column + general channel exist (from Phase 1).
2. Update chat query layer to ignore deleted messages: `is_hidden = false AND deleted_at IS NULL`.
3. Members list source = `pbx_softphone_users_safe` filtered by `domain_uuid = '2936594e-17b7-42a9-9165-95be48627923'` (Lemtel) for Lemtel users, and by the caller's resolved `domain_uuid` for others.
4. Presence: join `user_presence`, treat `last_seen_at > now() - interval '5 minutes'` as online; render green/grey dots.
5. Realtime: subscribe channel `chat-${channelId}` to INSERT/UPDATE/DELETE on `org_chat_messages` filtered by `channel_id=eq.${channelId}`; subscribe presence on `user_presence` filtered by `organization_id`.
6. Apply identically to desktop `OrgChatView`, mobile `TeamChatScreen`, portal `OrgChat`.

Verification: send messages between desktop and portal user; messages appear <3s both ways; member list shows all domain extensions with correct dots.

---

## Phase 5 — Desktop Admin wide mode (Bug 4)

File: `apps/ava-softphone-desktop/src/components/console/AdminView.tsx`.

1. Detect `window.innerWidth > 1200` (or `useMediaQuery`) → switch to two-pane layout.
2. LEFT (280px, scrollable): customer domain list (org `name`, `fusionpbx_domain_name`, extension count) loaded from `organizations` + a count from `pbx_softphone_users_safe` grouped by `domain_uuid`. Click selects.
3. RIGHT: tabs — Extensions / IVR / Ring Groups / Queues / Active Calls / Call History.
   - Extensions tab: `fusionpbx-proxy { action: 'list-extensions', domain_uuid }`, columns ext/name/reg status, Add/Edit/Delete dialogs reusing existing extension mutation actions.
   - Active Calls tab: `{ action: 'list-active-calls', domain_uuid }`.
   - Call History tab: query `pbx_call_records` filtered by `domain_uuid`.
4. Add `list-extensions` action in `fusionpbx-proxy` if missing:
   - `GET https://pbxnode.lemtel.tel/app/api/7/extensions?domain_uuid=…&limit=50&offset=0`
   - Headers: `X-Key`, `X-Username` from secrets.

Verification: open desktop full-screen → Admin tab; left list populated; click a domain → extensions render; add/edit/delete round-trips to PBX.

---

## Phase 6 — Self-test pass (manual + scripted checks)

Run the full checklist from the request:
- CDR realtime: test insert → all 4 surfaces show LIVE and new row.
- Transcription: trigger on a real recording → row + UI update.
- Chat: cross-platform send + member list + presence dots.
- Desktop admin wide: domain list, extensions, CRUD.
- Mobile screens: Recordings, Contacts, Chat, Voicemail (with ElevenLabs greeting visible), Queues.

For each failing item, loop back to the relevant phase and patch before declaring done.

---

## Technical notes

- All edge function changes go in `supabase/functions/<name>/index.ts`; they auto-deploy.
- All schema changes via the migration tool with GRANTs + RLS preserved; data seeds via the insert tool.
- Realtime subscriptions must live inside `useEffect` with cleanup to avoid leaks (per project rule).
- No changes to `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`.
- Landing page files remain untouched.
