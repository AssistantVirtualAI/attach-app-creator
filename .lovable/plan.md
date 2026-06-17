# Phase 2 — Chat sync + transcription fixes

## Reality check vs your spec

Your snippets reference a few things that don't exist in this codebase. I'll adapt to the real schema rather than introducing parallel tables.

- There is no `messages` table. Chat lives in `org_chat_messages` (per-channel) + `org_chat_channels` (per-org), mediated by the `org-chat` edge function.
- There is no `call_transcripts` table or `pbx_call_records.transcription` column. Transcripts live in `pbx_call_transcripts`; `pbx_call_records.transcribed` is a boolean flag.
- The desktop transcribe path uses the **Lovable AI Gateway (Gemini 2.5 Pro inline-audio)** today, not OpenAI Whisper / ElevenLabs. It's the recommended path on Lovable Cloud and is already wired through `fusionpbx-proxy` + `twilio-recording-proxy`. I'll keep it.
- Mobile has only the AVA AI chat (no group chat screen), so "sync across mobile" applies only when/if a mobile group-chat screen is added — out of scope for this phase.

If you want me to actually rip out `org_chat_*` and replace it with a flat `messages` table, say so explicitly — that's a much bigger migration and will break the existing desktop + web chat.

## Bug 1 — OrgChatView messages get erased

File: `apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx`

- Replace the on-channel-switch effect so it: (a) keeps `messages` mounted while loading the next channel, (b) writes results through a **dedupe-by-id UPSERT merge** instead of `setMessages(data ?? [])`, (c) never clears `messages` on errors.
- Realtime INSERT handler already appends; harden it with the same id-dedupe so optimistic local sends + realtime echoes don't double-render or get overwritten.
- Realtime UPDATE handler keeps its id-map replacement (edits/reactions still work).
- Audit the file for any `setMessages([])` and remove them (search confirms there are currently a couple of reset paths on channel switch + error).

## Bug 2 — Realtime channel naming consistency

Today:
- Web `src/hooks/useOrgChat.ts` → `org-chat-${channelId}`
- Desktop `OrgChatView.tsx` → `chat:${activeId}`

This is the real source of "not synced". Fix:

- Standardize both clients on **`org-chat-${channelId}`** (per-channel — keeps the postgres_changes filter cheap and matches the existing web hook). A pure `org-chat-${organization_id}` channel would force every client to receive every other channel's traffic; I'm pushing back on the literal spec here.
- Add presence to `OrgChatView`:
  - Subscribe to `user_presence` with channel `org-chat-presence-${orgId}` (already partially there as `presence:${orgId}` — rename for consistency).
  - Render a green dot next to any member whose `last_seen_at` is within 5 minutes.
  - Pull the full member roster from `org_members` for the active org (currently the directory list only contains people who've messaged).
- Message send already goes through `org-chat` edge function with the correct `channel_id` (channel rows carry `organization_id`); no insert-payload change needed.

## Bug 3 — Call transcription end-to-end

Edge function `supabase/functions/ai-transcribe-call/index.ts` already:
- pulls audio via direct URL → Supabase Storage → `fusionpbx-proxy get-recording` → `twilio-recording-proxy`,
- sends inline audio to Lovable AI Gateway (Gemini 2.5 Pro),
- writes `pbx_call_transcripts` and flips `pbx_call_records.transcribed`.

So no edge-function rewrite. The fixes are on the client:

`apps/ava-softphone-desktop/src/components/RecordingsList.tsx`
- "Transcribe & Analyze" button shows an inline spinner while the function runs.
- On success, render the transcript text under the audio player (read from `pbx_call_transcripts.transcript_text`).
- On error (including 402 credits-exhausted / 429 rate-limited / `no-audio`), show a clear inline error chip and a **Retry** button. No silent stub fallback in the UI.
- Stop treating `{ stub: true }` responses as success — surface them with the `reason` so the user knows why no real transcript came back.

## Bug 4 — Admin recordings page

File: `src/pages/lemtel/admin/AdminRecordings.tsx`
- Filter the recordings query by the selected org's `domain_uuid` (resolve via `pbx_domains.organization_id`).
- Render rows with: caller, destination, date, duration, audio player, Transcribe button.
- Audio loads via the `fusionpbx-proxy` `get-recording` action through a signed/base64 source already used elsewhere.
- On audio load failure, show "Audio not available" with a Retry button that re-invokes `get-recording` (max 3 retries w/ backoff), instead of a dead `<audio>` element.

## Out of scope / not changing
- `supabase/config.toml`, `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**` (per your instruction).
- Replacing `org_chat_*` schema with a flat `messages` table.
- Swapping the Lovable AI gateway transcriber for raw OpenAI/ElevenLabs.

## Technical notes

- Channel rename in `useOrgChat.ts` is already `org-chat-${channelId}` — only the desktop file changes name.
- Dedupe merge helper:
  ```ts
  const merge = (prev: Message[], incoming: Message[]) => {
    const seen = new Set(prev.map(m => m.id));
    return [...prev, ...incoming.filter(m => !seen.has(m.id))];
  };
  ```
- Presence query: `select user_id,last_seen_at from user_presence where organization_id = $org`; green when `now() - last_seen_at < interval '5 minutes'`.
- Member roster: `select user_id, profile.full_name from org_members join profiles on profiles.id = user_id where org_id = $org`.
- Recordings retry: wrap the `<audio>` `onError` to bump a per-row retry counter and re-request a fresh signed URL from `fusionpbx-proxy`.
