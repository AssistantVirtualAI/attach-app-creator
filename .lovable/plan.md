# Mobile playback + transcribe + live CDR (mobile / desktop / portal) + richer home stats

No changes to `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`.

---

## 1. Fix recording playback + transcribe (CallDetailScreen — mobile)

Today the **Play** button in `apps/ava-softphone-mobile/src/screens/CallDetailScreen.tsx` is a static `<button>` with no `onClick` — nothing plays, nothing transcribes. Rewire it:

- Add a single `audioRef` with proper lifecycle (pause/cleanup on unmount and on switch).
- On **Play**: call existing `mobileApi.voicemailAudio({ xml_cdr_uuid: callId, organization_id })` (same endpoint already issues signed URLs for both voicemail and call recordings). Cache the URL per call id. Show loading / error states + a "Retry in 3s" button.
- Real progress bar driven by `audio.ontimeupdate`; click-to-seek on the waveform.
- **Transcribe**: when the call has no transcript, show a "Transcribe with AVA" button that calls `mobileApi.analyzeCall(callId)` and then re-fetches `callDetail`. Auto-trigger after playback ends if `hasTranscript` is false.
- Surface transcript + summary + action items live as they arrive.

This same screen is rendered from Recordings tab today, so the fix covers both entry points.

## 2. Broaden CDR fetch so "yesterday/today" calls always appear

`supabase/functions/mobile-calls/index.ts` filters with a hard `.eq("extension", sp.extension)`. Calls written by FreeSWITCH where `extension` is null but `caller_number` or `destination_number` matches the user's extension are silently dropped. Change list query to:

```text
organization_id = sp.organization_id
AND (extension = sp.extension
     OR caller_number = sp.extension
     OR destination_number = sp.extension)
ORDER BY start_at DESC
LIMIT 200
```

Apply the same OR to the detail query so deep links never 404. Same broadening already applied to the mobile realtime CDR client filter — no further change needed there.

## 3. Live CDR sync — verify across mobile, desktop, portal

- **Mobile** — already has `useRealtimeCDR` (tightened last turn) + Recordings live refresh. Add the same realtime subscription to the home **Calls** tab so new rows appear without a manual reload.
- **Desktop** (`apps/ava-softphone-desktop`) — `RecentsList` already uses `useRealtimeRefresh` on `pbx_call_records`. Add the same OR-on-extension filter on its initial load query so existing data appears even when `extension` column is empty, and on realtime INSERT/UPDATE re-pull a fresh page.
- **Portal** (`src/hooks/usePbxRealtime.ts` / call lists) — add a subscription to `pbx_call_records` for the current org that invalidates the calls list query. Already publishes to `supabase_realtime` (migration done last turn).

No changes to RLS — existing `pbx_call_records` policies already scope per org/extension.

## 4. Home dashboard: Today / 7 days / 30 days with richer stats

- Add a segmented control (Today / 7d / 30d) at the top of `DashboardScreen.tsx`.
- Extend `mobile-domain-stats` to accept `?range=today|7d|30d` and return:
  - total calls, answered, missed, voicemails
  - total talk time (sum of `duration_seconds`)
  - average duration
  - average answer rate %
  - peak hour bucket
  - per-day bar chart (1/7/30 buckets)
  - top 5 extensions by call volume
- Client-side: replace today-only metrics + 7-day chart with the new range-aware payload. Loading skeletons preserved.

## 5. Physical mobile app parity

The native app on iOS/Android **is** the same codebase under `apps/ava-softphone-mobile`, wrapped by Capacitor. No native code change is required — the bottom tabs, dashboard, recordings, voicemail, contacts, playback, and transcribe will all ship on device. After pulling, the user runs `npx cap sync` once before the next native build (already documented in `apps/ava-softphone-mobile/RELEASE.md`; I'll add a one-line reminder for this batch).

---

## Files touched

- `apps/ava-softphone-mobile/src/screens/CallDetailScreen.tsx` — real Play + Transcribe wiring.
- `apps/ava-softphone-mobile/src/screens/DashboardScreen.tsx` — range tabs + new metrics rendering.
- `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx` — realtime subscription on calls list (small hook reuse).
- `supabase/functions/mobile-calls/index.ts` — broaden list + detail filter.
- `supabase/functions/mobile-domain-stats/index.ts` — range support + extra fields.
- `apps/ava-softphone-desktop/src/components/RecentsList.tsx` — broaden initial CDR query + realtime invalidation.
- `src/hooks/usePbxRealtime.ts` (or `src/hooks/usePbxData.ts`) — subscribe to `pbx_call_records` for live portal CDR.
- `apps/ava-softphone-mobile/RELEASE.md` — note `npx cap sync` for this update.

## Out of scope (will not change)

- AVA org pages, landing page, billing, RLS schema, native build configs.
- No new edge functions beyond the existing ones above.
