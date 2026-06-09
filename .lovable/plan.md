## Track E — Full glass/semantic visual sweep

### Approach

The codebase already ships a `.cockpit-scope` CSS layer in `src/index.css` (lines 707-760) that auto-styles every shadcn `Card`, `Table`, `Tabs`, and default `Button` inside it — turning them into glass/cockpit primitives with backdrop-blur, gradient borders, neon hover, and uppercase table headers. It also paints two ambient cyan/violet blur orbs as a scope background.

Today this scope is applied only by `AppLayout` (which wraps every `/org/lemtel/**` route). Track E = extend the same scope to every other authenticated route shell, instead of rewriting ~80 page files to swap `Card` → `GlassCard`.

### Changes

1. **`src/components/portals/PortalShells.tsx`** — add `cockpit-scope` to the `<main>` element inside `Shell` (single class addition). This instantly glassifies:
   - `/platform/**` (Platform Admin: dashboard, orgs, users, calls, telephony, QA, health, billing, audit, settings)
   - `/customer/**` (Customer Admin: dashboard, team, extensions, queues, IVR, numbers, calls, chat, AI admin, reports, analytics, KB, billing, settings)
   - `/my/**` (My Workspace: home, softphone, calls, voicemail, messages, recordings, chat, telecom, AI, downloads, profile, settings)

2. **`src/components/portals/PortalShells.tsx`** — header polish:
   - Active `NavLink` gets `sidebar-glow` (existing token) for the neon cyan underline used elsewhere.
   - Header `bg-card/40` → `cockpit-surface` style so the sticky bar matches the scope.

3. **`src/pages/admin/ClientCreateWizard.tsx`** — wrap the wizard root in `<div className="cockpit-scope min-h-screen">` so the standalone client-provisioning page inherits the same look.

4. **`src/index.css`** — minor: ensure `.cockpit-scope` orbs use `position: absolute` inside the shell (not `fixed`) so they don't bleed across other portals when multiple shells mount. One-line CSS adjustment.

### Out of scope
- No per-page Card→GlassCard swap (the scope handles it).
- No new color tokens, fonts, or spacing changes.
- No landing page edits (locked).
- No changes to `/org/lemtel/**` (already in scope via AppLayout).
- No business-logic, route, or component-API changes.

### Technical appendix
- Files modified: 3 (`PortalShells.tsx`, `ClientCreateWizard.tsx`, `index.css`).
- No new files, no migrations, no edge function changes, no deps.
- Verification: load `/platform`, `/customer`, `/my`, `/admin/clients/new` in the preview and confirm cards/tables/tabs render with glass styling and ambient orbs, matching `/org/lemtel/admin/dashboard`.
