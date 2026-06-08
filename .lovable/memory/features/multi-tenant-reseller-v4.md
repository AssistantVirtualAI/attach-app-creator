---
name: Multi-tenant reseller v4
description: v4.0.0 — hierarchical orgs (master/reseller/customer), org_members RBAC, white-label per org, impersonation with audit, custom domains
type: feature
---

Hierarchy stored on `organizations` via `parent_org_id`, `root_org_id`, `org_level` (0=AVA, 1=master Lemtel, 2=reseller/direct, 3=customer-under-reseller), `org_type` ('master'|'reseller'|'customer'|'direct').

RBAC: new `org_members` table with granular permission booleans (`can_manage_users`, `can_manage_billing`, `can_manage_resellers`, `can_listen_calls`, `can_white_label`, etc.) and `access_all_children` flag. Roles: `master_admin` | `reseller_admin` | `customer_admin` | `agent` | `user`.

Access: `public.get_accessible_org_ids(uuid)` SECURITY DEFINER returns the user's org subtree (master sees all; reseller_admin sees own + descendants via `access_all_children`). `is_master_admin(uuid)` and `can_access_org(uuid,uuid)` are the helpers used in policies.

Whitelabel: `loadWhitelabel(idOrSlug)` reads org brand fields + `billing_plans.features`; `applyWhitelabel(cfg)` sets CSS vars `--brand-primary/--brand-accent` + favicon + document.title. `WhitelabelProvider` wraps `/org/:slug/master` and `/org/:slug/reseller` and resolves from URL slug or `brand_portal_domain` custom domain.

Impersonation: `ImpersonationProvider` uses sessionStorage key `ava_impersonation_v1`; `start-impersonation` edge function verifies `can_access_org` and writes audit row with `impersonator_id` + `impersonated_org_id`. `ImpersonationBanner` is an orange sticky banner with Exit button.

Edge functions:
- `create-organization`: master/can_manage_resellers gate → optional `fusionpbx-proxy createDomain` → insert org → create auth user → insert org_members + organization_members → audit → optional `send-org-email welcome`.
- `start-impersonation`: gate via `can_access_org` then audit insert.
- `domain-router`: lookup org by `brand_portal_domain`.
- `send-org-email`: per-org branded templates (welcome) sent via Resend, falls back to logging if RESEND_API_KEY missing.

Plans: `billing_plans` seeded with starter/basic/professional/reseller/enterprise; `features` JSONB drives `useFeatureFlag`.

Routes (in `src/App.tsx`):
- `/org/:slug/master/*` — MasterShell + dashboard/organizations/users/calls/billing/system/audit
- `/org/:slug/reseller/*` — ResellerShell + dashboard/customers/users/settings/billing

Lemtel master row (id `71755d33-ed64-4ad5-a828-61c9d2029eb7`) auto-promoted to `org_level=1`, `org_type='master'`, unlimited resellers. Existing super_admins promoted to `master_admin` in `org_members`.
