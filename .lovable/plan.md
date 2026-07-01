## Root cause

`src/pages/lemtel/admin/AdminRecordings.tsx` line 75 selects a non-existent column `summary` from `pbx_call_records`. The real column is `ai_summary` (all other files in the codebase already use `ai_summary`). This single typo makes the whole Recordings page throw `column pbx_call_records.summary does not exist` before any row is loaded — that's why "0 shown" for every domain.

The rich transcript/coaching data already lives in `pbx_call_transcripts` (joined via `call_record_id`) and `pbx_ai_insights`; the page's `hydrateMeta()` already reads from both correctly. Only the initial list query is broken.

## Part 1 — Fix the failing query (unblocks the page)

In `src/pages/lemtel/admin/AdminRecordings.tsx`:
- Replace `summary` with `ai_summary` in the `.select(...)` on line 75.
- Update the `Rec` type: `summary?: string | null` → `ai_summary?: string | null`.
- Update the 3 render/merge sites (lines ~218, 261, 270, 426–431) to read `r.ai_summary` instead of `r.summary` (fallback chain becomes `metaById[r.id]?.summary || r.ai_summary`).

No DB migration. Do NOT add a `summary` column to `pbx_call_records`.

## Part 2 — Load recordings across all Lemtel domains

The list query already scopes only by `organization_id = LEMTEL_ORG_ID` + `has_recording = true` (no `domain_uuid` filter), so once Part 1 is fixed, all domains under Lemtel will appear. Additions:

- Add an optional "Domain" `<Select>` at the top of the page for super/org admins, populated from `distinct domain_uuid/domain_name` in `pbx_domains` for the org. Default = "All domains".
- Default date range: last 7 days (set `fromDate`/`toDate` on first mount instead of blank).
- Wire the existing FR/EN dropdown to persist per-user (already stored in `localStorage`) and pass `target_language` to `ai-transcribe-call` on Retranscribe.

## Part 3 — Cross-platform realtime sync of transcripts

Reuse the existing `useLemtelAiRealtime(LEMTEL_ORG_ID, reloadCurrentPage)` hook (already imported on this page) — it already subscribes to `pbx_call_transcripts` + `pbx_ai_insights` + `pbx_call_records` + `pbx_call_recordings` filtered by `organization_id` and invalidates queries. On transcript INSERT/UPDATE, refresh the affected row's meta in-place (call `hydrateMeta(r)` instead of a full page reload) to avoid flicker.

Confirm the same hook (or its equivalent) is wired in:
- Desktop: `apps/ava-softphone-desktop/src/lib/useRealtimeRefresh.ts` — add a subscription for `pbx_call_transcripts` on the recordings screen if missing.
- Mobile: `apps/ava-softphone-mobile` recordings screen — verify the `pbx_call_transcripts` channel exists (it does via `useNotificationCounts` / recordings screen).

All three platforms already read/write the same `pbx_call_transcripts` table — no schema change.

## Part 4 — "Sync from PBX" all domains

`syncFromPbx()` already calls `fusionpbx-proxy` with `action: 'backfill-cdrs'` scoped to `LEMTEL_ORG_ID`. Verify in `supabase/functions/fusionpbx-proxy/index.ts` that `backfill-cdrs` iterates every domain under the org (not just the first). If it doesn't, extend it to loop over `pbx_domains` rows for the org and aggregate the counts. Return `{ inserted, updated, domains_processed }` and toast the total.

## Out of scope for this fix

The bilingual `transcript_text_fr` / `transcript_text_en` split, per-field translation buttons, and a mobile-identical card redesign are large additive features. Not blocking the reported error and would double the size of this change. Happy to plan them as a follow-up once the page loads again — confirm if you want them bundled in.

## Files to change

- `src/pages/lemtel/admin/AdminRecordings.tsx` — column rename + domain filter + default date range + in-place row hydration on realtime events.
- `supabase/functions/fusionpbx-proxy/index.ts` — verify/extend `backfill-cdrs` to cover every Lemtel domain (only if it currently doesn't).

### Technical notes

- Column mapping confirmed via `information_schema`: `pbx_call_records` has `ai_summary`, `sentiment`, `transcribed`, `analyzed`, `recording_id`, `destination`, `has_recording` — but no `summary`.
- Every other query in the codebase (`ava-assistant`, `mobile-recordings`, `TelephonyMediaCenter`, `my-ai-assistant`, `useMyDashboardStats`, `ai-transcribe-call`) already uses `ai_summary`. AdminRecordings is the only offender.
