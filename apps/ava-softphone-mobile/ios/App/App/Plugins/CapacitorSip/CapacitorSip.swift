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

    // MARK: - Logging
    private func log(_ msg: String) {
        NSLog("[CapacitorPjsip] \(msg)")
        self.notifyListeners("log", data: ["message": msg])
    }

    // MARK: - Plugin methods
    @objc func initAccount(_ call: CAPPluginCall) {
        guard let server = call.getString("server"),
              let username = call.getString("username"),
              let password = call.getString("password") else {
            call.reject("server, username, password required")
            return
        }
        self.server = server
        self.port = UInt16(call.getInt("port") ?? 5060)
        self.username = username
        self.authUser = call.getString("authUser") ?? username
        self.password = password
        self.domain = call.getString("domain") ?? server
        self.displayName = call.getString("displayName") ?? username
        self.localTag = String(UUID().uuidString.prefix(8))
        self.callId = UUID().uuidString
        self.cseq = 1

        log("initAccount server=\(server):\(port) user=\(username) domain=\(self.domain)")
        configureAudioSession()
        requestMicPermission { [weak self] granted in
            guard let self = self else { return }
            self.log("mic permission granted=\(granted)")
            if !granted {
                self.notifyListeners("registrationFailed", data: ["reason": "microphone permission denied"])
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
        log("makeCall not yet implemented in native plugin")
        call.resolve(["ok": false, "reason": "not_implemented"])
    }
    @objc func hangup(_ call: CAPPluginCall) { call.resolve(["ok": true]) }
    @objc func answer(_ call: CAPPluginCall) { call.resolve(["ok": true]) }
    @objc func setMute(_ call: CAPPluginCall) { call.resolve(["ok": true]) }
    @objc func setHold(_ call: CAPPluginCall) { call.resolve(["ok": true]) }
    @objc func sendDTMF(_ call: CAPPluginCall) { call.resolve(["ok": true]) }
    @objc func setLogLevel(_ call: CAPPluginCall) { call.resolve(["ok": true]) }

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
        // SIP messages are separated by \r\n\r\n (header end). Naive split per response.
        while let range = rxBuffer.range(of: "\r\n\r\n") {
            let head = String(rxBuffer[..<range.upperBound])
            // We do not handle body length carefully here for REGISTER responses (usually no body).
            rxBuffer = String(rxBuffer[range.upperBound...])
            handleResponse(head)
        }
    }

    private func handleResponse(_ msg: String) {
        log("<<< \n\(msg)")
        let firstLine = msg.split(separator: "\r\n").first.map(String.init) ?? ""
        if firstLine.contains(" 401 ") || firstLine.contains(" 407 ") {
            // parse WWW-Authenticate
            if let wwwLine = msg.split(separator: "\r\n").first(where: {
                $0.lowercased().hasPrefix("www-authenticate:") || $0.lowercased().hasPrefix("proxy-authenticate:")
            }).map(String.init) {
                let (realm, nonce) = parseAuth(wwwLine)
                self.lastRealm = realm
                self.lastNonce = nonce
                cseq += 1
                sendRegister(authHeader: buildAuthHeader(method: "REGISTER", uri: "sip:\(domain)", realm: realm, nonce: nonce))
            } else {
                notifyListeners("registrationFailed", data: ["reason": "401 without auth header"])
            }
        } else if firstLine.contains(" 200 ") {
            if !registered {
                registered = true
                notifyListeners("registration", data: ["state": "registered"])
                // refresh every 50s
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
        } else if firstLine.range(of: " [4-6]\\d\\d ", options: .regularExpression) != nil {
            notifyListeners("registrationFailed", data: ["reason": firstLine])
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

    private func buildAuthHeader(method: String, uri: String, realm: String, nonce: String) -> String {
        let ha1 = md5("\(authUser):\(realm):\(password)")
        let ha2 = md5("\(method):\(uri)")
        let response = md5("\(ha1):\(nonce):\(ha2)")
        return "Authorization: Digest username=\"\(authUser)\", realm=\"\(realm)\", nonce=\"\(nonce)\", uri=\"\(uri)\", response=\"\(response)\", algorithm=MD5\r\n"
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
}
