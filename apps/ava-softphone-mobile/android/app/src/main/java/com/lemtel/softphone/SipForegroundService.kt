package com.lemtel.softphone

/**
 * Copy this file to android/app/src/main/java/com/lemtel/softphone/SipForegroundService.kt
 * after `npx cap add android`. Also merge the matching <service> declaration
 * from native-config/android-AndroidManifest.snippet.xml into AndroidManifest.xml.
 *
 * Required on Android 14+ (API 34) so that the microphone stays accessible
 * while a SIP call runs in the background. The service must be started with
 * ServiceCompat.startForeground(..., FOREGROUND_SERVICE_TYPE_MICROPHONE
 * | FOREGROUND_SERVICE_TYPE_PHONE_CALL) BEFORE PJSIP grabs the audio device.
 */
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class SipForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(NotificationManager::class.java)
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Active call",
                NotificationManager.IMPORTANCE_LOW,
            )
            ch.description = "Shown while a Lemtel call is ongoing"
            mgr?.createNotificationChannel(ch)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Lemtel Softphone")
            .setContentText("Active call in progress")
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "lemtel_active_call"
        private const val NOTIF_ID = 4711
    }
}
