# EonConnect Mobile

A React Native mobile app built with Expo that provides real-time chat and push notification support, designed to connect with a Laravel backend.

## Features

- **Authentication** — Token-based login with credentials persisted via AsyncStorage
- **Real-time chat** — Live messaging via Laravel Reverb (WebSocket) using Laravel Echo + Pusher JS
- **Push notifications** — Firebase Cloud Messaging (FCM) integration via `@react-native-firebase/messaging` and `@notifee/react-native`
- **Offline awareness** — Network state monitoring via `@react-native-community/netinfo`

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Expo ~56.0 / React Native 0.85 |
| Navigation | React Navigation v7 (native stack) |
| UI | React Native Paper v5 |
| State | Zustand v5 |
| HTTP | Axios |
| WebSocket | Laravel Echo + Pusher JS (Reverb broadcaster) |
| Push | Firebase Messaging + Notifee |
| Storage | AsyncStorage |

## Prerequisites

- Node.js 18+
- Android Studio (for Android builds)
- A running Laravel backend with Reverb and FCM configured
- `google-services.json` placed in `android/app/`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend URL

Update the `baseURL` in `src/services/api.js` and the `wsHost`/WebSocket config in `src/echo.js` to point to your Laravel server.

```js
// src/services/api.js
baseURL: 'http://<your-server-ip>:8000/api/v1'

// src/echo.js
wsHost: '<your-server-ip>',
wsPort: 8080,
```

### 3. Run on Android

```bash
npm run android
```

### 4. Start the dev server

```bash
npm start
```

## Project Structure

```
src/
  screens/
    LoginScreen.js    # Auth flow
    ChatScreen.js     # Real-time chat UI
  stores/
    useAuthStore.js   # Zustand auth state (token, user)
    useChatStore.js   # Zustand chat state (messages)
  services/
    api.js            # Axios instance with auth interceptor
  echo.js             # Laravel Echo / Reverb WebSocket setup
App.js                # Root navigator + FCM token registration
```

## Push Notifications

On app start, the app requests FCM permission, retrieves the device token, and registers it with the backend via `POST /api/v1/push/subscribe`. Foreground messages are handled by the `onMessage` listener in `App.js`.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server (dev client) |
| `npm run android` | Build and run on Android |
| `npm run ios` | Build and run on iOS |
| `npm run web` | Start web version |
