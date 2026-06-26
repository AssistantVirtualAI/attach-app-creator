import Foundation
import Capacitor
import Network
import AVFoundation
import CommonCrypto

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
        CAPPluginMethod(name: "addListener", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),
    ]

    private var connection: NWConnection?
    private var sipDomain = ""
    private var sipExtension = ""
    private var sipPassword = ""
    private var sipHost = ""
    private var callId = ""
    private var fromTag = ""
    private var currentCallId = ""

    @objc func initAccount(_ call: CAPPluginCall) {
        sipExtension = call.getString("extension") ?? ""
        sipDomain = call.getString("domain") ?? ""
        sipPassword = call.getString("password") ?? ""
        sipHost = call.getString("host") ?? "pbxnode.lemtel.tel"
        fromTag = String(UUID().uuidString.prefix(8))
        callId = UUID().uuidString

        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            guard granted else {
                DispatchQueue.main.async { call.reject("Microphone permission denied") }
                return
            }
            try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try? AVAudioSession.sharedInstance().setActive(true)

            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(self.sipHost),
                port: NWEndpoint.Port(rawValue: 5060)!
            )
            self.connection = NWConnection(to: endpoint, using: .tcp)
            self.connection?.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .ready:
                    self.sendRegister(cseq: 1, authHeader: nil)
                    self.startReceiving()
                case .failed(let error):
                    DispatchQueue.main.async {
                        self.notifyListeners("registration", data: ["status": "error", "reason": error.localizedDescription])
                    }
                default: break
                }
            }
            self.connection?.start(queue: .global(qos: .userInitiated))
            DispatchQueue.main.async { call.resolve() }
        }
    }

    private func sendRegister(cseq: Int, authHeader: String?) {
        var msg = "REGISTER sip:\(sipDomain) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n"
        msg += "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n"
        msg += "To: <sip:\(sipExtension)@\(sipDomain)>\r\n"
        msg += "Call-ID: \(callId)\r\n"
        msg += "CSeq: \(cseq) REGISTER\r\n"
        msg += "Contact: <sip:\(sipExtension)@\(sipHost):5060;transport=tcp>\r\n"
        msg += "Expires: 300\r\nMax-Forwards: 70\r\nUser-Agent: AVA Softphone 1.0\r\n"
        if let auth = authHeader { msg += "Authorization: \(auth)\r\n" }
        msg += "Content-Length: 0\r\n\r\n"
        connection?.send(content: msg.data(using: .utf8)!, completion: .contentProcessed { _ in })
    }

    private func startReceiving() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, _ in
            guard let self = self, let data = data, let response = String(data: data, encoding: .utf8) else { return }
            self.handleSipResponse(response)
            self.startReceiving()
        }
    }

    private func handleSipResponse(_ response: String) {
        if response.contains("SIP/2.0 401") || response.contains("SIP/2.0 407") {
            let realm = extractValue(from: response, key: "realm")
            let nonce = extractValue(from: response, key: "nonce")
            let ha1 = md5("\(sipExtension):\(realm):\(sipPassword)")
            let ha2 = md5("REGISTER:sip:\(sipDomain)")
            let dr = md5("\(ha1):\(nonce):\(ha2)")
            let auth = "Digest username=\"\(sipExtension)\", realm=\"\(realm)\", nonce=\"\(nonce)\", uri=\"sip:\(sipDomain)\", response=\"\(dr)\""
            sendRegister(cseq: 2, authHeader: auth)
        } else if response.hasPrefix("SIP/2.0 200") && response.contains("CSeq: 2 REGISTER") {
            DispatchQueue.main.async {
                self.notifyListeners("registration", data: ["status": "registered", "extension": self.sipExtension])
            }
        } else if response.hasPrefix("SIP/2.0 180") {
            DispatchQueue.main.async { self.notifyListeners("callStateChanged", data: ["state": "ringing"]) }
        } else if response.hasPrefix("SIP/2.0 200") && response.contains("INVITE") {
            sendAck()
            DispatchQueue.main.async { self.notifyListeners("callStateChanged", data: ["state": "active"]) }
        } else if response.hasPrefix("BYE") {
            DispatchQueue.main.async { self.notifyListeners("callEnded", data: [:]) }
        } else if response.hasPrefix("INVITE") {
            let number = extractCallerNumber(from: response)
            DispatchQueue.main.async { self.notifyListeners("callReceived", data: ["number": number]) }
        }
    }

    private func sendAck() {
        var msg = "ACK sip:\(sipDomain) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n"
        msg += "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n"
        msg += "To: <sip:\(sipDomain)>\r\nCall-ID: \(currentCallId)\r\nCSeq: 1 ACK\r\nContent-Length: 0\r\n\r\n"
        connection?.send(content: msg.data(using: .utf8)!, completion: .contentProcessed { _ in })
    }

    @objc func makeCall(_ call: CAPPluginCall) {
        guard let number = call.getString("number") else { call.reject("Missing number"); return }
        currentCallId = UUID().uuidString
        let sdp = "v=0\r\no=\(sipExtension) 0 0 IN IP4 \(sipHost)\r\ns=AVA\r\nc=IN IP4 \(sipHost)\r\nt=0 0\r\nm=audio 8000 RTP/AVP 0 8 101\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\na=rtpmap:101 telephone-event/8000\r\na=sendrecv\r\n"
        var msg = "INVITE sip:\(number)@\(sipDomain) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n"
        msg += "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n"
        msg += "To: <sip:\(number)@\(sipDomain)>\r\nCall-ID: \(currentCallId)\r\nCSeq: 1 INVITE\r\n"
        msg += "Contact: <sip:\(sipExtension)@\(sipHost):5060;transport=tcp>\r\n"
        msg += "Content-Type: application/sdp\r\nMax-Forwards: 70\r\nContent-Length: \(sdp.utf8.count)\r\n\r\n\(sdp)"
        connection?.send(content: msg.data(using: .utf8)!, completion: .contentProcessed { _ in })
        notifyListeners("callStateChanged", data: ["state": "ringing"])
        call.resolve()
    }

    @objc func hangup(_ call: CAPPluginCall) {
        var msg = "BYE sip:\(sipDomain) SIP/2.0\r\n"
        msg += "Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n"
        msg += "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\nTo: <sip:\(sipDomain)>\r\n"
        msg += "Call-ID: \(currentCallId)\r\nCSeq: 2 BYE\r\nContent-Length: 0\r\n\r\n"
        connection?.send(content: msg.data(using: .utf8)!, completion: .contentProcessed { _ in })
        notifyListeners("callEnded", data: [:])
        call.resolve()
    }

    @objc func answer(_ call: CAPPluginCall) { call.resolve() }
    @objc func setMute(_ call: CAPPluginCall) { call.resolve() }
    @objc func setHold(_ call: CAPPluginCall) { call.resolve() }
    @objc func setLogLevel(_ call: CAPPluginCall) { call.resolve() }

    @objc func sendDTMF(_ call: CAPPluginCall) {
        let digits = call.getString("digits") ?? ""
        let info = "INFO sip:\(sipDomain) SIP/2.0\r\nContent-Type: application/dtmf-relay\r\nContent-Length: 26\r\n\r\nSignal=\(digits)\r\nDuration=250\r\n"
        connection?.send(content: info.data(using: .utf8)!, completion: .contentProcessed { _ in })
        call.resolve()
    }

    private func extractCallerNumber(from message: String) -> String {
        if let range = message.range(of: "From:.*?sip:([^@>]+)@", options: .regularExpression) {
            let match = String(message[range])
            if let sipRange = match.range(of: "sip:") {
                return String(match[sipRange.upperBound...]).components(separatedBy: "@")[0]
            }
        }
        return "Unknown"
    }

    private func extractValue(from text: String, key: String) -> String {
        if let range = text.range(of: "\(key)=\"([^\"]+)\"", options: .regularExpression) {
            return String(text[range]).components(separatedBy: "\"")[1]
        }
        return ""
    }

    private func md5(_ string: String) -> String {
        let data = Data(string.utf8)
        var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
        data.withUnsafeBytes { _ = CC_MD5($0.baseAddress, CC_LONG(data.count), &digest) }
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
