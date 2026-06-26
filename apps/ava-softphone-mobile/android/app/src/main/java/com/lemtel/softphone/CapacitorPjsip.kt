package com.lemtel.softphone

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Native PJSIP wrapper for Android.
 *
 * SKELETON: PJSUA2 (pjsip) JNI bindings need to be wired in once the
 * native libs are built and added to the gradle project. Method signatures
 * mirror CapacitorPjsip.swift so the JS facade is platform-agnostic.
 */
@CapacitorPlugin(name = "CapacitorPjsip")
class CapacitorPjsip : Plugin() {

    private var initialized = false
    private var currentCallId: Int = -1

    @PluginMethod
    fun initAccount(call: PluginCall) {
        val extension = call.getString("extension")
        val domain = call.getString("domain")
        val password = call.getString("password")
        val wssUrl = call.getString("wssUrl")

        if (extension == null || domain == null || password == null || wssUrl == null) {
            call.reject("Missing extension/domain/password/wssUrl")
            return
        }

        // TODO: Endpoint.libCreate(); Endpoint.libInit(epConfig)
        //       TransportConfig (TLS/WSS) -> Endpoint.transportCreate
        //       Account.create(accCfg) with sip:<extension>@<domain>
        //       Override onRegState / onIncomingCall / onCallState -> notifyListeners

        initialized = true
        val ret = JSObject()
        ret.put("ok", true)
        ret.put("extension", extension)
        ret.put("domain", domain)
        ret.put("wssUrl", wssUrl)
        ret.put("stub", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun makeCall(call: PluginCall) {
        val number = call.getString("number")
        if (number == null) { call.reject("Missing number"); return }
        if (!initialized) { call.reject("Account not initialized"); return }

        // TODO: Call.makeCall("sip:$number@$domain", callOpParam)
        currentCallId = 1

        val ev = JSObject().put("state", "ringing").put("number", number)
        notifyListeners("callStateChanged", ev)

        val ret = JSObject().put("ok", true).put("callId", currentCallId)
        call.resolve(ret)
    }

    @PluginMethod
    fun hangup(call: PluginCall) {
        // TODO: currentCall?.hangup(callOpParam)
        currentCallId = -1
        notifyListeners("callEnded", JSObject().put("reason", "local"))
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun answer(call: PluginCall) {
        // TODO: currentCall?.answer(callOpParam(200))
        notifyListeners("callStateChanged", JSObject().put("state", "active"))
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun setMute(call: PluginCall) {
        val muted = call.getBoolean("muted") ?: false
        // TODO: AudDevManager.getCaptureDevMedia().adjustTxLevel(if (muted) 0f else 1f)
        call.resolve(JSObject().put("ok", true).put("muted", muted))
    }

    @PluginMethod
    fun setHold(call: PluginCall) {
        val onHold = call.getBoolean("onHold") ?: false
        // TODO: onHold ? currentCall.setHold(...) : currentCall.reinvite(...)
        call.resolve(JSObject().put("ok", true).put("onHold", onHold))
    }

    @PluginMethod
    fun sendDTMF(call: PluginCall) {
        val digit = call.getString("digit")
        if (digit == null) { call.reject("Missing digit"); return }
        // TODO: currentCall?.dialDtmf(digit)
        call.resolve(JSObject().put("ok", true).put("digit", digit))
    }
}
