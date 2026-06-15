import { useEffect, useRef, useState } from 'react';
import {
    View, FlatList, StyleSheet, KeyboardAvoidingView,
    Platform, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import { getEcho, resetEcho } from '../echo';

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(ts) {
    const d     = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ name, size = 32 }) {
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={styles.avatarText}>{initial}</Text>
        </View>
    );
}

export default function ChatScreen({ navigation }) {
    const [messages, setMessages] = useState([]);
    const [input,    setInput]    = useState('');
    const [sending,  setSending]  = useState(false);
    const { user, logout } = useAuthStore();
    const flatListRef = useRef(null);
    const unitId = user?.unit_id;
    const { bottom } = useSafeAreaInsets();

    useEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    useEffect(() => {
        if (!unitId) return;
        api.get(`/conversations/${unitId}`).then((res) => {
            setMessages(res.data.data);
        });
    }, [unitId]);

    useEffect(() => {
        if (!unitId) return;

        try {
            const echo = getEcho();
            echo.private(`conversation.${unitId}`)
                .listen('MessageSent', (e) => {
                    const msg = e.message ?? e;
                    setMessages((prev) =>
                        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
                    );
                });
        } catch (e) {
            console.error('[Echo] subscription failed:', e?.message);
        }

        return () => {
            try { getEcho().leave(`conversation.${unitId}`); } catch {}
        };
    }, [unitId]);

    const handleLogout = async () => {
        try { await api.post('/auth/logout'); } catch {}
        resetEcho();
        await logout();
        navigation.replace('Login');
    };

    const sendMessage = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            const res = await api.post(`/conversations/${unitId}`, { body: input.trim() });
            const sent = res.data.data;
            setMessages((prev) =>
                prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]
            );
            setInput('');
        } finally {
            setSending(false);
        }
    };

    const renderItem = ({ item, index }) => {
        const isSent    = item.sender_id === user?.id;
        const prevItem  = messages[index - 1];
        const currLabel = formatDateLabel(item.created_at);
        const prevLabel = prevItem ? formatDateLabel(prevItem.created_at) : null;
        const showDate  = currLabel !== prevLabel;
        const senderName = item.sender?.name ?? (isSent ? user?.name : 'Reception');

        return (
            <>
                {showDate && (
                    <View style={styles.dateSeparator}>
                        <View style={styles.dateLine} />
                        <Text style={styles.dateLabel}>{currLabel}</Text>
                        <View style={styles.dateLine} />
                    </View>
                )}
                <View style={[styles.msgRow, isSent ? styles.msgRight : styles.msgLeft]}>
                    {!isSent && (
                        <Avatar name={senderName} size={30} />
                    )}
                    <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                        <Text style={isSent ? styles.textSent : styles.textReceived}>
                            {item.body}
                        </Text>
                        <Text style={[styles.time, isSent ? styles.timeSent : styles.timeReceived]}>
                            {formatTime(item.created_at)}
                        </Text>
                    </View>
                </View>
            </>
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#0F2B5B" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerAvatar}>
                        <Text style={styles.headerAvatarText}>RC</Text>
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Reception</Text>
                        <Text style={styles.headerSub}>EonConnect</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />

                <View style={[styles.inputRow, { paddingBottom: Math.max(bottom, 8) }]}>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message…"
                        placeholderTextColor="#aab4cc"
                        multiline
                        maxLength={2000}
                        mode="outlined"
                        outlineColor="transparent"
                        activeOutlineColor="transparent"
                        theme={{ colors: { background: '#f0f4ff', onSurface: '#1a2540', onSurfaceVariant: '#1a2540' } }}
                        contentStyle={styles.inputContent}
                    />
                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={!input.trim() || sending}
                        style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                        activeOpacity={0.8}
                    >
                        {sending
                            ? <ActivityIndicator color="#fff" size={18} />
                            : <View style={styles.sendArrow} />
                        }
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const BLUE    = '#1A56A0';
const DARKBLUE = '#0F2B5B';

const styles = StyleSheet.create({
    safe:   { flex: 1, backgroundColor: DARKBLUE },
    flex:   { flex: 1, backgroundColor: '#f4f6fb' },

    header: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical:   12,
        backgroundColor:   DARKBLUE,
    },
    headerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar:     {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: BLUE,
        alignItems: 'center', justifyContent: 'center',
    },
    headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    headerTitle:      { color: '#fff', fontWeight: '700', fontSize: 16 },
    headerSub:        { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
    logoutBtn:        {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    logoutText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },

    list: { paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 8 },

    dateSeparator: {
        flexDirection:  'row',
        alignItems:     'center',
        marginVertical: 16,
        gap:            8,
    },
    dateLine:  { flex: 1, height: 1, backgroundColor: '#dde3f0' },
    dateLabel: { fontSize: 11, color: '#8a97b5', fontWeight: '500' },

    msgRow:  { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 6 },
    msgRight: { justifyContent: 'flex-end' },
    msgLeft:  { justifyContent: 'flex-start' },

    avatar:     { backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    bubble: {
        maxWidth:     '75%',
        paddingHorizontal: 14,
        paddingVertical:   8,
        borderRadius: 18,
        shadowColor:  '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius:  4,
        elevation:     2,
    },
    bubbleSent:     {
        backgroundColor:   BLUE,
        borderBottomRightRadius: 4,
    },
    bubbleReceived: {
        backgroundColor:  '#fff',
        borderBottomLeftRadius: 4,
    },
    textSent:     { color: '#fff', fontSize: 14.5, lineHeight: 20 },
    textReceived: { color: '#1a2540', fontSize: 14.5, lineHeight: 20 },
    time:         { fontSize: 10, marginTop: 3, opacity: 0.7 },
    timeSent:     { color: '#cfe0ff', textAlign: 'right' },
    timeReceived: { color: '#8a97b5' },

    inputRow: {
        flexDirection:  'row',
        alignItems:     'center',
        paddingHorizontal: 12,
        paddingTop:      8,
        backgroundColor: '#fff',
        borderTopWidth:  1,
        borderTopColor:  '#eaeff8',
        gap: 8,
    },
    input: {
        flex:      1,
        maxHeight: 120,
        fontSize:  15,
    },
    inputContent: { paddingVertical: 8, fontSize: 15, color: '#1a2540' },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#1A56A0',
        alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#b0bdd6' },
    sendArrow: {
        width:             0,
        height:            0,
        borderTopWidth:    8,
        borderBottomWidth: 8,
        borderLeftWidth:   14,
        borderTopColor:    'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor:   '#fff',
        marginLeft:        3,
    },
});
