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
        key:               'eonconnect-key',
        wsHost:            'eonconnect.setoria.site',
        wsPort:            443,
        wssPort:           443,
        forceTLS:          true,
        disableStats:      true,
        enabledTransports: ['ws', 'wss'],
        channelAuthorization: {
            customHandler: ({ channelName, socketId }, callback) => {
                api.post('/broadcasting/auth', {
                    channel_name: channelName,
                    socket_id:    socketId,
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                    baseURL: 'https://eonconnect.setoria.site/api',
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

    const pusher = echoInstance.connector.pusher;

    console.log('[Echo] Connection state:', pusher.connection.state);

    pusher.connection.bind('state_change', (states) => {
        console.log('[Echo] State:', states.previous, '->', states.current);
    });

    pusher.connection.bind('connecting', () => {
        console.log('[Echo] Connecting...');
    });

    pusher.connection.bind('connected', () => {
        console.log('[Echo] Connected!');
    });

    pusher.connection.bind('failed', () => {
        console.error('[Echo] Failed to connect');
    });

    pusher.connection.bind('unavailable', () => {
        console.error('[Echo] Unavailable');
    });

    pusher.connection.bind('error', (err) => {
        console.error('[Echo] Error:', JSON.stringify(err));
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
