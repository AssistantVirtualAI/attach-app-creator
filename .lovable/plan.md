# AVA Softphone Mobile — Publish-Ready Plan

## 1. Store compliance (privacy-by-design)
- New screens under `apps/ava-softphone-mobile/src/screens/`:
  - `PrivacyScreen.tsx` — plain-language data handling summary + link to `avastatistic.ca/privacy`.
  - `DataSafetyScreen.tsx` — list of data types collected/shared (matches Play Data Safety form & Apple Nutrition Label).
  - `PermissionsScreen.tsx` — explains why mic/contacts/notifications are requested, with toggles to re-prompt.
  - `SupportScreen.tsx` — in-app support: email `support@avastatistic.ca`, phone, "Send diagnostic" button, FAQ.
  - Extend existing `DeleteAccountScreen.tsx` with confirmation + reason.
- Add entries in `MoreScreen.tsx`: Privacy, Data Safety, Permissions, Support, Delete account, Terms, About (version + build).
- Add consent gate on first launch (mic + analytics opt-in) stored in Capacitor Preferences.

## 2. Background / automatic sync
- New `apps/ava-softphone-mobile/src/lib/backgroundSync.ts` using `@capacitor/background-runner` (iOS BGTaskScheduler / Android WorkManager) to refresh every ~15 min:
  - call history, queues, voicemail, recordings.
- Extend `useAutoSync.ts`:
  - foreground resume sync (already present),
  - listen to push/silent notifications to trigger immediate refresh,
  - exponential backoff on failure.
- Add Capacitor plugins: `@capacitor/background-runner`, `@capacitor/push-notifications`, `@capacitor/local-notifications`.
- Update `capacitor.config.ts` with BackgroundRunner config (`event: 'syncPbx'`, interval 15m).
- Update `native-config/ios-Info.plist.snippet.xml`: add `UIBackgroundModes` = `fetch`, `processing`, `remote-notification`, `voip`; add `BGTaskSchedulerPermittedIdentifiers` for `com.lemtel.softphone.sync`.
- Android: add `FOREGROUND_SERVICE`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` permissions snippet in `native-config/android-manifest.snippet.xml`.

## 3. Dialer FAB above bottom tab bar
- New `apps/ava-softphone-mobile/src/components/DialerFab.tsx` — circular keypad button, fixed `bottom: calc(tabbar + 16px)`, right-aligned, opens existing keypad modal.
- New `apps/ava-softphone-mobile/src/components/DialerSheet.tsx` — full-screen modal with 0-9, *, #, +, backspace, call button (wires to existing `mobileApi.placeCall`).
- Mount FAB in `MobileApp.tsx` so it appears on every tab.

## 4. Screenshots (for store listings)
- Use Playwright + preview at mobile viewports required by stores:
  - iPhone 6.7" (1290×2796) and 6.5" (1242×2688)
  - Android phone (1080×1920)
- Capture: Home, Calls, Dashboard, AVA Chat, Queues, Recordings, Dialer, More — EN and FR.
- Save under `/mnt/documents/store-screenshots/{ios,android}/{en,fr}/*.png`.
- Emit `<presentation-artifact>` tags for each.

## 5. Publish PDF guide
- Generate `/mnt/documents/AVA-Softphone-Publish-Guide.pdf` with reportlab containing:
  - App identity: name, bundle ID `com.lemtel.softphone`, version, icons.
  - Apple App Store: Connect setup, certificates, capabilities (Push, VoIP, Background Modes), TestFlight, review notes (demo account), export compliance, age rating, privacy nutrition label answers.
  - Google Play: Console setup, signing key, Data Safety form answers, content rating questionnaire, target API, permissions justification.
  - Required assets checklist: icons (1024, 512), feature graphic, screenshots list with sizes.
  - Legal URLs: privacy, terms, support.
  - Build & submit commands (`npx cap sync`, archive in Xcode, AAB in Android Studio).
  - EN + FR store copy (pulled from `store-metadata/`).
- Visual QA each page via pdftoppm.

## Files to create/edit
Create: `screens/PrivacyScreen.tsx`, `DataSafetyScreen.tsx`, `PermissionsScreen.tsx`, `SupportScreen.tsx`; `components/DialerFab.tsx`, `DialerSheet.tsx`; `lib/backgroundSync.ts`; `native-config/android-manifest.snippet.xml`; scripts `scripts/capture-screenshots.mjs`, `scripts/build-publish-pdf.py`.
Edit: `MobileApp.tsx`, `MoreScreen.tsx`, `DeleteAccountScreen.tsx`, `useAutoSync.ts`, `capacitor.config.ts`, `ios-Info.plist.snippet.xml`, `package.json`.

## Out of scope
- Actual store submission, paid developer accounts, real signing keys.
- New backend features beyond what mobile screens consume.
