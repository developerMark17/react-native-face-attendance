package com.faceattendancenativetemp

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class LiveStreamService : Service() {

    companion object {
        private const val TAG = "LiveStreamService"
        private const val CHANNEL_ID = "LiveStreamChannel"
        private const val NOTIFICATION_ID = 9989
        private const val HEADLESS_TASK_NAME = "LiveStreamHeadlessTask"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            var serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceType = serviceType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            }
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Launch HeadlessJS task to (re)start the WebRTC stream in a JS runtime
        // This is critical when the service restarts after the app was killed
        try {
            val taskIntent = Intent(applicationContext, LiveStreamHeadlessTaskService::class.java)
            applicationContext.startService(taskIntent)
            Log.d(TAG, "HeadlessJS task service started.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HeadlessJS task service", e)
        }

        // START_STICKY tells Android to recreate this service if the process is killed
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "onTaskRemoved: App was swiped away. Scheduling service restart.")

        // Schedule a restart via AlarmManager as a fallback for aggressive OEMs
        val restartServiceIntent = Intent(applicationContext, LiveStreamService::class.java).also {
            it.setPackage(packageName)
        }
        val restartServicePendingIntent = PendingIntent.getService(
            this,
            1,
            restartServiceIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_ONE_SHOT
            }
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.set(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 1000, // restart after 1 second
            restartServicePendingIntent
        )

        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy called")
        super.onDestroy()
        // Do NOT call stopForeground here - let the system handle it
        // If we're being destroyed by START_STICKY restart cycle, the notification persists
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Live Stream Background Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            serviceChannel.setShowBadge(false)
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Face Attendance")
            .setContentText("Live camera streaming is active in background")
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}

/**
 * HeadlessJsTaskService that bootstraps the WebRTC livestream in a fresh JS runtime.
 * This is invoked by LiveStreamService when the app process was killed but
 * the foreground service restarts (via START_STICKY or AlarmManager).
 */
class LiveStreamHeadlessTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        return HeadlessJsTaskConfig(
            "LiveStreamHeadlessTask",   // Must match the name registered in index.js
            Arguments.createMap(),       // No extra data needed, task reads from SharedPrefs
            5 * 60 * 1000L,            // 5-minute timeout (will be refreshed by reconnection)
            true                        // Allow task to run in foreground
        )
    }
}
