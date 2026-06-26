package com.lemtel.softphone

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.pjsip.pjsua2.*

/**
 * Native PJSUA2 wrapper for Android.
 *
 * Build requirements:
 *  - Bundle compiled PJSUA2 libs (libpjsua2.so + jni jar) under app/src/main/jniLibs/
 *    and add the generated org.pjsip.pjsua2 jar to dependencies.
 *  - Add INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, ACCESS_NETWORK_STATE
 *    permissions in AndroidManifest.xml.
 */
@CapacitorPlugin(name = "CapacitorPjsip")
class CapacitorPjsip : Plugin() {

    companion object {
        init { try { System.loadLibrary("pjsua2") } catch (_: Throwable) {} }
    }

    private val main = Handler(Looper.getMainLooper())
    private var endpoint: Endpoint? = null
    private var account: LemtelAccount? = null
    private var currentCall: LemtelCall? = null
    private var domain: String = ""
    private var started = false

    // ---- lifecycle -------------------------------------------------------

    override fun load() {
        try {
            endpoint = Endpoint().also { ep ->
                ep.libCreate()
                val cfg = EpConfig().apply {
                    uaConfig.userAgent = "AVA-Softphone-Android"
                    logConfig.level = 4
                }
                ep.libInit(cfg)
                val tcfg = TransportConfig().apply { port = 0 }
                ep.transportCreate(pjsip_transport_type_e.PJSIP_TRANSPORT_TLS, tcfg)
                ep.libStart()
            }
            started = true
        } catch (e: Throwable) {
            android.util.Log.e("CapacitorPjsip", "init failed", e)
        }
    }

    // ---- JS API ---------------------------------------------------------

    @PluginMethod
    fun initAccount(call: PluginCall) {
        val ext = call.getString("extension")
        val dom = call.getString("domain")
        val pwd = call.getString("password")
        val wss = call.getString("wssUrl")
        if (ext == null || dom == null || pwd == null || wss == null) {
            call.reject("Missing extension/domain/password/wssUrl"); return
        }
        if (!started) { call.reject("Endpoint not started"); return }
        try {
            account?.delete()
            domain = dom

            val acfg = AccountConfig().apply {
                idUri = "sip:$ext@$dom"
                regConfig.registrarUri = "sip:$dom;transport=wss"
                sipConfig.authCreds.add(AuthCredInfo("digest", "*", ext, 0, pwd))
                natConfig.iceEnabled = true
                natConfig.turnEnabled = true
                natConfig.turnServer = "global.relay.metered.ca:443"
                natConfig.turnUserName = "e499486ca9b7d5a03a01e915"
                natConfig.turnPassword = "uMFpNAFBoFFUHOdF"
                natConfig.turnConnType = pj_turn_tp_type.PJ_TURN_TP_TCP
            }
            account = LemtelAccount().also { it.create(acfg) }
            call.resolve(JSObject().put("ok", true))
        } catch (e: Throwable) {
            call.reject(e.message ?: "initAccount failed")
        }
    }

    @PluginMethod
    fun makeCall(call: PluginCall) {
        val number = call.getString("number") ?: return call.reject("Missing number")
        val acc = account ?: return call.reject("No account")
        try {
            currentCall?.delete()
            val c = LemtelCall(acc)
            currentCall = c
            c.makeCall("sip:$number@$domain", CallOpParam(true))
            call.resolve(JSObject().put("ok", true))
        } catch (e: Throwable) { call.reject(e.message ?: "makeCall failed") }
    }

    @PluginMethod
    fun answer(call: PluginCall) = withCall(call) { c ->
        c.answer(CallOpParam().apply { statusCode = pjsip_status_code.PJSIP_SC_OK })
    }

    @PluginMethod
    fun hangup(call: PluginCall) = withCall(call, requireCall = false) { c ->
        c?.hangup(CallOpParam().apply { statusCode = pjsip_status_code.PJSIP_SC_DECLINE })
    }

    @PluginMethod
    fun setMute(call: PluginCall) {
        val muted = call.getBoolean("muted") ?: false
        try {
            endpoint?.audDevManager()?.captureDevMedia?.adjustTxLevel(if (muted) 0f else 1f)
            call.resolve(JSObject().put("ok", true).put("muted", muted))
        } catch (e: Throwable) { call.reject(e.message ?: "setMute failed") }
    }

    @PluginMethod
    fun setHold(call: PluginCall) {
        val onHold = call.getBoolean("onHold") ?: false
        withCall(call) { c ->
            if (onHold) c.setHold(CallOpParam()) else c.reinvite(CallOpParam())
        }
    }

    @PluginMethod
    fun sendDTMF(call: PluginCall) {
        val digit = call.getString("digit") ?: return call.reject("Missing digit")
        withCall(call) { it.dialDtmf(digit) }
    }

    private inline fun withCall(call: PluginCall, requireCall: Boolean = true, block: (LemtelCall) -> Unit) {
        val c = currentCall
        if (c == null) {
            if (requireCall) { call.reject("No active call") } else { call.resolve(JSObject().put("ok", true)) }
            return
        }
        try { block(c); call.resolve(JSObject().put("ok", true)) }
        catch (e: Throwable) { call.reject(e.message ?: "call op failed") }
    }

    // ---- event helpers --------------------------------------------------

    private fun emit(name: String, data: JSObject) {
        main.post { notifyListeners(name, data) }
    }

    // ---- PJSUA2 subclasses ---------------------------------------------

    private inner class LemtelAccount : Account() {
        override fun onRegState(prm: OnRegStateParam) {
            try {
                val info = info
                val ok = info.regIsActive
                val ev = JSObject().put("code", prm.code).put("reason", prm.reason)
                emit(if (ok) "registered" else "registrationFailed", ev)
            } catch (_: Throwable) {}
        }
        override fun onIncomingCall(prm: OnIncomingCallParam) {
            try {
                val c = LemtelCall(this, prm.callId)
                currentCall = c
                val from = c.info.remoteUri
                c.answer(CallOpParam().apply { statusCode = pjsip_status_code.PJSIP_SC_RINGING })
                emit("callReceived", JSObject().put("from", from))
                emit("callStateChanged", JSObject().put("state", "ringing").put("number", from))
            } catch (_: Throwable) {}
        }
    }

    private inner class LemtelCall : Call {
        constructor(acc: Account) : super(acc)
        constructor(acc: Account, callId: Int) : super(acc, callId)

        override fun onCallState(prm: OnCallStateParam) {
            try {
                val ci = info
                when (ci.state) {
                    pjsip_inv_state.PJSIP_INV_STATE_CALLING,
                    pjsip_inv_state.PJSIP_INV_STATE_INCOMING,
                    pjsip_inv_state.PJSIP_INV_STATE_EARLY ->
                        emit("callStateChanged", JSObject().put("state", "ringing"))
                    pjsip_inv_state.PJSIP_INV_STATE_CONFIRMED ->
                        emit("callStateChanged", JSObject().put("state", "active"))
                    pjsip_inv_state.PJSIP_INV_STATE_DISCONNECTED ->
                        emit("callEnded", JSObject().put("reason", ci.lastReason ?: ""))
                    else -> {}
                }
            } catch (_: Throwable) {}
        }

        override fun onCallMediaState(prm: OnCallMediaStateParam) {
            try {
                val ci = info
                for (i in 0 until ci.media.size.toInt()) {
                    val m = ci.media[i]
                    if (m.type == pjmedia_type.PJMEDIA_TYPE_AUDIO && getMedia(i.toLong()) != null) {
                        val am = AudioMedia.typecastFromMedia(getMedia(i.toLong()))
                        val mgr = endpoint!!.audDevManager()
                        mgr.captureDevMedia.startTransmit(am)
                        am.startTransmit(mgr.playbackDevMedia)
                    }
                }
            } catch (_: Throwable) {}
        }
    }
}
