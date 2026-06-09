
# Plan: Desktop App — Complete Telecom Workspace

**Hard rule:** Do not touch `src/pages/Landing.tsx` or `src/components/landing/**`. All work lives in `apps/ava-softphone-desktop/`, shared `src/hooks/`, `supabase/functions/`, and migrations.

## Architecture overview

```text
apps/ava-softphone-desktop/src/
├── app/
│   ├── Shell.tsx                    role-aware nav (user vs admin)
│   └── routes.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Softphone.tsx                (exists)
│   ├── Calls.tsx                    (exists)
│   ├── Voicemail.tsx                (exists, + AI greeting editor)
│   ├── Recordings.tsx               (exists)
│   ├── Messages.tsx                 SMS (feature-flagged)
│   ├── OrgChat.tsx                  NEW
│   ├── TelecomSettings.tsx          NEW (user)
│   ├── AIAssistant.tsx              user chatbot (exists)
│   └── admin/
│       ├── AdminTelecomCenter.tsx   NEW (hub: users/exts/devices/DIDs/IVR/queues/RG/hours/holidays)
│       ├── AdminAIChat.tsx          NEW (confirm-before-execute)
│       └── Reports.tsx              NEW
└── lib/
    ├── roleGuard.ts                 isOrgAdmin / isManager / hides admin routes
    └── pbxApi.ts                    edge-function callers only
```

Shared backend (web portal already wired): `supabase/functions/pbx-chat-agent`, `fusionpbx-proxy`, `user-voicemail-greeting`, `org-chat`. Reuse them.

## Phase 1 — User Telecom Settings + Working Hours (Feature 1)

- Tables already present: `user_working_hours`, `user_call_handling`, `pbx_voicemail_settings`. Verify columns match the spec; migrate only if missing.
- New page `TelecomSettings.tsx`:
  - Assigned extension + WebRTC reg status (read from `pbx_softphone_users` via existing hook).
  - Weekly schedule grid Mon–Sun (start/end, enabled, lunch window, timezone).
  - Availability state (available/busy/dnd/away/vacation) → `user_presence` via `upsert_user_presence`.
  - After-hours action (voicemail / forward extension / forward external / org default) → `user_call_handling`.
  - Save badges: saved / pending sync / synced / failed.
  - All writes via a new edge function `user-telecom-settings` (validates + applies to FusionPBX via `fusionpbx-proxy`, never exposes creds).

## Phase 2 — AI Voicemail Greeting (Feature 2)

- Reuse existing `voicemail-greetings` flow and `voicemail-greetings` bucket.
- New edge function `generate-voicemail-greeting`:
  - Input: `tone` (professional/friendly/bilingual/short/detailed/after-hours/vacation).
  - Step 1: Lovable AI Gateway (`google/gemini-3-flash-preview`) → greeting text.
  - Step 2 (optional): ElevenLabs TTS (`ELEVENLABS_API_KEY` already set) → MP3 uploaded to `voicemail-greetings/<org>/<user>/<uuid>.mp3`.
  - If TTS unavailable → return text only with `tts_unavailable: true`.
- UI in `Voicemail.tsx`: tone picker, preview audio, "Save as my greeting" with confirm. Keep previous greeting until confirm; allow revert.

## Phase 3 — Organization Chat (Feature 3)

- Tables already present: `org_chat_channels`, `org_chat_messages`. RLS via `can_access_chat_channel` (already defined).
- Ensure `ensure_general_channel(org_id, user_id)` is called on first open.
- Edge function `org-chat` already exists for posting messages.
- New page `OrgChat.tsx`:
  - Channel sidebar (general + admin-created), unread badges from `org_chat_messages` vs `last_read_at` (add column if missing).
  - Realtime via `supabase.channel().on('postgres_changes', ...)` filtered by `organization_id`.
  - Message composer with attachments → `chat-attachments` bucket.
  - Full-text search using existing `tsv` column.
  - Admin actions: create/rename/archive/delete channel (RLS already enforces).

## Phase 4 — Role-aware Admin Surface (Feature 4)

- `roleGuard.ts` reads `user_roles` for current org (reuse `has_role` + `is_master_admin`).
- `Shell.tsx` filters nav items by role; admin routes also guarded in router.
- `AdminTelecomCenter.tsx` = tabbed hub reusing existing portal admin components from the web app:
  - Users / Extensions / Devices / DIDs / IVR / Queues / Ring groups / Business hours / Holidays / Vacation IVR.
  - Each tab calls existing edge functions (`fusionpbx-proxy` create/update/delete-* endpoints).
  - SIP password reset via `admin_link_softphone_by_email` + new `admin-reset-sip-password` edge function (generates, stores hashed, returns one-time copy QR).
  - Portal password reset → triggers `supabase.auth.resetPasswordForEmail()` (no plaintext exposure).

## Phase 5 — Admin AI Chat (Features 5 & 6)

- New edge function `telecom-admin-ai-agent` (AI SDK + Lovable AI Gateway, `stepCountIs(50)`).
- Tools (all `needsApproval: true` for mutations):
  - `create_business_hours_schedule`, `update_business_hours`, `apply_schedule_to(target)`
  - `create_holiday`, `apply_vacation_mode`, `restore_normal_routing`
  - `create_ivr`, `update_ivr_options`, `generate_ivr_greeting` (calls Phase 2 pipeline)
  - `create_user_and_assign_extension`, `reset_sip_password`, `send_portal_reset_email`, `enable_disable_user`
  - `assign_did_to_destination`, `set_after_hours_action`
  - `add_queue_agent`, `remove_queue_agent`, `set_queue_hours`, `set_overflow_destination`
  - Read-only: `list_users`, `list_extensions`, `list_queues`, `get_call_stats`, `summarize_today`
- Two-step UX in `AdminAIChat.tsx`:
  1. AI proposes → render `proposed_changes_json` diff card.
  2. Admin clicks **Confirm** → frontend calls execution endpoint with the proposal ID.
- New table `telecom_admin_ai_actions` (id, org_id, admin_user_id, prompt, interpreted_action, proposed_changes_json, confirmation_status, execution_status, execution_result_json, created_at, executed_at) with RLS scoped to org admins; service_role full access; audit insert trigger writes to `audit_logs`.

## Phase 6 — Reports (Feature 7)

- New page `admin/Reports.tsx`. Read from existing `pbx_call_records`, `pbx_voicemails`, `cc_queue_stats`, `agent_daily_reports`.
- Report types: org summary, user performance, missed calls, queue performance, DID usage, after-hours, voicemail, AI insights.
- Filters: date range / user / extension / queue / DID.
- AI exec summary via Lovable AI from aggregated row set.
- CSV/PDF export reuses `src/utils/pdfExport.ts`.

## Phase 7 — Database migrations (only what's missing)

Verify before adding; create only if absent:
- `business_hour_schedules` (org_id, name, timezone, schedule_json, assigned_to_type, assigned_to_id, +timestamps)
- `holiday_schedules` (org_id, name, start_date, end_date, greeting_text, audio_url, routing_action, routing_target, active, +timestamps)
- `telecom_admin_ai_actions` (as above)
- Possibly extend `org_chat_messages` with `read_by uuid[]` or add `org_chat_reads(user_id, channel_id, last_read_at)`

Every new public table: `CREATE TABLE` → `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated` + `GRANT ALL TO service_role` → `ENABLE RLS` → policies using `has_role(auth.uid(), org_id, 'org_admin')` / `current_user_org_ids()`.

## Phase 8 — Security & audit (Feature 10)

- All write paths through edge functions; no FusionPBX creds in client.
- New helper edge function `audit-log` (or insert directly via service_role) capturing: admin_user_id, organization_id, action, target, previous, new, status, source = `desktop_app` or `ai_admin_chat`.
- SIP passwords: generated server-side, stored hashed, displayed once via QR provisioning.
- Lint check after migrations: `supabase--linter` and address any new RLS warnings.

## Phase 9 — UX polish

- Status pill component reused across pages (Connected / Registered / Sync pending / Sync failed / Not configured).
- Empty + loading + error skeletons per page.
- FR/EN via existing `useTranslation`; add missing keys to `src/locales`.
- Window-size responsiveness verified at 1024×640 minimum.

## Out of scope this iteration

- Mobile app (separate plan).
- Landing page (locked by memory).
- Any change to existing CI/CD workflows or `electron-builder.yml` (per prior user instruction).

## Files I'll add or edit (high level)

- `apps/ava-softphone-desktop/src/pages/{TelecomSettings,OrgChat}.tsx`
- `apps/ava-softphone-desktop/src/pages/admin/{AdminTelecomCenter,AdminAIChat,Reports}.tsx`
- `apps/ava-softphone-desktop/src/lib/{roleGuard,pbxApi}.ts`
- `apps/ava-softphone-desktop/src/app/Shell.tsx` (role-aware nav)
- `supabase/functions/{user-telecom-settings,generate-voicemail-greeting,telecom-admin-ai-agent,admin-reset-sip-password}/index.ts`
- `supabase/migrations/<ts>_desktop_telecom_phase.sql`
- Shared hooks under `src/hooks/` reused by both portal and desktop.

## Acceptance gates

After each phase: deploy edge functions, run `supabase--linter`, smoke test via `supabase--curl_edge_functions`, then verify in desktop dev build (`bun run dev` inside `apps/ava-softphone-desktop`).
