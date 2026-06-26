# iOS Audio Test Checklist — RTP / AVAudioSession / CapacitorSip

Validate the audio-engine + SIP fix across realistic device configurations.
Run each row on a real device (the simulator does not exercise Bluetooth or
real cellular routes). Capture the `[RTP]` and `[CapacitorPjsip]` lines from
Console.app for every scenario.

## How to log

1. Connect device to a Mac, open **Console.app**.
2. Filter on `process:App message:[RTP]` OR `message:[CapacitorPjsip]`.
3. Trigger the scenario, then export the log.
4. Required lines to confirm the fix:
   - `session[pre-start] cat=… mode=… opts=0x…`
   - `setCategory playAndRecord/voiceChat ok (skip setActive — owned by SIP)`
   - `session[post-category] cat=AVAudioSessionCategoryPlayAndRecord mode=AVAudioSessionModeVoiceChat`
   - `tap installed (format=nil, native bus0)`
   - `audio engine started, route=…`
   - `LOCAL SDP (INVITE) >>>` and `REMOTE SDP <<<`
   - `remote SDP audio=…:… direction=sendrecv|recvonly|…`

If `engine start failed` appears, the auto-reconnect must log
`scheduling engine restart #N in Ns` followed by `restarting engine` and
finally `audio engine started`.

## Matrix

| # | Device / iOS | Network | Output route | Pre-call state | Expected | Pass? |
|---|---|---|---|---|---|---|
| 1 | iPhone (latest iOS) | Wi-Fi | Earpiece | App fresh launch | Category becomes `PlayAndRecord/VoiceChat`, engine starts, two-way audio | ☐ |
| 2 | iPhone (latest iOS) | Wi-Fi | Speaker | Tap speaker mid-call | `routeChange reason=…`, audio continues, no engine restart needed | ☐ |
| 3 | iPhone (latest iOS) | Wi-Fi | Bluetooth HFP headset | Headset connected before call | Route shows `BluetoothHFP:…`, full duplex audio | ☐ |
| 4 | iPhone (latest iOS) | Wi-Fi | Bluetooth HFP | Connect headset **mid-call** | `routeChange`, audio follows headset, no drop | ☐ |
| 5 | iPhone (latest iOS) | Wi-Fi | AirPods (HFP) | Already paired | Route `BluetoothHFP`, no `Failed to create tap` errors | ☐ |
| 6 | iPhone | LTE / 5G | Speaker | Outdoor cellular call | SDP `c=IN IP4 <pdp_ip0>`, RTP latches, audio OK | ☐ |
| 7 | iPhone | Wi-Fi → LTE handover | Speaker | Mid-call Wi-Fi off | Engine may restart once via backoff; audio resumes | ☐ |
| 8 | iPhone | Wi-Fi | Earpiece | App backgrounded then resumed mid-call | `interruption type=ended` followed by engine resume; no `setActive` race | ☐ |
| 9 | iPhone | Wi-Fi | Earpiece | Native call comes in mid-call | `interruption type=began`; after dismissal, engine restarts automatically | ☐ |
| 10 | iPhone | Wi-Fi | Earpiece | Music app playing before call | `OtherAudio=true` in `session[pre-start]`; ducked during call | ☐ |
| 11 | iPhone | Wi-Fi | Speaker | Place a call, then hold + resume | `LOCAL SDP (re-INVITE hold=true)` shows `a=sendonly`, resume restores `a=sendrecv`, no infinite re-INVITE | ☐ |
| 12 | iPhone | Wi-Fi | Speaker | FusionPBX answers `a=recvonly` | Log `remote=recvonly — continuing to send RTP anyway`; TX packets keep incrementing | ☐ |
| 13 | iPhone | Wi-Fi | Earpiece | Force kill SIP socket mid-call (airplane mode toggle) | Engine restart backoff (0.5s, 1s, 2s, …) attempts visible, gives up after 8 | ☐ |
| 14 | iPhone | Wi-Fi | Earpiece | Toggle silent switch mid-call | Audio continues (PlayAndRecord bypasses ringer mute) | ☐ |
| 15 | iPad (if supported) | Wi-Fi | Speaker | Fresh launch | Same category logs; engine starts | ☐ |

## Regression guards

- Never see `audio session activate failed` after the fix.
- Never see repeated `engine start failed: code=561017449` without a
  successful restart logged within ~2 seconds.
- `LOCAL SDP (INVITE)` always contains `a=sendrecv` on a normal call.
- `engineRestartTotal` in the diagnostics snapshot stays ≤ 1 for nominal
  scenarios (rows 1–6, 10, 14, 15).

## Diagnostics snapshot fields (AudioDiagnosticsScreen)

New fields exposed by `RTPAudioSession.snapshot()`:
- `sessionState` — current AVAudioSession category/mode/options
- `engineRestartAttempts` — current backoff attempt counter
- `engineRestartTotal` — cumulative restart count since call start
- `lastEngineError` — last `engine.start()` NSError string
