## Goal
Close the remaining audio/SIP gaps in the iOS softphone (Android tracked separately) and tune the Whisper transcription call.

## Findings from current code
- `RTPAudioSession.swift` already uses the standard ITU-T G.711 algorithm with `BIAS = 0x84 (132)` in both `ulawToLinear` and `linearToUlaw`. Math is correct, but each RTP packet recomputes per-sample — converting to 256-entry / 65536-entry lookup tables removes branches in the hot path and lets us assert correctness once at startup.
- `AudioStreamBasicDescription` is already `SignedInteger | Packed` mono 16-bit (VoiceProcessingIO-compatible). No change needed for item 4 from the prompt — will only add a comment.
- `useSoftphoneNative.ts` (the native path) already calls `stopRingback()` when `stage === 'early_media'` (line 90–91). The legacy `useSoftphone_new.ts` only stops on `state === 'active'` — needs the same early-media guard for parity.
- No OPTIONS keepalive exists in `CapacitorSip.swift`; only REGISTER refresh runs. Need a dedicated 25 s OPTIONS timer started after the first REGISTER 200 OK and torn down on unregister/socket close.
- `ai-transcribe-call/index.ts` Whisper call lacks `prompt` and `temperature` hints; FusionPBX recordings are 8 kHz μ-law WAV which Whisper already accepts.

## Changes

### 1. `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift`
- Add two `static let` lookup tables (`muLawDecompress: [Int16]`, `muLawCompress: [UInt8]`) built lazily from the existing standard algorithm so the table values are guaranteed identical to the current functions.
- Switch `ulawToLinear` / `linearToUlaw` to table reads; keep the algorithmic versions as `#if DEBUG` self-check at first use (`assert(table[i] == linearToUlawAlgo(i))`) to guarantee parity.
- Add a one-line comment above the ASBD block stating that interleaved packed I16 is required for VoiceProcessingIO (no value change).

### 2. `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift`
- Add `private var optionsTimer: Timer?` and:
  - `startOptionsKeepalive()` — schedule a 25 s repeating timer on the main run loop.
  - `sendOptions()` — build an `OPTIONS sip:<domain> SIP/2.0` request with a fresh branch/Call-ID, reusing the registered `localIP`, `username`, `domain`, transport, and current `localTag`; write through the existing `sendData` path (TCP or UDP, matching transport already in use).
  - `stopOptionsKeepalive()` — invalidate and nil the timer.
- Wire `startOptionsKeepalive()` into the REGISTER 200 OK handler (after the existing REGISTER-refresh setup) and `stopOptionsKeepalive()` into unregister / socket teardown / app-background cleanup paths already present.
- Guard against double-start (invalidate before re-scheduling).

### 3. `apps/ava-softphone-mobile/src/hooks/useSoftphone_new.ts`
- In the `callStateChanged` handler, when `d?.stage === 'early_media'`, call `stopRingback('early-media')` so PBX-supplied early audio is not masked. Native hook already handles this; align the legacy hook.

### 4. `supabase/functions/ai-transcribe-call/index.ts`
- When invoking Whisper-1, add:
  - `prompt: "Transcription d'un appel téléphonique en français canadien."`
  - `temperature: "0"`
  - `language: "fr"` (already set if present — verify).
- Add a short comment noting that 8 kHz μ-law WAV from FusionPBX is accepted natively by Whisper (no transcoding needed); MP3 also passes through.

## Explicitly out of scope
- Android `CapacitorPjsip.kt` parity for codec tables / OPTIONS keepalive (separate follow-up — user flagged it as known gap).
- No edits to `AppBridgeViewController.swift`, `project.pbxproj`, `Main.storyboard`, `AppDelegate.swift`.

## Verification
- iOS build compiles via existing typecheck.
- Manual: place outbound call → confirm ringback stops the instant `183` arrives; place call on LTE → confirm OPTIONS lines in PBX logs every ~25 s; record a French call → confirm Whisper transcript returns with `temperature=0` deterministic output.
