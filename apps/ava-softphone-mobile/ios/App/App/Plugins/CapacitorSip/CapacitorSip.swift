import Foundation
import Capacitor
import Network
import AVFoundation
import CallKit
import CommonCrypto

@objc(CapacitorSip)
public class CapacitorSip: CAPPlugin, CXProviderDelegate {

    // MARK: - SIP state
    private var connection: NWConnection?
    private var sipDomain = ""
    private var sipExtension = ""
    private var sipPassword = ""
    private var sipHost = ""
    private let sipPort: UInt16 = 5061
    private var callId = ""
    private var fromTag = ""
    private var cseq = 1
    private var isRegistered = false
    private var currentCallId = ""
    private var lastAuthHeader: String? = nil
    private var registerTimer: DispatchSourceTimer?
    private let registerIntervalSec: Int = 240 // refresh well before 300s Expires
    private var shouldReconnect = true

    // MARK: - CallKit
    private lazy var callProvider: CXProvider = {
        let config = CXProviderConfiguration(localizedName: "AVA Softphone")
        config.supportsVideo = false
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.phoneNumber, .generic]
        let provider = CXProvider(configuration: config)
        provider.setDelegate(self, queue: nil)
        return provider
    }()
    private let callController = CXCallController()
    private var activeCallUUID: UUID?

    // MARK: - Init / Register
    @objc func initAccount(_ call: CAPPluginCall) {
        sipExtension = call.getString("extension") ?? ""
        sipDomain = call.getString("domain") ?? ""
        sipPassword = call.getString("password") ?? ""
        sipHost = call.getString("host") ?? "pbxnode.lemtel.tel"
        fromTag = String(UUID().uuidString.prefix(8))
        callId = UUID().uuidString
        shouldReconnect = true

        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            guard granted else {
                DispatchQueue.main.async { call.reject("Microphone permission denied") }
                return
            }

            try? AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetooth, .defaultToSpeaker]
            )
            try? AVAudioSession.sharedInstance().setActive(true)

            self.startTlsConnection()
            DispatchQueue.main.async { call.resolve() }
        }
    }

    private func startTlsConnection() {
        // TLS parameters with SNI + strict cert validation
        let tlsOptions = NWProtocolTLS.Options()
        let secOptions = tlsOptions.securityProtocolOptions
        sec_protocol_options_set_tls_server_name(secOptions, sipHost)
        sec_protocol_options_set_min_tls_protocol_version(secOptions, .TLSv12)

        let tcpOptions = NWProtocolTCP.Options()
        tcpOptions.enableKeepalive = true
        tcpOptions.keepaliveIdle = 30
        tcpOptions.connectionTimeout = 10

        let params = NWParameters(tls: tlsOptions, tcp: tcpOptions)
        params.serviceClass = .signaling

        let endpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host(sipHost),
            port: NWEndpoint.Port(rawValue: sipPort)!
        )

        self.connection = NWConnection(to: endpoint, using: params)
        self.connection?.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                self.cseq = 1
                self.lastAuthHeader = nil
                self.sendRegister(cseq: self.cseq, authHeader: nil)
                self.startReceiving()
            case .failed(let error):
                DispatchQueue.main.async {
                    self.notifyListeners("registration", data: [
                        "status": "error",
                        "reason": error.localizedDescription
                    ])
                }
                self.scheduleReconnect()
            case .cancelled:
                self.isRegistered = false
            default:
                break
            }
        }
        self.connection?.start(queue: .global(qos: .userInitiated))
    }

    private func scheduleReconnect() {
        guard shouldReconnect else { return }
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) { [weak self] in
            guard let self = self, self.shouldReconnect else { return }
            self.startTlsConnection()
        }
    }

    private func startRegisterTimer() {
        registerTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: .global())
        timer.schedule(deadline: .now() + .seconds(registerIntervalSec), repeating: .seconds(registerIntervalSec))
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            self.cseq += 1
            self.sendRegister(cseq: self.cseq, authHeader: self.lastAuthHeader)
        }
        timer.resume()
        registerTimer = timer
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        shouldReconnect = false
        registerTimer?.cancel()
        registerTimer = nil
        // Send UNREGISTER (Expires: 0) before closing
        sendRegister(cseq: cseq + 1, authHeader: lastAuthHeader, expires: 0)
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.connection?.cancel()
            self?.connection = nil
            self?.isRegistered = false
            DispatchQueue.main.async {
                self?.notifyListeners("registration", data: ["status": "unregistered"])
                call.resolve()
            }
        }
    }

    private func sendRegister(cseq: Int, authHeader: String?, expires: Int = 300) {
        var headers = """
        REGISTER sip:\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TLS \(sipHost):\(sipPort);branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(sipExtension)@\(sipDomain)>\r\n\
        Call-ID: \(callId)\r\n\
        CSeq: \(cseq) REGISTER\r\n\
        Contact: <sip:\(sipExtension)@\(sipHost):\(sipPort);transport=tls>\r\n\
        Expires: \(expires)\r\n\
        Max-Forwards: 70\r\n\
        User-Agent: AVA Softphone 1.0\r\n
        """
        if let auth = authHeader {
            headers += "Authorization: \(auth)\r\n"
        }
        headers += "Content-Length: 0\r\n\r\n"

        let data = headers.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
    }

    private func startReceiving() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, error in
            guard let self = self else { return }
            if let data = data, let response = String(data: data, encoding: .utf8) {
                self.handleSipResponse(response)
            }
            if error == nil {
                self.startReceiving()
            }
        }
    }

    private func handleSipResponse(_ response: String) {
        if response.contains("SIP/2.0 401") || response.contains("SIP/2.0 407") {
            let realm = self.extractValue(from: response, key: "realm")
            let nonce = self.extractValue(from: response, key: "nonce")
            let ha1 = self.md5("\(sipExtension):\(realm):\(sipPassword)")
            let ha2 = self.md5("REGISTER:sip:\(sipDomain)")
            let digestResp = self.md5("\(ha1):\(nonce):\(ha2)")
            let authHeader = "Digest username=\"\(sipExtension)\", realm=\"\(realm)\", nonce=\"\(nonce)\", uri=\"sip:\(sipDomain)\", response=\"\(digestResp)\""
            self.lastAuthHeader = authHeader
            self.cseq += 1
            self.sendRegister(cseq: self.cseq, authHeader: authHeader)
        } else if response.hasPrefix("SIP/2.0 200") && response.contains("REGISTER") {
            DispatchQueue.main.async {
                self.isRegistered = true
                self.notifyListeners("registration", data: [
                    "status": "registered",
                    "extension": self.sipExtension
                ])
            }
            self.startRegisterTimer()
        } else if response.hasPrefix("SIP/2.0 180") {
            DispatchQueue.main.async {
                self.notifyListeners("callStateChanged", data: ["state": "ringing"])
            }
        } else if response.hasPrefix("SIP/2.0 200") && response.contains("INVITE") {
            self.sendAck(response: response)
            DispatchQueue.main.async {
                self.notifyListeners("callStateChanged", data: ["state": "active"])
            }
        } else if response.hasPrefix("BYE") {
            DispatchQueue.main.async {
                self.endActiveCallKitCall()
                self.notifyListeners("callEnded", data: [:])
            }
        } else if response.hasPrefix("INVITE") {
            let callerNumber = self.extractCallerNumber(from: response)
            self.reportIncomingCallKit(number: callerNumber)
            DispatchQueue.main.async {
                self.notifyListeners("callReceived", data: ["number": callerNumber])
            }
        }
    }

    private func sendAck(response: String) {
        let ack = """
        ACK sip:\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TLS \(sipHost):\(sipPort);branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(sipDomain)>\r\n\
        Call-ID: \(currentCallId)\r\n\
        CSeq: 1 ACK\r\n\
        Max-Forwards: 70\r\n\
        Content-Length: 0\r\n\r\n
        """
        let data = ack.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
    }

    @objc func makeCall(_ call: CAPPluginCall) {
        guard let number = call.getString("number") else {
            call.reject("Missing number")
            return
        }
        currentCallId = UUID().uuidString
        startOutgoingCallKit(number: number)

        let sdp = """
        v=0\r\n\
        o=\(sipExtension) 0 0 IN IP4 \(sipHost)\r\n\
        s=AVA Softphone\r\n\
        c=IN IP4 \(sipHost)\r\n\
        t=0 0\r\n\
        m=audio 8000 RTP/AVP 0 8 101\r\n\
        a=rtpmap:0 PCMU/8000\r\n\
        a=rtpmap:8 PCMA/8000\r\n\
        a=rtpmap:101 telephone-event/8000\r\n\
        a=fmtp:101 0-16\r\n\
        a=sendrecv\r\n
        """

        let invite = """
        INVITE sip:\(number)@\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TLS \(sipHost):\(sipPort);branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(number)@\(sipDomain)>\r\n\
        Call-ID: \(currentCallId)\r\n\
        CSeq: 1 INVITE\r\n\
        Contact: <sip:\(sipExtension)@\(sipHost):\(sipPort);transport=tls>\r\n\
        Content-Type: application/sdp\r\n\
        Max-Forwards: 70\r\n\
        User-Agent: AVA Softphone 1.0\r\n\
        Content-Length: \(sdp.utf8.count)\r\n\r\n\(sdp)
        """

        let data = invite.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
        notifyListeners("callStateChanged", data: ["state": "ringing"])
        call.resolve()
    }

    @objc func hangup(_ call: CAPPluginCall) {
        let bye = """
        BYE sip:\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TLS \(sipHost):\(sipPort);branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(sipDomain)>\r\n\
        Call-ID: \(currentCallId)\r\n\
        CSeq: 2 BYE\r\n\
        Content-Length: 0\r\n\r\n
        """
        let data = bye.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
        endActiveCallKitCall()
        notifyListeners("callEnded", data: [:])
        call.resolve()
    }

    @objc func answer(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func setMute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(!muted)
        call.resolve()
    }

    @objc func setHold(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func sendDTMF(_ call: CAPPluginCall) {
        let digits = call.getString("digits") ?? ""
        let body = "Signal=\(digits)\r\nDuration=250\r\n"
        let info = """
        INFO sip:\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TLS \(sipHost):\(sipPort);branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(sipDomain)>\r\n\
        Call-ID: \(currentCallId)\r\n\
        CSeq: 3 INFO\r\n\
        Content-Type: application/dtmf-relay\r\n\
        Content-Length: \(body.utf8.count)\r\n\r\n\(body)
        """
        let data = info.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
        call.resolve()
    }

    // MARK: - CallKit helpers
    private func reportIncomingCallKit(number: String) {
        let uuid = UUID()
        activeCallUUID = uuid
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .phoneNumber, value: number)
        update.hasVideo = false
        callProvider.reportNewIncomingCall(with: uuid, update: update) { _ in }
    }

    private func startOutgoingCallKit(number: String) {
        let uuid = UUID()
        activeCallUUID = uuid
        let handle = CXHandle(type: .phoneNumber, value: number)
        let action = CXStartCallAction(call: uuid, handle: handle)
        callController.request(CXTransaction(action: action)) { _ in }
    }

    private func endActiveCallKitCall() {
        guard let uuid = activeCallUUID else { return }
        let action = CXEndCallAction(call: uuid)
        callController.request(CXTransaction(action: action)) { _ in }
        activeCallUUID = nil
    }

    // MARK: - CXProviderDelegate
    public func providerDidReset(_ provider: CXProvider) {
        activeCallUUID = nil
    }
    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        notifyListeners("callStateChanged", data: ["state": "active"])
        action.fulfill()
    }
    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        notifyListeners("callEnded", data: [:])
        action.fulfill()
    }
    public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        action.fulfill()
    }
    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(!action.isMuted)
        action.fulfill()
    }

    // MARK: - Parsing helpers
    private func extractCallerNumber(from message: String) -> String {
        let pattern = "From:.*?sip:([^@>]+)@"
        if let range = message.range(of: pattern, options: .regularExpression) {
            let match = String(message[range])
            let parts = match.components(separatedBy: "sip:")
            if parts.count > 1 {
                return parts[1].components(separatedBy: "@")[0]
            }
        }
        return "Unknown"
    }

    private func extractValue(from text: String, key: String) -> String {
        let pattern = "\(key)=\"([^\"]+)\""
        if let range = text.range(of: pattern, options: .regularExpression) {
            let match = String(text[range])
            let parts = match.components(separatedBy: "\"")
            if parts.count > 1 { return parts[1] }
        }
        return ""
    }

    private func md5(_ string: String) -> String {
        let data = Data(string.utf8)
        var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
        data.withUnsafeBytes { ptr in
            _ = CC_MD5(ptr.baseAddress, CC_LONG(data.count), &digest)
        }
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
