import { useEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import { getEcho, resetEcho } from '../echo';

export default function ChatScreen({ navigation }) {
    const [messages, setMessages] = useState([]);
    const [input,    setInput]    = useState('');
    const [sending,  setSending]  = useState(false);
    const { user, logout } = useAuthStore();
    const flatListRef = useRef(null);
    const unitId = user?.unit_id;

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <Button
                    onPress={handleLogout}
                    textColor="#1A56A0"
                    compact
                >
                    Logout
                </Button>
            ),
        });
    }, [navigation]);

    // Load message history
    useEffect(() => {
        if (!unitId) return;
        api.get(`/conversations/${unitId}`).then((res) => {
            setMessages(res.data.data);
        });
    }, [unitId]);

    // Subscribe to WebSocket channel
    useEffect(() => {
        if (!unitId) return;

        let channel;
        try {
            const echo = getEcho();
            channel = echo.private(`conversation.${unitId}`)
                .listen('MessageSent', (e) => {
                    console.log('[Echo] MessageSent received', e);
                    setMessages((prev) => [...prev, e]);
                });
        } catch (e) {
            console.error('[Echo] subscription failed:', e?.message);
        }

        return () => channel?.stopListening('MessageSent');
    }, [unitId]);

    const handleLogout = async () => {
        try { await api.post('/auth/logout'); } catch {}
        resetEcho();
        await logout();
        navigation.replace('Login');
    };

    const sendMessage = async () => {
        if (!input.trim()) return;
        setSending(true);
        try {
            const res = await api.post(`/conversations/${unitId}`, { body: input.trim() });
            setMessages((prev) => [...prev, res.data.data]);
            setInput('');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isSent = item.sender_id === user?.id;
        return (
            <View style={[styles.msgRow, isSent ? styles.msgRight : styles.msgLeft]}>
                <Surface style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                    <Text style={isSent ? styles.textSent : styles.textReceived}>
                        {item.body}
                    </Text>
                    <Text style={[styles.time, isSent ? styles.timeSent : styles.timeReceived]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </Surface>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}
        >
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMessage}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={styles.list}
            />
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type a message..."
                    multiline
                    backgroundColor="#fff"
                />
                <Button
                    mode="contained"
                    onPress={sendMessage}
                    loading={sending}
                    disabled={!input.trim()}
                    buttonColor="#1A56A0"
                >
                    Send
                </Button>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container:      { flex: 1, backgroundColor: '#f7f8fa' },
    list:           { padding: 12, paddingBottom: 4 },
    msgRow:         { marginBottom: 8 },
    msgRight:       { alignItems: 'flex-end' },
    msgLeft:        { alignItems: 'flex-start' },
    bubble:         { maxWidth: '75%', padding: 10, borderRadius: 12, elevation: 1 },
    bubbleSent:     { backgroundColor: '#1A56A0' },
    bubbleReceived: { backgroundColor: '#ffffff' },
    textSent:       { color: '#fff', fontSize: 14 },
    textReceived:   { color: '#1a1a1a', fontSize: 14 },
    time:           { fontSize: 11, marginTop: 2, opacity: 0.7 },
    timeSent:       { color: '#fff' },
    timeReceived:   { color: '#555' },
    inputRow:       { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center', gap: 8, backgroundColor: '#fff' },
    input:          { flex: 1 },
});
