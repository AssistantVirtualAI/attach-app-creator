
# Lemtel Portal + Desktop — Stabilization & Parity Plan

Goal: every admin page reads and writes the real FusionPBX through `fusionpbx-proxy` (reads) and `pbx-write` (mutations), with the same field set the PBX UI exposes; the desktop app mirrors the portal; SIP registers cleanly; i18n is complete; tests cover each page.

---

## Phase 1 — SIP "Rejected (403)" fix (softphone)

Symptoms from console: WSS connects, then `Registration failed: Rejected {status: 403}` for `300@lemtel.lemtel.tel`.

403 on REGISTER on FusionPBX almost always means one of:
1. The SIP password returned by `softphone-credentials` does not match the password stored on the FusionPBX extension (most common — `pbx_softphone_users.sip_password` is stale vs. PBX).
2. The realm/domain mismatches (`sipDomain` ≠ extension's domain on PBX).
3. ACL / "register from this IP" rule on PBX rejects browser source.
4. Extension disabled or "do_not_disturb"/"call_timeout" blocking.

Work:
- Add a `softphone-diagnose` edge function returning: extension exists on PBX, enabled flag, domain UUID match, password hash match (compare `pbx_softphone_users.sip_password` against PBX `get-extension`), realm, last register attempt.
- In `softphone-credentials`, when 403 has happened recently (track in `pbx_softphone_users.last_register_status`), force re-fetch from `fusionpbx-proxy get-extension` and overwrite stored password before returning.
- Add a portal action "Reset SIP password" on `MyDevices` and on admin extensions row → calls `pbx-write update-extension` with a freshly generated 24-char password, mirrors to `pbx_extensions`, and updates `pbx_softphone_users.sip_password`.
- Surface registration failure cause in the softphone UI (banner with "Reset SIP password" CTA).

Test: after reset on ext 300, REGISTER returns 200 OK in JsSIP logs.

---

## Phase 2 — Favicon = AVA Statistic

- Use existing `src/assets/ava-statistics-logo.png` → copy to `public/favicon.png`.
- Delete `public/favicon.ico` so browser stops requesting the old one.
- Update `index.html` `<link rel="icon" href="/favicon.png" type="image/png">` + apple-touch-icon.

---

## Phase 3 — Dashboard real-data + new tiles

`HomeDashboard` (desktop) and `src/pages/lemtel/Dashboard.tsx` (portal):

- Replace placeholder "system CPU / network / active calls" with live values:
  - `Active calls` ← `telecom_live_calls` filtered by org (currently sometimes 0 due to wrong filter — verify org_id passed).
  - `Registered extensions` ← `pbx_softphone_users.status='online'` count.
  - `Today inbound / outbound / missed` ← `pbx_call_records` grouped by `direction` for `start_at >= today`.
  - `Unread SMS` ← `pbx_sms_threads.unread_count` sum.
  - `Unread voicemail` ← `pbx_voicemails.read_at IS NULL` count.
  - `PBX health` ← latest `telecom_sync_health.status`.
  - `Sync lag` ← `now() - telecom_sync_health.last_sync_at`.
  - `Trunks up/down` ← derived from `pbx_gateways` last status (Phase 6).
- CPU / network: drop the fake gauges OR wire them to a new `pbx_system_metrics` table populated by `fusionpbx-proxy` action `system-stats` (FusionPBX exposes `/app/status/status.php` JSON). If unavailable, remove the tiles cleanly rather than show wrong data.
- Add Realtime channel subscriptions so tiles auto-update.

Each tile becomes a link to its detail page (Calls, SMS, Voicemail, Extensions, Trunks).

---

## Phase 4 — Full CRUD parity per admin page

For every admin page, three guarantees: (a) all fields the PBX exposes are editable, (b) writes go through `pbx-write` and mirror to `pbx_*` tables, (c) row actions: edit / delete / duplicate / toggle-enabled.

Pages to bring to parity (re-scan after each):

| Page | Add | Edit | Delete | Notes |
|---|---|---|---|---|
| Extensions | ✓ | ✓ | ✓ | Add: voicemail, call-forward, ring strategy, codecs, caller-id, NAT, DTMF mode, vm pin, hot-desking |
| Devices | ✓ | ✓ | ✓ | Use `src/data/pbxDeviceModels.ts` for vendor/model picker, expose provisioning template, MAC, line keys, lines mapping — same form as FusionPBX `/app/devices/device_edit.php` |
| Call Queues | ✓ | ✓ | ✓ | Strategy, MOH, timeout, wrap-up, max wait, announce position, tier rules, agents grid |
| Ring Groups | ✓ | ✓ | ✓ | Members, strategy, timeout, forward on no-answer |
| IVRs + IVR options | ✓ | ✓ | ✓ | Greeting upload to `lemtel-ivr-audio`, key→action mapping |
| Time Conditions | ✓ | ✓ | ✓ | Already started; verify week/holiday matchers |
| Conferences | ✓ | ✓ | ✓ | PIN, max members, record flag |
| Hold Music | ✓ | ✓ | ✓ | Upload + assign to categories |
| Dialplans | ✓ | ✓ | ✓ | Raw XML editor + parsed condition/action rows |
| Destinations (inbound routes) | ✓ | ✓ | ✓ | DID → action picker (ext/queue/ringgroup/ivr/voicemail/conference/dialplan) with cascading selectors |
| Gateways (trunks) | ✓ | ✓ | ✓ | See Phase 6 |
| SIP Profiles | ✓ | ✓ | ✓ | Already done — verify reload action |
| Feature Codes | ✓ | ✓ | ✓ | Done — re-verify |
| Call Forwarding / Recording Rules / Voicemail Settings | ✓ | ✓ | ✓ | Done — re-verify |
| Phone Numbers / DIDs | ✓ | ✓ | ✓ | Provider field, assignment to destination |
| SMS Threads | view | reply | archive | Wire to `pbx_sms_messages` send via `pbx-write send-sms` |
| Voicemail | listen | mark read | delete | Audio stream from `voicemail-audio` bucket |
| Live Calls | view | hangup | transfer / barge | Uses `telecom_live_calls` + `pbx-write hangup-call` |
| Recordings | listen | download | delete | `lemtel-recordings` bucket |
| Sync Health | view | trigger resync | — | Done — verify |

Implementation pattern (reused everywhere): `<EntityFormDialog>` reading PBX field schema, `usePbxAction` for save/delete, `useEffect` to refetch after success, optimistic mirror upsert.

---

## Phase 5 — Inbound routes (Destinations) full wiring

- List = `list-destinations` from proxy, mirrored to `pbx_destinations`.
- Edit dialog cascading: pick DID → pick action type → pick target (queries the matching list endpoint).
- Save calls `update-destination` with `destination_actions` JSON; mirror writes update `pbx_destinations.destination_actions`.
- Delete calls `delete-destination`.

---

## Phase 6 — Gateways ("No gateways returned") fix

Likely causes:
1. Proxy `list-gateways` not implemented or returns `{gateways:[]}` while UI reads `data` not `gateways`.
2. `FUSIONPBX_DOMAIN_UUID` filter excludes global gateways (gateways are usually global, not per-domain).

Work:
- Inspect `fusionpbx-proxy` `list-gateways` handler — query `v_gateways` with no domain filter, normalize to `[{uuid, gateway, profile, proxy, register, enabled, state, status}]`.
- Update `AdminGateways` page to render either `data.gateways` or `data.data`.
- Diagnostic button already exists — keep, but add "Raw proxy URL" + HTTP status + first error line.
- Add full CRUD (create/edit/delete/register/unregister) via `pbx-write`.

---

## Phase 7 — Devices page = PBX Devices

- Replace minimal form with full device editor: vendor + model picker (from `pbxDeviceModels.ts`), MAC, template, profile, line keys grid, BLF assignments, time zone, firmware, user assignment.
- Provisioning URL preview.
- Same dialog used for create + edit.

---

## Phase 8 — Per-page rescan & connection audit

Script `scripts/audit-admin-pages.ts` iterates every `src/pages/lemtel/admin/*.tsx`, checks: (a) calls `pbxInvoke` or `pbx-write`, (b) renders from `pbx_*` mirror or proxy response, (c) has Add/Edit/Delete handlers, (d) has loading + empty + error states. Output a checklist into `.lovable/admin-audit.md`.

---

## Phase 9 — i18n EN/FR completeness

- Run a script to extract all string literals from `src/pages/lemtel/**` and `apps/ava-softphone-desktop/src/**`, diff against `src/locales/fr.ts` and `en.ts`.
- Fill missing keys; route all admin labels through `useTranslation`.

---

## Phase 10 — Desktop app parity

- Mirror every portal admin page inside `apps/ava-softphone-desktop/src/components/console/AdminView` using the same `pbxInvoke` calls.
- Lemtel admins see the full admin tree; lemtel customers see only `My …` pages (extension, voicemail, SMS, devices, billing). Gate by `useDesktopRole` → `is_lemtel_admin` vs membership-only.
- Dashboard tiles identical to portal Phase 3.

---

## Phase 11 — Tests (per page, both surfaces)

- Playwright spec per admin page under `tests/admin/*.spec.ts`: load → expect non-empty list OR empty-state → open Create dialog → fill → save → row appears → edit → delete.
- Desktop: Vitest + JSDOM smoke per page rendering, plus `scripts/smoke-electron.mjs` extended to navigate each admin route.
- SIP integration test: mock JsSIP, ensure 200 OK path after password reset.

---

## Phase 12 — Acceptance checklist

- [ ] Softphone registers (200 OK), no 403 loop.
- [ ] Favicon = AVA Statistic on portal + desktop.
- [ ] Dashboard tiles show real numbers; no fake CPU/network.
- [ ] Every admin page supports create / edit / delete identical to FusionPBX UI.
- [ ] Gateways list populates; CRUD works.
- [ ] Inbound routes editable end-to-end.
- [ ] Devices page has same fields as PBX device editor.
- [ ] All strings translated EN + FR.
- [ ] Desktop app shows admin tree for lemtel admins, customer-scoped pages for customers.
- [ ] Playwright + Vitest green for every page.

---

## Technical reference

- Read path: `pbxInvoke('list-…')` → `fusionpbx-proxy` → mirror upsert into `pbx_*`.
- Write path: `pbxInvoke('create|update|delete-…', params, { organizationId, objectType })` → `pbx-write` (RBAC + audit + mirror).
- Realtime: subscribe to `pbx_*` mirror tables to auto-refresh lists.
- New edge functions: `softphone-diagnose`, optional `pbx-system-stats`.
- New table (only if CPU/net kept): `pbx_system_metrics(org_id, cpu, mem, rx, tx, sampled_at)` + GRANTs + RLS by org membership.
- Files touched (high-level): `supabase/functions/{softphone-credentials,softphone-diagnose,fusionpbx-proxy,pbx-write}/index.ts`, `src/pages/lemtel/admin/*`, `src/pages/lemtel/Dashboard.tsx`, `src/locales/{fr,en}.ts`, `apps/ava-softphone-desktop/src/components/console/**`, `public/favicon.png`, `index.html`, `tests/admin/*.spec.ts`.
