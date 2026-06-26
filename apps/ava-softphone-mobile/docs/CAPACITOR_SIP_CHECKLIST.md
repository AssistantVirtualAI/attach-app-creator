# CapacitorSip — iOS validation & E2E test protocol

Native SIP/TLS plugin on port **5061** via Apple `Network.framework`, with
CallKit, periodic REGISTER refresh (every 240 s), graceful UNREGISTER on
`disconnect()`, and strict TLS (SNI + TLS 1.2+).

---

## 0. Quick sync

```bash
# Full sync (macOS + Xcode + CocoaPods required)
./scripts/ios-sync-and-validate.sh

# Static check only (safe on CI / sandboxes — no build, no Xcode)
./scripts/ios-sync-and-validate.sh --check
```

The `--check` mode validates plugin files, `Info.plist` keys, and the
`VITE_NATIVE_SIP=true` flag. Use it before every commit.

Manual equivalent of the full flow:

```bash
npm install
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
open ios/App/App.xcworkspace
```

In Xcode: drag `ios/App/App/Plugins/CapacitorSip/` into the **App** target
(Create groups, check "App"). Verify `CapacitorSip.swift` and `CapacitorSip.m`
appear in **Build Phases → Compile Sources**.

---

## 1. Required `Info.plist` keys

| Key | Value |
| --- | --- |
| `NSMicrophoneUsageDescription` | "AVA Softphone a besoin du microphone pour vos appels." |
| `NSLocalNetworkUsageDescription` | "AVA Softphone a besoin d'accéder au réseau local pour établir vos appels téléphoniques." |
| `UIBackgroundModes` | array containing `audio` **and** `voip` |

---

## 2. Enabling verbose logging on device

The plugin emits a `log` event for every meaningful step. Set the level once at
app boot (or per session via a debug screen):

```ts
import { CapacitorSipNative, attachNativeSipLogger } from '@/lib/sip/nativeSipProvider';

// Levels: 0=off 1=error 2=warn 3=info (default) 4=debug 5=verbose (full SIP frames)
await CapacitorSipNative.setLogLevel({ level: 5 });
const stopLogger = await attachNativeSipLogger(); // mirrors all events to console

// Or pass it directly at init:
await CapacitorSipNative.initAccount({ extension, domain, password, host, logLevel: 5 });
```

You can also use the new `log` listener to surface lines in your own UI overlay:

```ts
import { onNativeSipEvent } from '@/lib/sip/nativeSipProvider';
await onNativeSipEvent('log', e => mySink.push(e));
```

### Log categories emitted

| Category | What it covers |
| --- | --- |
| `init` | initAccount params, extension, host |
| `audio` | microphone permission, AVAudioSession config |
| `tls` | NWConnection state, SNI, handshake, cert validation, failures |
| `sip-out` / `sip-in` | outgoing & incoming SIP frames (full text at level 5, redacted) |
| `register` | REGISTER refresh timer, auth challenges, 200 OK, UNREGISTER |
| `call` | makeCall, hangup, mute, hold, DTMF, INVITE/BYE flow |
| `callkit` | CXProvider, CXAnswer/End/Start/Mute/Hold actions, audio session |

Passwords and Digest `response=` are **redacted** automatically at level 5.

---

## 3. E2E test protocol — physical iOS device

Run every scenario on a real iPhone over **Wi-Fi or cellular** (TLS:5061 does
not route in the iOS Simulator).

For each step, the **Success criteria** column must all be true.

### Scenario A — Connection & registration

| Step | Action | Success criteria |
| --- | --- | --- |
| A1 | Fresh install, launch app | Microphone + Local Network prompts shown, both accepted |
| A2 | Sign in (extension auto-loaded) | `[tls] Opening TLS connection to pbxnode.lemtel.tel:5061 SNI=...` |
| A3 | Wait ≤ 5 s | `[tls] NWConnection ready` then `[register] Auth challenge received` then `[register] 200 OK REGISTER` |
| A4 | JS receives `registration` event | `{ status: 'registered', extension: '...' }` |
| A5 | Wireshark / PCAP on PBX | ClientHello with SNI `pbxnode.lemtel.tel`, TLS ≥ 1.2 |

**FAIL signals**: `[tls][ERROR] NWConnection failed`, looping 401, `[tls][ERROR] Certificate validation FAILED`.

### Scenario B — REGISTER refresh

| Step | Action | Success criteria |
| --- | --- | --- |
| B1 | Stay registered, leave the app idle 6 min (foreground OR background) | A new `[register] Refresh REGISTER cseq=N` line appears every ~240 s |
| B2 | PBX server log | REGISTER with `Expires: 300` every 240 s, Auth header reused |
| B3 | App stays reachable for inbound calls after 5 min | Inbound INVITE in Scenario D still triggers CallKit |

### Scenario C — Outbound call

| Step | Action | Success criteria |
| --- | --- | --- |
| C1 | Dial a number, tap call | `[call] makeCall to <num>` + `[callkit] CXStartCallAction` |
| C2 | CallKit UI | Native green outgoing UI shown, app name "AVA Softphone" |
| C3 | INVITE → 180 → 200 | `[call] 180 Ringing` then `[call] 200 OK INVITE — sending ACK, call active` |
| C4 | Audio | Two-way audio, no echo, switch to Bluetooth/speaker works |
| C5 | End from app or CallKit | `[call] hangup() — sending BYE` + `[callkit] CXEndCallAction fulfilled` |

### Scenario D — Inbound call

| Step | Action | Success criteria |
| --- | --- | --- |
| D1 | App registered, screen locked | PBX sends INVITE → `[call] Incoming INVITE from <num>` |
| D2 | CallKit UI | Native ringer + lock-screen answer/decline buttons |
| D3 | Answer from lock screen | `[callkit] CXAnswerCallAction fulfilled` + `callStateChanged → active` |
| D4 | Decline | `[callkit] CXEndCallAction fulfilled` + 603 Decline reported to PBX |

### Scenario E — Mute

| Step | Action | Success criteria |
| --- | --- | --- |
| E1 | During active call, tap Mute in app | `[call] setMute(true)` + `[callkit] CXSetMutedCallAction muted=true` |
| E2 | Far end | Caller no longer hears local audio |
| E3 | Tap Mute again | `muted=false` log, audio restored, `muteChanged` JS event received |
| E4 | Mute from CallKit native UI | App receives `muteChanged { muted: true }` |

### Scenario F — Hold

| Step | Action | Success criteria |
| --- | --- | --- |
| F1 | Tap Hold in app | `[call] setHold(true)` + `[callkit] CXSetHeldCallAction onHold=true` |
| F2 | Far end | Hears hold tone / silence; local audio paused |
| F3 | Resume | `onHold=false` log + `holdChanged { held: false }` event |

### Scenario G — UNREGISTER on disconnect

| Step | Action | Success criteria |
| --- | --- | --- |
| G1 | Call `CapacitorSipNative.disconnect()` (e.g. sign-out button) | `[register] disconnect() — sending UNREGISTER (Expires: 0)` |
| G2 | PBX log | REGISTER with `Expires: 0` received, contact removed |
| G3 | After ~0.5 s | `[tls] Closing NWConnection after UNREGISTER` + JS receives `registration { status: 'unregistered' }` |
| G4 | Inbound INVITE attempted by PBX | Routed to voicemail / 480 Temporarily Unavailable |

### Scenario H — Resilience

| Step | Action | Success criteria |
| --- | --- | --- |
| H1 | Toggle Airplane Mode ON 10 s, then OFF | `[tls][ERROR] NWConnection failed` then reconnect every 5 s |
| H2 | After network back | New TLS handshake, `200 OK REGISTER` within ~5 s |
| H3 | Kill app (swipe up) | PBX sees REGISTER expire at 300 s (no graceful UNREGISTER expected) |

---

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `[tls][ERROR] Certificate validation FAILED` | Server cert CN/SAN ≠ `pbxnode.lemtel.tel`, or expired | Reissue cert, verify SAN includes the FQDN |
| `[tls][ERROR] NWConnection failed: ...` on every retry | TLS 1.2 not offered by PBX, or port blocked | Check firewall, enable TLS 1.2 on PBX |
| 401 loop, no `200 OK REGISTER` | Bad password, or realm parsing failed | Verify quoted Digest values in `[sip-in]` verbose log |
| `Microphone permission denied` | User refused prompt | Settings → AVA Softphone → Microphone |
| No CallKit UI | `UIBackgroundModes` missing `voip`, or running in Simulator | Add `voip` to Info.plist, deploy to device |
| Registration drops at ~5 min | `[register] Starting REGISTER refresh timer` log absent → timer never armed | Confirm `200 OK REGISTER` reached `handleSipResponse` |
| No audio one-way | NAT / RTP blocked | Check SDP `c=` line, configure SBC/NAT helper on PBX |

---

## 5. CI / pre-flight check

Add to your pipeline:

```bash
./apps/ava-softphone-mobile/scripts/ios-sync-and-validate.sh --check
```

This guards against regressions where the Info.plist or feature flag get
removed accidentally. Full E2E is a manual gate before TestFlight builds.
