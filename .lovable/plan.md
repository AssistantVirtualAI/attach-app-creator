# Plan: Fix Call Recording Playback

The current `get-recording` action in `fusionpbx-proxy` builds a URL like `${FUSIONPBX_API_URL}/var/lib/freeswitch/recordings/...` — a literal filesystem path appended to the API base. FusionPBX has no such HTTP route, so every fetch returns 404 and the UI shows "Could not load recording." The web UI itself downloads recordings via `/app/xml_cdr/xml_cdr_audio.php?id=<xml_cdr_uuid>&t=bin&ext=mp3`, which works for both live and archived recordings because FusionPBX resolves the on-disk path from the CDR row.

Additionally, `supabase.functions.invoke` returns JSON-decoded data for `application/json` and a `Blob` only when the SDK sees a non-JSON content-type; relying on that is brittle for audio. We'll fetch the proxy via plain `fetch` so we always get a real `Blob`.

## Changes

### 1) `supabase/functions/fusionpbx-proxy/index.ts` — rewrite `get-recording`

Accept `{ xml_cdr_uuid?, record_path?, record_name?, domain_name?, domain_uuid? }` and try, in order:

1. **CDR audio endpoint** (preferred — matches FusionPBX web UI):
   `GET ${FUSIONPBX_API_URL}/app/xml_cdr/xml_cdr_audio.php?id=<xml_cdr_uuid>&t=bin&ext=mp3`
2. Fallback to the alt name: `xml_cdr_download.php?id=<xml_cdr_uuid>&t=bin&ext=mp3`
3. **Recordings download endpoint** (when only path+name are known):
   `GET ${FUSIONPBX_API_URL}/app/recordings/recording_download.php?path=<record_path>&filename=<record_name>` with `domain_uuid` cookie/header
4. **REST API**: `GET /app/api/7/recordings/download?domain_uuid=...&path=...&name=...` (some installs expose this)

Send `Authorization: Basic ...` on every attempt. Return the first 2xx response as the audio stream with `Content-Type` inferred from extension and `Accept-Ranges: bytes`. If all fail, return `{ error, attempts: [{url, status}] }` with status 502 so the UI can show a useful message.

Also extend the schema check — when neither `xml_cdr_uuid` nor (`record_path` + `record_name`) is supplied, return 400.

### 2) `src/pages/lemtel/admin/AdminRecordings.tsx`

- Add `pbx_uuid` and `domain_name`/`domain_uuid` to the `select(...)` and the `Rec` type.
- Replace the `supabase.functions.invoke` call with a direct `fetch` to the function URL so the body is always a `Blob`:
  ```ts
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${session?.access_token ?? PUBLISHABLE_KEY}` },
    body: JSON.stringify({ action: 'get-recording', params: { xml_cdr_uuid: r.pbx_uuid, record_path: r.recording_path, record_name: r.recording_name, domain_uuid: r.domain_uuid, domain_name: r.domain_name } }),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  ```
- Infer mime from `recording_name` extension to avoid the `audio/wav` default for `.mp3` files.

### 3) `src/pages/lemtel/CustomerDetail.tsx` Recordings tab

Apply the same `pbx_uuid`/`domain_uuid` select + direct-fetch change so per-customer recording playback works too.

### 4) `src/components/portal/RecordingWavePlayer.tsx`

No changes — it already accepts a blob URL.

## Out of scope

- No schema changes — `pbx_uuid`, `recording_path`, `recording_name`, `domain_uuid`, `domain_name` are already populated by the CDR sync.
- No edits to landing pages, sidebar, or unrelated routes.
- Transcripts, MOS panel, and the rich call-details view in the screenshot are a follow-up; this plan focuses strictly on getting the audio to play.

## Verification

1. Open `/org/lemtel/admin/recordings`, click Play on a recent recording — audio loads and plays.
2. Open a customer drill-down → Recordings tab → Play works for that tenant's records.
3. If FusionPBX returns 404 on all attempts for a row, the UI toast shows the attempted URLs so we can adjust the endpoint list for this install.
