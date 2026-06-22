import { useEffect } from 'react';
import { Alert, AppState, View, Platform, Linking } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen        from './src/screens/LoginScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import ChatScreen         from './src/screens/ChatScreen';
import CallScreen         from './src/screens/CallScreen';
import IncomingCallModal  from './src/components/IncomingCallModal';
import useCallStore from './src/stores/useCallStore';
import api from './src/services/api';

const Stack         = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

async function registerFcmToken() {
    const authToken = await AsyncStorage.getItem('token');
    if (!authToken) return;
    try {
        const status = await messaging().requestPermission();
        const granted =
            status === messaging.AuthorizationStatus.AUTHORIZED ||
            status === messaging.AuthorizationStatus.PROVISIONAL;
        if (!granted) return;
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
            await api.post('/push/subscribe', { fcm_token: fcmToken });
        }
    } catch {}
}

async function promptOverlayPermissionOnce() {
    if (Platform.OS !== 'android') return;
    const prompted = await AsyncStorage.getItem('overlay_permission_prompted');
    if (prompted) return;
    await AsyncStorage.setItem('overlay_permission_prompted', '1');
    Alert.alert(
        'Enable Display Over Other Apps',
        'To show incoming call alerts, please enable "Display over other apps" for EonConnect in Settings.',
        [
            { text: 'Later', style: 'cancel' },
            {
                text: 'Open Settings',
                onPress: () => Linking.sendIntent(
                    'android.settings.action.MANAGE_OVERLAY_PERMISSION',
                    [{ key: 'package', value: 'com.eonconnect.mobile' }]
                ),
            },
        ]
    );
}

export default function App() {
    useEffect(() => {
        notifee.createChannel({
            id: 'messages',
            name: 'Messages',
            importance: AndroidImportance.HIGH,
        });

        promptOverlayPermissionOnce();
        registerFcmToken();

        const unsubForeground = messaging().onMessage(async (remoteMessage) => {
            const type = remoteMessage.data?.type;

            if (type === 'call_invite') {
                // App is foregrounded — update the call store; IncomingCallModal picks it up globally.
                const { unit_id, room, token, livekit_url, caller_name } = remoteMessage.data;
                useCallStore.getState().setRinging(
                    room, token, livekit_url, caller_name, parseInt(unit_id),
                );
                return;
            }

            if (type === 'call_ended') {
                useCallStore.getState().reset();
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

        const unsubRefresh = messaging().onTokenRefresh(async (fcmToken) => {
            const authToken = await AsyncStorage.getItem('token');
            if (!authToken) return;
            try { await api.post('/push/subscribe', { fcm_token: fcmToken }); } catch {}
        });

        const resumePendingCall = async () => {
            const raw = await AsyncStorage.getItem('pending_call');
            if (!raw) return;
            try {
                const call = JSON.parse(raw);
                const age = (Date.now() - call.received_at) / 1000;
                await AsyncStorage.removeItem('pending_call');
                if (age > 30) return;
                useCallStore.getState().setRinging(
                    call.room, call.token, call.livekit_url, call.caller_name, parseInt(call.unit_id),
                );
            } catch {}
        };

        // Handles tap when app was killed — no AppState change fires on cold start.
        notifee.getInitialNotification().then((notification) => {
            if (notification) resumePendingCall();
        });

        // Handles tap when app was backgrounded — AppState transitions to 'active'.
        const checkPending = async (nextState) => {
            if (nextState !== 'active') return;
            resumePendingCall();
        };
        const unsubAppState = AppState.addEventListener('change', checkPending);

        return () => {
            unsubForeground();
            unsubRefresh();
            unsubAppState.remove();
        };
    }, []);

    return (
        <PaperProvider>
            <View style={{ flex: 1 }}>
                <NavigationContainer ref={navigationRef}>
                    <Stack.Navigator initialRouteName="Login">
                        <Stack.Screen
                            name="Login"
                            component={LoginScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Conversations"
                            component={ConversationsScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Chat"
                            component={ChatScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Call"
                            component={CallScreen}
                            options={{ headerShown: false, gestureEnabled: false }}
                        />
                    </Stack.Navigator>
                </NavigationContainer>

                {/* Rendered above the navigator so it appears on any screen */}
                <IncomingCallModal navigationRef={navigationRef} />
            </View>
        </PaperProvider>
    );
}
