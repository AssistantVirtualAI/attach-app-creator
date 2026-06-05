# AVA Softphone — Desktop App

White-label downloadable softphone (Windows / macOS / Linux) that wraps the
same JsSIP/WebRTC stack used by the in-browser widget at
`/org/lemtel/telephony/webphone`.

## Develop

```bash
cd apps/ava-softphone-desktop
npm install
npm run dev
```

The renderer is served by Vite on `http://localhost:5173`; Electron loads it
with `frame: false` and a custom titlebar.

## Build installers

```bash
npm run build:win    # NSIS .exe
npm run build:mac    # .dmg + .zip (x64 + arm64)
npm run build:linux  # AppImage + .deb
```

Outputs land in `dist-electron/`. The signed/notarized installers are
uploaded to the GitHub release defined in `build/electron-builder.yml`
(`AssistantVirtualAI/ava-softphone-releases`); `electron-updater` reads
from the same release for silent background updates.

## Project layout

```
electron/
  main.ts            # BrowserWindow, IPC, auto-updater
  preload.ts         # contextBridge → window.electronAPI
  tray.ts            # System tray + status submenu
  notifications.ts   # Native OS notifications
  updater.ts         # electron-updater wiring
src/
  App.tsx            # Reuses softphone React components
  index.tsx          # Renderer entrypoint
  components/
    TitleBar.tsx     # Custom frameless titlebar
    SetupWizard.tsx  # First-launch 3-step wizard
    SettingsPage.tsx # Account / Audio / Notifications / General / About
assets/              # icon.png, icon.ico, icon.icns, tray icons
build/
  electron-builder.yml
  entitlements.mac.plist
```

## Credentials

On first launch the Setup Wizard signs the user into the AVA portal
(`https://avastatistic.ca`) and fetches their extension + SIP credentials
from `pbx_softphone_users` via Supabase. Credentials are persisted in
`electron-store` (encrypted on disk) and reused on subsequent launches.

## White-label

Replace `assets/icon.*`, `appId`, `productName`, `publisherName`, and the
`publish.*` block in `build/electron-builder.yml` to rebrand. No code
changes required.
