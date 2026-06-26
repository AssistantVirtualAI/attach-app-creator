# iOS Rebuild & Reinstall Checklist

Use this checklist **every time** native Swift/Objective-C files under
`apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/` change. Skipping a
step is the #1 reason "the fix didn't take" — the device keeps running the
previous binary because Xcode reuses cached build products and the installed
app on the device.

> ⚠️ JavaScript/TypeScript changes hot-reload over Vite. Native Swift changes
> require a **full rebuild + reinstall**.

## 0. Confirm the fix is on `main`
```bash
git pull --rebase
git log -1 --stat apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/
```
The latest commit must show the file you expect (e.g. `RTPAudioSession.swift`).

## 1. Install JS dependencies (only if `package.json` changed)
```bash
cd apps/ava-softphone-mobile
npm install
```

## 2. Build the web bundle
```bash
npm run build
```
Vite must finish with **no errors**. If the build is red, fix it before
touching Xcode — `cap sync` will copy a broken bundle otherwise.

## 3. Sync Capacitor → iOS
```bash
npx cap sync ios
```
Confirm the output lists:
- `✔ Copying web assets`
- `✔ Updating iOS plugins`
- `✔ Sync finished`

If Swift files were added/removed, also run:
```bash
npx cap update ios
```

## 4. Open the workspace (NOT the project)
```bash
npx cap open ios
```
Xcode must open `App.xcworkspace`. Opening `App.xcodeproj` skips CocoaPods
and the build will fail to link Capacitor.

## 5. Purge Xcode caches
In Xcode:
1. **Product → Clean Build Folder** (⇧⌘K).
2. Quit Xcode.
3. Wipe DerivedData:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
   ```
4. Reopen `App.xcworkspace`.

This guarantees Swift sources are recompiled from scratch — without it Xcode
can silently reuse a stale `.o` for `RTPAudioSession.swift`.

## 6. Remove the previous app from the device
On the iPhone/iPad:
1. Long-press the app icon → **Remove App → Delete App**.
2. **Settings → General → VPN & Device Management** → confirm the dev profile is still trusted.

Deleting the app drops the old bundle, NSUserDefaults cache, and any pinned
AVAudioSession state from previous runs.

## 7. Build & run on device
1. Select your physical iPhone in the Xcode scheme target.
2. **Product → Run** (⌘R).
3. Watch the **Devices and Simulators** console (⇧⌘2) or `Console.app` filtered
   by process name `App` for `[RTP]`, `[SIP]`, `[CapacitorSip]` log lines.

Expected log sequence on the first call after a successful audio fix:
```
[RTP] bound UDP fd=… port=… ip=…
[RTP] session[pre-start] cat=… mode=…
[RTP] setCategory playAndRecord/voiceChat ok …
[RTP] sleeping 100ms after setCategory to let session settle
[RTP] session[post-settle] cat=AVAudioSessionCategoryPlayAndRecord mode=AVAudioSessionModeVoiceChat sr=48000 …
[RTP] engine reset before prepare
[RTP] hw input format=F32 48000Hz ch=1 …
[RTP] converter init #1 F32 48000Hz → I16 8000Hz
[RTP] tap installed (format=nil, native bus0)
[RTP] audio engine started, route=…
```

If you see `engine start failed: code=561017449` again, the build did **not**
include the fix — restart at step 5.

## 8. Verify the fix on device
- Place an outbound call: you should hear ringback + remote audio, and the
  remote side should hear you.
- Toggle **Record** during the call — UI flips to "Stop Rec" and the device logs
  `recordingChanged recording=true`.
- Toggle **Hold** → **Resume** — no infinite re-INVITE loop, `holdChanged`
  events match the UI state.

## 9. (Optional) Archive for TestFlight
Only after all the above pass:
- **Product → Archive** → Distribute App → TestFlight Internal.
- Bump build number in `App/Info.plist` to avoid TestFlight rejection.

---

### Quick "fix didn't ship" diagnostic
| Symptom on device                         | Likely missed step |
| ----------------------------------------- | ------------------ |
| Old log lines, no new `[RTP] session[…]`  | Step 5 (clean build folder / DerivedData) |
| `cap sync` says "0 files copied"          | Step 2 (web bundle not rebuilt) |
| Swift compile error about missing symbol  | Step 3 (`cap update ios`) |
| App crashes immediately on launch         | Step 6 (delete app, reinstall) |
| Build succeeds but audio still broken     | Wrong scheme/target — check you ran on the **physical device**, not the simulator |
