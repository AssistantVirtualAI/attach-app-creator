
## Phase 1 — Logos, favicons, scroll fix, light glass refresh

### 1. Logo asset distribution

Source: `user-uploads://lemtel_store_icon_128_clean.png` (blue rounded square + gold wifi "L").

Generate sized variants once and copy to every required path:

- **Web app (avastatistic.ca)**
  - `public/favicon.png` (overwrite)
  - `public/lemtel-icon.png` (overwrite)
  - `public/desktop-app-icon.png` (overwrite)
  - `index.html` — confirm `<link rel="icon">` points to `/favicon.png`
  - Auth page (`src/pages/Auth.tsx`) — replace the generic `Activity` icon block with the Lemtel mark; add a small "AVA × Lemtel" lockup.

- **Desktop (Electron) `apps/ava-softphone-desktop/assets/`**
  - `icon.png` (1024px), `icon.ico` (Windows), `icon.icns` (macOS) — regenerated from the new PNG
  - `tray-icon.png` + `@2x`, `tray-icon-active.png` + `@2x` — monochrome variant for the tray (small)
  - `lemtel-logo.png` (overwrite)

- **Mobile (Capacitor) `apps/ava-softphone-mobile/assets/`**
  - Run `generate-icons.js` after dropping the new source PNG so Android `mipmap-*` and iOS `AppIcon.appiconset` are regenerated.
  - PWA: `apps/ava-softphone-mobile/public/` icons + `manifest.webmanifest` references.

- **Chrome extension `apps/lemtel-chrome-extension/icons/`**
  - `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` — regenerated from source.
  - `manifest.json` already references them; no JSON change needed.

- **App Store / Play Store metadata**
  - Place a 1024×1024 master at `apps/ava-softphone-mobile/store-metadata/icon-1024.png` for store submission.

### 2. Auth page branding (web)

`src/pages/Auth.tsx`: replace the gradient + `Activity` lucide icon with the real Lemtel mark image, wordmark "AVA Statistic — powered by Lemtel", lighter background gradient (white → soft blue), keep existing Google/Microsoft/Apple buttons but give them a glass surface with subtle gold hover ring.

### 3. Desktop scroll bug — fix all three

`apps/ava-softphone-desktop/src/`:

- **Top tab bar** (`TabIcons.tsx` / parent in `App.tsx`): the container is `display:flex` with no overflow rule. Add `overflow-x:auto`, `flex-wrap:nowrap`, `min-width:0` on the wrapper, hide scrollbar visually, and ensure each tab has `flex-shrink:0`.
- **List views** (`RecentsList.tsx`, `ContactsList.tsx`, `VoicemailList.tsx`, `RecordingsList.tsx`, `SmsThreads.tsx`): wrap their root in a flex column with `flex:1; min-height:0; overflow-y:auto`. Root cause: parent panes use flex without `min-height:0`, so children collapse instead of scrolling.
- **Settings** (`SettingsPage.tsx`): same fix — give the scroll container `flex:1; min-height:0; overflow-y:auto` and ensure the page wrapper is height-bounded.

### 4. Lighter glass visual refresh

**Desktop** (`apps/ava-softphone-desktop/src/lib/theme.tsx` + `styles/animations.css`):
- Shift base from deep navy to a lighter palette: surface `rgba(255,255,255,0.78)` over a soft `#eaf1fb → #f7faff` gradient, primary `#0052CC`, accent gold `#FFD700`, AI shimmer violet/cyan retained for "Powered by AVA" chips.
- Buttons get a glass variant: `backdrop-filter: blur(14px) saturate(160%)`, 1px gold inner ring, soft shadow, animated specular highlight on hover.
- Cards: 16px radius, 1px white border at 40%, frosted background, dim outer shadow.
- Tabs gain an active "wet glass" pill with subtle gold underline.

**Mobile** (`apps/ava-softphone-mobile/src/lib/theme` + `Brand.tsx`):
- Same lighter base; keep `HeroGradient` but lift opacity, swap to white-tinted glass cards for Home/Dialer/Calls/Messages/AI/Settings screens.
- Shiny glass CTA component used for Call / Send / Connect across screens.

**Web auth**: lighter gradient on the right panel, glass buttons matching desktop.

No business-logic changes. All edits stay in presentation files.

### 5. GitHub push

Commit is automatic on Lovable saves and syncs to the connected GitHub repo. After the changes land I'll confirm the sync.

### Out of scope for this turn (next phase if desired)
- Rebuilding mobile `AppIcon.appiconset` natively (requires `npx cap sync` locally by the user)
- Codesigned `.icns`/`.ico` regeneration via `iconutil` (will be produced via `sharp` in CI)
- Per-page visual QA pass on the admin web app beyond Auth — say the word and I'll extend the refresh to Dashboard/Settings/etc.

### Technical notes
- Icon resizing in the sandbox via `sharp` (Node) — no ImageMagick install needed.
- `.icns` generation uses `png2icons` (npm) for cross-platform build.
- Tray icons stay 16/22/32px monochrome to respect macOS template-image rules.
