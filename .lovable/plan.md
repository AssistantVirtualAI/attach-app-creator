## Plan

1. Fix the native plugin registration mismatch
   - Make JS register the same plugin name exported by iOS: `CapacitorPjsip`.
   - Keep a compatibility alias only if needed, but avoid registering `CapacitorSip` when iOS exports `CapacitorPjsip`.

2. Fix the native init payload mismatch
   - JS currently sends `extension`, but ObjC reads `username`; update the native plugin to accept both.
   - JS currently calls `makeCall({ number })`, but ObjC reads `destination`; update ObjC to accept both.
   - JS calls `setHold({ onHold })`, but ObjC reads `held`; update ObjC to accept both.

3. Fix event-name mismatch causing endless “connecting”
   - ObjC currently emits `registrationState` / `callState`.
   - JS listens for `registration`, `callStateChanged`, and `callEnded`.
   - Update ObjC to emit the JS-expected events with `status: registered/error` and call states mapped to `active/ringing/ended`.

4. Add native diagnostic logs visible with Xcode filter `CapacitorPjsip`
   - Log plugin load, `initAccount`, socket open, stream open/error/end, REGISTER send/receive, and auth challenge handling.
   - Add `setLogLevel` and `disconnect` methods because JS declares them.

5. Add a registration watchdog in `useSoftphoneNative`
   - If native registration never emits success/error, fail with a clear error instead of staying on connecting forever.
   - Log native events to the console for easier on-device debugging.

6. Update the validation script
   - Check that the JS registered plugin name matches `CapacitorPjsip`.
   - Check ObjC accepts `extension`, emits `registration`, and includes required methods.

After implementation you’ll need to pull the code, then run from `apps/ava-softphone-mobile`: `npm run build && npx cap sync ios`, then clean build in Xcode.