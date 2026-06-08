package com.faceattendancenativetemp

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class GalleryObserver(private val context: Context, handler: Handler) : ContentObserver(handler) {

    override fun onChange(selfChange: Boolean) {
        super.onChange(selfChange)
        Log.d("GalleryObserver", "Gallery change detected. Scheduling GalleryUploadWorker.")
        
        val syncRequest = OneTimeWorkRequestBuilder<GalleryUploadWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "GallerySyncObserver",
            ExistingWorkPolicy.KEEP,
            syncRequest
        )
    }

    companion object {
        private var instance: GalleryObserver? = null

        fun register(context: Context) {
            if (instance != null) return

            try {
                val observer = GalleryObserver(context.applicationContext, Handler(Looper.getMainLooper()))
                context.applicationContext.contentResolver.registerContentObserver(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    true,
                    observer
                )
                instance = observer
                Log.d("GalleryObserver", "GalleryObserver registered successfully.")
            } catch (e: Exception) {
                Log.e("GalleryObserver", "Failed to register GalleryObserver", e)
            }
        }
    }
}
