# Make admin portal match `/_design` visually

Goal: every admin page (everything wrapped by `AppLayout`) inherits the same cockpit glass aesthetic shown on `/_design` — ambient gradient backdrop, glow blobs, glass section headers, glass cards/tables, neon buttons, status chips — without touching routing, business logic, or the landing page.

## 1. Cockpit-ify `AppLayout` content shell

`src/components/layout/AppLayout.tsx`:
- Wrap `<main>` with `cockpit-bg cockpit-scope` and inject the two ambient glow blobs (cyan top-left, violet bottom-right) used in `CockpitLayout`/`DesignPreview`.
- Page padding stays the same; only the visual surface changes.
- Sidebar stays as-is (already redesigned with glass + shine).

## 2. New global `.cockpit-scope` CSS layer (`src/index.css`)

Single opt-in scope class that automatically restyles shadcn defaults inside the admin shell to match the design page — no per-page rewrites required.

Inside `.cockpit-scope` only:
- shadcn `Card` (`[data-slot="card"]`) → glass background (`hsl(var(--cockpit-surface) / 0.7)`), `backdrop-blur(18px)`, cockpit border, inset highlight, soft shadow — equivalent of `GlassCard`.
- shadcn `Table` headers/rows → uppercase tracked headers, hover row glow, divider color from `--cockpit-border` — equivalent of `GlassTable`.
- shadcn `Button` default variant → cockpit shine gradient + glow on hover (same recipe as `NeonButton` primary). Outline/ghost variants stay subtle.
- shadcn `Badge` → cockpit chip look (translucent surface + colored ring).
- Section `h1`/`h2` page titles get a thin cyan→violet underline accent via `.cockpit-scope h1.page-title` (opt-in only when a page adds the class, no surprise restyles).
- Tabs list → glass pill with shine.

All rules are theme-aware via existing cockpit HSL tokens, so they work in both light and dark.

## 3. Cockpit page header on top admin pages

For visual parity with `DesignPreview`'s `SectionHeader`, swap the existing ad-hoc page titles on the highest-traffic admin pages to `SectionHeader` from `@/components/ui-cockpit`:
- `SuperAdminDashboard`
- `Dashboard`
- `Clients`
- `Conversations`
- `Agents`
- `Integrations`
- `Settings`
- `Leads`
- `Handoffs`
- `WebhookLogs`
- `AuditLogs`

Header keeps the page's existing icon + title + subtitle + actions; nothing else changes. KPI tile blocks already present on these pages get replaced with `KpiCard` where one already exists trivially (Dashboard / SuperAdminDashboard). Other pages just inherit the global `.cockpit-scope` styling.

## 4. Out of scope

- No changes to `Landing.tsx` or `src/components/landing/**` (locked).
- No changes to client portal styling (separate scope — explicitly admin-only).
- No changes to `CockpitShell` / `CockpitLayout` / `DesignPreview` themselves.
- No data, routing, RBAC, or RLS changes.
- No new dependencies.

## Acceptance

- Visiting `/_design` and `/dashboard` (or any other admin page) renders with the same ambient backdrop, the same glass card surface, and the same button/badge/table styling.
- Light and dark themes both keep contrast (uses existing cockpit tokens already wired in both modes).
- No regression on sidebar, softphone widget, dropdowns, or non-admin pages.

## Technical appendix

- File touched: `src/components/layout/AppLayout.tsx` (main wrapper class + ambient glow markup only).
- File touched: `src/index.css` (~80 lines added under a new `@layer components { .cockpit-scope { ... } }` block).
- Files touched: 11 listed admin pages — header swap only, no logic changes.
- No migration. No edge function. No new route. No memory rule change.
