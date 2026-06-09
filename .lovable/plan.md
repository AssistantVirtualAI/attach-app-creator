# Portal Completion Plan — End-user portal, Wizard, Desktop Tab, Chatbot Pipeline, Visual Sweep, Tenant Audit

Builds on phases 1–7. Scope below is everything still missing or unfinished from the spec.

## Track A — End-user self-service portal (`/me`)

A new role-aware portal for any authenticated user whose `pbx_softphone_users.portal_user_id` matches their `auth.uid()`. Lives under `/me/*`, reuses `AppLayout` with a reduced sidebar scope (`my` only), works in web and inside the desktop app.

Pages:
- `/me` — overview: extension, registration status, presence toggle, today's calls, unread voicemail.
- `/me/voicemail` — list of own voicemails (already RLS-scoped via `can_access_voicemail`), playback, mark read, AI summary.
- `/me/forwarding` — read/write `pbx_call_forwarding` rows for own extension, gated by client-admin self-service flag.
- `/me/greetings` — upload to `voicemail-greetings` bucket scoped to own extension.
- `/me/devices` — own rows from `pbx_user_devices` + registration status from `pbx_softphone_users`.
- `/me/history` — own calls (`pbx_call_records` filtered by extension).
- `/me/presence` — wraps existing `upsert_user_presence` RPC.

Backing pieces:
- New sidebar scope group `my-extension` in `sidebarConfig.ts` visible whenever the user has a softphone row.
- One new RPC `get_my_extension_summary()` (security definer, scoped to `auth.uid()`).
- One edge function `me-update-forwarding` enforcing the admin self-service flag stored on `organizations`.

## Track B — Client creation wizard (7-step)

Replaces the current single-form client create with a guided flow at `/admin/clients/new`.

Steps: Org profile → Admins (multi-select existing users or invite by email) → PBX mapping (FusionPBX domain + extension range + DID pool) → Default roles (org_admin/manager/agent/viewer pre-seeded into `org_role_permissions`) → Branding (logo, primary color, optional subdomain) → First sync (kicks `pbx-sync-extensions` + `pbx-sync-cdr`) → Isolation verification (calls a new `verify_tenant_isolation(org_id)` RPC that confirms every business table has matching rows only via `organization_id`).

Implementation:
- New page `src/pages/admin/ClientCreateWizard.tsx` with stepper.
- New edge function `client-provision` orchestrating org creation, admin invites (via existing email infra), PBX mapping insert, role seeding, branding upsert, first sync trigger.
- New RPC `verify_tenant_isolation(uuid) returns jsonb` returning per-table pass/fail counts.

## Track C — Desktop app Portal tab + AVA chat panel

Update Electron shell to expose two new in-app routes that load the existing web portal under the same Supabase session.

- New `Portal` tab in `electron/main.cjs` window with a `BrowserView` pointed at `https://<published-url>/me` for end users, `/org/<slug>/admin/dashboard` for client admins, `/super-admin` for platform admins — chosen by role at login.
- Persistent right-side `AVA chat` dock backed by the existing `ava-admin-chat` page rendered in an iframe with `postMessage` bridge for "open extension X" deep-links.
- Auth handoff via existing Supabase session cookie (already same-origin under the published domain). No new secrets in renderer.
- Build: rebuild via `@electron/packager`, archive to `/mnt/documents/`.

## Track D — AVA chatbot command pipeline (web + desktop)

Generalize the current `telecom-admin-ai-agent` into a structured pipeline so end users, client admins, and platform admins can all use it within their permission scope.

Pipeline stages (all server-side in one edge function `ava-command`):
1. Parse intent via Lovable AI Gateway (tool-calling, JSON schema per command).
2. Resolve actor + role + tenant from JWT (`has_role`, `is_super_admin`, `is_lemtel_admin`).
3. Authorize: deny if scope mismatch. End users limited to own extension; client admins to own org; platform admins cross-org.
4. Dry-run validation (e.g. extension not in use, DID in tenant pool, working-hours payload shape).
5. Return a `preview` payload to the client. UI shows a confirm card.
6. On confirm, the same function executes via existing PBX/Twilio edge functions, never raw SQL.
7. Append to `ai_command_logs` (new table) + existing `audit_logs`.

Schema additions:
- `ai_command_logs` table (org_id, actor_id, intent, params jsonb, preview jsonb, status, error, execution_id, created_at). Standard GRANTs + RLS scoped to org members + super_admin.
- Reuse `telecom_admin_ai_actions` for the action registry, extend it with `scope` enum (`end_user | client_admin | platform_admin`).

UI:
- Web: extend `AvaAdminChat.tsx` to render preview cards + confirm/cancel buttons.
- Desktop: same component reused via the chat dock iframe.

## Track E — Visual sweep of every admin page

The global `.cockpit-scope` already restyles cards/tables/tabs/buttons. This track standardizes the page-level shell so every screen matches `/_design` exactly.

For each page under `src/pages/**` that renders inside `AppLayout`:
- Replace ad-hoc title/subtitle/actions blocks with `<SectionHeader>` from `@/components/ui-cockpit`.
- Replace any remaining ad-hoc stat tiles with `<KpiCard>` (`accent="cyan|violet|warning|success"`).
- Wrap dashboard sections in `<GlassCard>` with `glow` accent where appropriate.
- Replace ad-hoc badges with `<StatusChip>` / `<LiveBadge>`.
- Replace ad-hoc tables with `<GlassTable>` primitives (most already inherit via scope; this sweep makes the markup consistent).

Target list (~35 pages): all under `src/pages/` excluding `Landing.tsx`, `Auth*`, `ClientLogin*`, `widget/*`, `DesignPreview.tsx`. Done page-by-page in a single sweep PR.

## Track F — Multi-tenant isolation audit + fixes

A read-only audit script + targeted migration to close any gap.

Audit (script writes to `/mnt/documents/tenant-audit.md`):
- For every public table, check (a) presence of `organization_id` (or a documented exemption), (b) RLS enabled, (c) at least one policy that references `organization_id`/`has_role`/`current_user_org_ids`, (d) `GRANT` matches policy roles, (e) no policy grants `anon` SELECT on tenant data.
- For every edge function under `supabase/functions/**`, grep for raw `from('table')` without an `eq('organization_id', …)` filter and flag.
- Run `supabase--linter` + `security--run_security_scan` and merge findings.

Fixes (one migration, only what the audit flags):
- Add missing `organization_id` columns + backfill where derivable.
- Tighten over-permissive policies (`USING (true)`, `to public`, etc.).
- Add missing `GRANT`s.
- Drop accidental `anon` SELECTs on tenant tables.
- Add `verify_tenant_isolation()` RPC used by Track B step 7 and by a new platform-admin "Isolation Health" card on `/super-admin`.

## Out of scope

- Landing page (locked).
- Switching backend providers.
- Mobile native apps.
- Rewriting FusionPBX sync (already shipped in phase 5/6; only bug-fixes if audit surfaces issues).

## Execution order

1. Track F audit (read-only) — generates the gap list everything else relies on.
2. Track F fixes migration.
3. Track A end-user portal (depends on RLS being clean).
4. Track B wizard (depends on `verify_tenant_isolation`).
5. Track D chatbot pipeline (depends on tightened RLS + role helpers).
6. Track C desktop tab (depends on `/me` existing).
7. Track E visual sweep last so churn doesn't conflict with feature work.

## Technical appendix

- New tables: `ai_command_logs`. Extended: `telecom_admin_ai_actions` (+`scope`).
- New RPCs: `get_my_extension_summary`, `verify_tenant_isolation`.
- New edge functions: `client-provision`, `me-update-forwarding`, `ava-command`.
- New pages: `/me/*`, `/admin/clients/new`.
- Modified: `sidebarConfig.ts` (my-extension group), `AvaAdminChat.tsx` (preview cards), `electron/main.cjs` (Portal tab + chat dock).
- Estimated migrations: 2 (fixes + ai_command_logs/scope).
- Estimated edge function deploys: 3 new + 1 modified.
- All new public tables follow the required GRANT → RLS → POLICY order.
- No new third-party deps. Reuses Lovable AI Gateway, existing Supabase Auth, existing FusionPBX edge functions.
