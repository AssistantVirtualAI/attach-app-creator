# White-Label Reseller Platform — Delivery Plan

This spec is ~13 phases / multi-week scope. I can't ship it all in one turn safely, but I can deliver it incrementally. Most of the foundation (multi-tenant RBAC, org hierarchy, impersonation, client portal, FusionPBX proxy, audit logs, branding) already exists in this codebase — see `mem://features/multi-tenant-reseller-v4`, `auth/admin-client-login-bridge`, `features/client-portal-system`. I'll extend those rather than rebuild.

## Milestone 1 — Data model + routing (this turn)
- **Migration**: add missing columns to `organizations` (`org_type`, `parent_org_id`, `reseller_id`, `fusionpbx_domain_uuid`, `fusionpbx_domain_name`, `max_extensions`, `max_dids`, `status`, `brand_*`, `support_*`).
- **Migration**: extend `org_members` with granular permission booleans (`can_manage_*`) + `invited_by/at`, `last_active_at`.
- **Migration**: extend `audit_logs` with `org_id`, `impersonator_id`, `ip_address`.
- **Migration**: tighten/extend RLS on `organizations`, `org_members`, `pbx_extensions`, `pbx_call_records`, `pbx_voicemails`, `pbx_sms_threads` using existing `get_accessible_org_ids()` (already in DB).
- **Routing**: `getPostLoginRoute()` helper + wire into the login flow (ava/master → `/admin/dashboard`, reseller/customer admin → `/org/[slug]/dashboard`, agent/user → `/my/dashboard`).
- **Hook**: `useOrgAccess(slug)` returning `canAccess` + granular `can.*` flags.

## Milestone 2 — Customer creation wizard
5-step wizard at `/admin/organizations/new` and `/org/[reseller]/customers/new` + `provision-customer` edge function (org row, FusionPBX domain, admin users, welcome emails, audit log).

## Milestone 3 — Portals
- Reseller dashboard + customer list + impersonate action (reuses existing admin↔client bridge).
- Customer admin dashboard polish + sidebar (Business Hours added).
- `/my/dashboard` user portal polish.
- Impersonation banner on every layout.

## Milestone 4 — Business hours + routing
`/org/[slug]/phone-system/business-hours` UI + `fusionpbx-proxy` actions `create-time-condition` / `update-time-condition` + Canadian holidays preset.

## Milestone 5 — User provisioning + settings + audit viewer
`provision-user` edge function, settings tabs (Org/Phone/Notifications/Integrations/Billing/Security), audit log viewer pages.

## Why phased
Each milestone is a reviewable PR-sized change. Shipping all 13 phases in one shot would mean ~50+ files edited blind, untested edge functions, and migrations that can't be safely rolled back per-feature.

## Questions before I start Milestone 1
1. **`org_members` vs `organization_members` + `user_roles`**: you already have `organization_members` (membership) + `user_roles` (role) + a new `org_members` table (master_admin/access_all_children). Spec asks to put `role` + permissions on `org_members`. Confirm: extend the existing `org_members` table (add granular permission cols + customer_admin/agent/user roles to its role enum), and treat `organization_members`/`user_roles` as legacy compat — keep them in sync via trigger?
2. **FusionPBX domain creation**: ok to call FusionPBX API v7 `/app/api/7/domains` from `fusionpbx-proxy` using the existing `FUSIONPBX_API_KEY` / `FUSIONPBX_USERNAME` secrets?
3. **Welcome emails**: use Resend (already configured) with the org's `support_email` as From if set, else `ADMIN_NOTIFICATION_EMAIL`?
4. **Scope for this turn**: ship Milestone 1 only and stop for review, or push through Milestones 1+2?

Reply with answers (or "go" to take my defaults: yes/yes/yes/M1 only) and I'll start.
