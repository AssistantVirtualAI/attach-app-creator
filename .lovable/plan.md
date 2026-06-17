# Plan — Privacy Disclosures + Desktop Transcription/Analysis Fix

## Part A — Mobile: Expanded Data Safety & Privacy-by-Design

Rewrite `PrivacyScreen.tsx` and `DataSafetyScreen.tsx` (EN + FR) with concrete, store-ready disclosures organized by data category.

### 1. Call History (CDRs)
- **Collected**: caller/callee number, direction, start time, duration, disposition, queue, agent extension.
- **Source**: synced from your company PBX via secure backend.
- **Purpose**: display recent calls, dashboards, missed-call alerts.
- **Retention**: mirrors PBX retention (default 90 days, configurable by admin).
- **Sharing**: not shared with third parties; stays inside your workspace.
- **Control**: "Clear local cache" + "Request data export" + "Delete account".

### 2. Call Recordings
- **Collected**: audio file URL + metadata; audio streamed on demand, not stored on device.
- **Legal basis**: recording is governed by the company's PBX recording rules; user is informed before playback.
- **Purpose**: QA, training, dispute resolution.
- **Retention**: per workspace policy (default 30/60/90 days).
- **Access**: gated by role; playback events written to audit log.
- **Control**: users can request deletion of recordings tied to their extension via Support.

### 3. AI Transcription & Analysis
- **Collected**: transcript text, speaker turns, sentiment score, summary, key topics.
- **Processing**: audio sent to AVA AI Gateway (Lovable AI) over TLS, processed transiently, not used to train third-party models.
- **Storage**: transcript + analysis stored in your workspace database, linked to the call.
- **Purpose**: searchable history, coaching, sentiment trends.
- **Retention**: same as the parent call recording.
- **Control**: per-recording "Delete transcript" + workspace toggle "Disable AI analysis".

### 4. Account & Device
- Email, display name, extension, role, device push token, app version, OS.
- Purpose: authentication, push delivery, support diagnostics.
- Retention: until account deletion (30-day grace, then purge).

### 5. Diagnostics & Crash Logs
- Anonymous error events, build version. No call content. Opt-out toggle in Permissions screen.

### 6. User Controls (new section on `PrivacyScreen`)
- Export my data (GET → JSON download via `mobile-data-export` function).
- Delete my account (existing `DeleteAccountScreen`).
- Revoke device (sign-out + push token removal).
- Disable AI analysis on my calls (writes flag to `user_preferences`).
- Manage permissions (links to `PermissionsScreen`).

### 7. Permissions Disclosure Table (in `DataSafetyScreen`)
| Permission | Why | Optional? |
|---|---|---|
| Microphone | Place/receive SIP calls | No |
| Notifications | Inbound call alerts, voicemail | Yes |
| Contacts | Match caller name in dialer | Yes |
| Background refresh | Sync CDRs, queues, voicemail | Yes |

Also update `store-metadata/{ios,android}/metadata{,-fr}.txt` Data Safety section to match.

---

## Part B — Desktop: Real AI Transcription + Analysis (replace stub)

Current state: the panel returns "AI analysis unavailable — showing call metadata only." We need an actual pipeline.

### B1. Backend — new/updated edge functions
- **`transcribe-recording`** (new): input `{ recording_url, call_id, language? }`. Downloads audio (auth header against PBX), sends to Lovable AI Gateway model `google/gemini-3-flash-preview` with audio input (or whisper-compatible model if available in catalog) for transcription. Stores result in `call_transcripts (call_id, language, text, segments_jsonb, model, created_at)`.
- **`analyze-call`** (new): input `{ call_id }`. Reads transcript, calls Gemini with structured Output schema → `{ summary, sentiment, sentiment_score, topics[], action_items[], risk_flags[] }`. Stores into `call_analyses`.
- **`get-call-insights`** (new, read): returns transcript + analysis for the desktop panel; auto-triggers the two above if missing and `recording_url` exists.

### B2. Database migration
- `call_transcripts` + `call_analyses` tables (workspace-scoped RLS via `has_role`/membership helper), GRANTs for `authenticated` + `service_role`.
- Index on `call_id`.

### B3. Desktop UI
- Update the Call Detail panel that currently renders the stub. Replace the hard-coded "AI analysis unavailable…" branch with:
  - Loading shimmer while `get-call-insights` is pending.
  - On success: full transcript with speaker turns + collapsible segments, then Analysis card (sentiment chip, summary, topics chips, action items list).
  - On error: inline error with "Retry" button that re-invokes `transcribe-recording` + `analyze-call`.
- Wire "Re-run" button to force re-transcription (`force: true`).

### B4. CDR Refresh fix
- The refresh button currently re-renders cached data only. Update the CDR hook (likely `useExtensionDataSync` / `usePbxData`) so the refresh action:
  1. Invalidates the query cache.
  2. Calls the PBX sync edge function with `force: true` to pull the latest CDRs from the PBX in real time.
  3. Awaits the sync, then refetches the safe view.
- Ensure narrow/small-width history rows include date + time (not just time) — fix the responsive truncation in the CDR list component.

### B5. Mobile parity (read-only)
- `mobile-recordings` edge function returns transcript + analysis when present, so the mobile recordings screen can display them too (no new screens, just richer payload).

---

## Files

**Mobile (Part A):**
- Edit: `apps/ava-softphone-mobile/src/screens/PrivacyScreen.tsx`, `DataSafetyScreen.tsx`, `PermissionsScreen.tsx`, `MoreScreen.tsx`
- Edit: `store-metadata/{ios,android}/metadata.txt` + `metadata-fr.txt`
- Add: `src/i18n` strings for new sections (EN/FR)

**Desktop + backend (Part B):**
- New: `supabase/functions/transcribe-recording/index.ts`, `analyze-call/index.ts`, `get-call-insights/index.ts`
- Migration: `call_transcripts`, `call_analyses` (+ RLS + GRANTs)
- Edit: desktop Call Detail component (the one rendering the "AI analysis unavailable" stub)
- Edit: `apps/ava-softphone-desktop/src/hooks/useExtensionDataSync.ts` (refresh forces live sync) and the CDR list cell for narrow width
- Edit: `supabase/functions/mobile-recordings/index.ts` to include insights

## Out of scope
- New AI providers (uses existing Lovable AI Gateway).
- Changing PBX recording retention policy itself.
- Landing page.
