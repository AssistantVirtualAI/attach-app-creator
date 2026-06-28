import Foundation
import Capacitor
import AVFoundation

/// Thin Capacitor wrapper around PJSIP (PJSUA high-level API).
///
/// Replaces the previous custom NWConnection-based SIP stack and
/// hand-rolled RTPAudioSession. PJSIP runs its own worker threads,
/// handles RTP / jitter buffer / AEC / codec negotiation, and keeps
/// audio/SIP work completely off the main thread.
///
/// The bridged JS plugin name MUST remain `CapacitorPjsip` — that is
/// what `registerPlugin<CapacitorSipPlugin>('CapacitorPjsip')` expects
/// in `src/lib/sip/nativeSipProvider.ts`, and what
/// `AppBridgeViewController.registerPluginInstance(...)` registers.
@objc(CapacitorPjsip)
public class CapacitorPjsip: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorPjsip"
    public let jsName = "CapacitorPjsip"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initAccount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "makeCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hangup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "answer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHold", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendDTMF", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLogLevel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMicrophonePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playTestTone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRtpStats", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transfer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "park", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addListener", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),
    ]

    // Serial queue for all PJSUA calls. PJSUA itself is thread-safe but
    // keeping work off the main thread guarantees the UI never blocks.
    private let sipQueue = DispatchQueue(label: "pjsip.worker", qos: .userInitiated)

    private var pjsuaStarted = false
    private var accId: pjsua_acc_id = PJSUA_INVALID_ID
    private var currentCallId: pjsua_call_id = PJSUA_INVALID_ID
    private var recorderId: pjsua_recorder_id = PJSUA_INVALID_ID
    private var recorderPath: String?

    // C callbacks need a static reference to reach back into the instance.
    fileprivate static weak var shared: CapacitorPjsip?

    public override func load() {
        CapacitorPjsip.shared = self
        // Wire CallKit actions to PJSIP. Apple requires CallKit to own the
        // audio session lifecycle for VoIP apps — answering/ending from the
        // native UI must drive the SDK, not the other way around.
        CallKitManager.shared.onAnswer = { [weak self] in
            self?.sipQueue.async {
                guard let self = self, self.currentCallId != PJSUA_INVALID_ID else { return }
                pjsua_call_answer(self.currentCallId, 200, nil, nil)
            }
        }
        CallKitManager.shared.onEnd = { [weak self] in
            self?.sipQueue.async {
                guard let self = self, self.currentCallId != PJSUA_INVALID_ID else { return }
                pjsua_call_hangup(self.currentCallId, 0, nil, nil)
                self.currentCallId = PJSUA_INVALID_ID
            }
        }
        NSLog("[CapacitorPjsip] load — plugin ready, PJSUA will init on first initAccount")
    }

    deinit {
        if pjsuaStarted {
            pjsua_destroy()
        }
    }

    // MARK: - Helpers

    /// Build a transient pj_str_t backed by a Swift String. The returned
    /// pj_str_t is only valid for the duration of `body`.
    private func withPjStr<T>(_ s: String, _ body: (inout pj_str_t) -> T) -> T {
        var str = s
        return str.withUTF8 { buf in
            var pj = pj_str_t(
                ptr: UnsafeMutablePointer<CChar>(mutating: buf.baseAddress?.withMemoryRebound(to: CChar.self, capacity: buf.count) { $0 }),
                slen: pj_ssize_t(buf.count)
            )
            return body(&pj)
        }
    }

    /// Convert a Swift String to a heap-allocated pj_str_t (caller must keep
    /// the backing CString alive — used for account config that PJSUA copies).
    private func pjStrDup(_ s: String) -> pj_str_t {
        let cstr = strdup(s)
        return pj_str_t(ptr: cstr, slen: pj_ssize_t(strlen(cstr)))
    }

    private func notifyBg(_ event: String, _ data: [String: Any]) {
        sipQueue.async { [weak self] in
            self?.notifyListeners(event, data: data)
        }
    }

    // MARK: - Lifecycle

    @objc func initAccount(_ call: CAPPluginCall) {
        let server = call.getString("server") ?? call.getString("host") ?? "pbxnode.lemtel.tel"
        let username = call.getString("username") ?? call.getString("extension") ?? ""
        let password = call.getString("password") ?? ""
        let domain = call.getString("domain") ?? "lemtel.lemtel.tel"
        let logLevel = call.getInt("logLevel") ?? 3

        guard !username.isEmpty, !password.isEmpty else {
            call.reject("username and password required")
            return
        }

        sipQueue.async { [weak self] in
            guard let self = self else { return }

            if !self.pjsuaStarted {
                var status = pjsua_create()
                guard status == PJ_SUCCESS.rawValue else {
                    call.reject("pjsua_create failed: \(status)")
                    return
                }

                var cfg = pjsua_config()
                pjsua_config_default(&cfg)
                cfg.cb.on_reg_state = { accId in
                    guard let plugin = CapacitorPjsip.shared else { return }
                    var info = pjsua_acc_info()
                    pjsua_acc_get_info(accId, &info)
                    let code = Int(info.status.rawValue)
                    if code == 200 {
                        plugin.notifyBg("registration", ["state": "registered", "status": "registered", "code": code])
                    } else {
                        plugin.notifyBg("registration", [
                            "state": "error",
                            "status": "error",
                            "code": code,
                            "reason": "Registration failed: \(code)"
                        ])
                    }
                }
                cfg.cb.on_call_state = { callId, _ in
                    guard let plugin = CapacitorPjsip.shared else { return }
                    var info = pjsua_call_info()
                    pjsua_call_get_info(callId, &info)
                    switch info.state {
                    case PJSIP_INV_STATE_CALLING, PJSIP_INV_STATE_EARLY:
                        plugin.notifyBg("callStateChanged", ["state": "ringing", "direction": "out"])
                    case PJSIP_INV_STATE_CONFIRMED:
                        plugin.currentCallId = callId
                        plugin.notifyBg("callStateChanged", ["state": "active"])
                    case PJSIP_INV_STATE_DISCONNECTED:
                        if plugin.currentCallId == callId {
                            plugin.currentCallId = PJSUA_INVALID_ID
                        }
                        plugin.notifyBg("callEnded", ["reason": "remote_bye"])
                    default:
                        break
                    }
                }
                cfg.cb.on_incoming_call = { _, callId, _ in
                    guard let plugin = CapacitorPjsip.shared else { return }
                    plugin.currentCallId = callId
                    var info = pjsua_call_info()
                    pjsua_call_get_info(callId, &info)
                    let remote = String(cString: info.remote_info.ptr)
                    plugin.notifyBg("callReceived", ["from": remote])
                }

                var logCfg = pjsua_logging_config()
                pjsua_logging_config_default(&logCfg)
                logCfg.console_level = UInt32(max(0, min(5, logLevel)))

                var mediaCfg = pjsua_media_config()
                pjsua_media_config_default(&mediaCfg)
                mediaCfg.clock_rate = 8000
                mediaCfg.snd_clock_rate = 0
                mediaCfg.ec_tail_len = 200
                mediaCfg.no_vad = 0

                status = pjsua_init(&cfg, &logCfg, &mediaCfg)
                guard status == PJ_SUCCESS.rawValue else {
                    call.reject("pjsua_init failed: \(status)")
                    return
                }

                var tcpCfg = pjsua_transport_config()
                pjsua_transport_config_default(&tcpCfg)
                tcpCfg.port = 5060
                var transportId: pjsua_transport_id = 0
                status = pjsua_transport_create(PJSIP_TRANSPORT_TCP, &tcpCfg, &transportId)
                guard status == PJ_SUCCESS.rawValue else {
                    call.reject("transport_create failed: \(status)")
                    return
                }

                status = pjsua_start()
                guard status == PJ_SUCCESS.rawValue else {
                    call.reject("pjsua_start failed: \(status)")
                    return
                }
                self.pjsuaStarted = true
            }

            // Account
            var accCfg = pjsua_acc_config()
            pjsua_acc_config_default(&accCfg)
            accCfg.id = self.pjStrDup("sip:\(username)@\(domain)")
            accCfg.reg_uri = self.pjStrDup("sip:\(server);transport=tcp")
            accCfg.cred_count = 1
            accCfg.cred_info.0.realm = self.pjStrDup("*")
            accCfg.cred_info.0.scheme = self.pjStrDup("digest")
            accCfg.cred_info.0.username = self.pjStrDup(username)
            accCfg.cred_info.0.data_type = Int32(PJSIP_CRED_DATA_PLAIN_PASSWD.rawValue)
            accCfg.cred_info.0.data = self.pjStrDup(password)

            if self.accId != PJSUA_INVALID_ID {
                pjsua_acc_del(self.accId)
                self.accId = PJSUA_INVALID_ID
            }

            let status = pjsua_acc_add(&accCfg, pj_bool_t(PJ_TRUE.rawValue), &self.accId)
            guard status == PJ_SUCCESS.rawValue else {
                call.reject("pjsua_acc_add failed: \(status)")
                return
            }

            call.resolve(["ok": true, "status": "ok"])
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        sipQueue.async { [weak self] in
            guard let self = self else { return }
            if self.accId != PJSUA_INVALID_ID {
                pjsua_acc_del(self.accId)
                self.accId = PJSUA_INVALID_ID
            }
            call.resolve(["ok": true])
        }
    }

    // MARK: - Calls

    @objc func makeCall(_ call: CAPPluginCall) {
        let number = call.getString("number") ?? call.getString("destination") ?? ""
        let domain = call.getString("domain") ?? "lemtel.lemtel.tel"
        guard !number.isEmpty else { call.reject("number required"); return }

        sipQueue.async { [weak self] in
            guard let self = self, self.accId != PJSUA_INVALID_ID else {
                call.reject("not registered"); return
            }
            let uri = "sip:\(number)@\(domain);transport=tcp"
            var callId: pjsua_call_id = PJSUA_INVALID_ID
            let status = self.withPjStr(uri) { dst -> pj_status_t in
                pjsua_call_make_call(self.accId, &dst, nil, nil, nil, &callId)
            }
            guard status == PJ_SUCCESS.rawValue else {
                call.reject("make_call failed: \(status)"); return
            }
            self.currentCallId = callId
            call.resolve(["ok": true, "status": "calling", "callId": Int(callId)])
        }
    }

    @objc func hangup(_ call: CAPPluginCall) {
        sipQueue.async { [weak self] in
            guard let self = self else { return }
            if self.currentCallId != PJSUA_INVALID_ID {
                pjsua_call_hangup(self.currentCallId, 0, nil, nil)
                self.currentCallId = PJSUA_INVALID_ID
            }
            call.resolve(["ok": true])
        }
    }

    @objc func answer(_ call: CAPPluginCall) {
        sipQueue.async { [weak self] in
            guard let self = self else { return }
            if self.currentCallId != PJSUA_INVALID_ID {
                pjsua_call_answer(self.currentCallId, 200, nil, nil)
            }
            call.resolve(["ok": true])
        }
    }

    @objc func setMute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(["ok": true]); return
            }
            var info = pjsua_call_info()
            pjsua_call_get_info(self.currentCallId, &info)
            if muted {
                pjsua_conf_disconnect(0, info.conf_slot)
            } else {
                pjsua_conf_connect(0, info.conf_slot)
            }
            self.notifyBg("muteChanged", ["muted": muted])
            call.resolve(["ok": true, "muted": muted])
        }
    }

    @objc func setHold(_ call: CAPPluginCall) {
        let hold = call.getBool("onHold") ?? call.getBool("held") ?? false
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(["ok": true]); return
            }
            if hold {
                pjsua_call_set_hold(self.currentCallId, nil)
            } else {
                pjsua_call_reinvite(self.currentCallId, pj_bool_t(PJ_TRUE.rawValue), nil)
            }
            self.notifyBg("holdChanged", ["onHold": hold])
            call.resolve(["ok": true, "onHold": hold])
        }
    }

    @objc func sendDTMF(_ call: CAPPluginCall) {
        let digit = call.getString("digit") ?? call.getString("digits") ?? ""
        guard !digit.isEmpty else { call.resolve(); return }
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(); return
            }
            _ = self.withPjStr(digit) { d -> pj_status_t in
                pjsua_call_dial_dtmf(self.currentCallId, &d)
            }
            call.resolve(["ok": true])
        }
    }

    @objc func setLogLevel(_ call: CAPPluginCall) {
        let level = call.getInt("level") ?? 3
        sipQueue.async {
            pjsua_set_log_level(UInt32(max(0, min(5, level))))
            call.resolve(["level": level])
        }
    }

    // MARK: - Microphone permission

    @objc func requestMicrophonePermission(_ call: CAPPluginCall) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            call.resolve([
                "ok": granted,
                "granted": granted,
                "status": granted ? "granted" : "denied"
            ])
        }
    }

    // MARK: - Audio routing (PJSIP owns the audio device — these are best-effort)

    @objc func setAudioRoute(_ call: CAPPluginCall) {
        let route = call.getString("route") ?? "auto"
        do {
            let session = AVAudioSession.sharedInstance()
            switch route {
            case "speaker":
                try session.overrideOutputAudioPort(.speaker)
            default:
                try session.overrideOutputAudioPort(.none)
            }
            call.resolve(["ok": true, "route": route, "outputs": route])
        } catch {
            call.resolve(["ok": false, "route": route, "outputs": "", "error": error.localizedDescription])
        }
    }

    @objc func getAudioRoute(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map { ["portType": $0.portType.rawValue, "portName": $0.portName] }
        let inputs = (session.availableInputs ?? []).map { ["portType": $0.portType.rawValue, "portName": $0.portName] }
        call.resolve(["outputs": outputs, "availableInputs": inputs])
    }

    @objc func playTestTone(_ call: CAPPluginCall) {
        // PJSIP can play a built-in tone; return a stub for compatibility.
        call.resolve(["ok": true, "micPeak": 0, "route": "speaker"])
    }

    @objc func getRtpStats(_ call: CAPPluginCall) {
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(["running": false]); return
            }
            var info = pjsua_call_info()
            pjsua_call_get_info(self.currentCallId, &info)
            call.resolve([
                "running": true,
                "audioBackend": "pjsip",
                "sessionState": "\(info.state.rawValue)"
            ])
        }
    }

    // MARK: - Recording

    @objc func startRecord(_ call: CAPPluginCall) {
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(["ok": false, "recording": false]); return
            }
            let docs = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true).first ?? NSTemporaryDirectory()
            let path = "\(docs)/call-\(Int(Date().timeIntervalSince1970)).wav"
            var recId: pjsua_recorder_id = PJSUA_INVALID_ID
            let status = self.withPjStr(path) { p -> pj_status_t in
                pjsua_recorder_create(&p, 0, nil, 0, 0, &recId)
            }
            guard status == PJ_SUCCESS.rawValue else {
                call.resolve(["ok": false, "recording": false, "error": "recorder_create \(status)"]); return
            }
            var info = pjsua_call_info()
            pjsua_call_get_info(self.currentCallId, &info)
            pjsua_conf_connect(info.conf_slot, pjsua_recorder_get_conf_port(recId))
            pjsua_conf_connect(0, pjsua_recorder_get_conf_port(recId))
            self.recorderId = recId
            self.recorderPath = path
            call.resolve(["ok": true, "recording": true, "path": path])
        }
    }

    @objc func stopRecord(_ call: CAPPluginCall) {
        sipQueue.async { [weak self] in
            guard let self = self else { return }
            if self.recorderId != PJSUA_INVALID_ID {
                pjsua_recorder_destroy(self.recorderId)
                self.recorderId = PJSUA_INVALID_ID
            }
            let path = self.recorderPath ?? ""
            self.recorderPath = nil
            call.resolve(["ok": true, "recording": false, "path": path])
        }
    }

    // MARK: - Call control

    @objc func transfer(_ call: CAPPluginCall) {
        let target = call.getString("target") ?? ""
        guard !target.isEmpty else { call.reject("target required"); return }
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(["ok": false, "target": target]); return
            }
            let uri = target.contains("@") ? "sip:\(target)" : "sip:\(target)@lemtel.lemtel.tel"
            _ = self.withPjStr(uri) { t -> pj_status_t in
                pjsua_call_xfer(self.currentCallId, &t, nil)
            }
            call.resolve(["ok": true, "target": target])
        }
    }

    @objc func park(_ call: CAPPluginCall) {
        let code = call.getString("code") ?? "*68"
        sipQueue.async { [weak self] in
            guard let self = self, self.currentCallId != PJSUA_INVALID_ID else {
                call.resolve(["ok": false, "code": code]); return
            }
            let uri = "sip:\(code)@lemtel.lemtel.tel"
            _ = self.withPjStr(uri) { t -> pj_status_t in
                pjsua_call_xfer(self.currentCallId, &t, nil)
            }
            call.resolve(["ok": true, "code": code])
        }
    }

    @objc func addCall(_ call: CAPPluginCall) {
        let target = call.getString("target") ?? ""
        guard !target.isEmpty else { call.reject("target required"); return }
        // Place a second call; PJSIP supports multiple concurrent calls natively.
        sipQueue.async { [weak self] in
            guard let self = self, self.accId != PJSUA_INVALID_ID else {
                call.resolve(["ok": false, "target": target]); return
            }
            let uri = "sip:\(target)@lemtel.lemtel.tel;transport=tcp"
            var newCallId: pjsua_call_id = PJSUA_INVALID_ID
            _ = self.withPjStr(uri) { d -> pj_status_t in
                pjsua_call_make_call(self.accId, &d, nil, nil, nil, &newCallId)
            }
            call.resolve(["ok": true, "target": target, "callId": Int(newCallId)])
        }
    }
}
