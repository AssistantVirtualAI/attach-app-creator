# CapacitorSip — iOS validation checklist

Native SIP/TLS plugin on port 5061 via `Network.framework`, with CallKit,
periodic REGISTER refresh, graceful UNREGISTER, and strict TLS (SNI + TLS 1.2+).

## One-shot sync

```bash
./scripts/ios-sync-and-validate.sh
```

Equivalent manual steps:

```bash
npm install
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
open ios/App/App.xcworkspace
```

In Xcode: drag `ios/App/App/Plugins/CapacitorSip/` into the **App** target
(Create groups, check "App"). Verify `CapacitorSip.swift` and `CapacitorSip.m`
are in **Build Phases → Compile Sources**.

## Required Info.plist keys

- `NSMicrophoneUsageDescription`
- `NSLocalNetworkUsageDescription`
- `UIBackgroundModes` → `audio`, `voip`

## Device test plan

1. **Registration** — within ~5 s of launch, event
   `registration { status: 'registered' }` is emitted. Bad credentials → `error`.
2. **TLS** — Wireshark/PCAP shows ClientHello with SNI = `pbxnode.lemtel.tel`,
   TLS 1.2 or higher, port 5061. Cert chain validated by iOS trust store.
3. **Register refresh** — leave the app idle 6 minutes; server-side log shows
   a fresh REGISTER every ~240 s (before the 300 s `Expires`).
4. **Outbound call** — `makeCall({ number })` → CallKit "outgoing" UI, INVITE
   sent over TLS, 180 then 200 OK, ACK auto-sent, two-way audio.
5. **Inbound call** — server sends INVITE → native CallKit ring screen, answer
   from lock-screen works.
6. **DTMF** — keypad press → INFO with `application/dtmf-relay` body.
7. **Hangup** — BYE sent, CXEndCallAction fulfilled, `callEnded` event.
8. **Disconnect** — calling `CapacitorSipNative.disconnect()` sends REGISTER
   with `Expires: 0` then closes the NWConnection.
9. **Reconnect** — kill network briefly; on `.failed` state the plugin
   schedules a reconnect in 5 s and re-registers automatically.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| TLS handshake fails | Server cert CN/SAN ≠ `pbxnode.lemtel.tel` or TLS < 1.2 |
| 401 loop | Bad password — Digest realm/nonce parsing relies on quoted values |
| No CallKit UI | `UIBackgroundModes` missing `voip`, or running in Simulator |
| Registration drops at ~5 min | Refresh timer not started — check `200 OK REGISTER` is reached |
