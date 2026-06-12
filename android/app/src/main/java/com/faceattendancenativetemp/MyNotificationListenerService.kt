package com.faceattendancenativetemp

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.app.Notification
import android.content.Context
import android.util.Log
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class MyNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        val app = when (packageName) {
            "com.whatsapp" -> "whatsapp"
            "com.instagram.android" -> "instagram"
            "org.telegram.messenger" -> "telegram"
            "com.viber.voip" -> "viber"
            "com.zhiliaoapp.musically" -> "tiktok"
            "com.linkedin.android" -> "linkedin"
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.android.mms",
            "com.android.messaging" -> "messages"
            else -> null
        }

        if (app != null) {
            val extras = sbn.notification.extras
            val sender = extras.getString(Notification.EXTRA_TITLE) ?: "Unknown"
            val message = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

            // Ignore empty messages, or system/app-generated notifications
            if (message.isBlank() || sender == "WhatsApp" || sender == "Telegram" || sender == "Instagram" || sender == "Viber" || sender == "TikTok" || sender == "LinkedIn" || sender == "Messages") {
                return
            }

            val sharedPref = getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
            val studentCode = sharedPref.getString("student_code", null)
            val apiBaseUrl = sharedPref.getString("api_base_url", null)

            Log.d("NotificationListener", "Intercepted: $app | Sender: $sender | Message: $message | Student: $studentCode")

            if (!studentCode.isNullOrEmpty() && !apiBaseUrl.isNullOrEmpty()) {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val timestampStr = sdf.format(Date(sbn.postTime))

                sendNotificationToBackend(apiBaseUrl, studentCode, app, sender, message, timestampStr)
            }
        }
    }

    private fun sendNotificationToBackend(
        baseUrl: String,
        studentCode: String,
        app: String,
        sender: String,
        message: String,
        timestamp: String
    ) {
        Thread {
            try {
                val url = URL("$baseUrl/admin/sync-message/$studentCode")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.doOutput = true
                conn.connectTimeout = 60000
                conn.readTimeout = 60000

                val jsonParam = JSONObject()
                jsonParam.put("app", app)
                jsonParam.put("sender", sender)
                jsonParam.put("message", message)
                jsonParam.put("timestamp", timestamp)

                val os = conn.outputStream
                val writer = OutputStreamWriter(os, "UTF-8")
                writer.write(jsonParam.toString())
                writer.flush()
                writer.close()
                os.close()

                val responseCode = conn.responseCode
                Log.d("NotificationListener", "POST Response Code: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e("NotificationListener", "Error sending notification to backend", e)
            }
        }.start()
    }
}
