## Problem

On `/org/lemtel/admin/customers` (`src/pages/lemtel/LemtelCustomers.tsx`):

1. The **Extensions** column shows `0` for most domains because it counts rows in the local `pbx_extensions` cache. That cache is only populated for domains that have been synced — domains with extensions on the FusionPBX server but no local sync show `0`.
2. Clicking a row navigates to the internal admin detail page (`/org/lemtel/admin/customers/:uuid`) — a Lemtel-staff view. You want clicking the domain to drop you straight into that customer's portal so you can manage their phone system end-to-end (extensions, queues, IVRs, DIDs, etc.) as if you were them.

## Changes (UI only — file: `src/pages/lemtel/LemtelCustomers.tsx`)

### 1. Live extension counts per domain

- Add a new React Query `['fusionpbx', 'ext-counts']` that calls the existing `fusionpbx-proxy` edge function with `action: 'list-extensions-counts'` (preferred) **or**, if the proxy doesn't support a counts action, fans out one `list-extensions` call per domain in parallel (using `Promise.all`) and stores `{ [domain_uuid]: number }`.
- The query depends on `domains` and is enabled once `domains.length > 0`.
- Merge the live count with the local cache count: display `liveCount ?? localCount`, falling back to a tiny spinner while loading, so the column is never stuck at `0` when extensions actually exist on the PBX.
- Add a small "live" indicator (muted dot) when the number came from the PBX directly.

### 2. Click row → enter customer portal

- Replace the row-level `onClick` (currently `window.location.href = '/org/lemtel/admin/customers/${uuid}'`) with the same flow as the existing `manageAs(d)` button:
  - Pin `lemtel.activeDomain` in sessionStorage.
  - Call `impersonation.enter(org.id, org.name)`.
  - Navigate to that customer's cockpit: `/domain/${org.slug}/admin/dashboard` if a slug exists, otherwise `/console` (current fallback).
- If the domain has **no linked tenant org**, show a toast (already exists in `manageAs`) and keep the row non-clickable instead of silently failing.
- Keep the existing per-row action buttons (Sync, Edit, Delete, Copy portal link, "Open" detail link) untouched and `stopPropagation` so they still work. Rename the small `LogIn` button tooltip from "Manage as this customer" → "Open customer portal" for clarity, since the whole row now does it.
- Keep the existing "Open" button pointing to the internal admin detail page for cases where staff want the Lemtel-side record view.

### 3. Small polish

- Add `title="Click to open this customer's portal"` on the row and a chevron-right hint that's already there.
- Loading state: while `ext-counts` is fetching, show `…` instead of `0` for that domain only.

## Out of scope

- No backend / edge-function changes unless the `list-extensions` proxy can't be called per-domain (it already can — that's how `ConsoleExtensions` syncs).
- No changes to the customer portal pages themselves.
- No changes to permissions / RLS.

## Files touched

- `src/pages/lemtel/LemtelCustomers.tsx` (single file, UI only).
