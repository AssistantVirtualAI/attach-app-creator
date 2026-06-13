# Final PBX Parity Phases (9-12) + Desktop App Hardening

Phases 1-8 are complete. This plan closes the remaining gaps so the portal reaches full FusionPBX parity, and ensures the Electron desktop app shows the exact same views as the web portal.

## Phase 9 — Global Sync Health & Refresh Dashboard
- New page `AdminSyncHealth.tsx` under Phone System → Sync Health.
- Surfaces `telecom_sync_health` + `telecom_sync_jobs` + `pbx_sync_jobs`: last sync per entity (extensions, gateways, IVRs, destinations, time conditions, conferences, hold music, voicemail, recordings), status, error, duration.
- Per-row "Resync now" + global "Resync all" buttons calling `fusionpbx-proxy` list actions and updating cache tables.
- Auto-refresh every 30s via React Query.

## Phase 10 — SIP Profiles & Advanced Dialplan
- New page `AdminSipProfiles.tsx`: list/create/edit/delete from `pbx_sip_profiles` via proxy (`list-sip-profiles`, `upsert-sip-profile`, `delete-sip-profile`).
- New page `AdminDialplans.tsx`: full dialplan CRUD (not just time-conditions filter) with XML editor, context selector, order field, enabled toggle.
- Add proxy actions in `supabase/functions/fusionpbx-proxy/index.ts`.

## Phase 11 — Feature Codes & Call Forwarding (admin)
- `AdminFeatureCodes.tsx` backed by `pbx_feature_codes` (e.g. *97 voicemail, *72 forward) with enable/disable + code editing.
- `AdminCallForwarding.tsx` admin view of `pbx_call_forwarding` per extension (always/busy/no-answer/unavailable) with quick edit.

## Phase 12 — Recording Rules & Voicemail Settings (admin policies)
- `AdminRecordingRules.tsx` for `pbx_call_recording_rules` (inbound/outbound/internal toggles, retention days).
- `AdminVoicemailSettings.tsx` for org defaults in `pbx_voicemail_settings` (PIN policy, email-to-vm, transcription toggle, retention).

## Desktop App Parity Hardening (Electron)
- `electron/main.cjs`: switch from hard-coded `https://avastatistic.ca` to an env-driven URL (`PORTAL_URL` env, defaults to prod) so dev/staging builds show the same portal.
- Add a "Reload portal" + "Open in browser" menu and a tiny in-app navbar fallback (only if `did-fail-load`).
- Ensure mic + notifications + clipboard permissions auto-grant (already there) + add `display-capture` for screen share in conferences.
- Add deep-link handler `avastatistic://` so the desktop opens routes like `/lemtel/admin/sync-health` directly.
- Add packaging scripts (`build:linux`, `build:mac`, `build:win`) in `package.json` using `@electron/packager` per project conventions.
- Confirm `vite.config.ts` has `base: './'` (required for Electron file loads) — patch if missing.
- Document in `electron/README.md` how every new admin page (Phase 9-12) automatically appears in desktop since it's the same React bundle.

## Routing & Sidebar
- Register all 7 new routes in `src/App.tsx`.
- Add entries in `sidebarConfig.ts`:
  - Phone System → Sync Health, SIP Profiles, Dialplans, Feature Codes
  - Call Center → Recording Rules, Voicemail Settings
  - Phone System → Call Forwarding

## Out of scope
- No schema migrations expected (tables already exist).
- No changes to landing page, billing, or auth flows.

## Deliverable
After build mode: 7 new admin pages, expanded `fusionpbx-proxy` actions, hardened Electron shell with env-based URL + deep links + screen-share permission, packaging scripts, and updated sidebar/routes — giving identical parity between web portal and desktop app.