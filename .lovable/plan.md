# Apple App Store Compliance Plan — AVA Softphone Mobile

Goal: make `apps/ava-softphone-mobile` pass Apple's App Review (Guidelines 2.1, 2.5, 3.1, 4.0, 5.1.1, 5.1.5) and be fully deployable to TestFlight + the App Store.

## 1. Info.plist — required keys & usage strings

Update `apps/ava-softphone-mobile/ios/App/App/Info.plist` to match what the app actually does. Apple rejects vague or missing strings.

- `NSMicrophoneUsageDescription` — clear French + English copy (calls).
- `NSContactsUsageDescription` — only if Contacts screen is shipped; otherwise remove the import.
- `NSCameraUsageDescription` — remove if no video call in v1 (avoid rejection for unused permission).
- `NSPhotoLibraryUsageDescription` — keep only if avatar upload ships.
- `NSUserTrackingUsageDescription` — add only if any analytics SDK is added; otherwise omit.
- `NSLocalNetworkUsageDescription` + `NSBonjourServices` — keep (SIP).
- `NSFaceIDUsageDescription` — add if biometric unlock is enabled.
- `NSSpeechRecognitionUsageDescription` — remove unless on-device speech is used (transcription runs server-side).
- `ITSAppUsesNonExemptEncryption` = `false` (calls use standard HTTPS/SRTP via system libs).
- `UIBackgroundModes`: `audio`, `voip`, `remote-notification`. Remove `voip` if not using PushKit/CallKit — Apple rejects unused VoIP background mode (see §3).
- `UIRequiresPersistentWiFi` = true.
- `LSApplicationQueriesSchemes`: `tel`, `sms`, `mailto` (used by click-to-call fallbacks).
- `CFBundleDisplayName` = "AVA Softphone", `CFBundleShortVersionString` = 1.0.0, `CFBundleVersion` auto-bumped by CI.

## 2. CallKit + PushKit (required for VoIP background)

Apple Guideline 4.5 / iOS 13+: VoIP apps **must** use CallKit + PushKit when receiving calls while backgrounded; plain background mode `voip` without PushKit is grounds for rejection.

- Add native module `CallKitBridge.swift` (CXProvider + CXCallController) wired to `CapacitorSip` events (`incomingCall`, `callEnded`, `callAnswered`).
- Add `PushKitBridge.swift` registering for `PKPushTypeVoIP` and forwarding the push to FusionPBX REGISTER refresh + display incoming UI via CallKit.
- Backend: extend `mobile-push-token` edge function (create if missing) to store the VoIP push token per `pbx_extensions` row, and add edge function `pbx-voip-push` that the SIP server hits before INVITE to wake the device.
- If we ship v1 **without** PushKit, remove `voip` from `UIBackgroundModes` and document that incoming calls only work while app is foregrounded — safer for first submission.

## 3. Privacy Manifest (`PrivacyInfo.xcprivacy`) — mandatory since May 2024

Add `apps/ava-softphone-mobile/ios/App/App/PrivacyInfo.xcprivacy` declaring:

- `NSPrivacyCollectedDataTypes`: Contact Info (email, phone), Identifiers (User ID), Audio Data (calls), Customer Support, Diagnostics.
- `NSPrivacyTracking` = false (we do not track across apps).
- `NSPrivacyAccessedAPITypes` — required reason codes for: `UserDefaults` (CA92.1), `FileTimestamp` (C617.1), `SystemBootTime` (35F9.1), `DiskSpace` (E174.1). Capacitor uses these.
- Mirror declarations in App Store Connect "Privacy Details".

## 4. Sign in with Apple (Guideline 4.8)

Because the app offers third-party sign-in (Google) and account creation, Apple **requires** Sign in with Apple as an equivalent option.

- Enable Apple provider in Lovable Cloud auth (managed mode is fine for v1).
- Add `signInWithApple()` button in `SignInScreen` with the official Apple button styling.
- Capability: add "Sign in with Apple" in the Xcode project entitlements.

## 5. Account deletion (Guideline 5.1.1(v))

Already exists: `mobile-delete-account` edge function. Surface it visibly:

- `SettingsScreen` → "Delete my account" row (red), confirmation dialog, calls `mobile-delete-account`, signs out, clears Keychain + LocalNotifications.
- Add the same link in store listing's Support URL page.

## 6. Permissions UX

- Defer mic prompt to first dial attempt (not at launch).
- Defer notification prompt to first successful sign-in (already done in `useDeviceNotifications`).
- Add an in-app "Permissions" screen under Settings to re-open iOS Settings if any are denied.

## 7. Legal & required URLs

Already live at `avastatistic.ca`. Verify and link from app + App Store Connect:

- Privacy Policy: `https://avastatistic.ca/privacy` — must mention call recording, transcription (server-side AI), data retention, account deletion link, contact email.
- Terms of Service: `https://avastatistic.ca/terms` — required because of in-app paid features / subscriptions if any.
- Support URL: `https://avastatistic.ca/support` (create page if missing) with email + delete-account link.
- Marketing URL: optional.
- EULA: use Apple's standard EULA unless custom needed.

Add an in-app "About / Legal" row linking to Privacy + Terms (Guideline 5.1.1 requires in-app access).

## 8. Call recording compliance

iOS rejects recording without consent.

- Before starting a recording, play a French + English beep and TTS notice ("This call is being recorded").
- Add a setting toggle "Announce recording" defaulted ON, disabled-with-warning if user turns off.
- Privacy policy must describe storage, retention, who can access recordings.

## 9. App Store Connect metadata

Files already in `apps/ava-softphone-mobile/store-metadata/ios/`. Verify each:

- App name (30 chars), subtitle (30 chars), promotional text (170), description (4000), keywords (100), what's new.
- Screenshots: 6.7" iPhone (1290×2796) and 6.5" iPhone (1284×2778) at minimum; 5.5" no longer required. Include localized French set.
- App preview video (optional but recommended for VoIP).
- Category: Primary = Business, Secondary = Productivity.
- Age rating questionnaire — answer "Unrestricted Web Access" = No (we do not embed a browser).
- Content rights: confirm we own AVA logo / brand.
- Export compliance: standard encryption only → `ITSAppUsesNonExemptEncryption=false`.

## 10. App icons & launch screen

- Provide complete `AppIcon.appiconset` (all sizes incl. 1024×1024 marketing icon — no alpha, no rounded corners).
- `LaunchScreen.storyboard` with AVA logo on `#0A1429` background, no text (Apple rejects launch screens with marketing copy).

## 11. Capabilities & entitlements

In Xcode target:

- Push Notifications.
- Background Modes: Audio, VoIP (only if PushKit shipped), Remote notifications.
- Sign in with Apple.
- Associated Domains (for universal links to `avastatistic.ca` deep links) — optional v1.
- Keychain Sharing — only if extension sharing tokens.

## 12. Build & release pipeline

- Bump `MARKETING_VERSION` 1.0.0, `CURRENT_PROJECT_VERSION` 1.
- `apps/ava-softphone-mobile/RELEASE.md` updated with: `npm install` → `npm run build` → `npx cap sync ios` → open Xcode → Archive → upload to TestFlight.
- Add `scripts/ios-release.sh` wrapping the above and running `validate-ios-launch.sh`.
- Enable App Store Connect API key in CI (optional v2).

## 13. Pre-submission QA checklist

Add `apps/ava-softphone-mobile/docs/app-store-review-checklist.md`:

1. Fresh install → onboarding → sign-in (email, Google, Apple).
2. Grant mic on first dial; verify outbound + inbound audio both ways.
3. Receive missed call → lock-screen banner shows.
4. Receive voicemail → banner shows; tap opens voicemail tab.
5. Receive SMS → banner with preview; tap opens thread.
6. Switch WiFi ↔ LTE during call → no drop.
7. Account deletion flow → user removed, can't sign back in with same creds.
8. App backgrounded for 10 min → re-register works.
9. No crash on cold start without network.
10. VoiceOver labels on all primary buttons (dial pad, answer, hangup).

## 14. What to send the user once shipped to TestFlight

Generate a one-page summary with: TestFlight invite link, what to test, known limitations (e.g. v1 = foreground-only calls if no PushKit), feedback email.

---

## Technical details

- Files to add: `ios/App/App/PrivacyInfo.xcprivacy`, `ios/App/CallKitBridge.swift`, `ios/App/PushKitBridge.swift`, `src/screens/PermissionsScreen.tsx`, `src/lib/recordingConsent.ts`, `docs/app-store-review-checklist.md`, `scripts/ios-release.sh`.
- Files to edit: `ios/App/App/Info.plist`, `MobileApp.tsx` (Apple sign-in button, About/Legal row, Delete account row), `SettingsScreen.tsx`, `useSoftphoneNative.ts` (CallKit hooks), `RELEASE.md`.
- Edge functions to add/extend: `mobile-push-token` (store VoIP token), `pbx-voip-push` (server-initiated push), audit log for account deletions already covered.
- No DB schema change required beyond an optional `pbx_extensions.voip_push_token` column.

## Out of scope (call out before build)

- iPad-optimized layouts.
- Apple Watch companion.
- CarPlay integration.
- In-app purchases / subscriptions (would trigger Guideline 3.1.1 + StoreKit work).

## Open questions

1. Ship PushKit/CallKit in v1, or submit foreground-only and add in v1.1? PushKit doubles iOS work but is needed for "real" softphone background calls.
2. Is `avastatistic.ca/support` page live, or should it be created as part of this plan?
3. Is the Apple Developer account already enrolled with the bundle ID `com.lemtel.softphone` provisioned?
