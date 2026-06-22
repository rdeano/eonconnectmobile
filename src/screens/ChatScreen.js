import { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, FlatList, StyleSheet, KeyboardAvoidingView,
    Platform, TouchableOpacity, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import useCallStore from '../stores/useCallStore';
import { getEcho, resetEcho } from '../echo';

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(ts) {
    const d         = new Date(ts);
    const today     = new Date();
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

export default function ChatScreen({ navigation, route }) {
    const [messages,        setMessages]        = useState([]);
    const [input,           setInput]           = useState('');
    const [sending,         setSending]         = useState(false);
    const [receptionOnline, setReceptionOnline] = useState(false);
    const [callLoading,     setCallLoading]     = useState(false);
    const { user, logout } = useAuthStore();
    const flatListRef = useRef(null);
    const { bottom } = useSafeAreaInsets();

    const isReception = user?.role === 'reception';

    // Unit owners use their own unit_id; reception receives it as a route param.
    const unitId   = route.params?.unitId   ?? user?.unit_id;
    const unitName = route.params?.unitName ?? 'Unit';

    // What to show at the top of CallScreen for the person being called
    const calleeLabel = isReception ? unitName : 'Reception';

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Load messages
    useEffect(() => {
        if (!unitId) return;
        api.get(`/conversations/${unitId}`).then((res) => {
            setMessages(res.data.data);
            api.patch(`/conversations/${unitId}/read`).catch(() => {});
        });
    }, [unitId]);


    // Presence channel — track whether any reception user is online.
    // Only relevant for unit owners (reception knows they themselves are online).
    useEffect(() => {
        if (isReception) return;
        const isRecep = (u) => u.role === 'reception';
        try {
            getEcho()
                .join('presence.building')
                .here((users) => setReceptionOnline(users.some(isRecep)))
                .joining((u) => { if (isRecep(u)) setReceptionOnline(true); })
                .leaving((u) => {
                    if (!isRecep(u)) return;
                    const members = getEcho().connector.channels['presence-presence.building']?.members?.members;
                    setReceptionOnline(
                        members ? Object.values(members).some((m) => m.role === 'reception') : false,
                    );
                });
        } catch (e) {
            console.error('[Echo] presence join failed:', e?.message);
        }
        return () => {
            try { getEcho().leave('presence.building'); } catch {}
        };
    }, [isReception]);

    // Private conversation channel — messages + call signals
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
                })
                .listen('MessagesRead', () => {
                    setMessages((prev) =>
                        prev.map((m) => m.sender_id === user?.id ? { ...m, status: 'read' } : m)
                    );
                })
                .listen('CallInvited', async (e) => {
                    // Ignore if we're the one who initiated this call.
                    if (useCallStore.getState().status !== 'idle') return;
                    try {
                        const res = await api.post('/calls/token', { unit_id: e.unit_id });
                        const { room: roomName, token, livekit_url } = res.data;
                        useCallStore.getState().setRinging(
                            roomName, token, livekit_url, e.caller_name, e.unit_id,
                        );
                    } catch {}
                })
                .listen('CallEnded', () => {
                    useCallStore.getState().reset();
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

    const handleCall = useCallback(async () => {
        if (callLoading || !unitId) return;
        if (!isReception && !receptionOnline) {
            Alert.alert('Reception Offline', 'Reception is currently offline. Please try again later.');
            return;
        }
        setCallLoading(true);
        // Mark as 'calling' immediately so the Echo CallInvited event that bounces
        // back to this channel doesn't trigger the incoming-call modal on the caller.
        useCallStore.getState().setCalling(null, null, null, unitId);
        try {
            const res = await api.post('/calls/token', { unit_id: unitId });
            const { token, livekit_url } = res.data;
            await api.post('/calls/invite', { unit_id: unitId });
            navigation.navigate('Call', {
                token,
                livekitUrl: livekit_url,
                callerName: calleeLabel,
                unitId,
            });
        } catch {
            useCallStore.getState().reset();
            Alert.alert('Error', 'Could not start call. Please try again.');
        } finally {
            setCallLoading(false);
        }
    }, [callLoading, unitId, calleeLabel, navigation, isReception, receptionOnline]);

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
        const isSent     = item.sender_id === user?.id;
        const prevItem   = messages[index - 1];
        const currLabel  = formatDateLabel(item.created_at);
        const prevLabel  = prevItem ? formatDateLabel(prevItem.created_at) : null;
        const showDate   = currLabel !== prevLabel;
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
                    {!isSent && <Avatar name={senderName} size={30} />}
                    <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                        <Text style={isSent ? styles.textSent : styles.textReceived}>
                            {item.body}
                        </Text>
                        <View style={styles.timeRow}>
                            <Text style={[styles.time, isSent ? styles.timeSent : styles.timeReceived]}>
                                {formatTime(item.created_at)}
                            </Text>
                            {isSent && (
                                <Text style={[styles.tick, item.status === 'read' && styles.tickRead]}>
                                    {item.status === 'read' ? 'Seen' : 'Unread'}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
            </>
        );
    };

    // ── Header helpers ────────────────────────────────────────────────────────

    const showCallBtn = !!unitId;

    const headerTitle = isReception ? unitName : 'Reception';
    const headerSub   = isReception
        ? route.params?.unitLabel ?? ''
        : (receptionOnline ? 'Online' : 'EonConnect');

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#0F2B5B" />

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {/* Back button for reception (they go back to conversations list) */}
                    {isReception && (
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Text style={styles.backBtnText}>{'‹'}</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.headerAvatarWrap}>
                        <View style={styles.headerAvatar}>
                            <Text style={styles.headerAvatarText}>
                                {isReception
                                    ? (unitName || '?').charAt(0).toUpperCase()
                                    : 'RC'
                                }
                            </Text>
                        </View>
                        {!isReception && receptionOnline && <View style={styles.onlineDot} />}
                    </View>

                    <View>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        <Text style={[styles.headerSub, !isReception && receptionOnline && styles.headerSubOnline]}>
                            {headerSub}
                        </Text>
                    </View>
                </View>

                <View style={styles.headerRight}>
                    {showCallBtn && (
                        <TouchableOpacity
                            onPress={handleCall}
                            disabled={callLoading}
                            style={[styles.callBtn, !isReception && !receptionOnline && styles.callBtnOffline]}
                            activeOpacity={0.7}
                        >
                            {callLoading
                                ? <ActivityIndicator color="#fff" size={14} />
                                : <Text style={styles.callBtnText}>{'☎'}</Text>
                            }
                        </TouchableOpacity>
                    )}

                    {/* Logout only shown for unit owners — reception logs out from ConversationsScreen */}
                    {!isReception && (
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    )}
                </View>
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

const BLUE     = '#1A56A0';
const DARKBLUE = '#0F2B5B';

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: DARKBLUE },
    flex: { flex: 1, backgroundColor: '#f4f6fb' },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingHorizontal: 16,
        paddingVertical:   12,
        backgroundColor:   DARKBLUE,
    },
    headerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerAvatarWrap: { position: 'relative' },
    headerAvatar: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: BLUE,
        alignItems: 'center', justifyContent: 'center',
    },
    headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    onlineDot: {
        position: 'absolute', bottom: 1, right: 1,
        width: 11, height: 11, borderRadius: 6,
        backgroundColor: '#16a34a',
        borderWidth: 2, borderColor: DARKBLUE,
    },
    headerTitle:     { color: '#fff', fontWeight: '700', fontSize: 16 },
    headerSub:       { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
    headerSubOnline: { color: '#4ade80' },

    backBtn:     { paddingHorizontal: 4, paddingVertical: 4 },
    backBtnText: { color: '#fff', fontSize: 28, lineHeight: 28, fontWeight: '300' },

    callBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#16a34a',
        alignItems: 'center', justifyContent: 'center',
    },
    callBtnOffline: { backgroundColor: 'rgba(255,255,255,0.2)' },
    callBtnText: { color: '#fff', fontSize: 16 },

    logoutBtn: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    logoutText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },

    list: { paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 8 },

    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
    dateLine:      { flex: 1, height: 1, backgroundColor: '#dde3f0' },
    dateLabel:     { fontSize: 11, color: '#8a97b5', fontWeight: '500' },

    msgRow:   { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 6 },
    msgRight: { justifyContent: 'flex-end' },
    msgLeft:  { justifyContent: 'flex-start' },

    avatar:     { backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    bubble: {
        maxWidth: '75%',
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 18,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    bubbleSent:     { backgroundColor: BLUE, borderBottomRightRadius: 4 },
    bubbleReceived: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
    textSent:       { color: '#fff', fontSize: 14.5, lineHeight: 20 },
    textReceived:   { color: '#1a2540', fontSize: 14.5, lineHeight: 20 },
    timeRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 },
    time:           { fontSize: 10, opacity: 0.7 },
    timeSent:       { color: '#cfe0ff', textAlign: 'right' },
    timeReceived:   { color: '#8a97b5' },
    tick:           { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
    tickRead:       { color: '#7cd9ff' },

    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingTop: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#eaeff8',
        gap: 8,
    },
    input:           { flex: 1, maxHeight: 120, fontSize: 15 },
    inputContent:    { paddingVertical: 8, fontSize: 15, color: '#1a2540' },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#1A56A0',
        alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#b0bdd6' },
    sendArrow: {
        width: 0, height: 0,
        borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 14,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#fff',
        marginLeft: 3,
    },
});
