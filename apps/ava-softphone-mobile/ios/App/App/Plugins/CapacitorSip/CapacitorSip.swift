import Foundation
import Capacitor
import Network
import AVFoundation
import CommonCrypto

@objc(CapacitorSip)
public class CapacitorSip: CAPPlugin {
    
    private var connection: NWConnection?
    private var sipDomain = ""
    private var sipExtension = ""
    private var sipPassword = ""
    private var sipHost = ""
    private var callId = ""
    private var fromTag = ""
    private var cseq = 1
    private var isRegistered = false
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
                DispatchQueue.main.async {
                    call.reject("Microphone permission denied")
                }
                return
            }
            
            try? AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetooth, .defaultToSpeaker]
            )
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
                        self.notifyListeners("registration", data: [
                            "status": "error",
                            "reason": error.localizedDescription
                        ])
                    }
                default:
                    break
                }
            }
            
            self.connection?.start(queue: .global(qos: .userInitiated))
            DispatchQueue.main.async { call.resolve() }
        }
    }
    
    private func sendRegister(cseq: Int, authHeader: String?) {
        var headers = """
        REGISTER sip:\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(sipExtension)@\(sipDomain)>\r\n\
        Call-ID: \(callId)\r\n\
        CSeq: \(cseq) REGISTER\r\n\
        Contact: <sip:\(sipExtension)@\(sipHost):5060;transport=tcp>\r\n\
        Expires: 300\r\n\
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
            guard let self = self, let data = data,
                  let response = String(data: data, encoding: .utf8) else { return }
            
            self.handleSipResponse(response)
            self.startReceiving()
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
            self.sendRegister(cseq: 2, authHeader: authHeader)
        } else if response.hasPrefix("SIP/2.0 200") && response.contains("CSeq: 2 REGISTER") {
            DispatchQueue.main.async {
                self.isRegistered = true
                self.notifyListeners("registration", data: [
                    "status": "registered",
                    "extension": self.sipExtension
                ])
            }
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
                self.notifyListeners("callEnded", data: [:])
            }
        } else if response.hasPrefix("INVITE") {
            let callerNumber = self.extractCallerNumber(from: response)
            DispatchQueue.main.async {
                self.notifyListeners("callReceived", data: ["number": callerNumber])
            }
        }
    }
    
    private func sendAck(response: String) {
        let ack = """
        ACK sip:\(sipDomain) SIP/2.0\r\n\
        Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
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
        Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(number)@\(sipDomain)>\r\n\
        Call-ID: \(currentCallId)\r\n\
        CSeq: 1 INVITE\r\n\
        Contact: <sip:\(sipExtension)@\(sipHost):5060;transport=tcp>\r\n\
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
        Via: SIP/2.0/TCP \(sipHost):5060;branch=z9hG4bK\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))\r\n\
        From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(fromTag)\r\n\
        To: <sip:\(sipDomain)>\r\n\
        Call-ID: \(currentCallId)\r\n\
        CSeq: 2 BYE\r\n\
        Content-Length: 0\r\n\r\n
        """
        let data = bye.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
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
        let info = """
        INFO sip:\(sipDomain) SIP/2.0\r\n\
        Content-Type: application/dtmf-relay\r\n\
        Content-Length: 26\r\n\r\n\
        Signal=\(digits)\r\nDuration=250\r\n
        """
        let data = info.data(using: .utf8)!
        connection?.send(content: data, completion: .contentProcessed { _ in })
        call.resolve()
    }
    
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
