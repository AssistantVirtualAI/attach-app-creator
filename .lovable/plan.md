# Multi-Tenant Reseller Architecture — v4.0.0

Transform AVA Statistics Portal into a hierarchical multi-tenant system: AVA → Lemtel (master) → Resellers → Customers, with white-label branding, impersonation, and per-org billing.

## Phase 1 — Database Foundation

**Extend `organizations`** with: `parent_org_id`, `root_org_id`, `org_level`, `org_type`, brand fields (`brand_name`, `brand_logo_url`, `brand_primary_color`, `brand_accent_color`, `brand_favicon_url`, `brand_portal_domain`, `brand_app_name`, `brand_support_email`, `brand_support_phone`, `brand_website`), FusionPBX config (`fusionpbx_domain_uuid`, `fusionpbx_domain_name`, `fusionpbx_server_url`), limits (`max_extensions`, `max_dids`, `max_storage_gb`, `max_resellers`), `status`, `trial_ends_at`, billing fields.

**New `org_members`** table (separate from existing `organization_members`/`user_roles` — keeps backward compatibility) with granular permission booleans (`can_manage_users`, `can_manage_billing`, `can_manage_resellers`, `can_listen_calls`, `can_white_label`, etc.) and `access_all_children` scope flag.

**New `billing_plans`** seeded with starter/basic/pro/reseller/enterprise tiers.

**Security definer fns:**
- `get_accessible_org_ids(uuid)` → returns array of org ids the user can access (direct + descendants for reseller/master roles), used in RLS.
- `is_master_admin(uuid)`, `can_access_org(uuid, uuid)` helpers.
- `descendants_of(uuid)` recursive CTE wrapper.

**RLS:** rewrite policies on `organizations`, telephony tables (`pbx_*`), and `org_members` to use `get_accessible_org_ids(auth.uid())` so master/reseller admins see their subtree.

**Audit logs:** add `org_id`, `user_org_id`, `impersonator_id`, `impersonated_org_id`, `ip_address`, `user_agent` columns.

**Seed:** ensure Lemtel row has `org_level=1`, `org_type='master'`, brand defaults; backfill `root_org_id`/`parent_org_id` for existing orgs.

## Phase 2 — White-Label Engine

- `src/lib/whitelabel.ts` — `WhitelabelConfig` interface, `loadWhitelabel(orgId)`, `applyWhitelabel(config)` (CSS vars, favicon, title), `getPlanFeatures(plan)`.
- `src/contexts/WhitelabelContext.tsx` — provider that resolves config from current org slug/custom domain, applies to `:root`, exposes feature flags.
- `src/hooks/useFeatureFlag.ts` — gate UI by plan.
- Wrap App with provider; replace hardcoded "AVA Statistic"/"Lemtel" in shells with `useWhitelabel()`.

## Phase 3 — Lemtel Master Control Center

Routes under `/org/lemtel/master/*`:
- `MasterDashboard.tsx` — org tree (react-arborist or custom recursive component), system health cards (FusionPBX/Supabase/Telnyx/ElevenLabs ping via edge fn), global activity feed (realtime on audit_logs).
- `MasterOrganizations.tsx` — filterable table (All/Resellers/Customers/Direct/Suspended/Trial), row actions.
- `CreateOrgWizard.tsx` — 6-step wizard (type → basic → FusionPBX → limits/plan → branding+live preview → admin user). Calls new edge fn `create-organization` that: inserts org, provisions FusionPBX domain (Option A) via `fusionpbx-proxy`, creates auth user via admin API, inserts `org_members`, sends branded welcome email via Resend.
- `MasterAllUsers.tsx`, `MasterAllCalls.tsx`, `MasterBilling.tsx`, `MasterSystem.tsx`, `MasterAuditLogs.tsx` (filter by org/user/action/date/IP, CSV export).

## Phase 4 — Impersonation

- `src/contexts/ImpersonationContext.tsx` — stores `impersonated_org_id` in sessionStorage, exposes `enter(orgId)`/`exit()`.
- `ImpersonationBanner.tsx` — orange sticky top bar with org name + Exit button.
- Edge fn `start-impersonation` — verifies caller is master/reseller admin with rights over target, writes audit row, returns scoped context token.
- All data hooks read `effectiveOrgId = impersonated ?? currentOrg`.
- Audit trigger on key tables logs `impersonator_id` when present.

## Phase 5 — Org Switcher & Navigation

- `OrgSwitcher.tsx` in top bar — hierarchical dropdown (recursive tree), grouped by reseller, with "+ Create Organization" footer.
- `OrgBreadcrumb.tsx` — Lemtel > Reseller A > Customer A1 > page.
- Router updates: `/org/:slug/admin/*`, `/org/:slug/my/*`, `/org/:slug/master/*` (master only), `/org/:slug/reseller/*` (reseller only).
- `RequireOrgRole` guard component.

## Phase 6 — Reseller Portal

Routes `/org/:slug/reseller/*`:
- `ResellerDashboard.tsx` — own org + aggregated customer stats.
- `ResellerCustomers.tsx` — table + Create Customer wizard (reuses Phase 3 wizard scoped to reseller as parent).
- `ResellerUsers.tsx` — flat list across all child customers.
- `ResellerSettings.tsx` — edit own branding (logo upload to `organization-assets`, color pickers, support info), email templates, custom domain DNS instructions.
- `ResellerBilling.tsx` — see own plan, customer subscriptions.

## Phase 7 — Customer Admin Scoping

Existing `/org/:slug/admin/*` pages already exist from v3.0.0. Update them to:
- Resolve org from slug (not hardcoded Lemtel).
- Gate features via `useFeatureFlag`.
- Enforce plan limits (extensions/DIDs/storage) with usage bars + "Upgrade" CTA.
- Hide reseller-only menus.

## Phase 8 — Custom Domain Routing

- Edge fn `domain-router` — given `Host` header, returns org config; called at app bootstrap before whitelabel load.
- `src/lib/domainResolver.ts` — maps `window.location.hostname` → org (cached).
- Reseller settings → Custom Domain panel with DNS CNAME instructions and verification status.

## Phase 9 — Per-Org Email Templates

- Extend existing email infra: new `org_email_templates` table (org_id, template_key, subject, html, variables).
- Edge fn `send-org-email` resolves template per org with brand variables `{{brand_name}}`, `{{portal_url}}`, etc.
- Welcome email triggered by `create-organization`.

## Phase 10 — Polish

- Bump `package.json` to `4.0.0`.
- Update `sidebarConfig.ts` with Master / Reseller / Customer sections, role-gated.
- README + in-app changelog entry.

## Technical Notes

- New deps: none required; reuse `@dnd-kit`, `recharts`, `@tanstack/react-query`, `react-color` already present (verify; add `react-colorful` if missing for color picker).
- All new edge functions: `create-organization`, `start-impersonation`, `domain-router`, `send-org-email`, `org-health-check`.
- All new public tables include explicit GRANTs + RLS + service_role grants per project rules.
- Existing `organization_members`/`user_roles` kept; `org_members` is the new RBAC surface — write a one-time migration that mirrors existing memberships into `org_members` with mapped permission booleans so nothing breaks.
- Storage: reuse `organization-assets` bucket for logos/favicons (already exists, public).
- FusionPBX domain provisioning via existing `fusionpbx-proxy` with new `createDomain` action.

## Build Order

```text
1 (DB) → 2 (whitelabel) → 5 (switcher/nav) →
3 (master center) + 4 (impersonation) →
6 (reseller) → 7 (customer scoping) →
8 (custom domain) → 9 (emails) → 10 (polish)
```

Estimated 9–12 build turns. Approve to proceed.
