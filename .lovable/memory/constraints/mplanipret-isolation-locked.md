---
name: /mplanipret routes & org config are LOCKED
description: Hard constraint — never touch the /mplanipret route table, MplanipretGuard, OrganizationContext bindings, or App.tsx wiring for the Planiprêt mobile app
type: constraint
---

The Planiprêt mobile app at `/mplanipret` is a fully isolated surface with its
own login, guard (`MplanipretGuard`), and org-scoping. The user has been bitten
multiple times by edits that bounced `/mplanipret` into `/planipret/admin` or
broke its access path.

**Never** modify any of the following unless the user explicitly says
"change the /mplanipret routes" or "change the mplanipret org access":

- `src/App.tsx` — the `<Route path={ROUTES.MPLANIPRET} …>` block and its nested
  routes (home/calls/messages/voicemail/contacts/more/pipeline/search/stats).
- `src/components/auth/MplanipretGuard.tsx`
- `src/components/auth/AppSeparationGuard.tsx` (for `app="planipret"`)
- `src/lib/routes.ts` — `ROUTES.MPLANIPRET*` constants and the
  `isMplanipretPath` / `isPlanipretAdminPath` helpers.
- `src/context/OrganizationContext.tsx` — the AVA/Planiprêt/Lemtel scoping logic.
- `src/lib/postLoginRoute.ts` — anywhere it decides between mobile and admin.

When adding mobile features, work **inside** the existing nested routes and
inside `PlanipretMobile.tsx`. Never add a redirect that lands on
`/planipret/admin/*` from any `/mplanipret*` path. Never gate `/mplanipret`
behind an admin-only guard.

New Planiprêt preview/QA pages must live on their own paths
(e.g. `/planipret/store-preflight`) — never under `/mplanipret`.

**Why:** `/mplanipret` is the broker-facing mobile app; the admin portal is a
separate surface. Entangling them breaks broker access in production.
