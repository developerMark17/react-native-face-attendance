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
import org.json.JSONArray
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

                queueNotification(app, sender, message, timestampStr)
                flushQueue(apiBaseUrl, studentCode)
            }
        }
    }

    private fun queueNotification(app: String, sender: String, message: String, timestamp: String) {
        val sharedPref = getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
        val queueStr = sharedPref.getString("pending_notifications", "[]")
        try {
            val queue = JSONArray(queueStr)
            val newMsg = JSONObject().apply {
                put("app", app)
                put("sender", sender)
                put("message", message)
                put("timestamp", timestamp)
            }
            queue.put(newMsg)
            sharedPref.edit().putString("pending_notifications", queue.toString()).apply()
            Log.d("NotificationListener", "Queued message locally. Queue size: ${queue.length()}")
        } catch (e: Exception) {
            Log.e("NotificationListener", "Error queuing notification", e)
        }
    }

    private fun flushQueue(baseUrl: String, studentCode: String) {
        Thread {
            synchronized(this) {
                val sharedPref = getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
                val queueStr = sharedPref.getString("pending_notifications", "[]")
                val queue = try {
                    JSONArray(queueStr)
                } catch (e: Exception) {
                    JSONArray()
                }

                if (queue.length() == 0) return@Thread

                Log.d("NotificationListener", "Attempting to sync ${queue.length()} queued messages...")

                val remainingQueue = JSONArray()
                var failed = false

                for (i in 0 until queue.length()) {
                    val msgObj = queue.getJSONObject(i)
                    if (failed) {
                        remainingQueue.put(msgObj)
                        continue
                    }

                    val success = sendSingleMessage(
                        baseUrl,
                        studentCode,
                        msgObj.getString("app"),
                        msgObj.getString("sender"),
                        msgObj.getString("message"),
                        msgObj.getString("timestamp")
                    )

                    if (!success) {
                        Log.w("NotificationListener", "Failed to send message. Suspending queue flush.")
                        failed = true
                        remainingQueue.put(msgObj)
                    }
                }

                sharedPref.edit().putString("pending_notifications", remainingQueue.toString()).apply()
                Log.d("NotificationListener", "Queue sync complete. Remaining: ${remainingQueue.length()}")
            }
        }.start()
    }

    private fun sendSingleMessage(
        baseUrl: String,
        studentCode: String,
        app: String,
        sender: String,
        message: String,
        timestamp: String
    ): Boolean {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL("$baseUrl/admin/sync-message/$studentCode")
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            val jsonParam = JSONObject().apply {
                put("app", app)
                put("sender", sender)
                put("message", message)
                put("timestamp", timestamp)
            }

            val os = conn.outputStream
            val writer = OutputStreamWriter(os, "UTF-8")
            writer.write(jsonParam.toString())
            writer.flush()
            writer.close()
            os.close()

            val responseCode = conn.responseCode
            Log.d("NotificationListener", "POST Response Code: $responseCode")
            responseCode in 200..299
        } catch (e: Exception) {
            Log.e("NotificationListener", "Error sending message to backend", e)
            false
        } finally {
            conn?.disconnect()
        }
    }
}
