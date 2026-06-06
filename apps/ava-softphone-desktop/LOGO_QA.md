# Manual logo visibility QA

Run after `npm run dev` (web) or `npm run electron:dev` (desktop).

## Web app (Vite)
For each viewport — **desktop (1440×900)**, **tablet (820×1180)**, **mobile (390×844)**:

1. Open DevTools → Network → ✅ "Disable cache".
2. Hit `Ctrl/Cmd+Shift+R` (hard refresh).
3. In the tab favicon, confirm the new Lemtel oval logo (yellow/blue) shows — **not** the old white "L" icon.
4. Inspect `<link rel="icon">` in `<head>`: href must include `?v=` query (cache-bust).
5. Navigate to `/auth` → Lemtel logo visible above the form.
6. Navigate to `/org/lemtel/portal/dashboard` → logo in header.
7. Scroll to footer → Lemtel logo visible, not clipped.
8. Hard refresh again on each route → repeat step 3–7.

## Desktop app
For each window size — **default (420×720)**, **narrow (360×600)**, **tall (420×900)**:

1. Launch: `cd apps/ava-softphone-desktop && npm run electron:dev`.
2. **TitleBar (top)**: Lemtel logo + "Lemtel Telecom" text. Hover → glow intensifies.
3. **Setup Wizard / Auth**: large Lemtel logo with conic halo above "Lemtel Telecom" title.
4. After login → **Softphone footer (bottom)**: Lemtel logo + "Powered by AVA AI" line.
   - Confirm `[data-testid="lemtel-footer"]` is visible (DevTools).
   - `getBoundingClientRect().height > 40` and `bottom <= window.innerHeight`.
5. Resize window vertically to minimum — footer logo must remain visible (not clipped by overflow).
6. Switch tabs (dial / recents / contacts / voicemail / sms) — footer persists on all tabs.

## Pass criteria
- Single `LemtelLogo` component is used in **TitleBar**, **SetupWizard**, **SoftphonePane footer**.
- Same PNG asset (`apps/ava-softphone-desktop/src/assets/lemtel-logo.png`) everywhere.
- No console errors related to image loading.
- Browser favicon updates after one hard refresh thanks to `?v=` cache-bust.
