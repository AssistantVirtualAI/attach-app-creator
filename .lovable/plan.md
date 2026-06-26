## Plan

1. **Verify RemoteIO-only audio path**
   - Confirm `RTPAudioSession.swift` has no `AVAudioEngine`, `AVAudioPlayerNode`, `installTap`, or `removeTap` references.
   - Add a static validation script/check so future commits fail clearly if those symbols return.
   - Note: I can validate source/static compile assumptions here, but a true iOS device compile/run must be done in Xcode on Mac.

2. **Add detailed native RTP/AudioUnit logs**
   - Add structured `[RTP]` logs for:
     - RemoteIO state transitions: create, enable input/output, set stream formats, initialize, start, stop, dispose.
     - AudioUnit OSStatus failures with readable 4-char-code formatting where possible.
     - First input callback and periodic input counters: frames, mic peak, RTP tx packets.
     - First render callback and periodic render counters: frames, queued samples, RTP rx packets.
     - retry/reconnect attempt number, backoff delay, route/session state.
   - Keep logs diagnostic but throttled so callbacks do not spam the device console every audio frame.

3. **Harden iOS microphone permission UX**
   - Keep explicit native mic permission request before registration/call audio.
   - Add a JS listener for native `micPermission`/registration errors.
   - Show a clear user-facing message when mic access is denied: “Microphone access is required for two-way audio. Enable it in iOS Settings.”
   - Prevent calls from starting if permission is denied.

4. **Fix broken Record button wiring**
   - Current issue found: `MobileApp.tsx` maps `recording: false`, `startRecord: () => {}`, `stopRecord: () => {}` even though `useSoftphoneNative.ts` exposes `isRecording`, `startRecording`, `stopRecording`.
   - Wire `sp.snap.recording` to `softphone.isRecording`.
   - Wire `startRecord`/`stopRecord` to `softphone.startRecording`/`softphone.stopRecording`.
   - Keep native `recordingChanged` as the source of truth.

5. **Fix Hold/Resume UI state wiring**
   - Current likely issue found: `MobileApp.tsx` does not pass `softphone.isOnHold` into the `snap`; `ActiveCallSheet` only checks `callState === 'held'`, but native emits `isOnHold` separately.
   - Add `snap.onHold`/held mapping from `softphone.isOnHold`.
   - Update `ActiveCallSheet` so the Hold button label/action uses native hold state, not only callState.
   - Keep no optimistic re-toggle loops; state remains driven by native `holdChanged`.

6. **Improve visible mobile call buttons**
   - Replace the flat circular controls in `ActiveCallSheet.tsx` with visible glass/futuristic button styles directly in the component:
     - glossy radial/linear background,
     - active/disabled/loading states,
     - press/hover shine styling,
     - clearer Record/Hold active states.
   - Keep scope limited to mobile call controls.

7. **Add iOS real-device RTP test steps**
   - Update the iOS rebuild checklist with the exact verification commands/checks:
     - grep validation for no AVAudioEngine symbols,
     - clean build/reinstall steps,
     - required Xcode console filters,
     - expected RemoteIO logs,
     - real call test matrix: outbound audio both ways, inbound audio both ways, Hold/Resume, Record toggle, reconnect/retry.

8. **Validation after implementation**
   - Run source checks for removed AVAudioEngine symbols.
   - Run the existing iOS sync static validation script in check mode if safe.
   - Run TypeScript/tests only if available without changing native state.
   - Report clearly that real capture/playback confirmation must be run on the physical iOS device after `git pull`, `npm run build`, `npx cap sync ios`, clean build, reinstall.