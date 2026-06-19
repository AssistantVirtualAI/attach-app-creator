# Unified Recording Intelligence + Live CDR Sync

Transcribe & analyze each recording exactly **once** server-side, persist the result, and stream it to every surface (mobile app, desktop app, admin portal, client portal). Add realtime sync indicators, richer per-range Home stats, and a robust CDR retry/refresh path.

## 1. Transcribe-once + analyze-once pipeline (shared backend)

**Storage of truth:** `pbx_call_records` already has `transcribed`, `ai_summary`, `ai_score`, etc. Add (migration):
- `transcript_text` (text)
- `transcript_json` (jsonb — segments + speakers)
- `ai_sentiment` (text), `ai_topics` (text[]), `ai_action_items` (text[])
- `ai_coaching_notes` (jsonb — array of `{ category, severity, note }`)
- `ai_score` (already present) + `ai_score_breakdown` (jsonb)
- `ai_status` enum: `idle | queued | running | done | failed`
- `ai_error` (text), `ai_started_at`, `ai_completed_at`

**Edge function `ai-analyze-call` (existing) becomes idempotent:**
1. Lock row (`ai_status='running'` only if currently `idle|failed`). If `done` → return cached result immediately. If `running` → return `{status:'running'}`.
2. Pull recording bytes via the existing `fusionpbx-proxy get-recording` path.
3. Transcribe via Lovable AI STT (`openai/gpt-4o-mini-transcribe`).
4. Analyze via Lovable AI chat (`google/gemini-3-flash-preview`): summary, sentiment, topics, action items, coaching notes, score 0–100 with breakdown.
5. Persist everything to `pbx_call_records`, set `ai_status='done'`, broadcast via Realtime.

**Realtime fan-out:** ensure `pbx_call_records` is in `supabase_realtime` publication (it already is). All clients subscribe; updates dispatch instantly.

## 2. Auto-load recordings (no second tap)

- **Mobile `CallDetailScreen` / `RecordingsScreen`:** prefetch the signed URL the moment the row mounts (or list opens) so Play is instant. Show a small "loading audio" spinner inline; if `RECORDING_NOT_FOUND` (already returns 200+fallback), show the friendly badge.
- **Desktop `RecentsList`:** same prefetch when the row is hovered/selected.
- **Portal call-detail drawer:** prefetch via existing `loadPbxRecordingAudio`.

## 3. One-tap Transcribe action

- **Mobile recordings list:** add a `Transcribe` chip on each row.
  - If `ai_status='done'` → chip becomes `View AI` (opens detail with transcript + score + coaching).
  - If `running|queued` → shows animated progress chip with elapsed seconds.
  - If `failed` → red chip with `ai_error` tooltip + Retry.
- **Desktop `RecentsList` + Portal recordings table:** same chip states.
- All three surfaces call the same `ai-analyze-call` function — cached result returns instantly, no re-transcription, no token burn.

## 4. Realtime sync status indicator

Tiny pill in the header of each surface:
- 🟢 `Live` — Realtime channel `SUBSCRIBED` and last event < 60s
- 🟡 `Reconnecting` — channel `CHANNEL_ERROR` / `TIMED_OUT`, auto-retrying
- 🔴 `Offline` — no socket; manual Retry button
- Click pill → expanded popover with last-event timestamp, channel name, and `Force resync` button.

Implementation: shared `useRealtimeHealth(channelName)` hook in each app, reading `channel.state` + heartbeat timestamps.

## 5. CDR sync retry (manual + auto)

- **Auto:** on `visibilitychange → visible`, on app foreground (Capacitor `App.appStateChange`), on Realtime reconnect → refetch last 24h CDRs.
- **Backoff:** if a CDR insert event references a row not yet readable (replication lag), retry the row fetch with 250ms → 500ms → 1s → 2s backoff (max 4 tries).
- **Manual:** existing Refresh button stays; add `Force PBX pull` secondary action that invokes `cron-pbx-sync` for the user's domain (single-flight guarded — already implemented per prior change).

## 6. Home screen — richer per-range stats

`mobile-domain-stats` already supports `today | 7d | 30d`. Extend response with:
- `missedCalls`, `answeredCalls`, `outboundCalls`
- `avgDurationSec`, `totalTalkSec`
- `dialSuccessRate` (answered / total outbound), `dialFailedCount`
- `peakHour`, `perDay[]` (already present)

New tiles on `DashboardScreen.tsx`: Missed, Avg Duration, Dial Success %, Failed Dials. Same data surfaced on the desktop Home pane.

## 7. Playback debug checklist (dev-only mobile drawer)

Behind a long-press on the audio waveform (or `?debug=1`), show:
1. Signed URL issued ✓ / ✗  (+ expiry countdown)
2. `HEAD` request reachable ✓ / ✗  (status code)
3. Content-Type starts with `audio/` ✓ / ✗
4. `<audio>` `canplaythrough` fired ✓ / ✗
5. First `timeupdate` fired ✓ / ✗
6. PBX path source (xml_cdr / call_recordings / fallback)

Surfaces the exact failure point without needing remote logs.

## Files touched

**Backend (edge functions + migration):**
- `supabase/migrations/<new>.sql` — add AI columns + status enum
- `supabase/functions/ai-analyze-call/index.ts` — idempotent transcribe+analyze+coach
- `supabase/functions/mobile-domain-stats/index.ts` — extended metrics
- `supabase/functions/mobile-recordings/index.ts` — include `ai_status`, `ai_score`

**Mobile (`apps/ava-softphone-mobile/`):**
- `src/screens/RecordingsScreen.tsx` — Transcribe chip, prefetch, status badges
- `src/screens/CallDetailScreen.tsx` — auto-load audio, coaching panel, debug drawer
- `src/screens/DashboardScreen.tsx` — new stat tiles
- `src/components/RealtimeStatusPill.tsx` (new)
- `src/hooks/useRealtimeHealth.ts` (new)
- `src/hooks/useRealtimeCDR.ts` — backoff retry on row-not-found
- `src/MobileApp.tsx` — mount pill in header

**Desktop (`apps/ava-softphone-desktop/`):**
- `src/components/RecentsList.tsx` — Transcribe chip + prefetch + AI panel
- `src/components/RealtimeStatusPill.tsx` (new)
- `src/hooks/useRealtimeHealth.ts` (new)
- `src/lib/avaApi.ts` — `analyzeCall`, `getCallAi` helpers

**Portal (`src/`):**
- `src/hooks/usePbxData.ts` — surface `ai_*` columns
- `src/hooks/useRealtimeHealth.ts` (new)
- `src/components/pbx/RecordingsTable.tsx` — Transcribe chip + AI badge
- `src/components/pbx/CallDetailDrawer.tsx` (or equivalent) — transcript + coaching + score panel
- Header: realtime pill

## Out of scope (this plan)

- No changes to `Landing.tsx` / `landing/**` (locked).
- No changes to CI/CD, electron-builder, or Capacitor native configs.
- No new storage buckets (reuses `lemtel-recordings`).

After approval I will execute the migration first, then ship backend, then the three UI layers.