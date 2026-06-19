## Goal
Add per-recording AI (transcription + summary + coaching) on the mobile Recordings screen, and make sure the extension filter is visible on both Recordings and Call History.

## 1. Recordings screen — AI transcription, coaching, notes, summary

File: `apps/ava-softphone-mobile/src/screens/RecordingsScreen.tsx`

- Each recording row becomes expandable. Tapping reveals an inline panel with:
  - ▶ Audio player (already loads via `fusionpbx-proxy`).
  - "Transcribe with AI" button (only if no transcript yet) → calls existing `mobileApi.transcribeCall(id, meta)` (backed by edge function `ai-transcribe-call`, Lovable AI `openai/gpt-4o-mini-transcribe`).
  - Once transcript exists, auto-trigger `mobileApi.analyzeCall(id)` (backed by `ai-analyze-call`, Lovable AI `google/gemini-3-flash-preview`) to produce: summary, coaching score, coaching notes, action items, sentiment, topics.
  - Render: summary paragraph, coaching score chip, coaching notes list, action items, full transcript (collapsible).
- Status pills: "Transcribing…", "Analyzing…", "AI ready", error banner with retry.
- Cache results: read `transcript`/`summary`/`coachingScore`/`coachingNotes` from `mobileApi.callDetail(id)` first; only run AI if missing. Same pattern already used in `CallDetailScreen.tsx` — extract a shared `useCallAi(callId, meta)` hook in `apps/ava-softphone-mobile/src/hooks/useCallAi.ts` and reuse it in both screens to avoid duplication.

## 2. Extension filter — Recordings

File: `apps/ava-softphone-mobile/src/screens/RecordingsScreen.tsx`

- Filter is currently shown only when `isAdmin === true`. It is not appearing because:
  - `isAdmin` is passed in from `CallsScreen` and resolves to `false` for non-admin users — by design end-users only see their own extension.
- Confirm behaviour with admin user. If the admin still sees no filter, the cause is `domainUuid` missing on `creds` — add a fallback that derives `domain_uuid` from `mobileApi.me()` and refetches `pbx_extensions_directory`. Also surface "Loading extensions…" / "No other extensions" hints so the dropdown is never silently empty.

## 3. Extension filter — Call History

File: `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx`

- Filter already renders for admins (lines 184–193). Apply the same `domainUuid` fallback so it never disappears for admins whose creds lack `domainUuid`.
- Keep end-user scoping (own extension only) — that is a security requirement.

## 4. No backend changes required
- `ai-transcribe-call` and `ai-analyze-call` already exist and are wired through `mobileApi`.
- No DB migration, no new edge function.

## Files touched
- `apps/ava-softphone-mobile/src/hooks/useCallAi.ts` (new)
- `apps/ava-softphone-mobile/src/screens/RecordingsScreen.tsx`
- `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx`
- `apps/ava-softphone-mobile/src/screens/CallDetailScreen.tsx` (refactor to use the new hook)
