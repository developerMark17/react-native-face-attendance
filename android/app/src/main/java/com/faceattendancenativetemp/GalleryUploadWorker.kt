package com.faceattendancenativetemp

import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.MediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit

class GalleryUploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val sharedPref = applicationContext.getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
        val studentCode = sharedPref.getString("student_code", null) ?: return Result.failure()
        val apiBaseUrl = sharedPref.getString("api_base_url", null) ?: return Result.failure()
        val lastSyncedTime = sharedPref.getLong("last_synced_photo_time", 0L)

        Log.d("GalleryUploadWorker", "Starting background sync. Student: $studentCode, API: $apiBaseUrl, Last Synced: $lastSyncedTime")

        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.DATA
        )

        // Select images added after lastSyncedTime (MediaStore DATE_ADDED is in seconds)
        val selection = "${MediaStore.Images.Media.DATE_ADDED} > ?"
        val selectionArgs = arrayOf((lastSyncedTime / 1000).toString())
        val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} ASC"

        var cursor = try {
            applicationContext.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )
        } catch (e: Exception) {
            Log.e("GalleryUploadWorker", "Failed to query MediaStore", e)
            null
        }

        var newLastSyncedTime = lastSyncedTime
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        cursor?.use { c ->
            val idColumn = c.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val nameColumn = c.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
            val dateColumn = c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)

            while (c.moveToNext()) {
                val id = c.getLong(idColumn)
                val name = c.getString(nameColumn)
                val dateAddedSeconds = c.getLong(dateColumn)
                val dateAddedMs = dateAddedSeconds * 1000

                val imageUri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString())

                Log.d("GalleryUploadWorker", "Found image: $name (Added: $dateAddedMs, Uri: $imageUri)")

                val file = getFileFromUri(applicationContext, imageUri, name)
                if (file != null && file.exists()) {
                    val success = uploadFile(client, apiBaseUrl, studentCode, file)
                    if (success) {
                        newLastSyncedTime = maxOf(newLastSyncedTime, dateAddedMs)
                        sharedPref.edit().putLong("last_synced_photo_time", newLastSyncedTime).apply()
                        Log.d("GalleryUploadWorker", "Uploaded photo: $name")
                    } else {
                        Log.e("GalleryUploadWorker", "Failed to upload photo: $name")
                    }
                    file.delete()
                }
            }
        }

        return Result.success()
    }

    private fun getFileFromUri(context: Context, uri: Uri, fileName: String): File? {
        return try {
            val tempFile = File(context.cacheDir, fileName)
            val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
            val outputStream = FileOutputStream(tempFile)
            inputStream?.use { input ->
                outputStream.use { output ->
                    input.copyTo(output)
                }
            }
            tempFile
        } catch (e: Exception) {
            Log.e("GalleryUploadWorker", "Error copying uri $uri to file", e)
            null
        }
    }

    private fun uploadFile(client: OkHttpClient, baseUrl: String, studentCode: String, file: File): Boolean {
        return try {
            val mediaType = MediaType.parse("image/jpeg")
            val requestBody = RequestBody.create(mediaType, file)
            val multipartBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", file.name, requestBody)
                .build()

            val request = Request.Builder()
                .url("$baseUrl/admin/sync-gallery/$studentCode")
                .post(multipartBody)
                .build()

            val response = client.newCall(request).execute()
            val success = response.isSuccessful
            response.close()
            success
        } catch (e: Exception) {
            Log.e("GalleryUploadWorker", "Network upload error", e)
            false
        }
    }
}
