# Native SIP/TLS plugin (no WebRTC) — like Ringotel

Abandon JsSIP/WebRTC/TURN/mDNS path on iOS. Replace the existing `CapacitorPjsip` (Linphone) native bridge with a new `CapacitorSip` plugin that opens a raw TLS socket to `pbxnode.lemtel.tel:5061` via Apple's `Network.framework` and speaks SIP directly. JsSIP stays only as a web fallback.

## Files to create

1. **`apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift`** — Swift plugin from the prompt:
   - `NWConnection` with `NWParameters.tls` to host:5061
   - `initAccount` → connect + REGISTER, handle 401/407 with MD5 digest auth (`CC_MD5` via `CommonCrypto`)
   - `makeCall` (INVITE), `hangup` (BYE), stubs for `answer`/`setMute`/`setHold`/`sendDTMF`
   - Parses responses, emits `registration`, `callStateChanged`, `callEnded` via `notifyListeners`
   - Add `import CommonCrypto` (needed for `CC_MD5`)

2. **`apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.m`** — `CAP_PLUGIN` macro exporting the 7 methods.

3. **`apps/ava-softphone-mobile/src/lib/sip/nativeSipProvider.ts`** — replace existing file. Register plugin under name `CapacitorSip`, expose `CapacitorSipNative` with the new interface (`initAccount({extension, domain, password, host})`, `makeCall({number})`, `hangup`, `answer`, `setMute({muted})`, `setHold({held})`, `sendDTMF({digits})`). Keep a web stub so vitest/web preview don't crash. Keep `NATIVE_SIP_ENABLED` export.

## Files to modify

4. **`apps/ava-softphone-mobile/src/hooks/useSoftphone.ts`** — update the `NATIVE_SIP_ENABLED` branch to call `CapacitorSipNative.initAccount({ host: 'pbxnode.lemtel.tel', extension, domain, password })` and wire `makeCall` / `hangup` / `answer` / `setMute` / `setHold` / `sendDTMF` plus listeners (`registration`, `callStateChanged`, `callEnded`) to the existing softphone state machine. No changes to the JsSIP branch.

5. **`apps/ava-softphone-mobile/ios/App/App/Info.plist`** — ensure `UIBackgroundModes` contains `audio` and `voip` (already present from earlier work — verify, add if missing). No other changes.

6. **`apps/ava-softphone-mobile/.env.local`** — flip `VITE_NATIVE_SIP=true`.

## Files to remove

7. Delete `apps/ava-softphone-mobile/ios/App/Plugins/CapacitorPjsip/` (old Linphone Swift+ObjC bridge) and `apps/ava-softphone-mobile/ios/App/LINPHONE_SETUP.md`. Remove the `linphone-sw` SwiftPM dependency reference from `App.xcodeproj` if present, and any Linphone lines from `Podfile`.

## Technical notes (non-user)

- `Network.framework` `NWConnection` with `NWParameters.tls` handles TLS handshake automatically — no cert pinning configured (server uses public CA).
- MD5 digest auth only (no SHA-256 qop=auth fallback) — sufficient for Lemtel PBX which advertises `Digest MD5`.
- No SDP / RTP yet: `makeCall` sends INVITE with `Content-Length: 0`. Actual media path will require a follow-up (CallKit + AVAudioEngine RTP) — flagged but out of scope for this plan; registration + call signaling is what unblocks the current blocker.
- Web/Vitest: `nativeSipProvider` ships a no-op stub so existing tests (`rtcConfig.test.ts`, `uaConfig.test.ts`, `sipE2EFlow.test.tsx`) continue to pass.
- After merge user must run `npx cap sync ios` and open Xcode to add the new `Plugins/CapacitorSip` folder to the App target (folder reference).

## Verification

- `bunx vitest run` — existing SIP tests still green (web stub).
- Manual on TestFlight: install, observe console `registration: registered`, place call, observe `callStateChanged: ringing → active`. Audio media will not flow yet (documented limitation).
