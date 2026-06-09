# Next Implementation Slice

Picking up from the partially-shipped end-user portal. Two tracks in this slice, in order.

## 1. Finish Track A — `/me` portal

Already shipped: `MyForwarding`, `MyDevices`, `MyGreetings` + routes + sidebar entries.

Still missing from the spec:
- `/me` overview page — extension, registration status, presence toggle, today's calls, unread voicemail count. Backed by new RPC `get_my_extension_summary()` (security definer, scoped to `auth.uid()`).
- `/me/voicemail` — list from `pbx_voicemails` (already RLS-scoped via `can_access_voicemail`), signed-URL playback from `voicemail-audio`, `mark_voicemail_read` RPC, optional AI summary field.
- `/me/history` — own calls from `pbx_call_records` filtered by extension via `current_user_org_ids()` + extension match.
- `/me/presence` — wraps existing `upsert_user_presence` RPC; status + emoji + message + DND toggle.
- Edge function `me-update-forwarding` — enforces an org-level "allow end-user self-service forwarding" flag before letting `MyForwarding` write. Today the page writes directly; this gates it.
- Sidebar: add the 4 new entries under the existing `my-extension` group.

No new tables. One new RPC, one new edge function.

## 2. Track B — 7-step client creation wizard

Replace the current single-form client create with `/admin/clients/new`.

Steps:
1. Org profile (name, slug, timezone, locale).
2. Admins — multi-select existing users or invite by email (reuses existing invite email infra).
3. PBX mapping — FusionPBX domain UUID + extension range + DID pool.
4. Default roles — pre-seed `org_role_permissions` for `org_admin / manager / agent / viewer`.
5. Branding — logo upload to `organization-assets`, primary color, optional subdomain.
6. First sync — kicks `pbx-sync-extensions` + `pbx-sync-cdr`.
7. Isolation verification — calls new `verify_tenant_isolation(org_id)` RPC, shows per-table pass/fail.

New pieces:
- Page `src/pages/admin/ClientCreateWizard.tsx` (stepper using cockpit primitives).
- Edge function `client-provision` — orchestrates org insert, member + role inserts, PBX mapping row, role seeding, branding upsert, kicks first sync. Service-role only; gated by `is_super_admin` or `is_lemtel_admin`.
- RPC `verify_tenant_isolation(uuid) returns jsonb` — for each business table, counts rows that don't match `organization_id`. Reused later by a super-admin "Isolation Health" card.

## Out of scope this slice

Track C (desktop Portal tab), Track D (AVA command pipeline), Track E (full visual sweep). Picked up in the next slice once A+B are merged.

## Technical appendix

- New RPCs: `get_my_extension_summary`, `verify_tenant_isolation`.
- New edge functions: `me-update-forwarding`, `client-provision`.
- New pages: `/me`, `/me/voicemail`, `/me/history`, `/me/presence`, `/admin/clients/new`.
- Modified: `sidebarConfig.ts`, `App.tsx` routes, existing `MyForwarding.tsx` (switch write path to edge function).
- Migrations: 1 (two RPCs + optional `organizations.allow_user_self_forwarding boolean default true` flag).
- No new tables, no new third-party deps.
