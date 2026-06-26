## Scope
Fix three remaining mobile-app issues in the Planipret softphone. Frontend + iOS native plugin only — no backend schema, no Lemtel changes.

---

### 1. Record button — no visible indication that the call is being recorded

**Root cause**
- `ActiveCallSheet` only shows the label `Record / Stop Rec` on a small icon; users don't notice the toggle.
- `CapacitorSip.swift::startRecord` calls `call.reject("no active call")` when `callState != "active"`, but the JS layer (`useSoftphoneNative.startRecording`) just `console.warn`s the rejection — no toast, no state change. So if the toggle silently fails, the UI looks identical.
- After a successful `startRecord`, the only signal is the small icon label change; no banner/pulse.

**Fix (frontend only)**
- In `ActiveCallSheet.tsx`:
  - Add a prominent "● REC" pill (red, pulsing) near the status strip whenever `sp.snap.recording === true`. Show it next to the call timer, similar to the existing audio-engine banner.
  - Surface record errors through the existing `toast` state when `sp.startRecord/stopRecord` rejects.
- In `useSoftphoneNative.ts`:
  - Make `startRecording` / `stopRecording` re-throw the native rejection so the caller can show a toast (instead of swallowing with `console.warn`).
  - Only flip `isRecording` after the native promise resolves (remove the optimistic `setIsRecording(true)` before await).
- In `ActiveCallSheet.tsx::record`, wrap the call in try/catch and call `setToast("Impossible de démarrer l'enregistrement: …")` on failure.

---

### 2. Speaker / Bluetooth toggle throws an error

**Root cause**
`src/lib/sip/audioOutput.ts::setRoute` only tries `HTMLMediaElement.setSinkId(...)`, which on iOS WKWebView is either missing or rejects — the catch then throws and `ActiveCallSheet` shows "Impossible de basculer sur Haut-parleur". The real iOS routing is implemented in `CapacitorSip.swift::setAudioRoute` (already exposed in `nativeSipProvider.ts`) but never called.

**Fix (frontend only)**
- In `audioOutput.ts::setRoute`, when running on Capacitor native (`Capacitor.isNativePlatform()` or `VITE_NATIVE_SIP` flag), call `CapacitorPjsip.setAudioRoute({ route })` first; only fall back to `setSinkId` on web.
- Treat `setSinkId` `NotSupportedError` / missing as a silent skip (don't throw) — the native side did the routing.
- Update `route` from the native response (`outputs` string) so the UI pill reflects the actual port (e.g. detect `BluetoothHFP` → `bluetooth`, `Speaker` → `speaker`, else `earpiece`).
- Keep the existing `busy` guard and event emission.

---

### 3. Call transcription always fails

**Diagnosis (already confirmed via Edge logs)**
`ai-transcribe-call` returns `RECORDING_NOT_FOUND` on both `fusion-signed` and `fusion` proxies for `call_record_id=b1e19218-…`:
```
fetchErrors: ["fusion-signed:RECORDING_NOT_FOUND","fusion:RECORDING_NOT_FOUND"]
```
The function correctly maps that to `reason: "recording-not-synced"` with a retry hint, but `useCallAi` surfaces it as a generic "Transcription failed".

Two contributing factors:
1. The call was never actually recorded on the PBX (SIP INFO `Record: on` may not be honored on this Fusion install — or recording wasn't toggled before hangup), so there's no file to fetch.
2. Even when a recording exists, the `xml_cdr` row often isn't synced into Supabase yet at the moment the user taps "Transcribe", so `recording_path/name` are empty.

**Fix (frontend only — no backend change in this plan)**
- In `useCallAi.ts`:
  - When `t?.reason === 'recording-not-synced'` or `t?.reason === 'no-recording'`, surface a clear French message: "Enregistrement non disponible (l'appel n'a pas été enregistré ou la synchro PBX n'est pas encore terminée). Réessayez dans ~30 s."
  - Honor `t.retry_after_ms` by exposing a `retryAt` value so the UI can show a countdown / disable the button.
- In `CallDetailScreen.tsx` (or wherever the "Transcribe" button lives), show the retry hint instead of the raw "stub" error.

**Open question for the user** (asked separately below): do you want us to also force-enable per-extension recording on the PBX side so every call is recorded automatically? That's a backend change (`pbx_extensions.record_all_calls = true` + Fusion sync) and is out of scope unless confirmed.

---

## Files touched
- `apps/ava-softphone-mobile/src/components/ActiveCallSheet.tsx`
- `apps/ava-softphone-mobile/src/hooks/useSoftphoneNative.ts`
- `apps/ava-softphone-mobile/src/lib/sip/audioOutput.ts`
- `apps/ava-softphone-mobile/src/hooks/useCallAi.ts`
- `apps/ava-softphone-mobile/src/screens/CallDetailScreen.tsx`

No native Swift changes required for these three fixes — the existing `setAudioRoute`, `startRecord`, `stopRecord`, and `recordingChanged` bridge are already in place.

After approval the user will need to `git pull` + `npx cap sync ios` + rebuild to ship.
