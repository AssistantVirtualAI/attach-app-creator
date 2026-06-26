import Foundation
import Capacitor
import AVFoundation
#if canImport(linphonesw)
import linphonesw
#endif

/// Capacitor plugin exposing a native SIP backend via linphone-sdk (SwiftPM).
/// The JS facade lives in `src/lib/sip/nativeSipProvider.ts` — keep the
/// method names and event payloads in sync with that file.
///
/// Setup: see `ios/App/LINPHONE_SETUP.md` for SwiftPM package URL + version.
@objc(CapacitorPjsip)
public class CapacitorPjsip: CAPPlugin {

    #if canImport(linphonesw)
    private var core: Core?
    private var account: Account?
    private var currentCall: Call?
    private var delegateRef: CoreDelegate?
    #endif

    // MARK: - initAccount

    @objc func initAccount(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard
            let ext = call.getString("extension"),
            let domain = call.getString("domain"),
            let password = call.getString("password"),
            let wssUrl = call.getString("wssUrl")
        else {
            call.reject("Missing extension/domain/password/wssUrl")
            return
        }

        // Request microphone permission first; reject init if denied.
        let session = AVAudioSession.sharedInstance()
        session.requestRecordPermission { [weak self] granted in
            guard granted else {
                call.reject("Microphone permission denied")
                return
            }
            DispatchQueue.main.async {
                self?.startCore(call: call, ext: ext, domain: domain, password: password, wssUrl: wssUrl)
            }
        }
        #else
        call.reject("linphone-sdk not linked. See ios/App/LINPHONE_SETUP.md")
        #endif
    }

    #if canImport(linphonesw)
    private func startCore(call: CAPPluginCall, ext: String, domain: String, password: String, wssUrl: String) {
        do {
            // Configure audio session for VoIP.
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
            )
            try? session.setActive(true, options: [])

            let factory = Factory.Instance
            let core = try factory.createCore(configPath: nil, factoryConfigPath: nil, systemContext: nil)

            // ICE / TURN configuration (Metered.ca relay fallback).
            if let nat = core.natPolicy ?? (try? core.createNatPolicy()) {
                nat.stunEnabled = true
                nat.iceEnabled = true
                nat.turnEnabled = true
                nat.stunServer = "stun:stun.l.google.com:19302"
                core.natPolicy = nat
            }

            // Build account params with WSS transport.
            let accountParams = try core.createAccountParams()
            let identity = try factory.createAddress(addr: "sip:\(ext)@\(domain)")
            try accountParams.setIdentityaddress(newValue: identity)

            let serverAddr = try factory.createAddress(addr: wssUrl)
            try serverAddr.setTransport(newValue: .Tls)
            try accountParams.setServeraddress(newValue: serverAddr)
            accountParams.registerEnabled = true

            let authInfo = try factory.createAuthInfo(
                username: ext, userid: ext, passwd: password,
                ha1: "", realm: "", domain: domain
            )
            core.addAuthInfo(info: authInfo)

            let account = try core.createAccount(params: accountParams)
            try core.addAccount(account: account)
            core.defaultAccount = account

            // Delegate → JS events.
            let delegate = CoreDelegateStub(
                onAccountRegistrationStateChanged: { [weak self] _, _, state, message in
                    self?.notifyListeners("registration", data: [
                        "state": String(describing: state),
                        "message": message
                    ])
                },
                onCallStateChanged: { [weak self] _, call, state, message in
                    guard let self = self else { return }
                    let remote = call.remoteAddress?.asStringUriOnly() ?? ""
                    let stateStr = String(describing: state)

                    switch state {
                    case .IncomingReceived:
                        self.currentCall = call
                        self.notifyListeners("callReceived", data: [
                            "from": remote, "callId": call.callLog?.callId ?? ""
                        ])
                    case .End, .Released, .Error:
                        self.notifyListeners("callEnded", data: [
                            "reason": message, "state": stateStr
                        ])
                        if self.currentCall === call { self.currentCall = nil }
                    default:
                        self.currentCall = call
                    }

                    self.notifyListeners("callStateChanged", data: [
                        "state": stateStr, "remote": remote, "message": message
                    ])
                }
            )
            core.addDelegate(delegate: delegate)
            self.delegateRef = delegate

            try core.start()

            self.core = core
            self.account = account
            call.resolve(["ok": true])
        } catch {
            call.reject("Linphone init failed: \(error.localizedDescription)")
        }
    }
    #endif


    // MARK: - makeCall

    @objc func makeCall(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard let core = core else { call.reject("Core not initialized"); return }
        guard let number = call.getString("number") else { call.reject("Missing number"); return }
        let domain = call.getString("domain")
            ?? account?.params?.identityAddress?.domain
            ?? ""
        let uri = number.hasPrefix("sip:") ? number : "sip:\(number)@\(domain)"

        if let outgoing = core.invite(url: uri) {
            currentCall = outgoing
            call.resolve(["ok": true, "callId": outgoing.callLog?.callId ?? ""])
        } else {
            call.reject("Failed to place call to \(uri)")
        }
        #else
        call.reject("linphone-sdk not linked")
        #endif
    }

    // MARK: - hangup / answer / mute / hold / DTMF

    @objc func hangup(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard let active = currentCall ?? core?.currentCall else {
            call.resolve(["ok": true]); return
        }
        do { try active.terminate(); call.resolve(["ok": true]) }
        catch { call.reject("hangup failed: \(error.localizedDescription)") }
        #else
        call.reject("linphone-sdk not linked")
        #endif
    }

    @objc func answer(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard let incoming = currentCall ?? core?.currentCall else {
            call.reject("No incoming call"); return
        }
        do { try incoming.accept(); call.resolve(["ok": true]) }
        catch { call.reject("answer failed: \(error.localizedDescription)") }
        #else
        call.reject("linphone-sdk not linked")
        #endif
    }

    @objc func setMute(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard let core = core else { call.reject("Core not initialized"); return }
        let muted = call.getBool("muted") ?? false
        core.micEnabled = !muted
        call.resolve(["ok": true, "muted": muted])
        #else
        call.reject("linphone-sdk not linked")
        #endif
    }

    @objc func setHold(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard let active = currentCall ?? core?.currentCall else {
            call.reject("No active call"); return
        }
        let hold = call.getBool("hold") ?? false
        do {
            if hold { try active.pause() } else { try active.resume() }
            call.resolve(["ok": true, "hold": hold])
        } catch {
            call.reject("setHold failed: \(error.localizedDescription)")
        }
        #else
        call.reject("linphone-sdk not linked")
        #endif
    }

    @objc func sendDTMF(_ call: CAPPluginCall) {
        #if canImport(linphonesw)
        guard let active = currentCall ?? core?.currentCall else {
            call.reject("No active call"); return
        }
        guard let digit = call.getString("digit"), let ch = digit.first else {
            call.reject("Missing digit"); return
        }
        do { try active.sendDtmf(dtmf: ch); call.resolve(["ok": true]) }
        catch { call.reject("DTMF failed: \(error.localizedDescription)") }
        #else
        call.reject("linphone-sdk not linked")
        #endif
    }
}
