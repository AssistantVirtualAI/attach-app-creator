# Mobile recording playback — status & targeted improvements

## What's already correct (no change needed)

The mobile playback path **already matches the requested pattern**. `loadPbxRecordingAudioMobile` in `apps/ava-softphone-mobile/src/lib/mobileSupabase.ts` does exactly what the prompt asks for:

- Calls `fusionpbx-proxy` via raw `fetch()` (not `supabase.functions.invoke`).
- Sends `Authorization` + `apikey` headers.
- First tries `get-recording-signed-url` (fast, no large payload through the function), falls back to `get-recording`.
- Reads `Content-Type`; if it's `application/json` or non-OK, parses error codes (`RECORDING_NOT_FOUND`, `LOGIN_FAILED`, `Forbidden`) into human messages.
- On success, calls `res.blob()` and returns `URL.createObjectURL(blob)`.

`RecordingsScreen.tsx` already binds that URL to `<audio controls autoPlay src={url} />` and tracks `audioUrls` / `audioErrors` / `loadingAudio` state.

**Important correction to the prompt:** the proxy expects `{ action, organization_id, params: { xml_cdr_uuid, record_path, record_name, domain_uuid, ... } }` (nested `params`), not a flat body. The current mobile code is correct; the snippet in the prompt would actually break it. We will keep the nested shape.

## Gaps worth fixing

1. **Object URLs are lost on navigation.** `audioUrls` lives only in `useState`. Leaving Recordings and returning forces a full re-fetch of every audio file. Add a module-level `Map<string, string>` cache keyed by `xml_cdr_uuid || pbx_uuid || id`, rehydrate `audioUrls` on mount, and skip the network call when the cache already has a blob URL.
2. **Error copy.** Make sure `RECORDING_NOT_FOUND` surfaces as "File deleted from PBX after retention period" and `LOGIN_FAILED` as "PBX authentication failed", matching the prompt's wording (currently slightly different strings).
3. **Domain UUID safety.** Pass `recording.domain_uuid` through (already done) and fall back to the user's `mobile.domainUuid` when the row is missing it, so super-admin rows from other extensions still resolve.

## Changes (frontend only)

- `apps/ava-softphone-mobile/src/lib/mobileSupabase.ts`
  - Add `const audioBlobCache = new Map<string, string>()` at module scope.
  - In `loadPbxRecordingAudioMobile`, return cached URL when present; store new URL before returning.
  - Adjust error messages to match the agreed copy.
  - Accept optional `fallbackDomainUuid` and use it when `recording.domain_uuid` is empty.

- `apps/ava-softphone-mobile/src/screens/RecordingsScreen.tsx`
  - On mount, seed `audioUrls` from the module cache (so URLs survive tab switches).
  - Pass `mobile.domainUuid` as `fallbackDomainUuid`.
  - No UI/markup changes — the existing `<audio>` element and Play button stay as is.

## Out of scope

- No edits to `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`.
- No desktop changes — `RecordingsList.tsx` already uses the working signed-URL + audio-url path.
- No proxy/edge-function changes.

## Validation

- `bunx vitest run` in `apps/ava-softphone-mobile` (existing light-theme suite must still pass).
- Manual: open Recordings, press ▶ on a row, confirm `<audio>` appears and plays; navigate away and back, confirm the player is still mounted without a second network call; trigger a known-deleted recording and confirm the "File deleted from PBX" message.
