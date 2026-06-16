
# Desktop App Polish Pass

Scope: `apps/ava-softphone-desktop/` only. Pure UI/presentation — no backend changes.

## 1. Home dashboard — range filters + scroll fix

File: `apps/ava-softphone-desktop/src/components/console/HomeDashboard.tsx`, `src/hooks/useDashboardStats.ts`

- Add a range selector pill group: **Today · Week · Month · Custom**. Custom opens a date-range popover (start / end).
- Extend `useDashboardStats` to accept `{ range, from, to }` and aggregate KPIs + sparkline series over that window (today / 7d / 30d / arbitrary).
- Persist selection in `localStorage` + URL params (already wired for deep-linking).
- Fix the unscrollable page: the outer wrapper currently caps height inside the Electron shell. Make the dashboard container `h-full overflow-y-auto` with proper bottom padding so all tiles + tables are reachable on 1019×730.

## 2. Grid / table colour contrast (all pages)

Add a shared CSS layer in `src/styles/futuristic.css` and apply to:
- `HomeDashboard.tsx` (recent calls, voicemail, recordings tables)
- `AdminView.tsx` and `admin/PbxResourceSection.tsx`
- `MessagesView`, `VoicemailView`, `RecordingsView`, `CallsView`

Changes:
- Replace `rgba(255,255,255,0.02-0.05)` row backgrounds with `var(--ava-bg-card)` / `var(--ava-bg-elev)` tokens.
- Add zebra striping `tbody tr:nth-child(even)` using an `--ava-row-alt` token defined per theme (light/dark/midnight).
- Bump header `th` weight + border-bottom contrast (`2px solid var(--ava-border-strong)`).
- Add row hover highlight `var(--ava-row-hover)`.
- Ensure every cell uses `color: var(--ava-text)`; muted cells use `var(--ava-text-muted)` (already token-resilient from the previous pass).

## 3. AVA chat — floating bubble button

- Remove the always-mounted AVA panel from the right side of the shell.
- Add `src/components/console/AvaChatLauncher.tsx`: fixed bottom-right FAB (56px, primary gradient, sparkle icon, unread dot).
- Clicking opens a 420×620 floating chat panel anchored bottom-right (drag-resize optional later). Close button + Esc to dismiss.
- Mount once in the console shell (`AppLayout`/`ConsoleShell`) so it's available on every page.
- Reuse the existing AVA Assistant message components inside the new panel — only the container chrome changes.

## 4. Always show my extension

- Add `useMyExtension()` lookup (reuse `pbx_softphone_users` query already in `useMyDashboardStats`).
- Show in two places:
  - **Sidebar header** under "Lemtel / Telecom · AI Phone": a chip `Ext 300 · Mohamad H.` with registration-status dot (green/amber/grey).
  - **Top-right header** beside the AVAILABLE pill: a compact `EXT 300` badge.
- Loading skeleton + "No extension assigned" fallback chip linking to Settings.

## Technical notes

- All colour values come from existing `--ava-*` CSS variables; add 3 new tokens (`--ava-row-alt`, `--ava-row-hover`, `--ava-border-strong`) per theme block.
- Range filter state lives in `HomeDashboard` and is passed to `useDashboardStats` as a query key segment, preserving cache per range.
- FAB chat uses a portal so it overlays modals correctly; z-index `60`.
- Extension chip subscribes to the same realtime channel as the softphone status hook to keep the dot live.

## Out of scope

- Backend / RLS / Edge Function changes.
- Landing page.
- Mobile app and web admin portal.
