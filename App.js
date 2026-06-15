import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import messaging from '@react-native-firebase/messaging';
import api from './src/services/api';
import LoginScreen from './src/screens/LoginScreen';
import ChatScreen  from './src/screens/ChatScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    useEffect(() => {
        // Request FCM permission and register token with backend
        messaging().requestPermission().then(() => {
            return messaging().getToken();
        }).then((token) => {
            if (token) {
                api.post('/push/subscribe', { fcm_token: token }).catch(() => {});
            }
        }).catch(() => {});

        // Handle foreground notifications
        const unsubscribe = messaging().onMessage(async (remoteMessage) => {
            console.log('FCM foreground message:', remoteMessage);
        });

        return unsubscribe;
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
