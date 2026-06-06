# Lemtel Telecom — Mobile (Capacitor)

iOS + Android wrapper for the Lemtel softphone. Shares the proven SIP/WebRTC
logic (`useSoftphone`) with the Electron desktop app via path alias.

## Stack
- Vite + React 18 + TypeScript
- Capacitor 6 (iOS + Android)
- JsSIP for SIP/WebRTC
- Supabase for auth + state

## Install
```bash
cd apps/ava-softphone-mobile
npm install
```

## Add native platforms (one-time, requires Xcode / Android Studio)
```bash
npm run cap:add:ios
npm run cap:add:android
```

Then merge `native-config/ios-Info.plist.snippet.xml` into `ios/App/App/Info.plist`,
and drop your real Firebase `google-services.json` into `android/app/`
(see `native-config/android-google-services.placeholder.json`).

## Build & open native projects
```bash
npm run build:ios       # vite build + cap sync + open Xcode
npm run build:android   # vite build + cap sync + open Android Studio
```

## Sync only (after JS changes)
```bash
npm run sync:ios
npm run sync:android
```

## Dev (web preview in browser)
```bash
npm run dev
```

## Store metadata
See `store-metadata/ios/metadata.txt` and `store-metadata/android/metadata.txt`.

## Notes
- App ID: `com.lemtel.softphone`
- App Name: **Lemtel Telecom**
- The mobile UI is touch-optimized with iOS-style bottom tabs, large dialpad
  buttons, haptics, safe-area insets, and a full-screen active call sheet.
- Auth uses the existing `softphone-auth` Supabase edge function.
