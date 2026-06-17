import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import ChatScreen  from './src/screens/ChatScreen';
import api from './src/services/api';

const Stack = createNativeStackNavigator();

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

export default function App() {
    useEffect(() => {
        notifee.createChannel({
            id: 'messages',
            name: 'Messages',
            importance: AndroidImportance.HIGH,
        });

        // Re-register on mount in case the token changed while the app was killed.
        registerFcmToken();

        // Display notification while app is in foreground (background/quit is automatic)
        const unsubForeground = messaging().onMessage(async (remoteMessage) => {
            const title = remoteMessage.notification?.title ?? remoteMessage.data?.title;
            const body  = remoteMessage.notification?.body  ?? remoteMessage.data?.body;
            if (!title && !body) return;
            await notifee.displayNotification({
                title,
                body,
                android: { channelId: 'messages', importance: AndroidImportance.HIGH },
            });
        });

        // Keep the backend token in sync whenever FCM rotates it.
        const unsubRefresh = messaging().onTokenRefresh(async (fcmToken) => {
            const authToken = await AsyncStorage.getItem('token');
            if (!authToken) return;
            try {
                await api.post('/push/subscribe', { fcm_token: fcmToken });
            } catch {}
        });

        return () => {
            unsubForeground();
            unsubRefresh();
        };
    }, []);

    return (
        <PaperProvider>
            <NavigationContainer>
                <Stack.Navigator initialRouteName="Login">
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="Chat"
                        component={ChatScreen}
                        options={{ title: 'Reception Chat' }}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}
