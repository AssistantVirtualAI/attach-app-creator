# AVA Softphone — Store Release Checklist

## 1. Version
- Bump `package.json` version (semver).
- iOS: increase `CFBundleShortVersionString` + `CFBundleVersion`.
- Android: bump `versionName` + `versionCode` in `android/app/build.gradle`.

## 2. Build
```bash
cd apps/ava-softphone-mobile
npm install
npm run build           # vite build → dist/
npx cap sync ios        # or android
```

## 3. iOS — App Store Connect
1. Open `ios/App` in Xcode.
2. Merge `native-config/ios-Info.plist.snippet.xml` into `App/App/Info.plist`.
3. Enable capabilities: Background Modes (Audio/VoIP, Remote notifications, Background fetch), Push Notifications.
4. Set Bundle ID `com.lemtel.softphone` and team.
5. Archive → Distribute → App Store Connect.
6. In App Store Connect:
   - Use `store-metadata/ios/metadata.txt` (EN) and `metadata-fr.txt` (FR).
   - Upload screenshots from `store-metadata/screenshots/ios/{en,fr}/`.
   - Demo account: extension `999` / sandbox tenant (see Notion).
   - App Privacy → check Data Collected (Microphone, Contacts, Account info).
   - Export Compliance → uses standard encryption only, no submission required.
   - Submit for review.

## 4. Android — Play Console
1. Build signed AAB:
   ```bash
   cd android && ./gradlew bundleRelease
   ```
2. Merge `native-config/android-AndroidManifest.snippet.xml` into `app/src/main/AndroidManifest.xml`.
3. Upload AAB to Play Console (Internal track first).
4. Fill Store Listing using `store-metadata/android/metadata.txt` (EN) + `metadata-fr.txt` (FR).
5. Upload screenshots from `store-metadata/screenshots/android/{en,fr}/`.
6. Complete Data Safety form (see metadata file for mapping).
7. Promote internal → closed → production.

## 5. Compliance preflight
- [ ] Privacy Policy live at https://avastatistic.ca/privacy
- [ ] Terms of Service live at https://avastatistic.ca/terms
- [ ] In-app Account Deletion accessible (More → Delete my account)
- [ ] Push notifications opt-in prompt fires on first launch
- [ ] All permission usage strings match `native-config/*` snippets
- [ ] Reviewer demo account works on the published Lovable Cloud backend
- [ ] Security scan passes (run via lovable security scan)
