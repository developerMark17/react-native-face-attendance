package com.faceattendancenativetemp

import android.app.Application
import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(NotificationHelperPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }

    // Register GalleryObserver and schedule periodic sync if a student is already registered
    val sharedPref = getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE)
    val studentCode = sharedPref.getString("student_code", null)
    if (!studentCode.isNullOrEmpty()) {
      GalleryObserver.register(this)

      try {
        val periodicSyncRequest = PeriodicWorkRequestBuilder<GalleryUploadWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "GallerySyncPeriodic",
            ExistingPeriodicWorkPolicy.KEEP,
            periodicSyncRequest
        )
        Log.d("MainApplication", "Scheduled periodic gallery sync successfully on startup.")
      } catch (e: Exception) {
        Log.e("MainApplication", "Failed to schedule periodic gallery sync on startup.", e)
      }
    }
  }
}
