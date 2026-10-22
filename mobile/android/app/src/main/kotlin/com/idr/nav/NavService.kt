package com.idr.nav

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock

class NavService : Service(), SensorEventListener, LocationListener {

    companion object {
        init {
            System.loadLibrary("idr_core_jni")
        }
        const val CHANNEL_ID = "idr_nav_service_channel"
        const val NOTIFICATION_ID = 26168
    }

    private var engineHandle: Long = 0
    private lateinit var sensorManager: SensorManager
    private lateinit var locationManager: LocationManager
    private var isNavigating = false

    // State listeners callback
    var onStateUpdate: ((DoubleArray) -> Unit)? = null
    var onEventUpdate: ((String, String) -> Unit)? = null

    // Native declarations
    private external fun nativeCreate(imuRateHz: Double, alertLimitM: Double, hasGyro: Boolean, hasBaro: Boolean): Long
    private external fun nativeDestroy(handle: Long)
    private external fun nativeLoadModels(handle: Long, speedPath: String, adapterPath: String): Boolean
    private external fun nativeLoadMap(handle: Long, mapPath: String, userPath: String?): Boolean
    private external fun nativePushImu(handle: Long, tNs: Long, ax: Double, ay: Double, az: Double, gx: Double, gy: Double, gz: Double)
    private external fun nativePushMag(handle: Long, tNs: Long, mx: Double, my: Double, mz: Double)
    private external fun nativePushFix(handle: Long, tNs: Long, lat: Double, lon: Double, alt: Double, speed: Double, bearing: Double, r68: Double, numSats: Int, valid: Boolean)
    private external fun nativeStep(handle: Long, nowNs: Long)
    private external fun nativeGetState(handle: Long, outArray: DoubleArray): Boolean

    private val binder = LocalBinder()
    inner class LocalBinder : Binder() {
        fun getService(): NavService = this@NavService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    fun startNavigation(speedModelPath: String, adapterModelPath: String, mapDbPath: String) {
        if (isNavigating) return

        // Create notification and promote to foreground
        val notification = buildForegroundNotification("Active Dead Reckoning Navigation")
        startForeground(NOTIFICATION_ID, notification)

        // Native engine initialization
        val hasGyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null
        engineHandle = nativeCreate(100.0, 20.0, hasGyro, false)

        if (speedModelPath.isNotEmpty() && adapterModelPath.isNotEmpty()) {
            nativeLoadModels(engineHandle, speedModelPath, adapterModelPath)
        }
        if (mapDbPath.isNotEmpty()) {
            nativeLoadMap(engineHandle, mapDbPath, null)
        }

        // Register sensors
        sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }

        // Register GNSS
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this)
        } catch (e: SecurityException) {
            // Handled via permission request in Flutter
        }

        isNavigating = true
    }

    fun stopNavigation() {
        if (!isNavigating) return
        sensorManager.unregisterListener(this)
        locationManager.removeUpdates(this)
        if (engineHandle != 0L) {
            nativeDestroy(engineHandle)
            engineHandle = 0L
        }
        isNavigating = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private var lastAx = 0.0
    private var lastAy = 0.0
    private var lastAz = 9.80665
    private var lastGx = 0.0
    private var lastGy = 0.0
    private var lastGz = 0.0

    override fun onSensorChanged(event: SensorEvent?) {
        if (!isNavigating || engineHandle == 0L || event == null) return

        val nowNs = SystemClock.elapsedRealtimeNanos()
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                lastAx = event.values[0].toDouble()
                lastAy = event.values[1].toDouble()
                lastAz = event.values[2].toDouble()

                nativePushImu(engineHandle, nowNs, lastAx, lastAy, lastAz, lastGx, lastGy, lastGz)
                nativeStep(engineHandle, nowNs)

                // Dispatch state update
                val st = DoubleArray(12)
                if (nativeGetState(engineHandle, st)) {
                    onStateUpdate?.invoke(st)
                }
            }
            Sensor.TYPE_GYROSCOPE -> {
                lastGx = event.values[0].toDouble()
                lastGy = event.values[1].toDouble()
                lastGz = event.values[2].toDouble()
            }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                nativePushMag(engineHandle, nowNs,
                    event.values[0].toDouble(),
                    event.values[1].toDouble(),
                    event.values[2].toDouble())
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onLocationChanged(location: Location) {
        if (!isNavigating || engineHandle == 0L) return
        val nowNs = SystemClock.elapsedRealtimeNanos()
        nativePushFix(
            engineHandle,
            nowNs,
            location.latitude,
            location.longitude,
            location.altitude,
            location.speed.toDouble(),
            location.bearing.toDouble(),
            location.accuracy.toDouble(),
            10,
            true
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "IDR Navigation Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(content: String): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("IDR 26168 Intelligent Dead Reckoning")
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("IDR 26168 Intelligent Dead Reckoning")
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setOngoing(true)
                .build()
        }
    }
}
