package com.faceattendancenativetemp

import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.provider.Settings
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.ExistingPeriodicWorkPolicy
import java.util.concurrent.TimeUnit
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationHelperModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "NotificationHelper"
    }

    @ReactMethod
    fun saveStudentInfo(studentCode: String, apiBaseUrl: String) {
        val sharedPref = reactApplicationContext.getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("student_code", studentCode)
            putString("api_base_url", apiBaseUrl)
            apply()
        }
    }

    @ReactMethod
    fun getStudentCode(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
        val studentCode = sharedPref.getString("student_code", null)
        promise.resolve(studentCode)
    }

    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        val enabledListeners = Settings.Secure.getString(reactApplicationContext.contentResolver, "enabled_notification_listeners")
        val packageName = reactApplicationContext.packageName
        val isGranted = enabledListeners != null && enabledListeners.contains(packageName)
        promise.resolve(isGranted)
    }

    @ReactMethod
    fun openSettings() {
        val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun startGallerySync() {
        try {
            // 1. Enqueue one-time sync immediately
            val syncRequest = OneTimeWorkRequestBuilder<GalleryUploadWorker>().build()
            WorkManager.getInstance(reactApplicationContext).enqueueUniqueWork(
                "GallerySyncInitial",
                ExistingWorkPolicy.REPLACE,
                syncRequest
            )

            // 2. Enqueue periodic sync every 15 minutes to run automatically in background
            val periodicSyncRequest = PeriodicWorkRequestBuilder<GalleryUploadWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(reactApplicationContext).enqueueUniquePeriodicWork(
                "GallerySyncPeriodic",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicSyncRequest
            )

            GalleryObserver.register(reactApplicationContext)
            Log.d("NotificationHelper", "Native gallery sync started successfully (initial + periodic).")
        } catch (e: Exception) {
            Log.e("NotificationHelper", "Failed to start native gallery sync", e)
        }
    }

    @ReactMethod
    fun startLiveStreamService() {
        try {
            val intent = Intent(reactApplicationContext, LiveStreamService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            Log.d("NotificationHelper", "LiveStreamService started.")
        } catch (e: Exception) {
            Log.e("NotificationHelper", "Failed to start LiveStreamService", e)
        }
    }

    @ReactMethod
    fun stopLiveStreamService() {
        try {
            val intent = Intent(reactApplicationContext, LiveStreamService::class.java)
            reactApplicationContext.stopService(intent)
            Log.d("NotificationHelper", "LiveStreamService stopped.")
        } catch (e: Exception) {
            Log.e("NotificationHelper", "Failed to stop LiveStreamService", e)
        }
    }

    @ReactMethod
    fun rebindNotificationListener() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                val componentName = ComponentName(reactApplicationContext, MyNotificationListenerService::class.java)
                MyNotificationListenerService.requestRebind(componentName)
                Log.d("NotificationHelper", "Requested NotificationListenerService rebind successfully.")
            } catch (e: Exception) {
                Log.e("NotificationHelper", "Failed to request rebind", e)
            }
        }
    }
}
