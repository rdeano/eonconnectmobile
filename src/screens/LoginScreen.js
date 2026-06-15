import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';

export default function LoginScreen({ navigation }) {
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const { setAuth } = useAuthStore();

    const handleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { email, password });
            await setAuth(res.data.data.user, res.data.data.token);
            navigation.replace('Chat');
        } catch (e) {
            console.error('Login error:', e?.response?.status, e?.response?.data, e?.message);
            setError(e?.response?.data?.message || e?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <Surface style={styles.card}>
                <Text variant="headlineSmall" style={styles.title}>Eon Connect</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                />
                <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                />
                <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    style={styles.button}
                    buttonColor="#1A56A0"
                >
                    Login
                </Button>
            </Surface>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f7f8fa' },
    card:      { padding: 24, borderRadius: 12, elevation: 2 },
    title:     { fontWeight: '700', marginBottom: 20, color: '#1A56A0' },
    input:     { marginBottom: 12, backgroundColor: '#fff' },
    button:    { marginTop: 8 },
    error:     { color: 'red', marginBottom: 12 },
});
