package com.eonconnectmobile

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RingtoneModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "RingtoneModule"

    private var player: MediaPlayer? = null

    @ReactMethod
    fun start() {
        try {
            stop()
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(reactContext, uri)
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {
            // Device may have no default ringtone set; fail silently.
        }
    }

    @ReactMethod
    fun stop() {
        try {
            player?.run { if (isPlaying) stop(); release() }
        } catch (_: Exception) {}
        player = null
    }
}
