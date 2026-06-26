import Foundation
import Capacitor
import Network
import CommonCrypto
import AVFoundation

@objc(CapacitorPjsip)
public class CapacitorPjsip: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorPjsip"
    public let jsName = "CapacitorPjsip"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initAccount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "makeCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hangup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "answer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHold", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendDTMF", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLogLevel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMicrophonePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playTestTone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRtpStats", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transfer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "park", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addCall", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        // Auto-detect Bluetooth / route changes and force audio route without restarting the call.
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification, object: nil)
    }

    @objc private func handleRouteChange(_ note: Notification) {
        guard let userInfo = note.userInfo,
              let reasonRaw = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonRaw) else { return }
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map { $0.portType.rawValue }
        let hasBT = outputs.contains { ["BluetoothHFP","BluetoothA2DPOutput","BluetoothLE"].contains($0) }
        log("route change reason=\(reasonRaw) outputs=\(outputs) bt=\(hasBT)")

        // Auto policy: BT connected → BT; BT disconnected → speaker (if call in progress).
        if !callActiveId.isEmpty {
            do {
                switch reason {
                case .newDeviceAvailable:
                    if hasBT {
                        if let bt = session.availableInputs?.first(where: { [.bluetoothHFP, .bluetoothLE].contains($0.portType) }) {
                            try session.setPreferredInput(bt)
                        }
                        try session.overrideOutputAudioPort(.none)
                    }
                case .oldDeviceUnavailable:
                    try session.overrideOutputAudioPort(.speaker)
                default: break
                }
            } catch {
                log("route auto-switch error: \(error.localizedDescription)")
            }
        }
        notifyListeners("audioRouteChanged", data: [
            "reason": reasonRaw,
            "outputs": outputs,
            "bluetooth": hasBT
        ])
    }

    // MARK: - Config / State
    private var server: String = ""
    private var port: UInt16 = 5060
    private var username: String = ""
    private var authUser: String = ""
    private var password: String = ""
    private var domain: String = ""
    private var displayName: String = ""

    private var connection: NWConnection?
    private let queue = DispatchQueue(label: "capacitor.pjsip.tcp")
    private var localTag: String = ""
    private var callId: String = ""
    private var cseq: Int = 1
    private var branch: String { "z9hG4bK-" + UUID().uuidString.replacingOccurrences(of: "-", with: "") }
    private var registered: Bool = false
    private var lastNonce: String?
    private var lastRealm: String?
    private var registerTimer: Timer?
    private var rxBuffer: String = ""

    // MARK: - Call state
    private var callActiveId: String = ""
    private var callLocalTag: String = ""
    private var callRemoteTag: String = ""
    private var callRemoteUri: String = ""
    private var callRemoteContact: String = ""
    private var callCseq: Int = 1
    private var callInviteBranch: String = ""
    private var callInviteCseq: Int = 1
    private var callDirection: String = "" // "out" | "in"
    private var callState: String = "idle"
    private var lastInviteRequest: String = ""
    private var lastInviteAuth: String? = nil
    private var isMuted: Bool = false
    private var isOnHold: Bool = false
    private var isRecording: Bool = false
    private var pendingHold: Bool? = nil
    private var localSdpPort: Int = 40000

    // MARK: - RTP audio
    private var rtp: RTPAudioSession?
    private var localRtpIp: String = "0.0.0.0"
    private var localRtpPort: UInt16 = 0
    private var remoteRtpIp: String = ""
    private var remoteRtpPort: UInt16 = 0
    private var rtpStarted: Bool = false

    private func ensureRtpSocket() {
        if rtp != nil { return }
        let session = RTPAudioSession()
        session.onAudioStateChanged = { [weak self] status, data in
            self?.notifyListeners("audioStateChanged", data: data)
        }
        do {
            try session.prepareLocalSocket()
            self.rtp = session
            self.localRtpIp = session.localIp
            self.localRtpPort = session.localPort
            log("RTP socket bound \(localRtpIp):\(localRtpPort)")
            // Prewarm RemoteIO AudioUnit BEFORE any INVITE so AudioUnitInitialize
            // happens once on a stable AVAudioSession (avoids 561017449 mid-call).
            session.prewarmAudio()
        } catch {
            log("RTP socket bind failed: \(error.localizedDescription)")
        }
    }

    private func startRtpIfReady() {
        guard !rtpStarted, let rtp = rtp, !remoteRtpIp.isEmpty, remoteRtpPort > 0 else {
            log("RTP not ready rtpStarted=\(rtpStarted) hasRtp=\(rtp != nil) remote=\(remoteRtpIp):\(remoteRtpPort)")
            return
        }
        rtpStarted = true
        rtp.setMuted(isMuted)
        rtp.start(remoteIp: remoteRtpIp, remotePort: remoteRtpPort)
        log("RTP started → \(remoteRtpIp):\(remoteRtpPort)")
    }

    private func stopRtp() {
        rtpStarted = false
        rtp?.stop()
        rtp = nil
        remoteRtpIp = ""; remoteRtpPort = 0
        localRtpIp = "0.0.0.0"; localRtpPort = 0
    }

    /// Parse SDP body, populating remoteRtpIp / remoteRtpPort.
    private func parseRemoteSdp(_ msg: String) {
        guard let bodyStart = msg.range(of: "\r\n\r\n") else { return }
        let body = String(msg[bodyStart.upperBound...])
        var ip = ""
        var port: UInt16 = 0
        var direction = "sendrecv" // default per RFC 3264 when no a=* present
        for raw in body.split(separator: "\r\n") {
            let line = String(raw)
            if line.hasPrefix("c=IN IP4 ") {
                ip = String(line.dropFirst("c=IN IP4 ".count)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("m=audio ") {
                let parts = line.split(separator: " ")
                if parts.count >= 2, let p = UInt16(parts[1]) { port = p }
            } else if line == "a=recvonly" || line == "a=sendonly" || line == "a=sendrecv" || line == "a=inactive" {
                direction = String(line.dropFirst("a=".count))
            }
        }
        if !ip.isEmpty && port > 0 {
            remoteRtpIp = ip
            remoteRtpPort = port
            log("remote SDP audio=\(ip):\(port) direction=\(direction)")
            // FusionPBX sometimes answers a=recvonly even though our offer was
            // sendrecv (typically when a media bug / bridge is mid-setup). We
            // keep transmitting RTP regardless — the remote can drop what it
            // doesn't want — to avoid one-way audio when the PBX re-negotiates.
            if direction == "recvonly" || direction == "inactive" {
                log("remote=\(direction) — continuing to send RTP anyway (FusionPBX compat)")
            }
        }
        // Dump full remote SDP for diagnostics (truncated to avoid log spam).
        let truncated = body.count > 800 ? String(body.prefix(800)) + "…[+\(body.count-800)b]" : body
        log("REMOTE SDP <<<\n\(truncated)")
    }


    // MARK: - Logging
    private func log(_ msg: String) {
        NSLog("[CapacitorPjsip] \(msg)")
        self.notifyListeners("log", data: ["message": msg])
    }

    /// Best-effort local IPv4 to advertise in SIP signaling headers (Via, Contact).
    /// Avoids 0.0.0.0 which some PBX (NetSapiens) reject when NAT keepalive is off.
    private func sigLocalIp() -> String {
        return RTPAudioSession.primaryLocalIPv4() ?? "0.0.0.0"
    }

    private func emitCallState(_ state: String, direction: String? = nil, number: String? = nil, stage: String? = nil, code: String? = nil) {
        var data: [String: Any] = ["state": state, "callId": callActiveId]
        if let direction = direction ?? (callDirection.isEmpty ? nil : callDirection) { data["direction"] = direction }
        if let number = number { data["number"] = number }
        if let stage = stage { data["stage"] = stage }
        if let code = code { data["code"] = code }
        log("CALL_EVENT|callStateChanged|state=\(state)|stage=\(stage ?? "")|code=\(code ?? "")|callState=\(callState)|callId=\(callActiveId)")
        notifyListeners("callStateChanged", data: data)
    }

    private func emitCallEnded(_ reason: String, callId id: String? = nil) {
        let endedId = id ?? callActiveId
        log("CALL_EVENT|callEnded|reason=\(reason)|callId=\(endedId)")
        notifyListeners("callEnded", data: ["callId": endedId, "reason": reason])
    }

    // MARK: - Plugin methods
    @objc func initAccount(_ call: CAPPluginCall) {
        // Accept both legacy (server/username) and JS-side (domain/extension) param names.
        let domainParam = call.getString("domain")
        let server = call.getString("server") ?? domainParam ?? ""
        let username = call.getString("username") ?? call.getString("extension") ?? ""
        let password = call.getString("password") ?? ""
        if server.isEmpty || username.isEmpty || password.isEmpty {
            call.reject("server/domain, username/extension, password required")
            return
        }

        // Re-entrancy guard: if already registered or a connection is already
        // up, just re-emit registered and skip opening a new TCP socket. React
        // StrictMode / parent re-renders otherwise spam initAccount.
        let sameAccount = (self.server == server && self.username == username && self.password == password)
        if sameAccount && registered {
            log("initAccount skipped — already registered for \(username)@\(server)")
            notifyListeners("registration", data: ["state": "registered", "status": "registered"])
            call.resolve(["ok": true, "alreadyRegistered": true])
            return
        }
        if sameAccount, let conn = connection, conn.state == .ready || conn.state == .preparing {
            log("initAccount skipped — connection already \(conn.state) for \(username)@\(server)")
            call.resolve(["ok": true, "inFlight": true])
            return
        }
        self.server = server
        self.port = UInt16(call.getInt("port") ?? 5060)
        self.username = username
        self.authUser = call.getString("authUser") ?? username
        self.password = password
        self.domain = domainParam ?? server
        self.displayName = call.getString("displayName") ?? username
        self.localTag = String(UUID().uuidString.prefix(8))
        self.callId = UUID().uuidString
        self.cseq = 1

        log("initAccount server=\(server):\(port) user=\(username) domain=\(self.domain)")
        requestMicPermission { [weak self] granted in
            guard let self = self else { return }
            self.log("mic permission granted=\(granted)")
            let deniedReason = self.microphoneDeniedReason()
            self.notifyListeners("micPermission", data: [
                "granted": granted,
                "status": granted ? "granted" : "denied",
                "reason": granted ? "" : deniedReason
            ])
            if !granted {
                self.notifyListeners("registration", data: [
                    "state": "error",
                    "status": "error",
                    "reason": deniedReason
                ])
                self.notifyListeners("registrationFailed", data: ["reason": deniedReason])
                call.reject(deniedReason)
                return
            }
            self.configureAudioSession()
            self.connectAndRegister()
            call.resolve(["ok": true])
        }
    }

    // MARK: - Audio
    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            log("AVAudioSession configure begin permission=\(session.recordPermission.rawValue) route=\(audioRouteSummary())")
            try session.setCategory(.playAndRecord,
                                    mode: .voiceChat,
                                    options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker, .duckOthers])
            try session.setPreferredSampleRate(48000)
            try session.setPreferredIOBufferDuration(0.02)
            try session.setActive(true, options: [])
            log("AVAudioSession configured cat=\(session.category.rawValue) mode=\(session.mode.rawValue) sr=\(Int(session.sampleRate))Hz io=\(Int(session.ioBufferDuration * 1000))ms route=\(audioRouteSummary())")
        } catch {
            log("AVAudioSession error: \(error.localizedDescription)")
        }
    }

    private func microphoneDeniedReason() -> String {
        return "Microphone access is required for calls and two-way audio. Enable it in iOS Settings → Lemtel → Microphone, then reopen the app."
    }

    private func audioRouteSummary() -> String {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
        let inputs = session.currentRoute.inputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
        return "in=[\(inputs)] out=[\(outputs)]"
    }

    private func requestMicPermission(_ cb: @escaping (Bool) -> Void) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted:
            log("mic permission state=granted")
            cb(true)
        case .denied:
            log("mic permission state=denied")
            cb(false)
        case .undetermined:
            log("mic permission state=undetermined — requesting")
            session.requestRecordPermission { granted in DispatchQueue.main.async { cb(granted) } }
        @unknown default: cb(false)
        }
    }

    @objc func requestMicrophonePermission(_ call: CAPPluginCall) {
        log("explicit microphone permission request from JS")
        requestMicPermission { [weak self] granted in
            guard let self = self else { return }
            let reason = granted ? "" : self.microphoneDeniedReason()
            self.notifyListeners("micPermission", data: [
                "granted": granted,
                "status": granted ? "granted" : "denied",
                "reason": reason
            ])
            if granted { self.configureAudioSession() }
            call.resolve(["ok": true, "granted": granted, "status": granted ? "granted" : "denied", "reason": reason])
        }
    }

    @objc func makeCall(_ call: CAPPluginCall) {
        let number = call.getString("number") ?? call.getString("destination") ?? ""
        if number.isEmpty { call.reject("number required"); return }
        if !registered { call.reject("not registered"); return }
        callDirection = "out"
        callActiveId = UUID().uuidString
        callLocalTag = String(UUID().uuidString.prefix(8))
        callRemoteTag = ""
        callRemoteUri = "sip:\(number)@\(domain)"
        callRemoteContact = callRemoteUri
        callCseq = 1
        callState = "calling"
        isMuted = false
        isOnHold = false
        ensureRtpSocket()
        emitCallState("ringing", direction: "out", number: number, stage: "before_invite")
        sendInvite(to: number, authHeader: nil)
        emitCallState("ringing", direction: "out", number: number, stage: "invite_sent")
        call.resolve(["ok": true, "callId": callActiveId])
    }

    @objc func hangup(_ call: CAPPluginCall) {
        if callActiveId.isEmpty { call.resolve(["ok": true, "noCall": true]); return }
        if callState == "calling" || callState == "ringing" {
            sendCancel()
        } else if callState == "active" || callState == "hold" {
            sendBye()
        } else if callState == "incoming" {
            sendResponseToInvite(code: 486, reason: "Busy Here")
        }
        let id = callActiveId
        stopRtp()
        emitCallEnded("local_hangup", callId: id)
        resetCallState()
        call.resolve(["ok": true])
    }

    @objc func answer(_ call: CAPPluginCall) {
        if callState != "incoming" { call.reject("no incoming call"); return }
        ensureRtpSocket()
        parseRemoteSdp(lastInviteRequest)
        sendResponseToInvite(code: 200, reason: "OK", withSdp: true)
        callState = "active"
        startRtpIfReady()
        emitCallState("active", direction: "in")
        call.resolve(["ok": true])
    }


    @objc func setMute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? !isMuted
        isMuted = muted
        rtp?.setMuted(muted)
        log("mute changed muted=\(muted) — RTP samples \(muted ? "zeroed" : "live"), AVAudioSession unchanged")
        notifyListeners("muteChanged", data: ["muted": muted])
        call.resolve(["ok": true, "muted": muted])
    }

    @objc func setHold(_ call: CAPPluginCall) {
        let hold = call.getBool("held") ?? call.getBool("onHold") ?? !isOnHold
        if callActiveId.isEmpty || (callState != "active" && callState != "hold") {
            call.reject("no active call")
            return
        }
        if hold == isOnHold {
            // No-op: already in the requested state, don't spam re-INVITEs.
            call.resolve(["ok": true, "held": hold, "noop": true])
            return
        }
        pendingHold = hold
        callCseq += 1
        sendReInvite(hold: hold)
        // NOTE: don't mark held/resumed until the PBX confirms with 200 OK.
        notifyListeners("holdPending", data: ["held": hold, "onHold": hold])
        call.resolve(["ok": true, "held": hold, "pending": true])
    }

    @objc func sendDTMF(_ call: CAPPluginCall) {
        let digits = call.getString("digits") ?? call.getString("digit") ?? ""
        if digits.isEmpty || callActiveId.isEmpty { call.resolve(["ok": false]); return }
        for ch in digits {
            sendInfoDtmf(digit: String(ch))
            callCseq += 1
        }
        call.resolve(["ok": true])
    }

    @objc func setLogLevel(_ call: CAPPluginCall) { call.resolve(["ok": true, "level": call.getInt("level") ?? 3]) }

    @objc func unregister(_ call: CAPPluginCall) {
        connection?.cancel()
        connection = nil
        registered = false
        notifyListeners("registration", data: ["state": "unregistered"])
        call.resolve(["ok": true])
    }

    // MARK: - Audio route control (speaker / earpiece / bluetooth)
    @objc func setAudioRoute(_ call: CAPPluginCall) {
        let route = (call.getString("route") ?? "auto").lowercased()
        let session = AVAudioSession.sharedInstance()
        do {
            // Always (re)assert playAndRecord/voiceChat with BT allowed.
            try session.setCategory(.playAndRecord, mode: .voiceChat,
                                    options: [.allowBluetooth, .allowBluetoothA2DP,
                                              .defaultToSpeaker, .duckOthers])
            try session.setActive(true, options: [])

            switch route {
            case "speaker":
                try session.overrideOutputAudioPort(.speaker)
            case "earpiece", "receiver", "none":
                try session.overrideOutputAudioPort(.none)
            case "bluetooth":
                // Pick first Bluetooth input as preferred — iOS then routes audio there.
                if let bt = session.availableInputs?.first(where: { input in
                    [.bluetoothHFP, .bluetoothLE].contains(input.portType)
                }) {
                    try session.setPreferredInput(bt)
                }
                try session.overrideOutputAudioPort(.none)
            default:
                break
            }
            let outputs = session.currentRoute.outputs.map { "\($0.portType.rawValue)" }.joined(separator: ",")
            log("audio route set → \(route) actual=\(outputs)")
            call.resolve(["ok": true, "route": route, "outputs": outputs])
        } catch {
            log("setAudioRoute error: \(error.localizedDescription)")
            call.reject(error.localizedDescription)
        }
    }

    @objc func getAudioRoute(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map {
            ["portType": $0.portType.rawValue, "portName": $0.portName]
        }
        let inputs = session.availableInputs?.map {
            ["portType": $0.portType.rawValue, "portName": $0.portName]
        } ?? []
        call.resolve(["outputs": outputs, "availableInputs": inputs])
    }

    // MARK: - Pre-call audio test
    @objc func playTestTone(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 1.5
        let freq = call.getDouble("frequency") ?? 440.0
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .voiceChat,
                                    options: [.allowBluetooth, .allowBluetoothA2DP,
                                              .defaultToSpeaker, .duckOthers])
            try session.setActive(true, options: [])
        } catch { /* non-fatal */ }
        let tester = rtp ?? RTPAudioSession()
        tester.playTestTone(seconds: seconds, frequency: freq)
        // Sample mic peak for `seconds` then return the max value.
        let deadline = DispatchTime.now() + .milliseconds(Int(seconds * 1000) + 200)
        DispatchQueue.global().asyncAfter(deadline: deadline) {
            let snap = tester.snapshot()
            call.resolve([
                "ok": true,
                "micPeak": snap["micPeak"] ?? 0,
                "route": snap["route"] ?? ""
            ])
        }
    }

    @objc func getRtpStats(_ call: CAPPluginCall) {
        if let rtp = rtp {
            call.resolve(rtp.snapshot())
        } else {
            call.resolve(["running": false])
        }
    }

    private func connectAndRegister() {
        connection?.cancel()
        let host = NWEndpoint.Host(server)
        let nwPort = NWEndpoint.Port(rawValue: port) ?? 5060
        let conn = NWConnection(host: host, port: nwPort, using: .tcp)
        self.connection = conn

        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            self.log("nw state=\(state)")
            switch state {
            case .ready:
                self.notifyListeners("registration", data: ["state": "connecting"])
                self.startReceive()
                self.sendRegister(authHeader: nil)
            case .failed(let err):
                self.notifyListeners("registrationFailed", data: ["reason": "socket: \(err.localizedDescription)"])
            case .cancelled:
                self.registered = false
            default: break
            }
        }
        conn.start(queue: queue)
    }

    private func startReceive() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty, let str = String(data: data, encoding: .utf8) {
                self.rxBuffer += str
                self.processBuffer()
            }
            if let error = error {
                self.log("rx error: \(error.localizedDescription)")
                self.notifyListeners("registrationFailed", data: ["reason": error.localizedDescription])
                return
            }
            if !isComplete { self.startReceive() }
        }
    }

    private func processBuffer() {
        // Parse SIP messages respecting Content-Length.
        while let headerEnd = rxBuffer.range(of: "\r\n\r\n") {
            let headerPart = String(rxBuffer[..<headerEnd.lowerBound])
            var contentLength = 0
            for line in headerPart.split(separator: "\r\n") {
                let l = line.lowercased()
                if l.hasPrefix("content-length:") || l.hasPrefix("l:") {
                    let v = line.split(separator: ":", maxSplits: 1).last.map { String($0).trimmingCharacters(in: .whitespaces) } ?? "0"
                    contentLength = Int(v) ?? 0
                }
            }
            let afterHeaders = rxBuffer[headerEnd.upperBound...]
            let bodyBytes = afterHeaders.utf8.count
            if bodyBytes < contentLength { return } // wait for full body
            var consumed = headerEnd.upperBound
            if contentLength > 0 {
                let bodyData = Array(afterHeaders.utf8.prefix(contentLength))
                let body = String(bytes: bodyData, encoding: .utf8) ?? ""
                consumed = rxBuffer.index(headerEnd.upperBound, offsetBy: body.count)
            }
            let fullMsg = String(rxBuffer[..<consumed])
            rxBuffer = String(rxBuffer[consumed...])
            handleMessage(fullMsg)
        }
    }

    private func handleMessage(_ msg: String) {
        log("<<< \n\(msg)")
        let firstLine = msg.split(separator: "\r\n").first.map(String.init) ?? ""
        if firstLine.hasPrefix("SIP/2.0 ") {
            handleResponse(msg, firstLine: firstLine)
        } else {
            handleRequest(msg, firstLine: firstLine)
        }
    }

    private func handleRequest(_ msg: String, firstLine: String) {
        let method = firstLine.split(separator: " ").first.map(String.init) ?? ""
        switch method {
        case "INVITE":
            handleIncomingInvite(msg)
        case "ACK":
            // Confirmed answered call (for incoming we answered)
            if callDirection == "in" && callState == "active" {
                log("ACK received — call confirmed")
            }
        case "BYE":
            send200OK(to: msg)
            let id = callActiveId
            stopRtp()
            emitCallEnded("remote_bye", callId: id)
            resetCallState()
        case "CANCEL":
            send200OK(to: msg)
            if callState == "incoming" {
                sendResponseToInvite(code: 487, reason: "Request Terminated")
                let id = callActiveId
                stopRtp()
                emitCallEnded("remote_cancel", callId: id)
                resetCallState()
            }

        case "INFO", "NOTIFY", "OPTIONS", "MESSAGE":
            send200OK(to: msg)
        default:
            send200OK(to: msg)
        }
    }

    private func handleIncomingInvite(_ msg: String) {
        lastInviteRequest = msg
        callDirection = "in"
        callState = "incoming"
        callActiveId = headerValue(msg, "Call-ID") ?? UUID().uuidString
        callLocalTag = String(UUID().uuidString.prefix(8))
        ensureRtpSocket()
        parseRemoteSdp(msg)

        let fromH = headerValue(msg, "From") ?? ""
        callRemoteUri = extractUri(fromH)
        callRemoteContact = extractUri(headerValue(msg, "Contact") ?? fromH)
        let fromNumber = extractUser(fromH)
        // Send 100 Trying then 180 Ringing
        sendResponseToInvite(code: 100, reason: "Trying")
        sendResponseToInvite(code: 180, reason: "Ringing")
        notifyListeners("callReceived", data: ["from": fromNumber, "callId": callActiveId])
        emitCallState("ringing", direction: "in", number: fromNumber)
    }

    private func send200OK(to request: String) {
        let lines = request.split(separator: "\r\n").map(String.init)
        var via = "", from = "", toH = "", callid = "", cseqH = ""
        for l in lines {
            let lo = l.lowercased()
            if lo.hasPrefix("via:") { via = l }
            else if lo.hasPrefix("from:") { from = l }
            else if lo.hasPrefix("to:") { toH = l }
            else if lo.hasPrefix("call-id:") { callid = l }
            else if lo.hasPrefix("cseq:") { cseqH = l }
        }
        var resp = "SIP/2.0 200 OK\r\n"
        resp += via + "\r\n"
        resp += from + "\r\n"
        resp += toH + (toH.contains(";tag=") ? "" : ";tag=\(localTag)") + "\r\n"
        resp += callid + "\r\n"
        resp += cseqH + "\r\n"
        resp += "Content-Length: 0\r\n\r\n"
        sendRaw(resp)
        log(">>> 200 OK (in-dialog)")
    }

    private func handleResponse(_ msg: String, firstLine: String) {
        let parts = firstLine.split(separator: " ", maxSplits: 2).map(String.init)
        let code = parts.count > 1 ? parts[1] : ""
        var cseqMethod = ""
        for l in msg.split(separator: "\r\n") {
            if l.lowercased().hasPrefix("cseq:") {
                let comps = l.split(whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
                if comps.count >= 3 {
                    cseqMethod = comps[2].trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                }
                break
            }
        }
        log("response code=\(code) cseqMethod=\(cseqMethod) callDirection=\(callDirection) callState=\(callState) callId=\(callActiveId)")

        if cseqMethod == "REGISTER" {
            handleRegisterResponse(code: code, msg: msg)
            return
        }

        // INVITE responses (outgoing call leg). We accept the response even if
        // callDirection/callActiveId got cleared by a stray cleanup — as long as
        // we recently sent an INVITE, the 200 OK must transition the UI.
        if cseqMethod == "INVITE" {
            if code == "100" {
                // Trying — noop
            } else if code == "180" || code == "183" {
                callState = "ringing"
                emitCallState("ringing", direction: "out", stage: code == "180" ? "remote_ringing" : "early_media", code: code)
            } else if code == "401" || code == "407" {
                log("INVITE auth challenge \(code) — retrying with digest")
                callState = "ringing"
                emitCallState("ringing", direction: "out", stage: "auth_challenge", code: code)
                if let wwwLine = msg.split(separator: "\r\n").first(where: {
                    $0.lowercased().hasPrefix("www-authenticate:") || $0.lowercased().hasPrefix("proxy-authenticate:")
                }).map(String.init) {
                    let (realm, nonce) = parseAuth(wwwLine)
                    let target = extractUser(callRemoteUri)
                    let isProxyAuth = wwwLine.lowercased().hasPrefix("proxy-authenticate:") || code == "407"
                    let auth = buildAuthHeader(method: "INVITE", uri: callRemoteUri, realm: realm, nonce: nonce, proxy: isProxyAuth)
                    sendAck(to: msg, withinDialog: false)
                    callCseq += 1
                    sendInvite(to: target, authHeader: auth)
                } else {
                    log("INVITE \(code) missing auth header")
                    let id = callActiveId
                    stopRtp()
                    emitCallEnded("INVITE \(code) without auth header", callId: id)
                    resetCallState()
                }
            } else if code == "200" {
                // Detect re-INVITE (within an established dialog) vs initial INVITE 200 OK.
                let isReInvite = !callRemoteTag.isEmpty && (callState == "active" || callState == "hold")
                callRemoteTag = extractTag(headerValue(msg, "To") ?? "")
                if let contact = headerValue(msg, "Contact") { callRemoteContact = extractUri(contact) }
                parseRemoteSdp(msg)
                sendAck(to: msg, withinDialog: true)
                if isReInvite {
                    // Hold / resume confirmation. Do NOT touch callState, do NOT restart RTP.
                    // Just refresh the remote RTP target (PBX may relay through different IP/port).
                    if let confirmed = pendingHold {
                        isOnHold = confirmed
                        callState = confirmed ? "hold" : "active"
                        pendingHold = nil
                    }
                    log("CALL_EVENT|reINVITE_200_OK|held=\(isOnHold)|callState=\(callState)|callId=\(callActiveId)")
                    notifyListeners("holdChanged", data: ["held": isOnHold, "onHold": isOnHold])
                } else {
                    if callDirection.isEmpty { callDirection = "out" }
                    callState = "active"
                    startRtpIfReady()
                    log("CALL_EVENT|INVITE_200_OK→active|callId=\(callActiveId)")
                    emitCallState("active", direction: "out", stage: "answered", code: code)
                }
            } else if let n = Int(code), n >= 300 {
                sendAck(to: msg, withinDialog: false)
                let id = callActiveId
                stopRtp()
                emitCallEnded(firstLine, callId: id)
                resetCallState()
            }

        }
        // BYE response — clean up
        if cseqMethod == "BYE" {
            // already notified locally on hangup
        }
    }

    private func handleRegisterResponse(code: String, msg: String) {
        if code == "401" || code == "407" {
            if let wwwLine = msg.split(separator: "\r\n").first(where: {
                $0.lowercased().hasPrefix("www-authenticate:") || $0.lowercased().hasPrefix("proxy-authenticate:")
            }).map(String.init) {
                let (realm, nonce) = parseAuth(wwwLine)
                self.lastRealm = realm
                self.lastNonce = nonce
                cseq += 1
                let isProxyAuth = wwwLine.lowercased().hasPrefix("proxy-authenticate:") || code == "407"
                sendRegister(authHeader: buildAuthHeader(method: "REGISTER", uri: "sip:\(domain)", realm: realm, nonce: nonce, proxy: isProxyAuth))
            } else {
                notifyListeners("registrationFailed", data: ["reason": "401 without auth header"])
            }
        } else if code == "200" {
            if !registered {
                registered = true
                log("REGISTERED ✓ — notifying JS")
                notifyListeners("registration", data: ["state": "registered", "status": "registered", "extension": username])
                DispatchQueue.main.async {
                    self.registerTimer?.invalidate()
                    self.registerTimer = Timer.scheduledTimer(withTimeInterval: 50, repeats: true) { _ in
                        self.cseq += 1
                        if let realm = self.lastRealm, let nonce = self.lastNonce {
                            self.sendRegister(authHeader: self.buildAuthHeader(method: "REGISTER", uri: "sip:\(self.domain)", realm: realm, nonce: nonce))
                        } else {
                            self.sendRegister(authHeader: nil)
                        }
                    }
                }
            }
        } else if let n = Int(code), n >= 400 {
            notifyListeners("registrationFailed", data: ["reason": "REGISTER \(code)"])
        }
    }


    private func parseAuth(_ header: String) -> (String, String) {
        func extract(_ key: String) -> String {
            let pattern = "\(key)=\"([^\"]+)\""
            if let r = header.range(of: pattern, options: .regularExpression) {
                let part = String(header[r])
                if let eq = part.range(of: "=\"") {
                    return String(part[eq.upperBound..<part.index(before: part.endIndex)])
                }
            }
            return ""
        }
        return (extract("realm"), extract("nonce"))
    }

    private func md5(_ s: String) -> String {
        let data = Data(s.utf8)
        var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
        data.withUnsafeBytes { _ = CC_MD5($0.baseAddress, CC_LONG(data.count), &digest) }
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func buildAuthHeader(method: String, uri: String, realm: String, nonce: String, proxy: Bool = false) -> String {
        let ha1 = md5("\(authUser):\(realm):\(password)")
        let ha2 = md5("\(method):\(uri)")
        let response = md5("\(ha1):\(nonce):\(ha2)")
        let headerName = proxy ? "Proxy-Authorization" : "Authorization"
        return "\(headerName): Digest username=\"\(authUser)\", realm=\"\(realm)\", nonce=\"\(nonce)\", uri=\"\(uri)\", response=\"\(response)\", algorithm=MD5\r\n"
    }

    private func sendRegister(authHeader: String?) {
        let localIp = sigLocalIp()
        let transport = "TCP"
        let br = branch
        var msg = ""
        msg += "REGISTER sip:\(domain) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/\(transport) \(localIp);branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(localTag)\r\n"
        msg += "To: <sip:\(username)@\(domain)>\r\n"
        msg += "Call-ID: \(callId)\r\n"
        msg += "CSeq: \(cseq) REGISTER\r\n"
        msg += "Contact: <sip:\(username)@\(localIp);transport=\(transport.lowercased())>\r\n"
        msg += "Expires: 60\r\n"
        msg += "User-Agent: CapacitorPjsip/1.0\r\n"
        if let auth = authHeader { msg += auth }
        msg += "Content-Length: 0\r\n\r\n"

        log(">>> REGISTER cseq=\(cseq)\(authHeader != nil ? " (with auth)" : "")")
        guard let conn = connection else {
            notifyListeners("registrationFailed", data: ["reason": "no connection"])
            return
        }
        conn.send(content: msg.data(using: .utf8), completion: .contentProcessed { [weak self] error in
            if let error = error {
                self?.log("send error: \(error.localizedDescription)")
                self?.notifyListeners("registrationFailed", data: ["reason": error.localizedDescription])
            }
        })
    }

    private func sendRaw(_ msg: String) {
        guard let conn = connection else { return }
        conn.send(content: msg.data(using: .utf8), completion: .contentProcessed { [weak self] error in
            if let error = error { self?.log("sendRaw error: \(error.localizedDescription)") }
        })
    }

    // MARK: - Call signaling helpers
    private func resetCallState() {
        callActiveId = ""; callLocalTag = ""; callRemoteTag = ""
        callRemoteUri = ""; callRemoteContact = ""
        callState = "idle"; callDirection = ""
        callInviteBranch = ""; callInviteCseq = 1
        isMuted = false; isOnHold = false; pendingHold = nil; isRecording = false
        lastInviteRequest = ""; lastInviteAuth = nil
    }

    private func headerValue(_ msg: String, _ name: String) -> String? {
        let prefix = name.lowercased() + ":"
        for raw in msg.split(separator: "\r\n") {
            let line = String(raw)
            if line.lowercased().hasPrefix(prefix) {
                let v = line.dropFirst(prefix.count).trimmingCharacters(in: .whitespaces)
                return v
            }
        }
        return nil
    }

    private func extractUri(_ header: String) -> String {
        if let lt = header.firstIndex(of: "<"), let gt = header.firstIndex(of: ">"), lt < gt {
            return String(header[header.index(after: lt)..<gt])
        }
        return header.split(separator: ";").first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? header
    }

    private func extractUser(_ uri: String) -> String {
        let u = uri.replacingOccurrences(of: "sip:", with: "").replacingOccurrences(of: "sips:", with: "")
        if let at = u.firstIndex(of: "@") { return String(u[..<at]) }
        return u
    }

    private func extractTag(_ header: String) -> String {
        for part in header.split(separator: ";") {
            let p = part.trimmingCharacters(in: .whitespaces)
            if p.lowercased().hasPrefix("tag=") { return String(p.dropFirst(4)) }
        }
        return ""
    }

    private func cseqNumber(_ msg: String) -> Int {
        guard let cseqH = headerValue(msg, "CSeq") else { return callCseq }
        let comps = cseqH.split(separator: " ")
        if let first = comps.first, let n = Int(first) { return n }
        return callCseq
    }

    private func buildSdp(hold: Bool = false) -> String {
        let ip = localRtpIp.isEmpty || localRtpIp == "0.0.0.0"
            ? (RTPAudioSession.primaryLocalIPv4() ?? "0.0.0.0")
            : localRtpIp
        let port = localRtpPort > 0 ? Int(localRtpPort) : localSdpPort
        let direction = hold ? "a=sendonly" : "a=sendrecv"
        var sdp = ""
        sdp += "v=0\r\n"
        sdp += "o=- \(Int(Date().timeIntervalSince1970)) 1 IN IP4 \(ip)\r\n"
        sdp += "s=CapacitorPjsip\r\n"
        sdp += "c=IN IP4 \(ip)\r\n"
        sdp += "t=0 0\r\n"
        sdp += "m=audio \(port) RTP/AVP 0 8 101\r\n"

        sdp += "a=rtpmap:0 PCMU/8000\r\n"
        sdp += "a=rtpmap:8 PCMA/8000\r\n"
        sdp += "a=rtpmap:101 telephone-event/8000\r\n"
        sdp += "a=fmtp:101 0-16\r\n"
        sdp += direction + "\r\n"
        return sdp
    }

    private func sendInvite(to number: String, authHeader: String?) {
        let br = branch
        callInviteBranch = br
        callInviteCseq = callCseq
        let uri = "sip:\(number)@\(domain)"
        callRemoteUri = uri
        let sdp = buildSdp()
        log("LOCAL SDP (INVITE) >>>\n\(sdp)")
        var msg = ""
        msg += "INVITE \(uri) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(uri)>\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) INVITE\r\n"
        msg += "Contact: <sip:\(username)@\(sigLocalIp());transport=tcp>\r\n"
        msg += "User-Agent: CapacitorPjsip/1.0\r\n"
        msg += "Allow: INVITE, ACK, CANCEL, BYE, INFO, OPTIONS, NOTIFY\r\n"
        if let auth = authHeader { msg += auth }
        msg += "Content-Type: application/sdp\r\n"
        msg += "Content-Length: \(sdp.utf8.count)\r\n\r\n"
        msg += sdp
        log(">>> INVITE \(uri) cseq=\(callCseq)\(authHeader != nil ? " (auth)" : "")")
        sendRaw(msg)
    }

    private func sendAck(to response: String, withinDialog: Bool) {
        let toH = headerValue(response, "To") ?? ""
        let fromH = headerValue(response, "From") ?? ""
        let callid = headerValue(response, "Call-ID") ?? callActiveId
        let viaH = headerValue(response, "Via") ?? "SIP/2.0/TCP \(sigLocalIp());branch=\(branch)"
        let target = withinDialog ? callRemoteContact : callRemoteUri
        var msg = ""
        msg += "ACK \(target) SIP/2.0\r\n"
        msg += "Via: \(viaH)\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \(fromH)\r\n"
        msg += "To: \(toH)\r\n"
        msg += "Call-ID: \(callid)\r\n"
        msg += "CSeq: \(cseqNumber(response)) ACK\r\n"
        msg += "Content-Length: 0\r\n\r\n"
        log(">>> ACK")
        sendRaw(msg)
    }

    private func sendBye() {
        callCseq += 1
        let br = branch
        var msg = ""
        msg += "BYE \(callRemoteContact.isEmpty ? callRemoteUri : callRemoteContact) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>" + (callRemoteTag.isEmpty ? "" : ";tag=\(callRemoteTag)") + "\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) BYE\r\n"
        msg += "User-Agent: CapacitorPjsip/1.0\r\n"
        msg += "Content-Length: 0\r\n\r\n"
        log(">>> BYE")
        sendRaw(msg)
    }

    private func sendCancel() {
        let br = callInviteBranch.isEmpty ? branch : callInviteBranch
        let cancelCseq = callInviteCseq
        var msg = ""
        msg += "CANCEL \(callRemoteUri) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(cancelCseq) CANCEL\r\n"
        msg += "Content-Length: 0\r\n\r\n"
        log(">>> CANCEL")
        sendRaw(msg)
    }

    private func sendReInvite(hold: Bool) {
        let br = branch
        let target = callRemoteContact.isEmpty ? callRemoteUri : callRemoteContact
        let sdp = buildSdp(hold: hold)
        log("LOCAL SDP (re-INVITE hold=\(hold)) >>>\n\(sdp)")
        var msg = ""
        msg += "INVITE \(target) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>" + (callRemoteTag.isEmpty ? "" : ";tag=\(callRemoteTag)") + "\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) INVITE\r\n"
        msg += "Contact: <sip:\(username)@\(sigLocalIp());transport=tcp>\r\n"
        msg += "Content-Type: application/sdp\r\n"
        msg += "Content-Length: \(sdp.utf8.count)\r\n\r\n"
        msg += sdp
        log(">>> re-INVITE hold=\(hold)")
        sendRaw(msg)
    }

    private func sendInfoDtmf(digit: String) {
        let body = "Signal=\(digit)\r\nDuration=160\r\n"
        let br = branch
        let target = callRemoteContact.isEmpty ? callRemoteUri : callRemoteContact
        var msg = ""
        msg += "INFO \(target) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>" + (callRemoteTag.isEmpty ? "" : ";tag=\(callRemoteTag)") + "\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) INFO\r\n"
        msg += "Content-Type: application/dtmf-relay\r\n"
        msg += "Content-Length: \(body.utf8.count)\r\n\r\n"
        msg += body
        log(">>> INFO DTMF \(digit)")
        sendRaw(msg)
    }

    private func sendResponseToInvite(code: Int, reason: String, withSdp: Bool = false) {
        guard !lastInviteRequest.isEmpty else { return }
        let lines = lastInviteRequest.split(separator: "\r\n").map(String.init)
        var via = "", from = "", toH = "", callid = "", cseqH = ""
        for l in lines {
            let lo = l.lowercased()
            if lo.hasPrefix("via:") && via.isEmpty { via = l }
            else if lo.hasPrefix("from:") { from = l }
            else if lo.hasPrefix("to:") { toH = l }
            else if lo.hasPrefix("call-id:") { callid = l }
            else if lo.hasPrefix("cseq:") { cseqH = l }
        }
        var resp = "SIP/2.0 \(code) \(reason)\r\n"
        resp += via + "\r\n"
        resp += from + "\r\n"
        resp += toH + (toH.contains(";tag=") ? "" : ";tag=\(callLocalTag)") + "\r\n"
        resp += callid + "\r\n"
        resp += cseqH + "\r\n"
        if code == 200 {
            resp += "Contact: <sip:\(username)@\(sigLocalIp());transport=tcp>\r\n"
        }
        if withSdp && code == 200 {
            let sdp = buildSdp()
            log("LOCAL SDP (\(code) answer) >>>\n\(sdp)")
            resp += "Content-Type: application/sdp\r\n"
            resp += "Content-Length: \(sdp.utf8.count)\r\n\r\n"
            resp += sdp
        } else {
            resp += "Content-Length: 0\r\n\r\n"
        }
        sendRaw(resp)
        log(">>> \(code) \(reason) (to INVITE)")
    }

    // MARK: - Record / Transfer / Park / AddCall

    /// Server-side recording toggle via SIP INFO `Record: on|off` (NetSapiens / FusionPBX standard).
    /// Falls back to DTMF feature code `*1` for PBX that don't support the INFO method.
    @objc func startRecord(_ call: CAPPluginCall) {
        if callActiveId.isEmpty || callState != "active" {
            call.reject("no active call")
            return
        }
        isRecording = true
        callCseq += 1
        sendInfoRecord(on: true)
        notifyListeners("recordingChanged", data: ["recording": true])
        call.resolve(["ok": true, "recording": true])
    }

    @objc func stopRecord(_ call: CAPPluginCall) {
        if callActiveId.isEmpty {
            call.resolve(["ok": true, "recording": false])
            return
        }
        isRecording = false
        callCseq += 1
        sendInfoRecord(on: false)
        notifyListeners("recordingChanged", data: ["recording": false])
        call.resolve(["ok": true, "recording": false])
    }

    @objc func transfer(_ call: CAPPluginCall) {
        let target = call.getString("target") ?? call.getString("number") ?? ""
        if target.isEmpty { call.reject("target required"); return }
        if callActiveId.isEmpty || (callState != "active" && callState != "hold") {
            call.reject("no active call")
            return
        }
        callCseq += 1
        sendRefer(to: target)
        call.resolve(["ok": true, "target": target])
    }

    @objc func park(_ call: CAPPluginCall) {
        let code = call.getString("code") ?? "*5"
        if callActiveId.isEmpty || (callState != "active" && callState != "hold") {
            call.reject("no active call")
            return
        }
        callCseq += 1
        sendRefer(to: code)
        call.resolve(["ok": true, "code": code])
    }

    @objc func addCall(_ call: CAPPluginCall) {
        let target = call.getString("target") ?? call.getString("number") ?? ""
        if target.isEmpty { call.reject("target required"); return }
        // Hold current call first (re-INVITE sendonly) so the user can place a new outbound leg.
        // Full multi-leg merging is the caller's responsibility (or the PBX with *3).
        if !callActiveId.isEmpty && callState == "active" && !isOnHold {
            isOnHold = true
            callCseq += 1
            sendReInvite(hold: true)
            notifyListeners("holdChanged", data: ["held": true, "onHold": true])
        }
        // Notify JS so it can fire a fresh makeCall() once the hold is acknowledged.
        notifyListeners("addCallRequested", data: ["target": target])
        call.resolve(["ok": true, "target": target, "note": "follow up with makeCall on JS side"])
    }

    // MARK: - Helpers for new methods

    private func sendInfoRecord(on: Bool) {
        let body = "Record: \(on ? "on" : "off")\r\n"
        let br = branch
        let target = callRemoteContact.isEmpty ? callRemoteUri : callRemoteContact
        var msg = ""
        msg += "INFO \(target) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>" + (callRemoteTag.isEmpty ? "" : ";tag=\(callRemoteTag)") + "\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) INFO\r\n"
        msg += "Content-Type: application/x-record-control\r\n"
        msg += "Content-Length: \(body.utf8.count)\r\n\r\n"
        msg += body
        log(">>> SIP INFO Record: \(on ? "on" : "off")")
        sendRaw(msg)
    }

    private func sendRefer(to target: String) {
        let br = branch
        let dialogTarget = callRemoteContact.isEmpty ? callRemoteUri : callRemoteContact
        // Normalize target: if it already looks like a SIP URI, keep it; otherwise build one.
        let referTo = target.lowercased().hasPrefix("sip:") ? target : "sip:\(target)@\(domain)"
        var msg = ""
        msg += "REFER \(dialogTarget) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sigLocalIp());branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>" + (callRemoteTag.isEmpty ? "" : ";tag=\(callRemoteTag)") + "\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) REFER\r\n"
        msg += "Refer-To: <\(referTo)>\r\n"
        msg += "Referred-By: <sip:\(username)@\(domain)>\r\n"
        msg += "Contact: <sip:\(username)@\(sigLocalIp());transport=tcp>\r\n"
        msg += "Content-Length: 0\r\n\r\n"
        log(">>> REFER → \(referTo)")
        sendRaw(msg)
    }
}
