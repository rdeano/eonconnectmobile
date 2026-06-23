import { useEffect } from 'react';
import { AppState, View } from 'react-native';
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
import { requestAllPermissions } from './src/utils/permissions';

const Stack         = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

async function registerFcmToken() {
    const authToken = await AsyncStorage.getItem('token');
    if (!authToken) return;
    try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
            await api.post('/push/subscribe', { fcm_token: fcmToken });
        }
    } catch {}
}

export default function App() {
    useEffect(() => {
        notifee.createChannel({
            id: 'messages',
            name: 'Messages',
            importance: AndroidImportance.HIGH,
        });

        requestAllPermissions().then(registerFcmToken);

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
                android: {
                    channelId:   'messages',
                    importance:  AndroidImportance.HIGH,
                    pressAction: { id: 'default', launchActivity: 'default' },
                },
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
