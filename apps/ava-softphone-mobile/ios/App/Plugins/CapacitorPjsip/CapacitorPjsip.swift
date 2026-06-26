//
//  CapacitorPjsip.swift
//  Capacitor plugin exposing PjsipBridge (PJSUA2) to JS.
//

import Foundation
import Capacitor

@objc(CapacitorPjsip)
public class CapacitorPjsip: CAPPlugin, PjsipBridgeDelegate {

    private var domain: String = ""

    override public func load() {
        PjsipBridge.shared().delegate = self
        var err: NSError?
        if !PjsipBridge.shared().initEndpoint(&err) {
            NSLog("[CapacitorPjsip] initEndpoint failed: \(err?.localizedDescription ?? "")")
        }
    }

    // MARK: - JS API

    @objc func initAccount(_ call: CAPPluginCall) {
        guard
            let ext = call.getString("extension"),
            let domain = call.getString("domain"),
            let password = call.getString("password"),
            let wssUrl = call.getString("wssUrl")
        else { call.reject("Missing extension/domain/password/wssUrl"); return }

        self.domain = domain
        var err: NSError?
        let ok = PjsipBridge.shared().registerAccount(withExtension: ext,
                                                      domain: domain,
                                                      password: password,
                                                      wssUrl: wssUrl,
                                                      error: &err)
        if ok { call.resolve(["ok": true]) }
        else  { call.reject(err?.localizedDescription ?? "registerAccount failed") }
    }

    @objc func makeCall(_ call: CAPPluginCall) {
        guard let number = call.getString("number") else { call.reject("Missing number"); return }
        var err: NSError?
        let ok = PjsipBridge.shared().makeCall(to: number, domain: self.domain, error: &err)
        if ok { call.resolve(["ok": true]) } else { call.reject(err?.localizedDescription ?? "makeCall failed") }
    }

    @objc func answer(_ call: CAPPluginCall) {
        var err: NSError?
        let ok = PjsipBridge.shared().answerCurrentCall(&err)
        if ok { call.resolve(["ok": true]) } else { call.reject(err?.localizedDescription ?? "answer failed") }
    }

    @objc func hangup(_ call: CAPPluginCall) {
        var err: NSError?
        let ok = PjsipBridge.shared().hangupCurrentCall(&err)
        if ok { call.resolve(["ok": true]) } else { call.reject(err?.localizedDescription ?? "hangup failed") }
    }

    @objc func setMute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        var err: NSError?
        let ok = PjsipBridge.shared().setMuted(muted, error: &err)
        if ok { call.resolve(["ok": true, "muted": muted]) } else { call.reject(err?.localizedDescription ?? "setMute failed") }
    }

    @objc func setHold(_ call: CAPPluginCall) {
        let onHold = call.getBool("onHold") ?? false
        var err: NSError?
        let ok = PjsipBridge.shared().setHold(onHold, error: &err)
        if ok { call.resolve(["ok": true, "onHold": onHold]) } else { call.reject(err?.localizedDescription ?? "setHold failed") }
    }

    @objc func sendDTMF(_ call: CAPPluginCall) {
        guard let digit = call.getString("digit") else { call.reject("Missing digit"); return }
        var err: NSError?
        let ok = PjsipBridge.shared().sendDtmf(digit, error: &err)
        if ok { call.resolve(["ok": true, "digit": digit]) } else { call.reject(err?.localizedDescription ?? "sendDtmf failed") }
    }

    // MARK: - PjsipBridgeDelegate → notifyListeners

    public func pjsipRegStateChanged(_ registered: Bool, code: Int32, reason: String) {
        if registered {
            notifyListeners("registered", data: ["code": code, "reason": reason])
        } else {
            notifyListeners("registrationFailed", data: ["code": code, "reason": reason])
        }
    }
    public func pjsipIncomingCall(from: String) {
        notifyListeners("callReceived", data: ["from": from])
        notifyListeners("callStateChanged", data: ["state": "ringing", "number": from])
    }
    public func pjsipCallStateChanged(_ state: String) {
        notifyListeners("callStateChanged", data: ["state": state])
    }
    public func pjsipCallEnded(_ reason: String) {
        notifyListeners("callEnded", data: ["reason": reason])
    }
}
