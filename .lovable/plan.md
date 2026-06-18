# Recap — Phases 1 to 4

## Phase 1 — SIP + UI fixes (softphone desktop)
- Fixed "Bad Media Description" on incoming calls (jsSIP `answer()` SDP).
- Stabilised conversation widgets, presence pills, and call control UI in `apps/ava-softphone-desktop`.

## Phase 2 — Group chat + call transcription
- `OrgChatView` no longer wipes messages: introduced `orgChatMerge.ts` + tests to merge incoming realtime payloads with the local cache.
- Hardened transcription pipeline (recording → STT → conversation linkage).

## Phase 3 — Contacts + customer management
- `ContactsView` now merges FusionPBX extensions, `pbx_softphone_users`, and Zoho CRM contacts; virtualised list for large datasets.
- `CustomerDetail` gained a Users tab: create SIP extensions, assign phone numbers, send welcome emails through `customer-users-import` → `send-transactional-email`.
- Generated SIP password shown once with copy-to-clipboard toast.
- Migration: `customer-users-import` edge function + supporting columns.

## Phase 4 — Customer domain management (started)
- `useActiveDomain` hook + `DomainSwitcher` (super-admin only, in `AdminPortalLayout` header).
- `LEMTEL_ORG` is now resolved at module load from the active domain → all 40+ pages re-scope automatically when the super-admin switches domain (page reloads to apply).
- **IVR**: greeting upload (`AudioTab`), AI script generator, ElevenLabs TTS Studio, and `test-ivr` action wired into `fusionpbx-proxy`.
- **Porting**: `number_porting_requests` table + RLS, `PortingRequestDialog` for customers, admin queue at `/org/lemtel/admin/porting`.

## What is still missing
- Each customer domain does **not** yet have its own scoped dashboard mirroring the Lemtel admin cockpit.
- No per-domain admin role: today only Lemtel super-admins can manage; customer users have no management UI.
- Mobile/desktop softphone apps don't authenticate domain users yet.
- Devices, business hours, MOH, inventory (numbers + devices), recordings, and call history are not surfaced inside the customer's own portal.
- Domain admin invitation + onboarding flow is missing.

---

# Plan — Phase 5: Full per-domain phone system management

Goal: every domain (customer) has the same cockpit as the Lemtel master, scoped to its own data. Lemtel super-admin can enter any domain via the switcher; a designated "domain admin" can manage their own domain only. End-users get softphone access.

## 1. Roles & access

Extend `app_role` with:
- `domain_admin` — full management inside one domain.
- `domain_user` — extension owner, softphone-only access.

`user_roles` rows already carry `organization_id`; we keep using it as the domain scope. Add a helper:
- `public.has_domain_role(_user_id uuid, _org_id uuid, _role app_role) returns boolean` (SECURITY DEFINER).

Update RLS on every `pbx_*` table to allow `domain_admin` to read/write rows where `organization_id = their org`, in addition to existing super-admin policies.

## 2. Customer portal routes (`/portal/:domainSlug/*`)

New layout `CustomerPortalLayout` (mirrors `AdminPortalLayout` but pinned to the user's org, no DomainSwitcher unless super-admin):

```
/portal/:slug/dashboard          → live KPIs (active calls, registrations, today's volume)
/portal/:slug/extensions         → CRUD extensions (reuse LemtelExtensions)
/portal/:slug/devices            → SIP devices (reuse LemtelDevices)
/portal/:slug/ivr                → IVR menus + greetings (reuse LemtelIVR)
/portal/:slug/queues             → Call queues (reuse LemtelQueues)
/portal/:slug/ring-groups        → Ring groups (reuse TelephonyRingGroups)
/portal/:slug/moh                → Music on hold uploads + assignment
/portal/:slug/numbers            → DIDs, routing, porting (reuse LemtelDIDs)
/portal/:slug/business-hours     → Time conditions per domain
/portal/:slug/recordings         → Call recordings player + download
/portal/:slug/history            → Unified call history (CDRs + recordings)
/portal/:slug/stats              → Analytics: volumes, ASR, handle time, queue SLA
/portal/:slug/users              → Domain users + softphone provisioning
/portal/:slug/settings           → Branding, voicemail defaults, caller-id rules
```

All pages reuse existing Lemtel components but receive a `scopeOrgId` prop. The `useEffectiveOrgId()` helper (already in place) auto-resolves to the route's slug for domain users; super-admins keep using DomainSwitcher.

## 3. Dashboard cockpit (per domain)

`CustomerDashboard.tsx` mirrors `LemtelDashboard.tsx` with cards:
- Live calls, registered devices, today's CDR count, queue waiters.
- Inventory rollup: phone numbers, extensions, devices.
- Recent recordings (last 10) + call history (last 25).
- Health pill (FusionPBX ping + sync status for that domain).

## 4. Inventory unification

New page `/portal/:slug/inventory` combining:
- Phone numbers (from `phone_numbers` + `pbx_phone_number_assignments`).
- Devices (from `pbx_devices`).
- Extensions count + free range suggestion.

Single search + export to CSV.

## 5. Call history + recordings

`/portal/:slug/history` page joins `pbx_call_records` ↔ `pbx_call_recordings` by `call_uuid`. Columns: time, direction, from, to, extension, duration, disposition, recording (inline player + download).

Permissions: `domain_admin` sees all rows for org; `domain_user` sees only their own extension.

## 6. Music on hold per domain

`/portal/:slug/moh`:
- List `pbx_hold_music` rows for org.
- Upload .mp3/.wav → Supabase Storage bucket `lemtel-moh` (new, RLS by org).
- Add `set-default-moh` action in `fusionpbx-proxy` to update domain settings.

## 7. Business hours

`/portal/:slug/business-hours` wraps `pbx_time_conditions` for the org with a weekly grid editor (start/end per day, holidays). Persists via `fusionpbx-proxy` `create/update-time-condition`.

## 8. Stats

`/portal/:slug/stats` uses `cc_queue_stats` + `pbx_call_records` aggregates. Charts: calls per hour (6h–23h business window), avg handle time, abandon rate, top extensions.

## 9. Mobile + desktop softphone access for domain users

- Auth: domain user logs into desktop/mobile app with their Lemtel email + password. After login, app reads `user_roles` and pins `activeDomain` to their org.
- New edge function `provision-softphone-credentials` returns SIP creds (extension, password, SIP server, WS URL) scoped to the user's `pbx_extensions` row.
- Mobile app already supports SIP login; we just inject the provisioned credentials at session bootstrap.
- Add "Send mobile app invite" button in `CustomerDetail → Users`: sends app download link + auto-login token email.

## 10. Domain admin invitation flow

In `CustomerDetail`, "Promote to Domain Admin" button:
- Inserts `user_roles` row with `role='domain_admin'` and the customer's `organization_id`.
- Sends `domain-admin-welcome` transactional email with portal link `/portal/:slug/dashboard`.

## 11. Files to create

**New pages** (under `src/pages/portal/`):
`CustomerPortalLayout.tsx`, `CustomerDashboard.tsx`, `CustomerInventory.tsx`, `CustomerHistory.tsx`, `CustomerRecordings.tsx`, `CustomerMOH.tsx`, `CustomerBusinessHours.tsx`, `CustomerStats.tsx`, `CustomerUsers.tsx`, `CustomerSettings.tsx`.

**New components**: `DomainGuard.tsx` (RLS-aware route guard), `InventoryTable.tsx`, `CallHistoryWithRecording.tsx`.

**New edge functions**: `provision-softphone-credentials`, `customer-portal-stats`.

**New email template**: `domain-admin-welcome.tsx`.

**Migrations**:
- Add `domain_admin`, `domain_user` to `app_role` enum.
- `has_domain_role()` security-definer function.
- Per-table RLS additions for `domain_admin` on every `pbx_*` table.
- Storage bucket `lemtel-moh` + RLS.

**Edited**:
- `src/App.tsx` (new portal routes).
- `fusionpbx-proxy/index.ts` (add `set-default-moh`, time-condition CRUD if missing).
- `DomainSwitcher.tsx` (also reachable to `domain_admin` if they manage multiple orgs).

**Not touched**: `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**`, auto-generated Supabase files.

## 12. Rollout order

1. Roles + RLS migration.
2. `CustomerPortalLayout` + routing + `DomainGuard`.
3. Dashboard + Extensions + Devices (reuse).
4. Numbers + Inventory + Call History + Recordings.
5. IVR / Queues / Ring Groups / MOH / Business Hours wired into portal.
6. Stats page.
7. Softphone provisioning + mobile/desktop login wiring.
8. Domain admin invitation + welcome email.
