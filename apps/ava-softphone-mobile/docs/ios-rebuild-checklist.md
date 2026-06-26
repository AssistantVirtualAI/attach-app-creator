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

Before opening Xcode, verify the native audio file is really the RemoteIO build:
```bash
grep -En "AVAudioEngine|AVAudioPlayerNode|installTap|removeTap" \
  ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift && \
  echo "❌ stale AVAudioEngine code still present" || \
  echo "✅ RemoteIO-only: no AVAudioEngine/tap references"

grep -n "kAudioUnitSubType_RemoteIO" \
  ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift
```

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
[RTP] session[post-settle] cat=AVAudioSessionCategoryPlayAndRecord mode=AVAudioSessionModeVoiceChat sr=…
[RTP] RemoteIO build begin
[RTP] RemoteIO component found
[RTP] RemoteIO instance created
[RTP] RemoteIO input enabled bus=1
[RTP] RemoteIO output enabled bus=0
[RTP] RemoteIO input callback format=I16 8000Hz ch=1 framesPerPacket=1
[RTP] RemoteIO render format=I16 8000Hz ch=1 framesPerPacket=1
[RTP] RemoteIO render callback installed bus=0
[RTP] RemoteIO input callback installed bus=1
[RTP] AudioUnitInitialize ok
[RTP] AudioOutputUnitStart begin
[RTP] RemoteIO started, route=…
[RTP] input callback #1 frames=… micPeak=… txPackets=…
[RTP] render callback #1 frames=… playQueue=… rxPackets=…
```

If you see `AVAudioEngine`, `AVAudioPlayerNode`, `installTap`, `removeTap`, or
`engine start failed: code=561017449` again, the device is running a stale native
binary — restart at step 5 and delete the app before reinstalling.

## 8. Verify the fix on device
- Place an outbound call: you should hear ringback + remote audio, and the remote side should hear you.
- Place an inbound call and answer: confirm two-way audio again.
- Watch `[RTP] input callback` logs: `micPeak` should rise when you speak and `txPackets` should increase.
- Watch `[RTP] rx packet` + `[RTP] render callback` logs: `rxPackets` should increase while the remote talks and `rxPeak` should rise.
- Toggle **Record** during the call — UI flips to "Stop Rec" and the device logs `recordingChanged recording=true`.
- Toggle **Hold** → **Resume** — the button returns to **Hold**, no infinite re-INVITE loop, and `holdChanged` events match the UI state.
- Deny microphone permission on a test install: the app must show a readable microphone-required error and must not start a call.

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
