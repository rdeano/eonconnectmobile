import { NativeModules, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';

const NOTIF_ID = 'incoming_call_ring';

// ── Android: native module plays the device's default phone ringtone ─────────

async function ensureAndroidChannel() {
    // Silent channel — sound comes from RingtoneModule, not the notification.
    await notifee.createChannel({
        id:         'calls_silent_v1',
        name:       'Incoming Call',
        importance: AndroidImportance.HIGH,
        sound:      null,
        vibration:  false,
    });
}

// ── iOS: notifee channel with ring.wav (unchanged behaviour) ─────────────────

async function ensureIosChannel() {
    await notifee.createChannel({
        id:         'calls_ringtone_v1',
        name:       'Incoming Call Ringtone',
        importance: AndroidImportance.HIGH,
        sound:      'ring',
        vibration:  false,
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startRingtone() {
    if (Platform.OS === 'android') {
        // Play the device's system ringtone via MediaPlayer.
        NativeModules.RingtoneModule?.start();

        // Show a silent ongoing notification so the call survives backgrounding.
        try {
            await ensureAndroidChannel();
            await notifee.displayNotification({
                id:    NOTIF_ID,
                title: 'Incoming Voice Call',
                body:  'EonConnect',
                android: {
                    channelId:  'calls_silent_v1',
                    importance: AndroidImportance.HIGH,
                    ongoing:    true,
                    autoCancel: false,
                },
            });
        } catch (e) {
            console.warn('[Ringtone] notification failed:', e?.message);
        }
    } else {
        // iOS: rely on the notifee notification sound (ring.wav).
        try {
            await ensureIosChannel();
            await notifee.displayNotification({
                id:    NOTIF_ID,
                title: 'Incoming Voice Call',
                body:  'EonConnect',
                ios: { sound: 'ring.wav' },
                android: {
                    channelId:  'calls_ringtone_v1',
                    importance: AndroidImportance.HIGH,
                    loopSound:  true,
                    ongoing:    true,
                    autoCancel: false,
                },
            });
        } catch (e) {
            console.warn('[Ringtone] start failed:', e?.message);
        }
    }
}

export async function stopRingtone() {
    if (Platform.OS === 'android') {
        NativeModules.RingtoneModule?.stop();
    }
    try {
        await notifee.cancelNotification(NOTIF_ID);
    } catch {}
}
