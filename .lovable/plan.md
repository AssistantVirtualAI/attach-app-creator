# Plan — Real Lemtel data on every admin page

## 1. Fix "no extensions" on `/org/lemtel/admin/extensions`

The 21 Lemtel extensions exist in the database, so this is a data-loading / RLS / sync issue, not missing data. I'll:

- Add a diagnostic banner on the page when the query returns zero rows: shows whether it's an auth issue, an org-membership issue, or a stale sync, with a one-click "Resync from PBX" button that calls `sync-extensions` on the proxy.
- Trigger an immediate `sync-extensions` on first load when no rows are present so the table is repopulated from FusionPBX (`v_extensions`) without manual action.
- Surface the underlying `pbx_sync_jobs` row (last error, fetched count) inline so we can see exactly why a sync produced 0 rows.
- Add `pbx_extensions` and `pbx_softphone_users` to realtime so the table updates the moment a sync finishes.

## 2. Edit existing users + grant/revoke desktop & mobile app access

Extend the existing **Edit** dialog so an admin can act on any extension the same way they would in FusionPBX, **without changing the user's current SIP password**:

- Editable fields written back to FusionPBX through `update-extension`: display name, caller ID name + number, voicemail on/off + PIN, Do-Not-Disturb, call forwarding, outbound CID, user/group, enabled/disabled, description.
- "App access" section per extension:
  - Toggle **Desktop app access** and **Mobile app access** (stored in `pbx_softphone_users.app_access_enabled`, with a new `desktop_access_enabled` / `mobile_access_enabled` split so each can be controlled independently).
  - When access is granted, the softphone row is created/linked and `sip_password` is **kept exactly as it is in FusionPBX** (read from `v_extensions.password` via proxy). The user signs in to the desktop and mobile app with their existing extension number + existing PBX password. No password reset, no new credential to remember.
  - When access is revoked, both toggles flip off, active sessions are invalidated (audit-logged), and the apps' login flow refuses the user until access is re-granted.
- All changes write an `audit_logs` entry (who, when, what changed).

## 3. Recordings — transcription + AI insights

On `AdminRecordings.tsx` and on the Call History row detail:

- Add **Transcribe** and **Analyze** buttons per recording. They call the existing `transcribe-recording` and `summarize-recording` actions on `fusionpbx-proxy` (Lovable AI Gateway, Gemini 2.5 Flash).
- Display the resulting transcript, summary, sentiment, language, key topics, and action items inline. Status chips: `pending / running / done / failed`.
- Add a bulk "Transcribe + analyze last 24h" button gated to Lemtel admins.
- On the Call History page, each row with `has_recording=true` gets the same panel (collapsible) so insights live next to the call.
- All AI results persist in `pbx_call_recordings` (`summary`, `sentiment`, `language`, `transcribed`, `analyzed`) and `pbx_call_transcripts` — already present, so no schema change beyond adding `topics jsonb` and `action_items jsonb` columns.

## 4. Dashboard — fully real data + AI insights + more stats

Rework `AdminDashboard.tsx` so every widget reads real Lemtel data (no placeholders):

- **Live tiles** (5–10s refresh via the existing `get-system-health-live` and `get-active-calls-live` proxy actions): active calls, registered extensions vs total, CPU / memory / disk, trunk status, today's inbound/outbound/missed, today's minutes.
- **Historical charts** (from `pbx_call_records`): calls per hour today, calls per day last 30d, answer rate, average handle time, missed-call rate, top extensions, top destinations, busiest hours heatmap.
- **Recordings & AI**: total recordings, % transcribed, % analyzed, sentiment distribution (positive / neutral / negative), top conversation topics across the last 7 days (aggregated from `pbx_call_recordings.summary` + topics).
- **AI insights card** (new): one daily call to Lovable AI Gateway that summarizes the last 24h of PBX activity — anomalies (spike in missed calls, queue overflow, extension offline > N hours), recommended actions, sentiment trend. Cached for 1h in `pbx_ai_insights`.
- **Quick links** to Active Calls, Recordings, Sync Health, Extensions with the same live counts.

## Technical notes

- New proxy actions: `update-extension-app-access`, `get-extension-secret` (admin-only, returns existing FusionPBX `password` to seed the softphone row at grant time without ever exposing it to the frontend — it's stored encrypted into `pbx_softphone_users.sip_password` via the edge function).
- Migration: add `desktop_access_enabled boolean default true`, `mobile_access_enabled boolean default true` to `pbx_softphone_users`; add `topics jsonb`, `action_items jsonb` to `pbx_call_recordings`; enable realtime on `pbx_extensions`, `pbx_softphone_users`, `pbx_call_recordings`.
- All writes gated by `is_lemtel_admin()` / `has_role(_, _, 'org_admin')` and logged to `audit_logs`.
- No visual redesign, no changes to AI voice agent pages.

## Out of scope

- Resetting / rotating user PBX passwords (explicitly preserved).
- Visual redesign of any page.
- AI voice agent configuration.
