package com.lemtel.softphone

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.pjsip.pjsua2.*

/**
 * Native PJSUA2 wrapper for Android — parité iOS.
 *
 * Audio path mirrors the iOS RTPAudioSession:
 *  - AudioManager.MODE_IN_COMMUNICATION + STREAM_VOICE_CALL for echo cancellation
 *  - Jitter buffer primed to 60 ms (≈ 3 packets at 8kHz/20ms PCMU)
 *  - PCMU codec preferred (G.711 μ-law, 8kHz)
 *  - RECORD_AUDIO permission requested BEFORE registering the SIP account
 *  - Periodic [PJSIP][stats] log line every 5 s with packet / underrun counters
 *
 * Build requirements:
 *  - Bundle compiled PJSUA2 libs (libpjsua2.so + jni jar) under app/src/main/jniLibs/
 *  - Add INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, ACCESS_NETWORK_STATE
 *    permissions in AndroidManifest.xml
 */
@CapacitorPlugin(
    name = "CapacitorPjsip",
    permissions = [
        Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO])
    ]
)
class CapacitorPjsip : Plugin() {

    companion object {
        init { try { System.loadLibrary("pjsua2") } catch (_: Throwable) {} }
        private const val TAG = "CapacitorPjsip"
    }

    private val main = Handler(Looper.getMainLooper())
    private var endpoint: Endpoint? = null
    private var account: LemtelAccount? = null
    private var currentCall: LemtelCall? = null
    private var domain: String = ""
    private var started = false

    // AudioManager state for in-call routing
    private var audioManager: AudioManager? = null
    private var savedAudioMode: Int = AudioManager.MODE_NORMAL
    private var focusRequest: AudioFocusRequest? = null

    // Stats counters (parité iOS RTP metrics)
    @Volatile private var lastStatsLog: Long = 0L
    private val statsHandler = Handler(Looper.getMainLooper())
    private var statsRunnable: Runnable? = null

    // Pending initAccount params (waiting on RECORD_AUDIO permission grant)
    private var pendingInitCall: PluginCall? = null

    // ---- lifecycle -------------------------------------------------------

    override fun load() {
        try {
            audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            endpoint = Endpoint().also { ep ->
                ep.libCreate()
                val cfg = EpConfig().apply {
                    uaConfig.userAgent = "AVA-Softphone-Android"
                    logConfig.level = 4
                    // Jitter buffer parité iOS : amorce ~60 ms / max 200 ms.
                    // PJSUA jbInit/jbMin/Max units = frames (20ms per frame @ G.711).
                    medConfig.jbInit = 3   // prime with 3 packets (60 ms)
                    medConfig.jbMinPre = 3
                    medConfig.jbMaxPre = 10
                    medConfig.jbMax = 30   // ~600 ms hard cap
                    medConfig.clockRate = 8000
                    medConfig.sndClockRate = 8000
                    medConfig.channelCount = 1
                    medConfig.audioFramePtime = 20
                    medConfig.ecOptions = 0   // built-in AEC (Android voice mode handles it)
                    medConfig.ecTailLen = 200
                }
                ep.libInit(cfg)
                val tcfg = TransportConfig().apply { port = 0 }
                ep.transportCreate(pjsip_transport_type_e.PJSIP_TRANSPORT_TLS, tcfg)
                ep.libStart()

                // Prefer PCMU (parité iOS RTPAudioSession).
                try {
                    ep.codecSetPriority("PCMU/8000/1", 255)
                    ep.codecSetPriority("PCMA/8000/1", 254)
                    ep.codecSetPriority("opus/48000/2", 100)
                } catch (_: Throwable) {}
            }
            started = true
            startStatsLogger()
        } catch (e: Throwable) {
            android.util.Log.e(TAG, "init failed", e)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        stopStatsLogger()
        releaseAudioFocus()
    }

    // ---- audio routing (parité iOS MODE_IN_COMMUNICATION) ---------------

    private fun acquireInCallAudio() {
        val am = audioManager ?: return
        try {
            savedAudioMode = am.mode
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(false)
                    .build()
                focusRequest = req
                am.requestAudioFocus(req)
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            }
            android.util.Log.i(TAG, "[audio] acquired MODE_IN_COMMUNICATION + STREAM_VOICE_CALL focus")
        } catch (e: Throwable) {
            android.util.Log.w(TAG, "acquireInCallAudio failed", e)
        }
    }

    private fun releaseAudioFocus() {
        val am = audioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { am.abandonAudioFocusRequest(it) }
                focusRequest = null
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(null)
            }
            am.mode = savedAudioMode
        } catch (_: Throwable) {}
    }

    // ---- JS API ---------------------------------------------------------

    @PluginMethod
    fun initAccount(call: PluginCall) {
        // Ensure RECORD_AUDIO BEFORE creating the account — otherwise the first
        // INVITE will silently fail on Android 13+.
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            pendingInitCall = call
            requestPermissionForAlias("microphone", call, "onMicPermissionResult")
            return
        }
        doInitAccount(call)
    }

    @PermissionCallback
    private fun onMicPermissionResult(call: PluginCall) {
        val pending = pendingInitCall ?: call
        pendingInitCall = null
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            pending.reject("Microphone permission denied — cannot register softphone")
            return
        }
        doInitAccount(pending)
    }

    private fun doInitAccount(call: PluginCall) {
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
            acquireInCallAudio()
            currentCall?.delete()
            val c = LemtelCall(acc)
            currentCall = c
            c.makeCall("sip:$number@$domain", CallOpParam(true))
            call.resolve(JSObject().put("ok", true))
        } catch (e: Throwable) { call.reject(e.message ?: "makeCall failed") }
    }

    @PluginMethod
    fun answer(call: PluginCall) = withCall(call) { c ->
        acquireInCallAudio()
        c.answer(CallOpParam().apply { statusCode = pjsip_status_code.PJSIP_SC_OK })
    }

    @PluginMethod
    fun hangup(call: PluginCall) = withCall(call, requireCall = false) { c ->
        c?.hangup(CallOpParam().apply { statusCode = pjsip_status_code.PJSIP_SC_DECLINE })
        releaseAudioFocus()
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

    @PluginMethod
    fun getStats(call: PluginCall) {
        val c = currentCall
        val stats = JSObject().put("hasCall", c != null)
        try {
            c?.let {
                val info = it.info
                stats.put("state", info.stateText)
                stats.put("durationMs", info.connectDuration.sec * 1000L + info.connectDuration.msec)
                // Pull RTCP stream stats (RX) for jitter / packet loss visibility.
                try {
                    val si = it.getStreamInfo(0)
                    val ss = it.getStreamStat(0)
                    stats.put("codec", si.codecName)
                    stats.put("rxPackets", ss.rtcp.rxStat.pkt)
                    stats.put("rxLoss", ss.rtcp.rxStat.loss)
                    stats.put("rxJitterMs", ss.rtcp.rxStat.jitterUsec.mean / 1000)
                    stats.put("txPackets", ss.rtcp.txStat.pkt)
                    stats.put("txLoss", ss.rtcp.txStat.loss)
                } catch (_: Throwable) {}
            }
        } catch (_: Throwable) {}
        call.resolve(stats)
    }

    private fun startStatsLogger() {
        stopStatsLogger()
        val r = object : Runnable {
            override fun run() {
                try {
                    val c = currentCall
                    if (c != null) {
                        val info = c.info
                        val ss = try { c.getStreamStat(0) } catch (_: Throwable) { null }
                        val rx = ss?.rtcp?.rxStat
                        val tx = ss?.rtcp?.txStat
                        android.util.Log.i(
                            TAG,
                            "[PJSIP][stats] state=${info.stateText} rxPkts=${rx?.pkt ?: 0} rxLoss=${rx?.loss ?: 0} rxJitterMs=${(rx?.jitterUsec?.mean ?: 0) / 1000} txPkts=${tx?.pkt ?: 0} jbInit=3"
                        )
                    }
                } catch (_: Throwable) {}
                statsHandler.postDelayed(this, 5000)
            }
        }
        statsRunnable = r
        statsHandler.postDelayed(r, 5000)
    }

    private fun stopStatsLogger() {
        statsRunnable?.let { statsHandler.removeCallbacks(it) }
        statsRunnable = null
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
                    pjsip_inv_state.PJSIP_INV_STATE_DISCONNECTED -> {
                        emit("callEnded", JSObject().put("reason", ci.lastReason ?: ""))
                        releaseAudioFocus()
                    }
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
