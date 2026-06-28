## Goal
Fix 5 native softphone issues on iOS: mic too loud, app freeze, ringback timing, "remote can't hear me", and SDP port=0 risk.

## Changes

### 1. `RTPAudioSession.swift` — mic gain attenuation
In the RemoteIO **input render callback** (mic → PCMU encode path), apply 0.6x attenuation per Int16 sample before `encodePCMU(...)`:
```swift
let attenuated = Int16(clamping: (Int32(sample) * 6) / 10)
let pcmu = muLawCompress[Int(UInt16(bitPattern: attenuated))]
```
Leave AGC=on as-is (already configured line 516-519).

### 2. `RTPAudioSession.swift` — RTP TX diagnostics
- In `start(remoteIp:remotePort:)` add: `NSLog("[RTP] remote set to \(remoteIp):\(remotePort) hasRemote=true")`.
- In the input callback before `sendto`, guard:
  ```swift
  guard hasRemote else { NSLog("[RTP] WARN no remote addr, drop TX"); return }
  ```
- Add throttled (every 50 packets) log: `NSLog("[RTP] TX seq=\(txSeq) → \(remoteIp):\(remotePort)")`.

### 3. `CapacitorSip.swift` — unblock main thread
Wrap every `notifyListeners(...)` call that runs from the TCP receive queue or the OPTIONS timer in `DispatchQueue.global(qos: .userInitiated).async { … }`. Specifically the call-state, registration, hold, recording, livePcm*, callReceived, callEnded events fired from `handleResponse` / parser paths.

OPTIONS timer fires from the main runloop — move the send onto background:
```swift
optionsTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
  DispatchQueue.global(qos: .background).async { self?.sendOptions() }
}
```

### 4. `CapacitorSip.swift` — SDP port guard
In `buildSdp(hold:)` (line 1021), if `localRtpPort == 0` AND `localSdpPort == 0`, log an error and return `""`. Callers (`call`, re-INVITE, 200 OK responder) must abort the INVITE/answer when SDP is empty so we never advertise port 0.

### 5. Ringback priming
In `apps/ava-softphone-mobile/src/lib/nativeBoot.ts` (or `src/MobileApp.tsx` root mount), register a once-only listener:
```ts
import { primeRingbackContext } from "./lib/sip/ringback";
const prime = () => primeRingbackContext();
document.addEventListener("touchstart", prime, { once: true, passive: true });
document.addEventListener("click", prime, { once: true });
```
Ensures `AudioContext` is unlocked on the very first user gesture, well before `makeCall()`.

## Out of scope / untouched
`AppBridgeViewController.swift`, `project.pbxproj`, `Main.storyboard`, Android plugin.

## Verification
- Xcode logs show `[RTP] remote set to … hasRemote=true` and periodic TX seq lines after INVITE.
- Remote party hears audio at normal level (no clipping).
- UI remains responsive during call setup and OPTIONS keepalive ticks.
- Ringback starts immediately on first Call tap after a fresh launch.
- No SDP advertising `m=audio 0 RTP/AVP …` in outbound INVITEs.
