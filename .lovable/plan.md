# Lemtel Portal — 9 Critical Fixes (5-Phase Plan)

Scope: Lemtel org only. Do NOT touch `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/*`, `CallKitManager.swift`, `Main.storyboard`, or `project.pbxproj`. Reuse existing patterns (`fusionpbx-proxy`, `ai-transcribe-call`, mobile `recMeta()` org_id fallback).

---

## Phase 1 — Security & Isolation Foundation (Issue 8 + RLS for 2/9)

Must come first; every later phase depends on correct scoping.

- **Post-login routing**: in the auth redirect resolver (likely `Auth.tsx` / `AuthenticatedShell` for Lemtel), force any user with `org_admin` / `domain_admin` role to `/lemtel/dashboard`; end-users to `/my`. Drop "last visited" memory for Lemtel admins.
- **Route guards** (`LemtelGuard.tsx` + a new `MyOnlyGuard`):
  - org admin → all `/lemtel/*` for their `organization_id` only
  - domain admin → `/lemtel/*` filtered to their `domain_uuid` (sidebar + page-level)
  - end-user → only `/my/*`; any other path → redirect `/my`
- **RLS audit + migration** on: `pbx_call_recordings`, `pbx_call_transcripts`, `pbx_voicemails`, `pbx_voicemail_settings`, `pbx_call_queues`, `pbx_queue_agents`, `pbx_extensions`, `pbx_domain_users`, `pbx_domains`. Add `domain_uuid` predicates (not just `organization_id`). Use a `has_domain_access(_user, _domain_uuid)` SECURITY DEFINER helper to avoid recursion.
- **Edge-function authorization**: every Lemtel-facing function (`fusionpbx-proxy`, `mobile-recordings`, `ai-transcribe-call`, `voicemail-sync`, etc.) must verify `domain_uuid` belongs to caller's allowed set before returning data.
- Manual test matrix: org admin, single-domain admin, end-user → confirm UI + direct API both deny cross-tenant access.

---

## Phase 2 — Recordings, Transcripts & Cross-Platform Sync (Issues 2, 9, 4)

- **Issue 2 — "missing UUID" on portal Recordings**: align portal `Recordings` page (`src/pages/my/Recordings.tsx` + Lemtel admin recordings view) to the mobile resolution chain `creds?.domainUuid || creds?.fusionpbxDomainUuid || fallbackDomainUuid`. Pull domain_uuid from session/`OrganizationContext` and pass it into the `fusionpbx-proxy` / `mobile-recordings` calls.
- **Issue 9 — portal transcription errors**: portal's "Transcrire" call to `ai-transcribe-call` must include `{ call_record_id, organization_id, xml_cdr_uuid }` exactly like the mobile fix. Add the same fallback chain (`pbx_softphone_users` → `org_members` → hardcoded org).
- **Issue 4 — language follows UI**:
  - Schema migration: add `transcript_text_fr`, `transcript_text_en`, `coaching_summary_fr`, `coaching_summary_en` on `pbx_call_transcripts` (keep `transcript_text` as canonical).
  - `ai-transcribe-call` accepts `target_language`; generates canonical + translates on first request; caches in the language-specific columns.
  - All three UIs (portal `Recordings`, Lemtel admin call detail, mobile `RecordingsScreen.tsx`) resolve display via `i18n.language` and request translation if missing (then cache).
- **Realtime**: standardize a `useRecordingsRealtime(domainUuid)` hook used by portal + desktop + mobile, subscribing to `pbx_call_recordings` and `pbx_call_transcripts` filtered by `domain_uuid`. Mirror mobile's `ava:callEnded` + 30s poll + focus refresh on portal/desktop.
- Verify identical query shape across the 3 clients (same select columns, same join to `pbx_extensions`).

---

## Phase 3 — User & Voicemail Provisioning (Issues 1, 6)

- **Issue 1 — Sync FusionPBX user emails**:
  - Extend `fusionpbx-proxy` with action `list_domain_users` returning `{ extension, email, username, user_uuid }` per `domain_uuid` (only domains the caller administers).
  - New admin UI tab in `LemtelPbxUsers.tsx` (or domain detail): table of users + per-row "Sync & Assign" button.
  - Button calls the **existing** end-user provisioning mutation (the same one triggered when a user self-enters extension+domain+SIP password) — just feed it the email pulled from FusionPBX and an admin-side flag. Same write target (`pbx_softphone_users`), no parallel schema.
- **Issue 6 — `/my` voicemail + ElevenLabs greeting**:
  - Wire `src/pages/my/Voicemail.tsx` to `user-voicemail` (list/play) scoped to caller's extension via RLS.
  - Greeting generator section: text → `elevenlabs-generate-greeting` (or `voicemail-greeting-tts`) → preview → "Set as my greeting" calls `user-voicemail-greeting` which uploads/overwrites via `fusionpbx-proxy` (voicemail greeting API) for that extension only.
  - Server-side guard: extension must match the caller (no write to other users' greetings).

---

## Phase 4 — Removals & Cleanup (Issues 3, 5)

- **Issue 3 — Remove softphone from portal**: delete portal-only softphone/dialer/WebRTC components (`LemtelSoftphoneUsers.tsx` keep; remove the embedded dialer/WebRTC widget if any in portal), routes, nav entries, and portal-only edge calls. Touch **nothing** under `apps/ava-softphone-mobile/`. Inventory pass first; list files in PR description.
- **Issue 5 — Remove "Phone Numbers" page**:
  - Diff `src/pages/PhoneNumbers.tsx` features vs Domain → Destinations (`LemtelDIDs.tsx` / domain detail Destinations tab). Port any missing piece (DID assignment, routing) into Destinations.
  - Remove the route, nav item, and redirect old `/phone-numbers` URLs to `/lemtel/domains/:id/destinations`.

---

## Phase 5 — Queue Membership Fix & QA (Issue 7)

- **Issue 7 — Add members to queue errors**:
  - Inspect `fusionpbx-proxy` queue-related actions for the same kind of regression as the CDR `extension` column strip; verify `domain_uuid`, `queue_uuid`, extension format (`100@domain.tld` vs bare `100`).
  - Fix payload, surface explicit error toast on partial failure (no silent catch).
  - Test on ≥2 Lemtel domains.
- **Cross-cutting QA**: run the 3-role × 2-domain matrix, confirm no leakage, recordings/transcripts/voicemails appear live on portal+desktop+mobile, language toggle flips transcripts, queue add works on all domains.
- **Deliverable note** in PR: list every Supabase table + RLS policy touched per issue.

---

## Technical Notes

- Reuse `has_role` / add `has_domain_access` SECURITY DEFINER helpers for RLS.
- Translation cache columns avoid repeat Claude/Gemini calls; only translate on first request per language per call.
- All edge functions: keep current `verify_jwt` config, add Zod validation of `domain_uuid` / `organization_id` inputs.
- Realtime channels: one per domain (`recordings:${domain_uuid}`) to keep payloads scoped and RLS-aligned.
- Migrations grouped per phase so each can ship/rollback independently.
