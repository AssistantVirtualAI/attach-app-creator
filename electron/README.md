# AVA Statistic / Lemtel Desktop App

Native desktop shell that loads the production portal at https://avastatistic.ca,
so the desktop app exposes the exact same pages, navigation and login as the web
portal.

## Build (Linux)

```bash
npm install --save-dev electron @electron/packager
npx @electron/packager . "AVA-Statistic" \
  --platform=linux --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/supabase' \
  --ignore='^/electron-release'
```

## Build for macOS / Windows

Replace `--platform=linux` with `--platform=darwin` or `--platform=win32`.

## Run in dev

```bash
PORTAL_URL=https://id-preview--d91c2598-79a6-408e-9f03-52317572ea4c.lovable.app \
  npx electron electron/main.cjs
```

`PORTAL_URL` can be pointed at the preview build to test before shipping.
