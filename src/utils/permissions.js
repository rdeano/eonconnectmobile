import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function requestMicrophone() {
    if (Platform.OS !== 'android') return true;
    const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
            title: 'Microphone Permission',
            message: 'EonConnect needs your microphone to make and receive voice calls.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
        }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestNotifications() {
    // notifee.requestPermission handles POST_NOTIFICATIONS on Android 13+
    // and the standard notification permission dialog on iOS.
    const settings = await notifee.requestPermission();
    // authorizationStatus: 0=DENIED, 1=AUTHORIZED, 2=PROVISIONAL
    return settings.authorizationStatus >= 1;
}

async function promptOverlay() {
    if (Platform.OS !== 'android') return;
    const already = await AsyncStorage.getItem('overlay_permission_prompted');
    if (already) return;
    await AsyncStorage.setItem('overlay_permission_prompted', '1');
    Alert.alert(
        'Display Over Other Apps',
        'To show incoming call alerts on the lock screen, enable "Display over other apps" for EonConnect in Settings.',
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

/**
 * Request all runtime permissions the app needs.
 * Call once on startup after the user is known to be active (e.g. in App useEffect).
 */
export async function requestAllPermissions() {
    await requestNotifications();
    await requestMicrophone();
    await promptOverlay();
}
