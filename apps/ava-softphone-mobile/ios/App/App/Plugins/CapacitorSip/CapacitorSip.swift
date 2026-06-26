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
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise)
    ]

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
    private var localSdpPort: Int = 40000

    // MARK: - Logging
    private func log(_ msg: String) {
        NSLog("[CapacitorPjsip] \(msg)")
        self.notifyListeners("log", data: ["message": msg])
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
        configureAudioSession()
        requestMicPermission { [weak self] granted in
            guard let self = self else { return }
            self.log("mic permission granted=\(granted)")
            self.notifyListeners("micPermission", data: ["granted": granted, "status": granted ? "granted" : "denied"])
            if !granted {
                self.notifyListeners("registration", data: ["state": "error", "status": "error", "reason": "microphone permission denied"])
                self.notifyListeners("registrationFailed", data: ["reason": "Microphone permission denied — enable it in iOS Settings"])
                return
            }
            self.connectAndRegister()
        }
        call.resolve(["ok": true])
    }

    // MARK: - Audio
    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord,
                                    mode: .voiceChat,
                                    options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker, .duckOthers])
            try session.setPreferredSampleRate(48000)
            try session.setPreferredIOBufferDuration(0.02)
            try session.setActive(true, options: [])
            log("AVAudioSession configured (playAndRecord/voiceChat)")
        } catch {
            log("AVAudioSession error: \(error.localizedDescription)")
        }
    }

    private func requestMicPermission(_ cb: @escaping (Bool) -> Void) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted: cb(true)
        case .denied:  cb(false)
        case .undetermined: session.requestRecordPermission { granted in DispatchQueue.main.async { cb(granted) } }
        @unknown default: cb(false)
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
        sendInvite(to: number, authHeader: nil)
        notifyListeners("callStateChanged", data: ["state": "ringing", "direction": "out", "number": number, "callId": callActiveId, "stage": "invite_sent"])
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
        resetCallState()
        notifyListeners("callEnded", data: ["callId": id, "reason": "local_hangup"])
        call.resolve(["ok": true])
    }

    @objc func answer(_ call: CAPPluginCall) {
        if callState != "incoming" { call.reject("no incoming call"); return }
        sendResponseToInvite(code: 200, reason: "OK", withSdp: true)
        callState = "active"
        notifyListeners("callStateChanged", data: ["state": "active", "direction": "in", "callId": callActiveId])
        call.resolve(["ok": true])
    }

    @objc func setMute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? !isMuted
        isMuted = muted
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .voiceChat,
                                    options: muted ? [.allowBluetooth, .defaultToSpeaker] : [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker, .duckOthers])
            try session.setActive(true, options: [])
        } catch {
            log("setMute audio session error: \(error.localizedDescription)")
        }
        notifyListeners("muteChanged", data: ["muted": muted])
        call.resolve(["ok": true, "muted": muted])
    }

    @objc func setHold(_ call: CAPPluginCall) {
        let hold = call.getBool("held") ?? call.getBool("onHold") ?? !isOnHold
        if callActiveId.isEmpty || (callState != "active" && callState != "hold") {
            call.reject("no active call")
            return
        }
        isOnHold = hold
        callCseq += 1
        sendReInvite(hold: hold)
        callState = hold ? "hold" : "active"
        notifyListeners("holdChanged", data: ["held": hold, "onHold": hold])
        call.resolve(["ok": true, "held": hold])
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

    // MARK: - TCP / SIP
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
            resetCallState()
            notifyListeners("callEnded", data: ["callId": id, "reason": "remote_bye"])
        case "CANCEL":
            send200OK(to: msg)
            if callState == "incoming" {
                sendResponseToInvite(code: 487, reason: "Request Terminated")
                let id = callActiveId
                resetCallState()
                notifyListeners("callEnded", data: ["callId": id, "reason": "remote_cancel"])
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
        let fromH = headerValue(msg, "From") ?? ""
        callRemoteUri = extractUri(fromH)
        callRemoteContact = extractUri(headerValue(msg, "Contact") ?? fromH)
        let fromNumber = extractUser(fromH)
        // Send 100 Trying then 180 Ringing
        sendResponseToInvite(code: 100, reason: "Trying")
        sendResponseToInvite(code: 180, reason: "Ringing")
        notifyListeners("callReceived", data: ["from": fromNumber, "callId": callActiveId])
        notifyListeners("callStateChanged", data: ["state": "ringing", "direction": "in", "number": fromNumber, "callId": callActiveId])
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
                let comps = l.split(separator: " ")
                if comps.count >= 3 { cseqMethod = String(comps[2]) }
                break
            }
        }
        log("response code=\(code) cseqMethod=\(cseqMethod) callDirection=\(callDirection) callState=\(callState) callId=\(callActiveId)")
        // REGISTER responses
        if cseqMethod == "REGISTER" {
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
                notifyListeners("registrationFailed", data: ["reason": firstLine])
            }
        }

        // INVITE responses (outgoing call leg)
        if cseqMethod == "INVITE" && callDirection == "out" && !callActiveId.isEmpty {
            if code == "100" {
                // Trying — noop
            } else if code == "180" || code == "183" {
                callState = "ringing"
                notifyListeners("callStateChanged", data: ["state": "ringing", "direction": "out", "callId": callActiveId])
            } else if code == "401" || code == "407" {
                log("INVITE auth challenge \(code) — keeping call ringing and retrying with digest auth")
                callState = "ringing"
                notifyListeners("callStateChanged", data: ["state": "ringing", "direction": "out", "callId": callActiveId, "stage": "auth_challenge", "code": code])
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
                    resetCallState()
                    notifyListeners("callEnded", data: ["callId": id, "reason": "INVITE \(code) without auth header"])
                }
            } else if code == "200" {
                callRemoteTag = extractTag(headerValue(msg, "To") ?? "")
                if let contact = headerValue(msg, "Contact") { callRemoteContact = extractUri(contact) }
                sendAck(to: msg, withinDialog: true)
                callState = "active"
                notifyListeners("callStateChanged", data: ["state": "active", "direction": "out", "callId": callActiveId])
            } else if let n = Int(code), n >= 300 {
                sendAck(to: msg, withinDialog: false)
                let id = callActiveId
                resetCallState()
                notifyListeners("callEnded", data: ["callId": id, "reason": firstLine])
            }
        }
        // BYE response — clean up
        if cseqMethod == "BYE" {
            // already notified locally on hangup
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
        let localIp = "0.0.0.0"
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
        isMuted = false; isOnHold = false
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
        let ip = "0.0.0.0"
        let direction = hold ? "a=sendonly" : "a=sendrecv"
        var sdp = ""
        sdp += "v=0\r\n"
        sdp += "o=- \(Int(Date().timeIntervalSince1970)) 1 IN IP4 \(ip)\r\n"
        sdp += "s=CapacitorPjsip\r\n"
        sdp += "c=IN IP4 \(ip)\r\n"
        sdp += "t=0 0\r\n"
        sdp += "m=audio \(localSdpPort) RTP/AVP 0 8 101\r\n"
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
        var msg = ""
        msg += "INVITE \(uri) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP 0.0.0.0;branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(uri)>\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) INVITE\r\n"
        msg += "Contact: <sip:\(username)@0.0.0.0;transport=tcp>\r\n"
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
        let viaH = headerValue(response, "Via") ?? "SIP/2.0/TCP 0.0.0.0;branch=\(branch)"
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
        msg += "Via: SIP/2.0/TCP 0.0.0.0;branch=\(br);rport\r\n"
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
        msg += "Via: SIP/2.0/TCP 0.0.0.0;branch=\(br);rport\r\n"
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
        var msg = ""
        msg += "INVITE \(target) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP 0.0.0.0;branch=\(br);rport\r\n"
        msg += "Max-Forwards: 70\r\n"
        msg += "From: \"\(displayName)\" <sip:\(username)@\(domain)>;tag=\(callLocalTag)\r\n"
        msg += "To: <\(callRemoteUri)>" + (callRemoteTag.isEmpty ? "" : ";tag=\(callRemoteTag)") + "\r\n"
        msg += "Call-ID: \(callActiveId)\r\n"
        msg += "CSeq: \(callCseq) INVITE\r\n"
        msg += "Contact: <sip:\(username)@0.0.0.0;transport=tcp>\r\n"
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
        msg += "Via: SIP/2.0/TCP 0.0.0.0;branch=\(br);rport\r\n"
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
            resp += "Contact: <sip:\(username)@0.0.0.0;transport=tcp>\r\n"
        }
        if withSdp && code == 200 {
            let sdp = buildSdp()
            resp += "Content-Type: application/sdp\r\n"
            resp += "Content-Length: \(sdp.utf8.count)\r\n\r\n"
            resp += sdp
        } else {
            resp += "Content-Length: 0\r\n\r\n"
        }
        sendRaw(resp)
        log(">>> \(code) \(reason) (to INVITE)")
    }
}
