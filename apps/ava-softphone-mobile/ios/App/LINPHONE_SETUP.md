# Linphone SDK Setup (Swift Package Manager)

The native SIP backend (`CapacitorPjsip`) uses [linphone-sdk](https://gitlab.linphone.org/BC/public/linphone-sdk-swift-ios)
via Swift Package Manager. CocoaPods is no longer used for SIP.

## 1. Add the Swift Package in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Menu **File → Add Package Dependencies…**
3. Paste the package URL:
   ```
   https://gitlab.linphone.org/BC/public/linphone-sdk-swift-ios.git
   ```
4. **Dependency Rule**: *Up to Next Major Version* — `5.3.0` (recommended stable).
   - If 5.3 is unavailable in your Xcode, fall back to `5.2.x`.
5. Click **Add Package**.
6. In the products screen, check **`linphonesw`** and assign it to the **`App`** target.

## 2. Build settings

No bridging header is required (Linphone Swift module is imported directly with
`import linphonesw`). The previous `App-Bridging-Header.h` has been removed.

Minimum iOS deployment target: **13.0** (already set in `Podfile`).

## 3. Sync & build

```bash
cd apps/ava-softphone-mobile
npm install
npx cap sync ios
cd ios/App
pod install
open App.xcworkspace
```

Then build the `App` scheme for a real device (Linphone SDK does not run in the
iOS simulator).

## 4. Enable native SIP

Once the build succeeds and you've verified registration in Xcode logs, set:

```
# apps/ava-softphone-mobile/.env.local
VITE_NATIVE_SIP=true
```

Rebuild the JS layer (`npm run build` + `npx cap sync ios`) to ship the change.

## 5. Troubleshooting

- **`No such module 'linphonesw'`** — the package wasn't added to the `App`
  target. Re-open *File → Add Package Dependencies* and tick the target.
- **Audio session conflicts** — Linphone manages `AVAudioSession`; remove any
  duplicate `setActive(true)` calls from other plugins if you see route errors.
- **Registration stays `Progress`** — check the WSS URL (must be
  `wss://host:port`) and that the SIP server certificate is trusted.
