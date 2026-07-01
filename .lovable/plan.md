# Lemtel Portal — 4 Critical Fixes

## Issue 1 — Gateways: System-Level Fetch

**File:** `supabase/functions/fusionpbx-proxy/index.ts`

- Locate the `get-gateways` (or equivalent) action.
- Remove any `domain_uuid` filter from the `/api/v1/gateways` call — query at system scope.
- On `403 Forbidden`, attempt `fs_cli -x 'sofia status gateway'` as read-only fallback via existing PHP session pattern.
- If both fail, return the permission-fix message (already surfaced) but keep partial `fs_cli` data if available.
- Frontend Gateways page: display all rows regardless of domain, show domain name column when present.

## Issue 2 — Remove Duplicate "Phone Numbers" Page (Lemtel only)

- Remove the "Phone Numbers" nav entry from the Lemtel sidebar component.
- Redirect the `/phone-numbers` route (Lemtel scope) → `/inbound-routes` via `<Navigate replace>`.
- Grep for internal links pointing to the removed route and repoint them to Inbound Routes.
- Guard the change to Lemtel org only; other orgs untouched.

## Issue 3 — Queue Member Add: fs_cli Fallback + Admin Notice

**File:** `supabase/functions/fusionpbx-proxy/index.ts`

- In `add-queue-member` handler: on 403 with `call_center_tier_add`, fall back to:
  `fs_cli -x "callcenter_config queue tier add <queue> <agent> <level> <position>"`
- Parse fs_cli output; return success or a precise permission error message listing all missing ACLs (tier + agent add/update/delete, queue_view).

**Frontend:**
- Add a dismissible admin-only notice at the top of the Call Center → Queues page when the last add attempt returned the permission error, listing the exact Group Manager permissions Keeny must add (tier + agent CRUD, queue_view, gateway_view/all, command_add/edit).

## Issue 4 — Org Isolation + Post-Login Redirect

**4a — Isolation:**
- Audit admin pages (calls, recordings, extensions, softphone users, transcripts) — ensure every Supabase query filters `organization_id = <lemtel org>`.
- Verify RLS on `pbx_call_records`, `pbx_call_recordings`, `pbx_extensions_directory`, `pbx_softphone_users`, `pbx_call_transcripts`; add org-scoped policies where missing (migration).
- Add guard in `fusionpbx-proxy`: if the Lemtel API key is used and body `organization_id` ≠ Lemtel org, reject with 403.
- Route guard: mismatched `organization_id` → redirect to own dashboard + "Accès refusé" toast.

**4b — Post-login redirect:**
- In the auth callback / session hydration, resolve role from `user_roles` / `pbx_softphone_users`.
  - super_admin / org_admin → `/dashboard`
  - domain_admin → `/dashboard?domain=<domain_uuid>`
  - end-user → `/my`
- Perform redirect before rendering protected content (loading gate).
- If deep-link target belongs to a different org, override to user's own dashboard.

## Constraints Respected

- No changes to iOS Swift plugins, CallKitManager, storyboard, or Xcode project.
- Recording/transcription/voicemail pipeline untouched.
- Fixes apply across all Lemtel domains, not just primary.

## Deliverables Report

- List of Supabase tables + RLS policies modified.
- List of edge function actions patched.
- List of frontend routes/components changed.
