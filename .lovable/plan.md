
# Plan — Recordings coverage & Sync Health alignment

Scope: backend (proxy + DB) and Media Center / Sync Health UI only. No visual redesign, no AI voice agent changes.

## Part A — Recordings: full metadata + secure access

### A1. Schema (`pbx_call_recordings` + `pbx_call_records`)
Migration to guarantee every recording-bearing CDR has a complete row in `pbx_call_recordings`:

- Add/ensure columns on `pbx_call_recordings`:
  - `recording_name text`, `recording_path text`, `recording_url text`
  - `recording_seconds int`, `recording_available boolean default false`
  - `transcript_status text` (`none|pending|done|failed`), `transcribed boolean generated`
  - `summary_status text`, `analyzed boolean generated`
  - `sentiment text` (`positive|neutral|negative|mixed`)
  - `summary text`, `language text`
  - `access_status text` (`ok|forbidden|missing|stale`), `last_checked_at timestamptz`
  - `pbx_uuid text` (FK link to CDR), `sip_call_id text`
- Unique index `(organization_id, pbx_uuid)`.
- Mirror flags on `pbx_call_records`: `has_recording`, `recording_id uuid`, `recording_available`, `transcribed`, `analyzed`, `sentiment` (already partially present — fill the gaps).
- Backfill trigger so inserting/updating a `pbx_call_recordings` row updates the mirror flags on the matching `pbx_call_records`.

### A2. Proxy: recording resolver consolidation
- New shared module `supabase/functions/_shared/recordingUrl.ts` (single source of truth) used by `fusionpbx-proxy`:
  - Force host `pbxnode.lemtel.tel`.
  - Try in order: signed FusionPBX URL → app/recordings download path → app/call_recordings path.
  - PHPSESSID cookie auth, Basic auth fallback.
  - Returns `{ url, available, seconds, content_length, http_status }`.
- New proxy action `sync-recording-meta`:
  - Walks `pbx_call_records` where `has_recording = true` AND (`recording_id IS NULL` OR `pbx_call_recordings.last_checked_at < now() - 6h`).
  - Upserts `pbx_call_recordings` with resolver result + `access_status` (`ok|forbidden|missing`).
  - Stamps `recording_available`, `recording_seconds`, `last_checked_at`.
- New proxy action `get-recording-stream` (signed, short-lived redirect) for secure listen/download from the portal.

### A3. Transcription & summary pipeline (queued, audited)
- New table `pbx_recording_jobs` (`recording_id`, `job_type` = `transcribe|summarize`, `status`, `error`, `started_at`, `finished_at`, `requested_by`).
- New proxy actions:
  - `transcribe-recording` → enqueues job, calls Lovable AI Gateway (Whisper-equivalent / `google/gemini-2.5-flash` audio) using existing `LOVABLE_API_KEY`, stores transcript in `pbx_call_transcripts`, sets `transcript_status='done'`.
  - `summarize-recording` → uses transcript → produces `summary`, `sentiment`, `language`; updates `pbx_call_recordings`.
- Every action gated by `is_lemtel_admin()` / `has_role()` and writes to `audit_logs`.

### A4. Media Center UI (no redesign)
- Reuse the existing list and badges. Wire:
  - "Listen" → `get-recording-stream`.
  - "Download" → same with `?download=1`.
  - "Transcribe" / "Summarize" buttons → call the new actions, optimistic state.
  - Filter chips: `Recorded only`, `Transcribed`, `Has summary`, `Sentiment`.
  - Free-text search now hits `pbx_call_transcripts.content_tsv` (add tsvector + GIN index).

## Part B — Sync Health alignment (real per-entity status)

### B1. Per-entity proxy actions
Add or finalize these actions in `fusionpbx-proxy` (each does list → upsert → returns `{ fetched, upserted, skipped, duration_ms }`):

| Entity | Action | Target table |
|---|---|---|
| Extensions | `sync-extensions` | `pbx_extensions` |
| Devices | `sync-devices` | `pbx_devices` |
| Ring Groups | `sync-ring-groups` | `pbx_ring_groups` |
| Call Queues | `sync-call-queues` | `pbx_call_queues` |
| Queue Agents | `sync-queue-agents` | `pbx_queue_agents` |
| IVRs / Options | `sync-ivrs` | `pbx_ivrs`, `pbx_ivr_options` |
| Destinations | `sync-destinations` | `pbx_destinations` |
| Time Conditions | `sync-time-conditions` | `pbx_time_conditions` |
| Conferences | `sync-conferences` | `pbx_conferences` |
| Hold Music | `sync-hold-music` | `pbx_hold_music` |
| Gateways | `sync-gateways` | `pbx_gateways` |
| Voicemail boxes | `sync-voicemail` | `pbx_voicemail_settings` |
| Voicemail messages | `sync-voicemail-messages` | `pbx_voicemails` (exists, normalize output) |
| Voicemail greetings | `sync-voicemail-greetings` | new column on `pbx_voicemail_settings` |
| Recordings meta | `sync-recording-meta` | `pbx_call_recordings` |
| CDRs | `sync-cdrs` (existing) | `pbx_call_records` |
| CC Stats | `sync-cc-stats` | `cc_queue_stats` |
| Contacts | `sync-contacts` | new `pbx_contacts` (created if missing) |
| Feature codes | `sync-feature-codes` | `pbx_feature_codes` |
| Dialplans | `sync-dialplans` | `pbx_dialplans` |

Out-of-scope for FusionPBX (no native API): fax server, email queue, event guard. These will be marked `n/a` in Sync Health rather than `unknown`.

### B2. `pbx_sync_jobs` enrichment
Add columns: `endpoint text`, `fetched int`, `upserted int`, `skipped int`, `duration_ms int`, `error text`.
`sync-all` orchestrator writes one row per entity per run with proper status (`completed | completed_with_errors | failed`).

### B3. AdminSyncHealth UI
- Replace the static entity list with a config-driven list aligned with B1.
- Per row show: last job status, `fetched/upserted/skipped`, duration, last run, "Run now" + "Backfill".
- Entities without a backing action render as `n/a` (greyed) — never `unknown`.
- Realtime subscription on `pbx_sync_jobs` so rows update live.

### B4. Voicemail / SMS / Call Center surfaces
- Voicemail page: bind list to `pbx_voicemails`, "Mark read" via existing `mark_voicemail_read`, "Play" via `get-voicemail-stream` (mirrors A2 resolver).
- SMS page: already reads `pbx_sms_threads`/`pbx_sms_messages` — add the same realtime hook used elsewhere, no UI change.
- Call Center page: bind tiles to `cc_queue_stats` rows produced by `sync-cc-stats`; live agents from existing `get-active-calls-live` + `pbx_queue_agent_state`.

## Security & audit
- All new write/sync actions: require `is_lemtel_admin()` or `has_role(_, _, 'org_admin')`.
- Tenant scoping via `organizations.fusionpbx_domain_uuid`.
- Every write → `audit_logs` (`resource_type`, `resource_id`, `action`, `metadata`).
- Frontend keeps reading from `_safe` views; raw credentials never leave edge functions.

## Files touched
- `supabase/functions/fusionpbx-proxy/index.ts` (new actions)
- `supabase/functions/_shared/recordingUrl.ts` (new)
- `supabase/migrations/*` (recordings columns, `pbx_recording_jobs`, `pbx_sync_jobs` columns, transcript tsvector, optional `pbx_contacts`)
- `src/pages/telephony/TelephonyMediaCenter.tsx` (wire new actions + filters)
- `src/pages/lemtel/admin/AdminSyncHealth.tsx` (config-driven list + realtime)
- Voicemail/SMS/Call Center page bindings (no visual changes)

## Out of scope
- Visual redesign, navigation changes, AI voice agent pages.
- Host-level OS metrics (kept as "Unavailable" from previous step).
- Fax / email queue / event guard sync (marked `n/a`).

Proceed?
