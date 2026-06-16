## Issues

1. **AVA logo broken on desktop** — `BrandTagline` (and a couple of other desktop screens) reference `/ava-statistics-logo.png` as an absolute path. The desktop app builds with Vite `base: './'` and runs under Electron `file://`, so absolute root paths don't resolve and the image shows as a broken placeholder.
2. **SIP password field is unclear** — users don't know which password to type. It's the same password defined on the extension in FusionPBX / portal (verified by `extension-signin` against `pbx_softphone_users.sip_password`). No backend change needed — only a clearer hint and label.

## Changes

### 1. Logo — switch to a bundled Vite asset (sweep)
- Import the PNG once via a shared module (e.g. `apps/ava-softphone-desktop/src/assets/avaStatisticsLogo.ts` re-exporting `import logo from './ava-statistics-logo.png'`).
- Move `ava-statistics-logo.png` from `public/` into `apps/ava-softphone-desktop/src/assets/` so Vite hashes and resolves it relative to the built `index.html` (works under `file://`).
- Replace every `src="/ava-statistics-logo.png"` (and `/ava-statistic-logo.png`, `/ava-logo.png`) reference in the desktop app with the imported asset. Files touched:
  - `src/components/BrandTagline.tsx`
  - `src/components/SoftphonePane.tsx`
  - `src/components/SetupWizard.tsx`
  - `src/components/SettingsPage.tsx`
  - `src/components/console/LeftRail.tsx`
  - `src/components/console/AIWorkspace.tsx`
  - `src/components/console/ConsoleLayout.tsx`
  - `src/lib/theme.tsx` (if it embeds a logo URL)
  - `index.html` (if it preloads the logo)
- Add `onError` fallback hiding the `<img>` so a future missing asset never shows a broken icon.

### 2. Login screen — clearer SIP password guidance
In the desktop auth screen (Extension tab):
- Relabel hint under the form to:  
  *"Use the same SIP password defined on your extension in the portal (or in FusionPBX). If you don't have one, ask your administrator to set it on your extension."*
- Add a small inline help tooltip (?) next to the **SIP PASSWORD** label with the same text.
- No change to the auth flow or `extension-signin` edge function — current behavior already validates against the extension's SIP password.

## Verification
- Run `bun run build` for the desktop app and confirm the AVA logo asset is emitted with a hashed filename and referenced from the bundle.
- Visually confirm the logo renders on the login screen, console header, AI workspace, settings, and left rail.
- Confirm the new hint text appears under the SIP password field.

## Out of scope
- Generating/emailing per-user softphone passwords.
- Any portal-side password UI changes.
- Changes to FusionPBX provisioning.
