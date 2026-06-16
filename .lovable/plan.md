# Desktop App — Visual Overhaul + Global Theme Propagation

## Root causes (why nothing seems to change today)

1. **Theme only affects Settings**: Only `SettingsPage` reads from `useTheme()`. Every other component (`TitleBar`, `SoftphonePane`, `ProfileMenu`, `SetupWizard`, `AIInsights`, `RecordingsList`, `OutputDevicePicker`, `BrandTagline`, `MessagesHarness`) imports the **static** `theme` constant from `lib/theme.tsx` — a frozen light palette. So switching mode never repaints the app.
2. **Duplicate status/profile**: `TitleBar` renders `ProfileMenu` (AVAILABLE pill), and `SoftphonePane` header re-renders Ext badge + REGISTERED dot + `ProfileMenu` again. On narrow widths both stack.
3. **Type/density**: Static sizes (10–14 px), no fluid clamps, monospace dialer field looks dated next to the glass surfaces.

---

## Part A — Global theme propagation (with Save button)

### A1. Make tokens reactive via CSS variables
- In `ThemeProvider` (`lib/theme.tsx`), on every `mode` change write each token to `document.documentElement.style.setProperty('--ava-bg', t.bg)`, etc. for all ~25 tokens.
- Refactor the static `theme` export into **getters** that read `var(--ava-…)` with a hard-coded light fallback. Every component already calling `theme.colors.bg` will then auto-repaint when the variables flip — zero component churn.
- Same treatment for `theme.glass.*` (the inline style objects become functions returning fresh objects from CSS vars).

### A2. Pending + Save UX in Settings
- Split state: `pendingMode` (local) vs. committed `mode` (context). Theme buttons set `pendingMode`. Live preview pane uses `pendingMode`.
- Add sticky footer in `SettingsPage`:
  - **Save** (primary, gradient) → `setMode(pendingMode)` + persist to `localStorage` + toast "Theme applied to all screens".
  - **Revert** secondary → resets `pendingMode = mode`.
  - Disabled when `pendingMode === mode`.
- Broadcast via `storage` event (already wired) so the responsive overlay iframes also flip.

### A3. Reload safety
- `ThemeProvider` already restores from `localStorage` on mount; once A1 lands the CSS vars get written before first paint via a tiny inline `<script>` in `index.html` reading `ava-softphone-theme` → applies a `data-ava-theme` attribute + base background to avoid white flash.

---

## Part B — Visual identity refresh (futuristic, especially narrow widths)

### B1. Remove duplicate status
- Drop the `<ProfileMenu />` + status dot block from `SoftphonePane` header. Keep only the Ext badge + a single tiny SIP indicator (4 px dot, no text on `compact`).
- `TitleBar` remains the **single** source of profile + presence. On `compact`/`ultraCompact` widths, `TitleBar` becomes the full status bar (Ext + status + ProfileMenu + sync + gear).

### B2. Futuristic effects
- **Aurora mesh background**: animated 18s slow gradient drift on `<body>` using CSS `@keyframes` translating two radial blobs (brand blue + cyan).
- **Glass v2**: increase blur to 20px, add inner 1px highlight (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.08)`), corner radius 18.
- **Neon focus ring**: `0 0 0 2px var(--ava-accent), 0 0 18px -2px var(--ava-accent)` on `:focus-visible`.
- **Dialer keys**: subtle gradient bevel + active state with cyan glow + 60 ms scale(0.96) press. Letters under digits get a faint accent glow on hover.
- **Dock**: floating pill (already glass), add scanline shimmer (1.5 s) on the active tab, animated icon morph on switch.
- **Header**: gradient hairline border-bottom (blue→cyan→gold) instead of flat border.
- **Number field**: replace `Enter a number…` monospace with a tabular-figures display font + animated caret + soft inner glow when focused. Right-aligned for entered digits.
- **Brightness overlay**: tint shifts hue slightly per theme (cool for daylight, warm-blue for midnight).

### B3. Typography pass
- Adopt fluid scale: `font-size: clamp(11px, 1.4vw, 13px)` for body, `clamp(20px, 3vw, 28px)` for titles.
- Switch dialer digits to `Space Grotesk` 600 with `font-variant-numeric: tabular-nums lining-nums`.
- Increase letter-spacing on caps pills (0.6 → 0.8). Lower opacity of dim text from 0.85 → 0.72 for hierarchy.
- All-caps labels (`ABC`, `DEF`…) shrink to 9 px with 1.4 letter-spacing — currently competing with the digit.
- Anti-alias: add `-webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility` globally.

### B4. Narrow-width polish (the screenshot case)
- Header collapses to 40 px, Ext badge becomes icon-only with tooltip, status becomes 6 px dot.
- Dock auto-shrinks tab labels to 9 px and uses 2-letter abbreviations when width < 380 px (no `HISTO…` truncation).
- Add a 6 px safe-area top padding so the macOS traffic lights never overlap the title row.

---

## Files to touch

**Theme infra**
- `apps/ava-softphone-desktop/src/lib/theme.tsx` — CSS var injection, reactive `theme` proxy.
- `apps/ava-softphone-desktop/index.html` — pre-paint theme bootstrap script.
- `apps/ava-softphone-desktop/src/styles/futuristic.css` — new aurora keyframes, neon ring, scanline, fluid type.

**Settings (Save flow)**
- `apps/ava-softphone-desktop/src/components/SettingsPage.tsx` — pending state, Save/Revert footer.

**Visual + dedupe**
- `apps/ava-softphone-desktop/src/components/SoftphonePane.tsx` — strip duplicate ProfileMenu/status, new dialer treatment.
- `apps/ava-softphone-desktop/src/components/TitleBar.tsx` — promote to single status bar (Ext + status + profile + actions).
- `apps/ava-softphone-desktop/src/components/ProfileMenu.tsx` — compact variant.
- `apps/ava-softphone-desktop/src/components/BrightnessOverlay.tsx` — theme-aware hue.

**Untouched**: edge functions, RLS, mobile app, landing page, PBX provisioning.

---

## Verification
1. Switch theme in Settings → press Save → confirm TitleBar, dialer, dock, dock pills, recents, voicemail all flip.
2. Reload app → theme persists, no white flash.
3. Resize to 380 px → only one status row, no truncated dock labels, ProfileMenu reachable from TitleBar.
4. Tab through dialer → neon focus ring visible in all 4 themes.
5. Responsive lab (`?lab=responsive`) → theme syncs across iframes via storage event.
