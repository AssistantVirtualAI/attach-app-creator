//
//  CapacitorPjsip.swift
//  Native PJSIP wrapper exposed to JS via Capacitor.
//
//  NOTE: This is a SKELETON. The PJSIP C bindings (pjsua2) must be wired in
//  once the `pjsip` CocoaPod is installed and a bridging header is added.
//  Methods currently emit events and return success/failure shapes that match
//  what `nativeSipProvider.ts` expects, so the JS layer can be tested with a
//  mock before the native side is fully implemented.
//

import Foundation
import Capacitor
// import PJSIP   // <- enable once pod installed and bridging header configured

@objc(CapacitorPjsip)
public class CapacitorPjsip: CAPPlugin {

    // MARK: - Internal state
    private var initialized = false
    private var registered = false
    private var currentCallId: Int32 = -1

    // MARK: - initAccount
    @objc func initAccount(_ call: CAPPluginCall) {
        guard
            let extensionId = call.getString("extension"),
            let domain = call.getString("domain"),
            let password = call.getString("password"),
            let wssUrl = call.getString("wssUrl")
        else {
            call.reject("Missing extension/domain/password/wssUrl")
            return
        }

        // TODO: pjsua_create / pjsua_init / pjsua_transport_create (TLS/WSS)
        //       pjsua_acc_add with id=sip:<ext>@<domain> and reg_uri from wssUrl
        //       Wire callbacks: on_reg_state -> notifyListeners("registered" | "registrationFailed")
        //                       on_incoming_call -> notifyListeners("callReceived", { from })
        //                       on_call_state -> notifyListeners("callStateChanged", { state })

        self.initialized = true
        call.resolve([
            "ok": true,
            "extension": extensionId,
            "domain": domain,
            "wssUrl": wssUrl,
            "stub": true
        ])
    }

    // MARK: - makeCall
    @objc func makeCall(_ call: CAPPluginCall) {
        guard let number = call.getString("number") else {
            call.reject("Missing number")
            return
        }
        guard initialized else { call.reject("Account not initialized"); return }
        // TODO: pjsua_call_make_call(acc_id, "sip:<number>@<domain>", ...)
        currentCallId = 1
        notifyListeners("callStateChanged", data: ["state": "ringing", "number": number])
        call.resolve(["ok": true, "callId": currentCallId])
    }

    // MARK: - hangup
    @objc func hangup(_ call: CAPPluginCall) {
        // TODO: pjsua_call_hangup(currentCallId, 0, nil, nil)
        currentCallId = -1
        notifyListeners("callEnded", data: ["reason": "local"])
        call.resolve(["ok": true])
    }

    // MARK: - answer
    @objc func answer(_ call: CAPPluginCall) {
        // TODO: pjsua_call_answer(currentCallId, 200, nil, nil)
        notifyListeners("callStateChanged", data: ["state": "active"])
        call.resolve(["ok": true])
    }

    // MARK: - setMute
    @objc func setMute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        // TODO: pjsua_conf_adjust_tx_level / pjsua_conf_adjust_rx_level
        call.resolve(["ok": true, "muted": muted])
    }

    // MARK: - setHold
    @objc func setHold(_ call: CAPPluginCall) {
        let onHold = call.getBool("onHold") ?? false
        // TODO: onHold ? pjsua_call_set_hold : pjsua_call_reinvite
        call.resolve(["ok": true, "onHold": onHold])
    }

    // MARK: - sendDTMF
    @objc func sendDTMF(_ call: CAPPluginCall) {
        guard let digit = call.getString("digit") else {
            call.reject("Missing digit")
            return
        }
        // TODO: pjsua_call_dial_dtmf(currentCallId, &pj_digit)
        call.resolve(["ok": true, "digit": digit])
    }
}
