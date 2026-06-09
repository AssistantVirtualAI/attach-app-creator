# Phase 9 — Desktop UX Polish + FR/EN Sweep

**Hard rule:** Do not touch `src/pages/Landing.tsx` or `src/components/landing/**`. All work stays inside `apps/ava-softphone-desktop/` and `src/locales/`.

This is the last open phase from the desktop telecom plan. Everything else (Phases 1–8) is already shipped.

## Scope

1. **Shared status pill component**
   - New `apps/ava-softphone-desktop/src/components/ui/StatusPill.tsx` with variants: `connected`, `registered`, `sync-pending`, `sync-failed`, `not-configured`, `online`, `offline`, `busy`, `dnd`.
   - Replace ad-hoc colored badges in `TelecomSettingsView`, `OrgChatView`, `AdminAIChatView`, `ReportsView`, dialer/header.

2. **Empty / loading / error states**
   - New `apps/ava-softphone-desktop/src/components/ui/StateView.tsx` (skeleton, empty illustration slot, error with retry).
   - Apply to: Calls, Voicemail, Recordings, Messages, OrgChat (no channel selected / no messages), TelecomSettings (no extension), AdminAIChat (no proposals), Reports (no data in range), Contacts.

3. **Console layout polish**
   - Tighten spacing tokens in `ConsoleLayout.tsx` (4px unit grid), unify header bar height, add consistent page title + subtitle slot.
   - Smooth view transitions (framer-motion fade/slide) between left-rail items.
   - Ensure 1024×640 minimum: audit overflow on `OrgChatView` channel list and `ReportsView` tables; switch to responsive grid.

4. **FR/EN translation sweep**
   - Add keys under `src/locales/{en,fr}/desktop.ts` (new namespace `desktop.*`).
   - Cover all hardcoded strings in: `TelecomSettingsView`, `OrgChatView`, `AdminAIChatView`, `ReportsView`, `LeftRail` labels, status pills, empty/error states.
   - Wire via existing `useTranslation()` hook; verify language toggle updates desktop views live.

5. **Accessibility + keyboard**
   - Focus rings on rail items, `aria-label`s on icon-only buttons, `role="status"` on status pills.
   - `Esc` closes any open dialog; `Cmd/Ctrl+K` already wired — verify still works after layout changes.

6. **QA pass**
   - Manual smoke on each desktop view at 1024×640 and 1440×900.
   - Toggle FR↔EN, verify no missing keys (console warn).
   - Verify role-aware rail: `normal` user sees no admin items; `org_admin` sees admin tabs.

## Files to add / edit

- **Add**: `apps/ava-softphone-desktop/src/components/ui/StatusPill.tsx`, `StateView.tsx`
- **Add**: `src/locales/en/desktop.ts`, `src/locales/fr/desktop.ts` (+ register in `src/locales/index.ts`)
- **Edit**: `apps/ava-softphone-desktop/src/components/console/{ConsoleLayout,LeftRail,TelecomSettingsView,OrgChatView,AdminAIChatView,ReportsView}.tsx`
- **Edit**: any view-level files that currently hold hardcoded EN strings or ad-hoc status badges

## Out of scope

- Landing page (locked).
- New features — this phase is polish + i18n only.
- Web portal — desktop only, except shared locale files.

## Acceptance

- No hardcoded user-facing strings remain in the touched desktop files.
- Every list/data view has explicit loading + empty + error variants.
- `.lovable/plan.md` Phase 9 flips to ✅.

## Progress
- ✅ StatusPill + StateView components added (`apps/ava-softphone-desktop/src/components/ui/`)
- ✅ Desktop i18n hook + EN/FR dictionaries (`apps/ava-softphone-desktop/src/lib/i18n.ts`)
- ✅ LeftRail labels, search, settings, and aria-labels translated; focus ring on rail items
- ✅ Spin + pulse keyframes appended to `styles/animations.css`
