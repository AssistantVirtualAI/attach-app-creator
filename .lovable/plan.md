
# Desktop App — Futuristic Visual Refresh

Scope: `apps/ava-softphone-desktop` only. Frontend/presentation tokens + shared chrome. No business logic, no API/SIP changes.

## Design direction

- **Palette (from AVA Statistic logo)**
  - Deep brand blue `#0023e6` → bright `#4d6dff` → aurora cyan `#21d4fd`
  - Signal gold `#d4a73a` / soft `#e8c878` for premium accents
  - Frosted surfaces: `#eef2fa → #dde4f1` gradient base, white glass panels at 78–88% with `blur(14px)`
  - Dark mode: midnight `#0b1124 → #131a35` with the same blue/cyan/gold accents
- **Typography**: Space Grotesk (display/headings, tracking tightened) + DM Sans (body/UI). Loaded via Google Fonts in `index.html`. Numerals tabular for call lists/timers.
- **Density**: Spacious & airy — base spacing unit stays 4px but cards use 20–28px padding, list rows 56px min, generous gutters.
- **Motion**: Futuristic
  - Glass blur + gradient hairline borders (animated conic-gradient on focus/active nav)
  - Hover lift (translateY -2px) + soft blue glow shadows
  - Page enter: fade+slide 240ms ease-out
  - Active-call dock + incoming toast: subtle pulse ring in brand blue
  - Reduced-motion respected via `prefers-reduced-motion`

## What changes

### 1. Theme tokens (`src/lib/theme.tsx`)
- Rewrite both `light` and `dark` token sets to the logo palette above.
- Add `gradients`: `auroraPrimary`, `auroraSubtle`, `goldEdge`, `meshBackdrop`.
- Add `glass.nav`, `glass.dock`, `glass.toast` variants (different blurs/opacities).
- Add `motion`: durations + easings, plus `glowPulseBlue` / `glowPulseGold` shadow tokens.
- Keep legacy color aliases (`midnight`, `deepPanel`, `signalGold`, `textIce`, `mutedSilver`, etc.) so existing components keep working — only the underlying hex values change.

### 2. Global chrome
- `src/index.tsx` / `index.html`: inject Space Grotesk + DM Sans, set `font-family` on `<html>`, smooth font rendering, base background = `bgGradient`.
- Add a single global stylesheet `src/styles/futuristic.css` with:
  - `@keyframes` for `auroraShift`, `borderTrace`, `pulseGlow`, `pageEnter`
  - Utility classes: `.glass`, `.glass-strong`, `.aurora-border`, `.lift-hover`, `.tabular-nums`
  - Custom scrollbar styling (thin, brand-tinted)

### 3. Responsive layout (`ConsoleLayout.tsx`, `LeftRail.tsx`, `AIPanel.tsx`)
- Replace hard 640px compact breakpoint with three tiers: `<640` mobile bar, `640–960` rail-only (AI panel collapses to icon), `>960` full three-pane.
- Left rail: glass column, animated active indicator (gradient bar that slides), icon hover halo.
- Top header (compact): full-bleed glass with aurora hairline; logo wordmark left, ext + org centered, search/settings right.
- Main content area gets a subtle radial mesh backdrop and 24px page padding (16 on mobile).

### 4. Cards, lists, buttons (shared visual primitives)
- Update `theme.glass.card` / `cardGold` / `cardAI` with stronger blur (16px), 1px gradient borders via `mask`, hover lift.
- New `Button` visual variants used across views (no API change): `primary` (aurora gradient + blue glow), `ghost` (glass), `gold` (premium actions like Start Call).
- List rows: 1px bottom hairline using `border-image` gradient; selected row gets left aurora bar + soft blue tint.

### 5. Key surfaces polished
- `HomeDashboard`: KPI tiles become glass cards with gradient numerals (Space Grotesk 32–40px), micro-sparkline accents.
- `SoftphonePane` dialer: bigger keypad (64px keys), gold call button with pulse, glass status chip.
- `CallsView` / `RecordingsView` / `VoicemailView`: unified glass table with sticky glass header, hover row glow.
- `ActiveCallDock` & `IncomingCallToast`: aurora gradient border + pulse ring; better text/CTA contrast.
- `AdminView` tabs: pill tabs with sliding aurora indicator.
- `SettingsPage`: section cards on glass, segmented controls for theme.

### 6. Text ↔ visual harmony
- Type scale (Space Grotesk display / DM Sans UI): 11/12/14/16/20/24/32/40 with line-heights 1.15 display / 1.5 body.
- Letter-spacing: -0.01em on display ≥20px, +0.08em uppercase eyebrows (11px gold).
- All numerals in call/timer/KPI contexts use `font-variant-numeric: tabular-nums`.
- Enforce min contrast: body text token raised to `#0b1530` on light, `#eaf0ff` on dark; muted never below WCAG AA on its surface.

### 7. Accessibility & perf
- `prefers-reduced-motion`: disable pulses, keep fades short.
- Focus-visible ring: 2px aurora outline + 3px soft glow.
- Backdrop-filter behind a `@supports` fallback (solid translucent color) for older WebViews.

## Technical details

Files to modify:
- `apps/ava-softphone-desktop/src/lib/theme.tsx` — token rewrite + new gradient/motion tokens
- `apps/ava-softphone-desktop/src/index.tsx` — font imports, global background
- `apps/ava-softphone-desktop/index.html` — preconnect + Google Fonts link
- `apps/ava-softphone-desktop/src/styles/futuristic.css` *(new)* — keyframes + utilities
- `apps/ava-softphone-desktop/src/components/console/ConsoleLayout.tsx` — breakpoints, backdrop, header polish
- `apps/ava-softphone-desktop/src/components/console/LeftRail.tsx` — glass column, sliding indicator
- `apps/ava-softphone-desktop/src/components/console/AIPanel.tsx` — collapsible at mid breakpoint
- `apps/ava-softphone-desktop/src/components/console/HomeDashboard.tsx` — KPI cards + type scale
- `apps/ava-softphone-desktop/src/components/SoftphonePane.tsx` — dialer/keypad/call button polish
- `apps/ava-softphone-desktop/src/components/console/CallsView.tsx`, `RecordingsView.tsx`, `VoicemailView.tsx`, `MessagesView.tsx`, `ContactsView.tsx` — shared glass table styling via tokens
- `apps/ava-softphone-desktop/src/components/console/AdminView.tsx` — pill tabs with sliding indicator
- `apps/ava-softphone-desktop/src/components/console/ActiveCallDock.tsx`, `IncomingCallToast.tsx` — aurora border + pulse
- `apps/ava-softphone-desktop/src/components/SettingsPage.tsx` — section cards, segmented theme switch

Out of scope: SIP/voicemail logic, edge functions, RLS, web app (`src/`), landing page.

## Verification

- Browser preview at mobile (390), tablet (820), desktop (1366, 1920) viewports — check layout, contrast, no clipping.
- Toggle light/dark via Settings — verify both themes.
- Reduced-motion OS setting → animations damped.
- Smoke: dialer renders, call dock appears on simulated incoming (`Ctrl+Shift+I`), nav transitions, AI panel toggle.
