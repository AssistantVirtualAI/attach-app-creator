# Planiprêt Mobile — Standalone Capacitor App

Bundle ID: `com.planipret.mobile`
App name: Planiprêt Mobile

## Quickstart

```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
cd ios/App && pod install && cd ../..
npx cap open ios
```

Android:
```bash
npx cap add android
npx cap sync android
npx cap open android
```

## Notes

- Fully standalone — no WebView shell. React Router serves `/login` → `/home` and the mobile pages.
- Supabase Edge Functions are called via `@supabase/supabase-js` against the shared backend.
- `@capacitor-community/bluetooth-le@4.x` is pinned for Capacitor 6 compatibility.
