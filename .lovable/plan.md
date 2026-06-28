# Plan: Replace Custom RTP/SIP Stack with PJSIP SDK

## Goal
Eliminate iPhone freezes, poor audio quality, and unstable call states by replacing the home-grown `RTPAudioSession.swift` + manual SIP TCP stack with the industry-standard **PJSIP SDK** (used by Zoiper, Bria, etc.) via CocoaPods.

## Scope (iOS only, for this phase)
All changes inside `apps/ava-softphone-mobile/ios/`. JS/TS layer (`nativeSipProvider.ts`, `useSoftphoneNative.ts`, hooks, UI) stays untouched — the bridged plugin name `CapacitorPjsip` and the event/method contract are preserved.

## Steps

### 1. Podfile — add PJSIP
File: `apps/ava-softphone-mobile/ios/App/Podfile`
Add inside the `App` target:
```ruby
pod 'pjsip', '~> 2.13'
```

### 2. Bridging header — expose PJSUA C API to Swift
File: `apps/ava-softphone-mobile/ios/App/App/App-Bridging-Header.h`
Append:
```objc
#include <pjsua.h>
```

### 3. Rewrite the Capacitor plugin as a thin PJSIP wrapper
File: `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift`
- Strip everything custom (NWConnection SIP, RTP, audio session management, keepalive, jitter buffer, PCMU tables, etc.).
- Keep the existing `@objc(CapacitorPjsip)` class name + `CAPBridgedPlugin` registration so `AppBridgeViewController.registerPluginInstance(...)` keeps working.
- Implement methods on a dedicated `DispatchQueue(label: "pjsip.worker", qos: .userInitiated)` so SIP/audio never touches the Main Thread:
  - `initAccount` → `pjsua_create` → `pjsua_init` (TCP transport, port 5060, AEC tail 200ms, 8 kHz clock) → `pjsua_start` → `pjsua_acc_add` with MD5 digest creds for `sip:<ext>@lemtel.lemtel.tel` registering to `pbxnode.lemtel.tel;transport=tcp`.
  - `makeCall` → `pjsua_call_make_call`.
  - `answer` → `pjsua_call_answer(200)`.
  - `hangup` → `pjsua_call_hangup`.
  - `setMute` → `pjsua_conf_disconnect/connect` on the call's `conf_slot`.
  - `setHold` → `pjsua_call_set_hold` / `pjsua_call_reinvite(PJSUA_CALL_UNHOLD)`.
  - `sendDTMF` → `pjsua_call_dial_dtmf` (RFC 2833).
  - `setLogLevel` → wraps `pjsua_logging_config.console_level`.
- Wire PJSUA callbacks (`on_reg_state`, `on_call_state`, `on_incoming_call`) to existing JS events with the exact same payload shape used today:
  - `registration` → `{ state: 'registered'|'error', status, reason? }`
  - `callStateChanged` → `{ state: 'ringing'|'active'|'hold', direction? }`
  - `callReceived` → `{ from }`
  - `callEnded` → `{ reason }`
- All `notifyListeners` dispatched via the worker queue (no Main Thread blocking).
- `deinit` → `pjsua_destroy()`.

### 4. Delete the custom RTP/SIP code
- Delete `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift` (PJSIP owns audio, AEC, jitter, codecs).
- Update `apps/ava-softphone-mobile/scripts/ios-sync-and-validate.sh` to stop asserting on `RTPAudioSession.swift` (block 1c). Keep the `1b/1d` checks — `CapacitorSip.swift` and all `pluginMethods` remain present.

### 5. Methods kept on the Swift plugin as no-op stubs (for now)
To preserve the existing `CapacitorSipPlugin` TS contract without changing JS:
`disconnect`, `requestMicrophonePermission` (call `AVAudioSession.requestRecordPermission`), `setAudioRoute`, `getAudioRoute`, `playTestTone`, `getRtpStats` (return PJSIP `pjsua_call_get_info` stats), `startRecord`/`stopRecord` (PJSIP `pjsua_call_set_user_data` + `pjsua_recorder_create`), `transfer` (`pjsua_call_xfer`), `park`, `addCall`.

Anything not yet wired to PJSIP returns `{ ok: true }` to avoid breaking JS callers; we'll progressively map them to real PJSIP calls in follow-up turns.

### 6. Keep unchanged
- `AppBridgeViewController.swift` — already registers the plugin.
- `Main.storyboard` — already points to `AppBridgeViewController`.
- `Info.plist` — `NSMicrophoneUsageDescription`, `NSLocalNetworkUsageDescription`, `UIBackgroundModes: voip/audio` already present.
- `nativeSipProvider.ts`, `useSoftphone_new.ts`, `ringback.ts`, `incomingRingtone.ts`, UI components — no change.
- `.env.local` `VITE_NATIVE_SIP=true`.

### 7. Post-change manual steps (documented in the closing message)
```bash
cd apps/ava-softphone-mobile
npm run build
npx cap sync ios
cd ios/App && pod install
open App.xcworkspace   # then Run on a real iPhone
```

## Risk / fallback
- If `pod 'pjsip' ~> 2.13'` is not available on the user's CocoaPods Spec repo, fallback to `pod 'pjsip', :git => 'https://github.com/chebur/pjsip.git'` (community-maintained prebuilt podspec). We'll handle that at build time if `pod install` fails.
- Live transcription and contact sync logic remain untouched (already removed/working).

## Out of scope (this turn)
- Android (`CapacitorPjsip.kt`) — separate phase; current Android stack stays.
- Edge functions, Supabase schemas, transcription pipeline.

## One clarifying question before I implement
The plugin uses `bridge?.registerPluginInstance(CapacitorPjsip())` from `AppBridgeViewController.capacitorDidLoad()`. PJSIP `pjsua_init` is heavy (allocates worker threads, opens audio unit) — should I:

- **(A)** Defer `pjsua_create/init/start` until the first `initAccount({...creds})` call from JS (current plan, lazy init), **or**
- **(B)** Initialize PJSUA eagerly in `load()` and only do `pjsua_acc_add` on `initAccount`?

(A) is safer (no work until user signs in). I'll proceed with (A) unless you say otherwise.
