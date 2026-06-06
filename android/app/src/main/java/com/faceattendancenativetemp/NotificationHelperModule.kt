package com.faceattendancenativetemp

import android.content.Context
import android.content.Intent
import android.provider.Settings
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
}
