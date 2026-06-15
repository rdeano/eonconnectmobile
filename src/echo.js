import Echo from 'laravel-echo';
import PusherRN from 'pusher-js/react-native';
import useAuthStore from './stores/useAuthStore';
import api from './services/api';

const Pusher = typeof PusherRN === 'function'
    ? PusherRN
    : (PusherRN.default || PusherRN.Pusher);

console.log('[Echo] Resolved Pusher type:', typeof Pusher);
global.Pusher = Pusher;

let echoInstance = null;

export function getEcho() {
    if (echoInstance) return echoInstance;

    console.log('[Echo] Echo type:', typeof Echo);
    console.log('[Echo] Pusher type:', typeof Pusher);

    const token = useAuthStore.getState().token;

    echoInstance = new Echo({
        broadcaster:       'reverb',
        Pusher,
        key:               'hfhkajcmtwwcnafmzc1f',
        wsHost:            '192.168.254.100',
        wsPort:            8080,
        forceTLS:          false,
        enabledTransports: ['ws'],
        channelAuthorization: {
            customHandler: ({ channelName, socketId }, callback) => {
                api.post('/broadcasting/auth', {
                    channel_name: channelName,
                    socket_id:    socketId,
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                    baseURL: 'http://192.168.254.100:8000/api',
                })
                .then((res) => {
                    console.log('[Echo] Channel auth success:', channelName);
                    callback(null, res.data);
                })
                .catch((err) => {
                    console.error('[Echo] Channel auth failed:', err?.response?.status, channelName);
                    callback(err);
                });
            },
        },
    });

    echoInstance.connector.pusher.connection.bind('connected', () =>
        console.log('[Echo] WebSocket connected')
    );
    echoInstance.connector.pusher.connection.bind('error', (err) =>
        console.error('[Echo] WebSocket error', err)
    );
    echoInstance.connector.pusher.connection.bind('disconnected', () =>
        console.warn('[Echo] WebSocket disconnected')
    );

    return echoInstance;
}

export function resetEcho() {
    if (echoInstance) {
        echoInstance.disconnect();
        echoInstance = null;
    }
}
