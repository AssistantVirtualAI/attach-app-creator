# Phase 4 — Noise Cancellation + Network Intelligence

Scope: `/mplanipret` mobile app only. Lemtel softphone untouched. Backend & Edge Functions unchanged.

## 4.1 — Audio processing & noise cancellation

**New file `src/lib/planipret/audio/audioConstraints.ts`**
- Export `getAudioConstraints(mode: 'standard' | 'office' | 'phone')` returning the WebRTC constraints from the spec (echoCancellation, noiseSuppression, autoGainControl, sampleRate, channelCount, latency, suppressLocalAudioPlayback).
- `phone` mode → narrowband 8 kHz; `office` mode → add RNNoise WASM hook.

**New file `src/lib/planipret/audio/rnnoise.ts`**
- Lazy-load `@jitsi/rnnoise-wasm` AudioWorklet, expose `applyRnnoise(stream)` returning a processed `MediaStream`.
- Graceful fallback to raw stream if WASM unavailable.

**New file `src/lib/planipret/audio/vad.ts`**
- AnalyserNode-based Voice Activity Detection.
- Emits `speaking`/`silent` events + level (0–10) for the VU meter.
- Auto-mute timer: off / 30 s / 60 s (configurable).

**New file `src/lib/planipret/audio/audioRouter.ts`**
- Wraps native `audioOutput.ts` calls (already used by Lemtel) — earpiece / speaker / Bluetooth.
- Reuses existing native bridge; **no Swift changes**.

**New component `src/components/planipret/mobile/call/CallAudioSheet.tsx`**
- Bottom sheet with: mic toggle, speaker selector, NC toggle + 3-mode picker (Standard / Bureau / Téléphone), 10-bar real-time VU meter, pulsing green border on active speech.

## 4.2 — Network intelligence

**Install**: `@capacitor/network` (already a Capacitor project).

**New file `src/lib/planipret/network/networkMonitor.ts`**
- Singleton. `init()` registers `Network.addListener('networkStatusChange')` + 5 s `checkSignalQuality()` interval during active call only.
- `measureWifiQuality()` pings the SIP edge (HEAD request) 3× → returns `{ rtt, loss }`.
- Classifies: Excellent (<50 ms), Bon (50–150), Acceptable (150–300), Mauvais (>300), Warning if loss >5 %.
- Emits events via tiny `EventTarget`.

**Handover logic** (`networkMonitor.attemptHandover()`):
- Pre-register SIP on new transport, send re-INVITE, confirm RTP, drop old. Implemented as orchestration over existing `useSoftphoneNative` — calls `prewarmAudio()` + `reinvite()` already exposed by `CapacitorSip`. No native code changes.

**New component `src/components/planipret/mobile/call/NetworkBadge.tsx`**
- Top-of-call pill: 📶 + label + color (green/yellow/orange/red). Animated "Reconnexion..." state.

**Settings (MMore)**
- New section "Réseau" with 3 toggles (auto-switch, prefer-WiFi, background-calls) persisted in `localStorage` under `pp_network_prefs`.
- Live status line: "Réseau actuel: WiFi — 12 ms".

## 4.3 — Bluetooth auto-detection

**Install**: `@capacitor-community/bluetooth-le`.

**New file `src/lib/planipret/audio/bluetoothManager.ts`**
- `scanAudioDevices()` on app launch (via existing onboarding hook).
- `autoConnectLast()` from `localStorage.pp_last_bt_device`.
- Listen for connect/disconnect → call `audioRouter.switchTo(...)`.
- Rules: headset connect → switch to headset; disconnect → fallback to earpiece (not speaker); car BT → switch automatically.

**Permission strings**
- Append to `docs/mplanipret-native-config.md`: `NSBluetoothAlwaysUsageDescription` (iOS) + `BLUETOOTH_CONNECT` (Android API 31+).
- Onboarding screen 5 already covers the runtime prompt — extend `reqBluetooth()` to call the new manager when native plugin is present.

## Wiring

- `PlanipretMobile.tsx` → mount `<NetworkBadge/>` + `<CallAudioSheet/>` inside the existing active-call layout.
- `MMore.tsx` → add Réseau section.
- `MobilePermissionsOnboarding.tsx` → call `bluetoothManager.scanAudioDevices()` on Bluetooth screen completion.

## Out of scope (acknowledged limits)

- True sub-500 ms SIP handover requires native iOS work in `CapacitorSip.swift`; this plan wires the orchestration and UI but actual re-INVITE on alternate interface is best-effort on iOS without additional Swift changes.
- krisp.ai SDK requires a paid licence key — using free RNNoise WASM instead.

## Technical notes

- All new files scoped under `src/lib/planipret/**` and `src/components/planipret/mobile/call/**` — zero impact on Lemtel.
- Reuses existing `audioOutput.ts` and `CapacitorSip` native bridge.
- No DB migrations, no Edge Function changes.
- Bilingual strings added to `src/lib/i18n/mplanipret.ts`.
