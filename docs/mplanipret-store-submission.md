# Planiprêt Mobile — App Store & Google Play submission guide

This document explains how to publish the `/mplanipret` mobile experience as a native
app for **iOS App Store** and **Google Play Store**. The web app is wrapped with
**Capacitor** (already configured in `capacitor.config.ts`).

---

## 1. Pre-flight (already done in this repo)

- ✅ Bilingual UI (FR / EN) with in-app language switcher
- ✅ Light / Dark theme switcher
- ✅ Profile drawer with availability status, password change, sign-out
- ✅ Privacy consent gate + onboarding tutorial
- ✅ `Info.plist` mic / network usage descriptions
- ✅ `PrivacyInfo.xcprivacy` declaration
- ✅ Independent auth flow — no admin-portal redirects
- ✅ Footer "POWERED BY AVA · DEVELOPED BY AVA"

---

## 2. Build the native shells

```bash
# 1. Build the web bundle
bun run build

# 2. Sync to iOS + Android Capacitor projects
npx cap sync ios
npx cap sync android

# 3. Open in Xcode / Android Studio
npx cap open ios
npx cap open android
```

---

## 3. App Store (iOS)

### Bundle identifier
- iOS: `ca.avastatistic.planipret.mobile`

### Required metadata (App Store Connect)
| Field | Value |
|---|---|
| App name | **Planiprêt — Broker Mobile** |
| Subtitle (FR) | Espace courtier mobile sécurisé |
| Subtitle (EN) | Secure mobile broker workspace |
| Primary category | Business |
| Secondary category | Finance |
| Age rating | 4+ |
| Privacy URL | https://planipret.com/privacy |
| Support URL | https://planipret.com/support |

### Required screenshots (per locale FR & EN)
- 6.7" iPhone — 1290 × 2796 (3 minimum)
- 6.5" iPhone — 1284 × 2778 (3 minimum)
- 5.5" iPhone — 1242 × 2208 (3 minimum)
- 12.9" iPad Pro — 2048 × 2732 (only if iPad is supported)

Capture these from `/mplanipret/home`, `/mplanipret/calls`, `/mplanipret/messages`,
and the dialer + AVA chat sheet.

### App Privacy answers (iOS Privacy "nutrition" label)
Declare the following data types collected and **linked to identity**:
- Contact info → Name, Email, Phone number (account)
- Identifiers → User ID
- Usage data → Product interaction (analytics)
- Audio data → Voice recordings (only when broker presses Record)
- Diagnostics → Crash data, performance

Mark all as **used for App Functionality** only. None used for tracking.

### Required Info.plist usage strings (already in the project)
- `NSMicrophoneUsageDescription`
- `NSCameraUsageDescription` (avatar selection)
- `NSContactsUsageDescription`
- `NSLocalNetworkUsageDescription`
- `NSUserTrackingUsageDescription` → set to a sentence stating we do **not** track.

### Encryption export compliance
Set `ITSAppUsesNonExemptEncryption` = **NO** in `Info.plist` (we only use standard
HTTPS + Supabase TLS).

### TestFlight
1. Archive in Xcode → Distribute App → App Store Connect → Upload.
2. Add an Internal testing group with all Planiprêt admins.
3. Submit for App Store review once internal QA is signed off.

---

## 4. Google Play (Android)

### Application id
`ca.avastatistic.planipret.mobile`

### Store listing
| Field | Value |
|---|---|
| App name | **Planiprêt — Broker Mobile** |
| Short description (FR) | Espace courtier mobile sécurisé |
| Short description (EN) | Secure mobile broker workspace |
| Category | Business |
| Content rating | Everyone |
| Privacy policy URL | https://planipret.com/privacy |

### Required visual assets
- Adaptive icon — 512 × 512 PNG
- Feature graphic — 1024 × 500 PNG
- Phone screenshots — at least 2, 1080 × 1920 (FR + EN)
- 7" tablet — at least 1
- 10" tablet — at least 1

### Data safety form (Google Play Console)
Declare the same categories as the iOS Privacy section.
- Data is **collected** and **encrypted in transit** ✅
- Users **can request deletion** ✅ via support@avastatistic.ca

### Permissions
- `RECORD_AUDIO` — for VoIP calls and on-demand recording
- `READ_CONTACTS` — to populate the contacts tab
- `INTERNET` — required for Supabase and SIP
- `POST_NOTIFICATIONS` (Android 13+) — for inbound call / message alerts

### Closed testing
1. `./gradlew bundleRelease` → upload `.aab` to Internal testing.
2. Promote to Closed testing for Planiprêt brokers.
3. Promote to Production after sign-off.

---

## 5. QA checklist before submission

- [ ] Switch language FR ↔ EN — every visible string updates.
- [ ] Switch theme Light ↔ Dark — frame, header, tabbar, profile sheet all adapt.
- [ ] Profile drawer: change status (Available, Busy, Break, Offline) — color dot updates header avatar in real time.
- [ ] Profile drawer: change password — toast confirms, you can log out and log back in with the new password.
- [ ] Sign out from drawer — returns to the `MobileAuthScreen` (no redirect to `/planipret/admin`).
- [ ] Forgot password sends reset email.
- [ ] Tap the legal links — bottom sheet opens with TOS / Privacy text in the chosen language.
- [ ] Install on a real iPhone + Android device, place a call, receive a call, record, listen to the recording.

---

## 6. Versioning

Bump `version` in `package.json`, `CFBundleShortVersionString` (iOS), and
`versionName` (Android) together. Use semver (`1.0.0`, `1.1.0`, …).

---

Maintainer: **AVA Statistic** — support@avastatistic.ca
