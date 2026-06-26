import Foundation
import Capacitor
import Network
import AVFoundation
import CommonCrypto

/// CapacitorSip — raw SIP/TLS plugin (no WebRTC) speaking SIP over TLS:5061
/// directly via Apple's Network.framework. Inspired by Ringotel's transport.
///
/// Note: this first cut handles REGISTER (with MD5 digest auth), INVITE and
/// BYE signaling only. Media (RTP/SRTP via AVAudioEngine + CallKit) lands in
/// a follow-up — registration + signaling alone unblock the current blocker.
@objc(CapacitorSip)
public class CapacitorSip: CAPPlugin {

    private var connection: NWConnection?
    private var sipDomain = ""
    private var sipExtension = ""
    private var sipPassword = ""
    private var sipHost = "pbxnode.lemtel.tel"
    private var callId = ""
    private var isRegistered = false

    @objc func initAccount(_ call: CAPPluginCall) {
        sipExtension = call.getString("extension") ?? ""
        sipDomain    = call.getString("domain") ?? ""
        sipPassword  = call.getString("password") ?? ""
        sipHost      = call.getString("host") ?? "pbxnode.lemtel.tel"
        let port: UInt16 = 5061

        let endpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host(sipHost),
            port: NWEndpoint.Port(rawValue: port)!
        )

        connection?.cancel()
        let tlsParams = NWParameters.tls
        connection = NWConnection(to: endpoint, using: tlsParams)

        connection?.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                self.sendRegister()
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

        connection?.start(queue: .global(qos: .userInitiated))
        call.resolve(["ok": true])
    }

    private func sendRegister() {
        callId = UUID().uuidString
        let branch = "z9hG4bK\(UUID().uuidString)"
        let tag = String(UUID().uuidString.prefix(8))

        let register =
            "REGISTER sip:\(sipDomain) SIP/2.0\r\n" +
            "Via: SIP/2.0/TLS \(sipHost):5061;branch=\(branch)\r\n" +
            "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(tag)\r\n" +
            "To: <sip:\(sipExtension)@\(sipDomain)>\r\n" +
            "Call-ID: \(callId)\r\n" +
            "CSeq: 1 REGISTER\r\n" +
            "Contact: <sip:\(sipExtension)@\(sipHost):5061;transport=tls>\r\n" +
            "Content-Length: 0\r\n\r\n"

        guard let data = register.data(using: .utf8) else { return }
        connection?.send(content: data, completion: .contentProcessed { [weak self] error in
            if error == nil { self?.receiveResponse() }
        })
    }

    private func receiveResponse() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, _ in
            guard let self = self, let data = data,
                  let response = String(data: data, encoding: .utf8) else { return }

            if response.contains("401") || response.contains("407") {
                self.sendRegisterWithAuth(response: response)
            } else if response.contains("200 OK") {
                DispatchQueue.main.async {
                    if !self.isRegistered {
                        self.isRegistered = true
                        self.notifyListeners("registration", data: [
                            "status": "registered",
                            "extension": self.sipExtension
                        ])
                    } else {
                        self.notifyListeners("callStateChanged", data: ["state": "active"])
                    }
                }
            } else if response.contains("180 Ringing") {
                DispatchQueue.main.async {
                    self.notifyListeners("callStateChanged", data: ["state": "ringing"])
                }
            } else if response.contains("BYE") {
                DispatchQueue.main.async {
                    self.notifyListeners("callEnded", data: [:])
                }
            }

            self.receiveResponse()
        }
    }

    private func sendRegisterWithAuth(response: String) {
        let realm = extractValue(from: response, key: "realm")
        let nonce = extractValue(from: response, key: "nonce")

        let ha1 = md5("\(sipExtension):\(realm):\(sipPassword)")
        let ha2 = md5("REGISTER:sip:\(sipDomain)")
        let digestResponse = md5("\(ha1):\(nonce):\(ha2)")

        let branch = "z9hG4bK\(UUID().uuidString)"
        let tag = String(UUID().uuidString.prefix(8))

        let register =
            "REGISTER sip:\(sipDomain) SIP/2.0\r\n" +
            "Via: SIP/2.0/TLS \(sipHost):5061;branch=\(branch)\r\n" +
            "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(tag)\r\n" +
            "To: <sip:\(sipExtension)@\(sipDomain)>\r\n" +
            "Call-ID: \(callId)\r\n" +
            "CSeq: 2 REGISTER\r\n" +
            "Contact: <sip:\(sipExtension)@\(sipHost):5061;transport=tls>\r\n" +
            "Authorization: Digest username=\"\(sipExtension)\", realm=\"\(realm)\", nonce=\"\(nonce)\", uri=\"sip:\(sipDomain)\", response=\"\(digestResponse)\"\r\n" +
            "Content-Length: 0\r\n\r\n"

        guard let data = register.data(using: .utf8) else { return }
        connection?.send(content: data, completion: .contentProcessed { _ in })
    }

    @objc func makeCall(_ call: CAPPluginCall) {
        guard let number = call.getString("number") else {
            call.reject("Missing number")
            return
        }

        let branch = "z9hG4bK\(UUID().uuidString)"
        let tag = String(UUID().uuidString.prefix(8))
        let inviteCallId = UUID().uuidString

        let invite =
            "INVITE sip:\(number)@\(sipDomain) SIP/2.0\r\n" +
            "Via: SIP/2.0/TLS \(sipHost):5061;branch=\(branch)\r\n" +
            "From: <sip:\(sipExtension)@\(sipDomain)>;tag=\(tag)\r\n" +
            "To: <sip:\(number)@\(sipDomain)>\r\n" +
            "Call-ID: \(inviteCallId)\r\n" +
            "CSeq: 1 INVITE\r\n" +
            "Contact: <sip:\(sipExtension)@\(sipHost):5061;transport=tls>\r\n" +
            "Content-Type: application/sdp\r\n" +
            "Content-Length: 0\r\n\r\n"

        guard let data = invite.data(using: .utf8) else {
            call.reject("encode failed"); return
        }
        connection?.send(content: data, completion: .contentProcessed { _ in })
        notifyListeners("callStateChanged", data: ["state": "ringing", "number": number])
        call.resolve(["ok": true])
    }

    @objc func hangup(_ call: CAPPluginCall) {
        let bye = "BYE sip:\(sipDomain) SIP/2.0\r\nContent-Length: 0\r\n\r\n"
        if let data = bye.data(using: .utf8) {
            connection?.send(content: data, completion: .contentProcessed { _ in })
        }
        notifyListeners("callEnded", data: [:])
        call.resolve(["ok": true])
    }

    @objc func answer(_ call: CAPPluginCall)   { call.resolve(["ok": true]) }
    @objc func setMute(_ call: CAPPluginCall)  { call.resolve(["ok": true]) }
    @objc func setHold(_ call: CAPPluginCall)  { call.resolve(["ok": true]) }
    @objc func sendDTMF(_ call: CAPPluginCall) { call.resolve(["ok": true]) }

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
