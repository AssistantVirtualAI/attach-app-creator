## Goal

Stop guessing why the broker count is 201 instead of 355, then wire every Planiprêt admin page to the correct, fully paginated NetSapiens v2 endpoint, with a clear server-capability panel that exposes what is and isn't actually available on the current SNAPsolution version.

## Step 1 — Build a real diagnostic page at `/planipret/admin/debug`

New page that calls a new edge function `ns-debug-audit` and displays four side-by-side numbers in plain French. Visible only to Planiprêt admins. No background jobs — this is a pure live audit.

- **Query A** — `SELECT count(*) FROM planipret_profiles WHERE organization_id = '<AVA>'`.
- **Query B** — call `GET /domains/planipret.ca/users` with a paginated loop. Try both pagination conventions and surface which one the server actually uses:
  - 1-based pages: `?start=1&limit=200`, `?start=2&limit=200`, …
  - offset/limit: `?limit=100&offset=0`, `?limit=100&offset=100`, …
  - inspect response headers `X-Total-Count`, `Content-Range`, `Link` and show their raw values.
- **Query C** — diff Query A vs Query B:
  - extensions in NS-API not present in `planipret_profiles` (by email + by extension).
  - profiles with no matching NS-API extension.
- **Query D** — dump the exact query/edge function currently driving the Overview KPI, `/admin/users` total, and the sidebar badge, and show their values next to A & B so the failing path is obvious.

The debug page is intentionally temporary; remove once the discrepancy is reconciled, but keep `ns-debug-audit` around because the diagnostic panel in Step 6 reuses it.

## Step 2 — Fix the broker count everywhere

Once Step 1 names the cause, apply one fix and route every consumer through it:

- If NS-API pagination is the bug, rewrite the loop in `pp-admin-ns-sync` and `ns-email-migration-match` to use whichever pagination signal the server actually returns (header total when present, otherwise loop until a short page).
- If `planipret_profiles` itself only has ~200 rows, do NOT silently inflate the count. Show the actual portal count as the primary number, plus a secondary stat "X extensions NS-API sans compte portail" with a CTA to the manual-review queue.

Make `/admin/overview` "Courtiers actifs", `/admin/users` total, and the sidebar badge all call the same `adminCounts` helper, hitting the same query. No more parallel sources of truth.

## Step 3 — Fix `/admin/calls` (CDRs)

- Update `ns-cdrs` (broker-scoped, mobile) and `pp-admin-ns-sync` (admin-scoped) to call `GET /domains/{domain}/cdrs` with the same paginated loop as Step 1 and accept `start_time` / `end_time` query params.
- Map NS fields → `planipret_phone_calls` (direction, from/to numbers, started/answered/ended, duration, disposition).
- Architecture: keep `/admin/calls` reading from `planipret_phone_calls` (Option B) so AI scoring stays attached; add a "🔄 Importer l'historique CDR" button on the Appels page that calls `pp-admin-ns-sync` for a date range and shows progress (`Import en cours… 1 240 / 3 500 appels`). Idempotency key = NS call id.

## Step 4 — Fix `/admin/messages` (SMS)

- Replace the current single endpoint guess with the confirmed pattern:
  1. `GET /domains/{domain}/users/{user}/messagesessions` (paginated, per broker).
  2. For each session, `GET /domains/{domain}/users/{user}/messagesessions/{id}/messages`.
- Map to `planipret_phone_messages` and upsert by `ns_message_id`.
- Run this as a batched background job (10 brokers at a time, small delay between batches) since it requires 355+ session-list calls. The Edge Function returns immediately and the UI polls progress: `Synchronisation SMS: 45/355 courtiers traités`.
- Add a manual "🔄 Importer l'historique SMS" button and a scheduled refresh (every 15 min via `pg_cron`).

## Step 5 — Fix `/admin/voicemails` (recordings + transcriptions)

Treat as three distinct concerns:

1. **Voicemails** — `GET /domains/{domain}/users/{user}/voicemails/inbox`, looped per broker in the same batched job, audio file fetched via the file URL on the record. Map to `planipret_voicemails`.
2. **Call recordings** — first check if the CDR record carries a `recording_url`/`recording_file`. If not, try `GET /domains/{domain}/users/{user}/recordings`. If the server is < v45 and that endpoint truly 404s, do NOT keep hammering it — surface "⚠️ Les enregistrements d'appels via API nécessitent NetSapiens v45+. Le serveur actuel est en v44.4.1." on the page itself.
3. **Transcriptions** — check (a) if CDR/voicemail records include `transcription_text`, (b) the existing `ns-transcription` function path, and (c) the `PORTAL_VOICE_TRANSCRIPTION_SENTIMENT` domain config. If transcripts come back empty, show "⚠️ La transcription vocale n'est peut-être pas activée pour ce domaine. Vérifiez auprès de Clinton." instead of silently empty rows.

## Step 6 — Permanent NS-API feature panel on `/planipret/admin/integrations`

New section "🔍 Fonctionnalités disponibles sur ce serveur" powered by `ns-debug-audit`:

```text
Version serveur : 44.4.1-beta.64
✅ CDRs                    — GET /domains/{d}/cdrs            (n résultats sur la dernière sonde)
✅ Messages (sessions)     — GET /domains/{d}/users/{u}/messagesessions
✅ Voicemails              — GET /domains/{d}/users/{u}/voicemails/inbox
❌ Enregistrements         — nécessite v45+ (v44.4.1 détectée)
❌ Transcriptions          — non activé pour planipret.ca (PORTAL_VOICE_TRANSCRIPTION_SENTIMENT off)
```

Each row stores its last-probe result + timestamp so future "why isn't X working" questions get answered by this panel before any code is touched.

## Step 7 — Verification checklist (done in-app, not from memory)

1. Debug page shows portal count vs paginated NS-API count, with the gap explained.
2. Overview KPI, `/admin/users` total, and sidebar badge all show the same number.
3. After running CDR backfill, `/admin/calls` shows real rows with correct direction/duration/disposition.
4. After SMS batch sync runs against a few test brokers, `/admin/messages` shows their real threads.
5. After voicemail sync, `/admin/voicemails` shows real inbox entries with audio playback.
6. Recordings + transcriptions either work or display the precise server-side limitation message from Step 6 — never silently empty.

## Technical details

- All admin endpoints stay behind `is_planipret_admin`; broker endpoints behind `is_planipret_member`.
- Shared paginator goes in `supabase/functions/_shared/ns-pagination.ts`: returns `{ items, totalFromHeader, pages, paginationSignal }` so callers can log how the server answered.
- Idempotency keys: `ns_call_id` for CDRs/recordings, `ns_message_id` for SMS, `ns_voicemail_id` for voicemails.
- Background work uses `EdgeRuntime.waitUntil`; progress is written to a new `planipret_sync_progress` row (job_id, step, processed, total, finished_at) that the UI polls.
- Schema additions limited to `planipret_sync_progress` and a small `planipret_ns_server_capabilities` row keyed by `domain` + `feature` for the Step 6 panel.
- No frontend hardcoded counts; everything reads from `adminCounts.getBrokerCounts()`.
- The debug page and its edge function are gated by `is_planipret_admin` and never expose raw NS tokens.

## What I won't touch

- Mobile broker app screens (already wired and working post-prior phase).
- ElevenLabs / Claude / Maestro integrations on the same Integrations page.
- The shipped email-based login + identity migration work from the prior turn.
