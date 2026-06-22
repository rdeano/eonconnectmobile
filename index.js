import { registerGlobals } from '@livekit/react-native';
registerGlobals();

import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';

const API_BASE = 'https://eonconnect.setoria.site/api/v1';

notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;

    // Notification body tap or Accept button — app opens via launchActivity,
    // App.js AppState listener reads pending_call and shows IncomingCallModal.
    if (type === EventType.PRESS) return;
    if (type === EventType.ACTION_PRESS && pressAction?.id === 'accept') return;

    // Decline button — end the call silently without opening the app.
    if (type === EventType.ACTION_PRESS && pressAction?.id === 'decline') {
        try {
            const raw = await AsyncStorage.getItem('pending_call');
            if (raw) {
                const call  = JSON.parse(raw);
                const token = await AsyncStorage.getItem('token');
                if (token) {
                    await fetch(`${API_BASE}/calls/end`, {
                        method:  'POST',
                        headers: {
                            'Content-Type':  'application/json',
                            'Accept':        'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ unit_id: parseInt(call.unit_id) }),
                    });
                }
                await AsyncStorage.removeItem('pending_call');
            }
        } catch {}
        await notifee.cancelNotification(notification.id);
    }
});

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await notifee.createChannel({
        id: 'calls',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
    });
    await notifee.createChannel({
        id: 'messages',
        name: 'Messages',
        importance: AndroidImportance.HIGH,
    });

    const type = remoteMessage.data?.type;

    if (type === 'call_invite') {
        await AsyncStorage.setItem('pending_call', JSON.stringify({
            ...remoteMessage.data,
            received_at: Date.now(),
        }));
        // fullScreenAction launches the app immediately — even on the lock screen —
        // which is required for incoming call UX. pressAction is the fallback if the
        // system blocks the full-screen intent (e.g. notification shade tap).
        await notifee.displayNotification({
            title: `Incoming call from ${remoteMessage.data.caller_name ?? 'Reception'}`,
            body: 'Tap to answer',
            android: {
                channelId: 'calls',
                importance: AndroidImportance.HIGH,
                pressAction: { id: 'default' },
                fullScreenAction: { id: 'default' },
                actions: [
                    {
                        title: '❌  Decline',
                        pressAction: { id: 'decline' },
                    },
                    {
                        title: '📞  Accept',
                        pressAction: { id: 'accept', launchActivity: 'default' },
                    },
                ],
            },
        });
        return;
    }

    if (type === 'call_ended') {
        await AsyncStorage.removeItem('pending_call');
        return;
    }

    // Regular chat message notification
    const title = remoteMessage.notification?.title ?? remoteMessage.data?.title;
    const body  = remoteMessage.notification?.body  ?? remoteMessage.data?.body;
    if (!title && !body) return;
    await notifee.displayNotification({
        title,
        body,
        android: { channelId: 'messages', importance: AndroidImportance.HIGH },
    });
});

registerRootComponent(App);
