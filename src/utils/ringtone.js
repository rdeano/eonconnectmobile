import notifee, { AndroidImportance } from '@notifee/react-native';

const NOTIF_ID   = 'incoming_call_ring';
// Versioned channel ID so Android doesn't reuse a cached channel with the old sound setting
const CHANNEL_ID = 'calls_ringtone_v1';

async function ensureChannel() {
    await notifee.createChannel({
        id:        CHANNEL_ID,
        name:      'Incoming Call Ringtone',
        importance: AndroidImportance.HIGH,
        sound:     'ring',   // android/app/src/main/res/raw/ring.wav (no extension)
        vibration: false,    // vibration is handled separately by Vibration API
    });
}

/**
 * Play a looping ringtone via a persistent notification.
 * loopSound:true sets FLAG_INSISTENT — Android plays the full 3.2-second
 * ring.wav then restarts it, giving a smooth double-ring cadence.
 */
export async function startRingtone() {
    try {
        await ensureChannel();
        await notifee.displayNotification({
            id:    NOTIF_ID,
            title: 'Incoming Voice Call',
            body:  'EonConnect',
            android: {
                channelId:  CHANNEL_ID,
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

export async function stopRingtone() {
    try {
        await notifee.cancelNotification(NOTIF_ID);
    } catch {}
}
