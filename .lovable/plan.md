# Continue Multi-Platform Fixes — Phases 2-5

Picking up where Phase 1 left off (CDR SQL fix, AI job schema). Now dispatching the remaining fixes so desktop app, mobile app (`/m`), admin portal, and user portal all stay in sync.

## Phase 2 — Desktop Admin: full edit parity + live counts

**Files:** `apps/ava-softphone-desktop/src/components/console/CustomersView.tsx`, `AdminView.tsx`, `DomainModal.tsx` (+ new `ExtensionEditModal`, `NumberEditModal`, `QueueEditModal`)

- Show real counts for extensions / numbers / call queues per domain by querying `pbx_extensions`, `pbx_phone_number_assignments` (and `phone_numbers`), `pbx_call_queues` grouped by `domain_uuid`, falling back to `organization_id`. Subscribe via Realtime so counts update live.
- Replace the cramped "Edit" dialogs with full admin-portal-equivalent panels exposing every field currently editable in the admin portal (extension: SIP creds, voicemail, forwarding, CID, codecs, recording; number: routing, CNAM, e911, assignment; queue: strategy, timeout, MOH, members).
- Save via the same RPC/edge functions the admin portal uses, then trigger `fusionpbx-proxy` `sync-domain` so changes propagate to PBX immediately.

## Phase 3 — Mobile `/m` CDR & Recordings (real-time + correct metadata)

**Files:** `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx`, `CallDetailScreen.tsx`, `RecordingsScreen.tsx`, `hooks/useRealtimeCDR.ts`, `supabase/functions/mobile-calls/index.ts`, `supabase/functions/mobile-recordings/index.ts`

- `mobile-calls`: broaden CDR match (include `caller_id_number`, `caller_destination`, `source_number`, `destination_number`, `extension`) and order by `start_stamp DESC`. Pull from `lemtel_cdrs_cache` first, fall back to `pbx_call_records`.
- Auto-trigger `cron-pbx-sync` on screen focus + pull-to-refresh, not only manual retry. Subscribe to `pbx_call_records` Realtime channel so new calls stream in.
- Render readable local date + time on list rows and detail screen (use `Intl.DateTimeFormat`, locale-aware).
- Recordings: use the new `xml_cdr_uuid` / `record_path` / `record_name` returned by the edge function to request a signed URL via `pbx-recording-url`. Show actual playback state (loading / playing / error) instead of generic label.

## Phase 4 — Mobile Home: rich stats + AVA summary ranges

**Files:** `apps/ava-softphone-mobile/src/screens/DashboardScreen.tsx`, `components/AIPanel.tsx`

- Expand the home dashboard tiles: total calls, answered, missed, avg duration, peak hour, top extension, voicemails, recordings count — for Today / 7d / 30d / custom range (date picker).
- AVA summary calls `ai-summary` edge function (Lovable AI Gateway, model `google/gemini-2.5-flash`) with the aggregated stats and returns a natural-language daily/weekly/monthly briefing. Cache last result in `localStorage` keyed by range.
- Same component reused on desktop app home and user portal home for parity.

## Phase 5 — Cross-platform sync hardening

- Ensure these tables are in `supabase_realtime` publication: `pbx_call_records`, `lemtel_cdrs_cache`, `pbx_voicemails`, `pbx_call_recordings`, `pbx_extensions`, `pbx_phone_number_assignments`, `pbx_call_queues`, `pbx_domains`.
- Centralize Realtime subscription in a shared `useTelecomRealtime` hook consumed by desktop, mobile, admin, and user portals so a single change fans out everywhere.
- Add an `app_sync_events` lightweight broadcast channel (`supabase.channel('telecom:sync')`) emitted by `cron-pbx-sync` after each successful run; all clients listen and invalidate React Query caches.

## Technical notes

- No changes to `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`.
- Edge functions touched: `mobile-calls`, `mobile-recordings`, `cron-pbx-sync`, new `ai-summary`.
- Migration: add missing tables to `supabase_realtime` publication; no schema changes.
- React Query keys standardized: `['cdrs', orgId, range]`, `['recordings', orgId]`, `['dashboard-stats', orgId, range]` so invalidation works across platforms.

Approve to start with Phase 2.
