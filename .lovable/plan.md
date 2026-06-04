# Multi-Organization Management

Bring back multiple organizations so a user can create new orgs from Settings, assign members (including org admins), and let each org admin create agents and assign them to their own clients.

## What the user will see

1. **New "Organizations" tab in Settings** (visible to super_admin and any user who belongs to ≥1 org)
   - List of all orgs the user belongs to, with role badge per org
   - "Create new organization" button → modal asking for name + slug (auto-generated, editable) + optional logo
   - For each org row: switch to it, rename, deactivate (org_admin/super_admin only)
   - "Members" sub-section per org: list members with role, invite by email, change role (org_admin, manager, agent, viewer), remove member
   - Creator of a new org is automatically added as `org_admin` and a default `billing_config` is initialized (reuses existing `setup_new_user_organization` pattern via a new lighter SQL function `create_organization_for_user`)

2. **Org switcher in the top bar** (AppLayout header)
   - Dropdown showing all orgs the user is a member of with the current one checked
   - Selecting an org updates `OrganizationContext` and persists choice in `localStorage` (`selected_organization_id`)
   - All existing pages (Clients, Agents, Conversations, Analytics, etc.) already read `selectedOrgId` from context → they will automatically scope to the active org with no further changes

3. **Clients & Agents flow (already mostly in place, small adjustments)**
   - Clients page already filters by `organization_id` — confirmed working per org
   - Agent creation modal: the `client_id` selector will be filtered to clients of the **currently selected org**
   - Org admins of a given org can create agents inside that org and assign them to one of that org's clients via the existing assign-client field on the agent form

## Technical details

### Database
No new tables needed — `organizations`, `organization_members`, `user_roles`, `billing_config` already exist with proper RLS.

Add one SECURITY DEFINER helper to safely bootstrap a brand-new org for the calling user (mirrors `setup_new_user_organization` but callable any time):

```sql
create or replace function public.create_organization_for_user(
  _name text, _slug text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _org_id uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  insert into organizations(name, slug, onboarding_completed) values (_name, _slug, true) returning id into _org_id;
  insert into organization_members(user_id, organization_id, accepted_at) values (_uid, _org_id, now());
  insert into user_roles(user_id, organization_id, role) values (_uid, _org_id, 'org_admin');
  insert into billing_config(organization_id, plan_tier, subscription_status) values (_org_id, 'free', 'active');
  return _org_id;
end; $$;
```

### Frontend changes
- `src/context/OrganizationContext.tsx` — load **all** memberships (not just first), expose `organizations[]` and `setSelectedOrgId(id)`, persist choice to `localStorage`.
- `src/components/layout/AppLayout.tsx` — add `<OrgSwitcher />` dropdown next to the notifications bell.
- `src/components/sidebar/OrgSwitcher.tsx` (new) — reads context, lists orgs, switches active org.
- `src/pages/Settings.tsx` — add `Organizations` tab between `agency` and `members`.
- `src/components/settings/OrganizationsTab.tsx` (new) — list + create modal + per-org members panel. Reuses existing `MembersTab` patterns and the `create-org-member` edge function (already accepts `organization_id`).
- `src/components/agents/CreateAgentModal.tsx` — make sure the client selector filter uses `selectedOrgId` (verify, adjust if hardcoded).
- Locales: add new strings under `settings.organizations.*` in `src/locales/en.ts` and `fr.ts`.

### Permissions
- Anyone authenticated can create a new org via the RPC (they become its `org_admin`).
- Only `org_admin`/`super_admin` of an org can rename/deactivate it or manage that org's members (already enforced by existing RLS + `manage-org-roles` / `create-org-member` edge functions).

## Out of scope
- Cross-org data merging or analytics aggregation
- Billing per org beyond initializing a free plan row (existing billing UI keeps working per active org)
- Migrating existing super-admin shortcuts
