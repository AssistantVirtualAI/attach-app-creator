# AVA Statistic Desktop App (Electron)

The desktop app is a thin native shell that loads the same portal users see in the
browser. **Every page available in the portal is automatically available in the
desktop app** — there is no separate codebase. New admin pages (Sync Health, SIP
Profiles, Dialplans, Feature Codes, Call Forwarding, Recording Rules, Voicemail
Settings, Conferences, Hold Music, Time Conditions, Destinations) appear in the
desktop app on next launch with no rebuild required.

## Files

- `electron/main.cjs` — main process (window, permissions, deep-link routing).

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORTAL_URL` | `https://avastatistic.ca` | Portal origin to load. Set to a staging URL to test pre-prod builds. |
| `DEV_TOOLS` | _(off)_ | Set to `1` to auto-open DevTools. |

## Permissions auto-granted

- microphone / camera (softphone, video, conferences)
- notifications (incoming calls, mentions)
- clipboard read/write
- `display-capture` (screen share inside conferences)

## Deep links

The app registers the `avastatistic://` protocol. Examples:

- `avastatistic://lemtel/admin/sync-health`
- `avastatistic://lemtel/admin/dialplans`
- `avastatistic://lemtel/admin/sip-profiles`

Clicking such a link from any browser/email opens the desktop app on that route.

## Packaging

```bash
npm install --save-dev electron @electron/packager

# Linux x64
npx @electron/packager . "AVA Statistic" --platform=linux --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'

# macOS x64 (zip — .dmg requires macOS host)
npx @electron/packager . "AVA Statistic" --platform=darwin --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'

# Windows x64
npx @electron/packager . "AVA Statistic" --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'
```

Then archive: `tar czf AVA-linux.tar.gz -C electron-release "AVA Statistic-linux-x64"`.
