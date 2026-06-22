import { useState } from 'react';
import {
    View, StyleSheet, KeyboardAvoidingView, Platform,
    StatusBar, TouchableOpacity,
} from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';

export default function LoginScreen({ navigation }) {
    const [email,        setEmail]        = useState('');
    const [password,     setPassword]     = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error,        setError]        = useState('');
    const [loading,      setLoading]      = useState(false);
    const { setAuth } = useAuthStore();

    const handleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { email, password });
            await setAuth(res.data.data.user, res.data.data.token);

            // Sanctum token is now in AsyncStorage — safe to register FCM token
            try {
                await messaging().requestPermission();
                const fcmToken = await messaging().getToken();
                if (fcmToken) {
                    await api.post('/push/subscribe', { fcm_token: fcmToken });
                }
            } catch {}

            const role = res.data.data.user?.role;
            navigation.replace(role === 'reception' ? 'Conversations' : 'Chat');
        } catch (e) {
            setError(e?.response?.data?.message || e?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#0F2B5B" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.hero}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>EC</Text>
                    </View>
                    <Text style={styles.appName}>EonConnect</Text>
                    <Text style={styles.tagline}>Building Management Portal</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Welcome back</Text>
                    <Text style={styles.cardSubtitle}>Sign in to your account</Text>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>Email address</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            mode="outlined"
                            placeholder="you@example.com"
                            placeholderTextColor="#aab4cc"
                            style={styles.input}
                            outlineColor="#dde3f0"
                            activeOutlineColor="#1A56A0"
                            theme={{ colors: { background: '#f8faff', onSurface: '#1a2540', onSurfaceVariant: '#6b7a99' } }}
                        />
                    </View>

                    <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>Password</Text>
                        <View style={styles.passwordWrap}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                mode="outlined"
                                placeholder="••••••••"
                                placeholderTextColor="#aab4cc"
                                style={[styles.input, { flex: 1 }]}
                                outlineColor="#dde3f0"
                                activeOutlineColor="#1A56A0"
                                theme={{ colors: { background: '#f8faff', onSurface: '#1a2540', onSurfaceVariant: '#6b7a99' } }}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(v => !v)}
                                style={styles.showBtn}
                            >
                                <Text style={styles.showBtnText}>
                                    {showPassword ? 'Hide' : 'Show'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading || !email.trim() || !password.trim()}
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                        buttonColor="#1A56A0"
                        labelStyle={styles.buttonLabel}
                    >
                        {loading ? 'Signing in…' : 'Sign In'}
                    </Button>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F2B5B' },
    flex: { flex: 1 },

    hero: {
        alignItems:      'center',
        justifyContent:  'center',
        paddingVertical: 40,
        backgroundColor: '#0F2B5B',
    },
    logoCircle: {
        width:           72,
        height:          72,
        borderRadius:    36,
        backgroundColor: '#1A56A0',
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    14,
        shadowColor:     '#000',
        shadowOffset:    { width: 0, height: 4 },
        shadowOpacity:   0.3,
        shadowRadius:    8,
        elevation:       8,
    },
    logoText:     { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 1 },
    appName:      { color: '#fff', fontSize: 26, fontWeight: '700', letterSpacing: 0.5 },
    tagline:      { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },

    card: {
        flex:                1,
        backgroundColor:     '#fff',
        borderTopLeftRadius:  28,
        borderTopRightRadius: 28,
        paddingHorizontal:   24,
        paddingTop:          32,
        shadowColor:         '#000',
        shadowOffset:        { width: 0, height: -4 },
        shadowOpacity:       0.08,
        shadowRadius:        12,
        elevation:           12,
    },
    cardTitle:    { fontSize: 22, fontWeight: '700', color: '#0F2B5B', marginBottom: 4 },
    cardSubtitle: { fontSize: 14, color: '#6b7a99', marginBottom: 24 },

    errorBox: {
        backgroundColor: '#fff2f2',
        borderRadius:    10,
        borderLeftWidth: 3,
        borderLeftColor: '#e53935',
        padding:         12,
        marginBottom:    16,
    },
    errorText: { color: '#c62828', fontSize: 13 },

    fieldWrap:    { marginBottom: 14 },
    fieldLabel:   { fontSize: 13, fontWeight: '600', color: '#3d4f6e', marginBottom: 4, marginLeft: 2 },
    input:        {},

    passwordWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    showBtn:      {
        paddingHorizontal: 12,
        paddingVertical:   10,
        borderRadius:      8,
        backgroundColor:   '#f0f4ff',
    },
    showBtnText:  { fontSize: 13, color: '#1A56A0', fontWeight: '600' },

    button:        { marginTop: 8, borderRadius: 12 },
    buttonContent: { paddingVertical: 6 },
    buttonLabel:   { fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
});
