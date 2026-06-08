# Remediation Plan — 9 Phases

Tackled in order. Each phase is a separate commit/checkpoint.

## Phase 1 — Security hardening (CRITICAL)
- `fusionpbx-proxy`: enforce `is_lemtel_member` for read actions, `is_lemtel_admin` for write/delete/sync.
- `webhooks-router`: reject requests when no webhook secret configured (return 503), never silently skip HMAC.
- Tighten RLS: `org_chat_channels` UPDATE → creator/admin/member only; `cc_monitor_sessions` write → supervisor/admin only; `cc_pause_reasons` write → admin/manager only.
- Add `voicemail-audio` INSERT policy scoped to owner path; add `lemtel-recordings` SELECT for lemtel members via CDR join.

## Phase 2 — Fix `org_members` RLS recursion
- Audit current policies, replace recursive `USING` with `SECURITY DEFINER` helper (`can_access_org`, `is_master_admin` already exist).
- Verify with `EXPLAIN` no self-reference; confirm `/customer` and `/platform` queries succeed.

## Phase 3 — Missing tables / alias fix
- Inventory code references to `pbx_dids` and `pbx_recordings`.
- Either create thin SQL views aliasing to `phone_numbers` + `pbx_call_recordings`, OR refactor frontend to use canonical names. Prefer views for backward compat.

## Phase 4 — Navigation cleanup (404s & duplicates)
- Add redirects: `/admin/users` → `/platform/users`, `/admin/audit` → `/platform/audit`, `/admin/*` → `/platform/*`.
- Consolidate `/org/lemtel/telephony/*`, `/org/lemtel/portal/*`, `/org/lemtel/admin/*` → redirect to the new `/platform` / `/customer` / `/my` portals.
- Add a single source-of-truth route map; remove dead routes.

## Phase 5 — Portal scope per role (already split, now enforce)
- `/platform` shell: keep full admin nav (already done).
- `/customer` shell: hide platform-only items; gate routes with `has_role(org_admin|reseller_admin|manager)`.
- `/my` shell: minimal user nav; block customer/platform pages via guard.
- Add `RoleGuard` component used by each route.

## Phase 6 — Console 400 errors
- Sweep dashboard + telephony pages, identify failing queries (likely `_safe` view mismatches or missing columns).
- Fix query column names, add `.maybeSingle()` where appropriate, handle empty results gracefully.
- Add error boundaries on data-heavy pages so a single failed query doesn't blank the page.

## Phase 7 — Seed empty tables with sane defaults
- `pbx_queue_agents`, `pbx_ivr_options`, `pbx_voicemails`, `pbx_sms_threads`, `pbx_sms_messages`, `org_business_hours`, `app_releases`.
- For Lemtel org: insert 1 demo queue+agents, default business hours (Mon-Fri 9-17), placeholder voicemail greeting, and 1 `app_releases` row for current desktop version.

## Phase 8 — Downloads page
- Replace `#` placeholders with real GitHub Releases URLs from `app_releases` table.
- Hide platforms with no asset; show "Coming soon" badge instead of broken link.
- Add direct fallback to `/api/latest-release` edge function.

## Phase 9 — Branding & i18n consistency
- Audit mixed FR/EN strings, route everything through `useTranslation`.
- Brand hierarchy: "AVA · Lemtel" in platform admin, "{org name}" in customer admin, plain "Workspace" in /my.
- Single language toggle in top-right of every shell.

## Telephony WSS (already done, verify)
Primary host `wss://pbxnode.lemtel.tel:7443`, fallbacks `portal.lemtel.tel`, `lemtel.lemtel.tel`. Add `node.lemtelcloud.net` as additional fallback. Manual QA: register → inbound → outbound on `/my/softphone` and `/customer/extensions`.

## Execution order
P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9. Stop after each phase, smoke-test, then proceed.
