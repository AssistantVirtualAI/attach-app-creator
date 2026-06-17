# Plan: Real transcription + readable page header banner

## 1. Fix call transcription (real audio, not metadata fallback)

The "Transcription and analysis complete" message followed by metadata-only text comes from `supabase/functions/ai-transcribe-call/index.ts`. When no audio bytes can be fetched, it writes a stub built from caller/duration/hangup info and the AI analysis step then truthfully says "only basic call metadata".

Root cause: the function never actually pulled the audio for this call (no `recording_url`, or `fusionpbx-proxy` returned no `audio_base64`), so it skipped the AI gateway entirely.

Changes in `ai-transcribe-call/index.ts`:
- Try harder to resolve audio: (1) direct `recording_url`, (2) Supabase Storage path `recording_path` via `admin.storage`, (3) `fusionpbx-proxy` `get-recording`, (4) `twilio-recording-proxy` when call originated from Twilio. Log which source succeeded.
- Stop silently writing the stub on `!audioBytes`. Instead return HTTP 422 with a clear reason (`no-audio`, `proxy-failed`, `forbidden-host`) so the UI can show "Recording unavailable" instead of the misleading metadata transcript.
- When audio is found but >20 MB, downsample/clip with `ffmpeg`-equivalent? Not feasible in edge. Instead split base64 send into a single Gemini call with `gemini-2.5-flash` (already supports inline audio up to ~20MB). If too large, switch to OpenAI Whisper via Lovable AI if available; otherwise return 413 with reason.
- Switch model to `google/gemini-2.5-pro` for transcription (better verbatim) and keep `gemini-2.5-flash` for the downstream `ai-analyze-call` summary. Add `maxOutputTokens: 8000` and log `finishReason`.
- Always set `provider` accurately: `lovable-ai/gemini-2.5-pro`, `stub-no-audio`, `stub-error`. Frontend can hide AI analysis when `provider` starts with `stub-`.

Changes in `ai-analyze-call/index.ts`:
- Skip analysis entirely when the transcript record has `provider` starting with `stub-`. Return a friendly "Transcript not yet available — recording could not be retrieved" and don't fabricate a sentiment/score.

Frontend (`LemtelPortalCalls.tsx` and AVA summary panel):
- When transcript `provider` is a stub, show a clear empty state with a "Retry transcription" button (calls `ai-transcribe-call` again) instead of the current misleading "complete" message.

## 2. Redesign the page header banner (light + dark)

The grey/washed banner in the screenshot is the cockpit glass hero used on Reports / Insights pages. The eyebrow ("INSIGHTS") and subtitle are nearly invisible because of low-opacity foreground on a near-white frosted gradient.

Changes in `src/index.css` (cockpit glass tokens):
- Replace `--cockpit-surface` light values with a deeper tinted glass (subtle primary tint) so the gradient isn't pure grey.
- Raise eyebrow/subtitle contrast: define `.cockpit-eyebrow` (uppercase, tracking, `text-primary/80` light · `text-cockpit-cyan` dark) and `.cockpit-subtitle` (`text-foreground/75`).
- Tighten border to `hsl(var(--primary) / 0.25)` and add a soft inner glow that matches the brand cyan/violet instead of flat grey.

Changes in the header component used for Reports (locate exact component on first build step — likely a local `<header>` block in the Reports page; if it's a shared "PageHero" we'll update once and propagate):
- Use semantic tokens: `text-foreground` for title, `cockpit-eyebrow` class for "INSIGHTS", `cockpit-subtitle` for description.
- Add subtle gradient overlay (`from-primary/10 via-transparent to-cockpit-cyan/10`) instead of the current flat translucent grey.
- Ensure 4.5:1 contrast in both themes (verify manually after build).

## Files to touch
- `supabase/functions/ai-transcribe-call/index.ts`
- `supabase/functions/ai-analyze-call/index.ts`
- `src/pages/lemtel/LemtelPortalCalls.tsx` (transcript empty state + retry)
- `src/index.css` (glass tokens + eyebrow/subtitle helpers)
- The Reports page header (file pinpointed during build — likely `src/pages/AgentReports.tsx` or a shared hero component)

## Out of scope
- Changing where recordings are stored / FusionPBX configuration.
- Re-running historical stub transcripts in bulk (user can click Retry per call).
