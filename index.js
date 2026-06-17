import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';

// Required by notifee — must be registered before setBackgroundMessageHandler.
// Handles notification interaction events (press, dismiss) when app is in background/quit.
notifee.onBackgroundEvent(async ({ type, detail }) => {
    // Extend here if you need to handle notification press/dismiss/action-button events.
});

// notifee intercepts FCM messages on Android — we must display manually here,
// even for notification messages (the OS no longer auto-displays them).
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await notifee.createChannel({
        id: 'messages',
        name: 'Messages',
        importance: AndroidImportance.HIGH,
    });

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
