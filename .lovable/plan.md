# Softphone iOS/Android + Transcription Fix Plan

## 1. Outgoing ringback (no audio while dialing)

**`src/lib/sip/ringback.ts`**
- Export `primeRingbackContext()` that creates the `AudioContext` synchronously (must run inside the user-gesture tap handler). Keep nodes lazy, but the context itself must exist before the async SIP flow starts, otherwise iOS Safari/WKWebView blocks playback.
- Keep `startRingback()` / `stopRingback()` API the same; internally reuse the primed context.

**`apps/ava-softphone-mobile/src/hooks/useSoftphone_new.ts`** (the active native hook)
- In `call(number)`: invoke `primeRingbackContext()` then `startRingback()` immediately, before `CapacitorPjsip.makeCall`.
- In `callStateChanged` handler: stop ringback only on `state === 'active'`. Ignore `auth_challenge` / `invite_sent` / `ringing` (keep tone playing).
- In `callEnded` and on error paths: always `stopRingback()`.

## 2. iOS audio quality (`RTPAudioSession.swift`)

Keep `kAudioUnitSubType_VoiceProcessingIO` (correct for AEC/NS/AGC).

- **Jitter buffer**: add `minBufferPackets = 3` (60 ms at 20 ms ptime). Don't pull from `playQueue` until threshold reached on (re)start or after underrun. Track underruns in stats.
- **PCMU decode**: replace current table with ITU-T G.711 µ-law reference implementation (bias 132, sign-aware), exactly as in the user prompt.
- **PCMU encode** (mic): standard µ-law compression with bias + segment search (ITU-T reference). Replace any naïve table.
- **Upsample 8 → 48 kHz**: linear interpolation between consecutive 8 kHz samples (6 output samples per input pair) — no more sample-and-hold.
- **Downsample 48 → 8 kHz**: average 6 consecutive float samples before µ-law encode (simple anti-alias).
- **Format flags**: ensure render/input `AudioStreamBasicDescription.mFormatFlags` includes `kAudioFormatFlagIsNonInterleaved` for VPIO mono float32.
- Keep `prev` sample state between callbacks so interpolation doesn't click at packet boundaries.

## 3. iOS call stability (`CapacitorSip.swift`)

- After receiving `200 OK` on INVITE (and after parsing remote SDP): `DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(200)) { startRtp() }`.
- Hold/unhold: add `private var isHoldPending = false`. Reject `setHold` calls while pending; clear flag once the re-INVITE final response arrives or times out (5 s).
- SIP keepalive: schedule a 30 s repeating `Timer` that sends OPTIONS to the registrar while registered. Cancel on `disconnect()` / unregister.

## 4. Transcription pipeline (`supabase/functions/ai-transcribe-call/index.ts`)

Rewrite to:

1. Resolve recording URL via existing `fusionpbx-proxy` (`get-recording-url` action). Download WAV/MP3 bytes.
2. **Primary — OpenAI Whisper**: convert/ensure 16 kHz mono WAV (ffmpeg-wasm not available in Deno; instead, upload original — Whisper accepts wav/mp3 at 8 kHz; only resample if source is raw PCMU/µ-law). POST multipart to `https://api.openai.com/v1/audio/transcriptions` with `model=whisper-1`, `language=fr`, `response_format=json`. Auth: `OPENAI_API_KEY`.
3. **Fallback — Gemini** (`google/gemini-2.5-flash`) via Lovable AI Gateway `/v1/chat/completions` with inline audio (base64) if Whisper returns non-2xx.
4. **Analysis — Claude** (`anthropic/claude-sonnet-4-6`) via Anthropic API using `ANTHROPIC_API_KEY` with system prompt:
   > "Tu es un coach commercial. Analyse cet appel téléphonique et fournis: 1) Résumé en 3 points 2) Points positifs 3) Points à améliorer 4) Score de qualité /10"
   Parse into `summary`, `positives[]`, `improvements[]`, `quality_score`.
5. Upsert into `pbx_call_transcripts` (transcript_text, language, provider='whisper'|'gemini') and `pbx_ai_insights` (summary, coaching_notes, quality_score, provider='claude-sonnet-4-6'). Write `call_intelligence_audit` row with status + duration.
6. Error classification preserved: `pbx-auth-failed`, `recording-not-found`, `recording-pending-sync`, plus new `transcription-provider-failed` and `analysis-failed`.

**Secrets**: confirm `OPENAI_API_KEY` exists; request via `add_secret` if missing. `ANTHROPIC_API_KEY` and `LOVABLE_API_KEY` already configured.

Redeploy `ai-transcribe-call` after edit.

## 5. Android parity (Capacitor plugin Kotlin side — to be added later if not present)

Document required changes in a follow-up; for this pass, ensure JS side:
- Calls `requestMicrophonePermission()` before `initAccount` on both platforms (already in plugin interface).
- Native Kotlin equivalents to set `AudioManager.MODE_IN_COMMUNICATION`, request `RECORD_AUDIO`, use `AudioTrack` with `STREAM_VOICE_CALL` will be tracked separately if Android plugin source exists; otherwise noted as TODO (no Android plugin folder currently visible — confirm before editing).

## Files touched

- `apps/ava-softphone-mobile/src/lib/sip/ringback.ts`
- `apps/ava-softphone-mobile/src/hooks/useSoftphone_new.ts`
- `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift`
- `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift`
- `supabase/functions/ai-transcribe-call/index.ts`

## Out of scope (untouched)

- `AppBridgeViewController.swift`, `project.pbxproj`, `Main.storyboard`
- Android native plugin code (no Kotlin source present in repo; will flag if found during build)

## Validation

- Build typecheck on mobile app + edge function deploy.
- Manual: outbound call → ringback audible within 100 ms of tap; once answered, two-way audio clean (no echo, no chipmunk effect from bad resampling).
- Transcription: trigger on an existing recording, expect Whisper transcript + Claude analysis row in `pbx_ai_insights`.
