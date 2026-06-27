# Apple App Store Review Checklist — AVA Softphone

Last reviewed: 2026-06-27

## 1. Privacy & permissions
- [x] `NSMicrophoneUsageDescription` (FR + EN)
- [x] `NSContactsUsageDescription` (FR + EN)
- [x] `NSPhotoLibraryUsageDescription` (FR + EN)
- [x] `NSLocalNetworkUsageDescription` + `NSBonjourServices` (SIP)
- [x] `NSUserNotificationsUsageDescription`
- [x] `PrivacyInfo.xcprivacy` with declared data types + required-reason API codes
- [x] `ITSAppUsesNonExemptEncryption = false`
- [x] No `NSCameraUsageDescription` (no video calls in v1)

## 2. Account
- [x] Email / SIP credential sign-in
- [x] In-app **Delete my account** flow (Settings → Account)
- [ ] Apple Sign In — N/A in v1 (app does not offer third-party sign-in such as Google/Facebook). Re-evaluate if Google sign-in is added.

## 3. Background & calling
- [x] Background mode: `audio`, `remote-notification`
- [ ] `voip` background mode — **deferred to v1.1** (requires PushKit + CallKit). v1 = foreground-only incoming calls.
- [x] Local notifications surface missed calls, voicemails, SMS

## 4. Call recording compliance
- [x] Audible beep + spoken consent notice played before recording starts (`playRecordingConsent`)
- [x] User-facing toggle "Announce recording" (defaults ON) in Settings
- [x] Privacy policy describes recording, storage, retention

## 5. Legal & support URLs
- App must show in-app links to all four:
  - Privacy Policy: https://avastatistic.ca/privacy
  - Terms of Service: https://avastatistic.ca/terms
  - Support: https://avastatistic.ca/support
  - Account deletion: in-app Settings → Account → Delete my account

## 6. App Store Connect metadata
- [ ] App name (≤30), subtitle (≤30), promo text (≤170), description (≤4000), keywords (≤100)
- [ ] Screenshots: 6.7" (1290×2796) + 6.5" (1284×2778), FR + EN
- [ ] App preview video (optional)
- [ ] Primary category: Business · Secondary: Productivity
- [ ] Age rating questionnaire completed (Unrestricted Web Access = No)
- [ ] Content rights confirmation
- [ ] Export compliance = Standard encryption only

## 7. Assets
- [ ] `AppIcon.appiconset` complete, 1024×1024 marketing icon (no alpha, no rounded corners)
- [x] `LaunchScreen.storyboard` — logo only, no marketing copy

## 8. Pre-submission QA
1. Fresh install → sign in → make outbound call → audio both ways
2. Receive missed call → lock-screen banner
3. Receive voicemail → banner; tap opens voicemail
4. Receive SMS → banner with preview; tap opens thread
5. Switch WiFi ↔ LTE during call → no drop
6. Delete account → user removed, cannot re-sign in
7. App backgrounded 10 min → re-register works on resume
8. Cold start with airplane mode → no crash
9. VoiceOver labels on dial pad, answer, hangup
10. Start recording → consent beep + voice notice play
