import { useCallback, useEffect, useState } from 'react';
import {
    View, FlatList, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import { resetEcho } from '../echo';

function formatTime(ts) {
    if (!ts) return '';
    const d     = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function previewText(unit) {
    const body = unit.messages?.[0]?.body;
    if (!body) return 'No messages yet';
    return body.length > 55 ? body.slice(0, 52) + '…' : body;
}

function UnitRow({ item, onPress }) {
    const unitLabel  = `Unit ${item.unit_number ?? item.id}`;
    const ownerName  = item.owner?.name ?? item.owner_name ?? unitLabel;
    const unread     = item.unread_count ?? 0;
    const latestTime = item.messages?.[0]?.created_at;
    const initial    = ownerName.charAt(0).toUpperCase();

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
            </View>

            <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>{ownerName}</Text>
                    <Text style={styles.rowTime}>{formatTime(latestTime)}</Text>
                </View>
                <View style={styles.rowBottom}>
                    <Text style={[styles.rowUnit, unread > 0 && styles.rowUnitBold]}>
                        {unitLabel}
                    </Text>
                    {unread > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.rowPreview} numberOfLines={1}>
                    {previewText(item)}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

export default function ConversationsScreen({ navigation }) {
    const [units,      setUnits]      = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const { logout } = useAuthStore();

    const load = useCallback(async () => {
        try {
            const res = await api.get('/conversations');
            setUnits(res.data.data);
        } catch {}
    }, []);

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
        load();
    }, [load, navigation]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        try { await api.post('/auth/logout'); } catch {}
        resetEcho();
        await logout();
        navigation.replace('Login');
    };

    const handleOpenUnit = (unit) => {
        const unitLabel = `Unit ${unit.unit_number ?? unit.id}`;
        const ownerName = unit.owner?.name ?? unit.owner_name ?? unitLabel;
        navigation.navigate('Chat', {
            unitId:    unit.id,
            unitLabel,
            unitName:  ownerName,
        });
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#0F2B5B" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>EonConnect</Text>
                    <Text style={styles.headerSub}>Reception</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={units}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <UnitRow item={item} onPress={() => handleOpenUnit(item)} />
                )}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>No active units yet.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const BLUE     = '#1A56A0';
const DARKBLUE = '#0F2B5B';

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f4f6fb' },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingHorizontal: 16,
        paddingVertical:   14,
        backgroundColor:   DARKBLUE,
    },
    headerTitle: { color: '#fff', fontWeight: '700', fontSize: 18 },
    headerSub:   { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
    logoutBtn: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    logoutText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },

    row: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   14,
        backgroundColor:   '#fff',
        gap:               12,
    },
    avatar: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: BLUE,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
    },
    avatarText:  { color: '#fff', fontSize: 18, fontWeight: '700' },
    rowContent:  { flex: 1, gap: 2 },
    rowTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowName:     { fontSize: 15, fontWeight: '700', color: '#1a2540', flex: 1 },
    rowTime:     { fontSize: 11, color: '#8a97b5', marginLeft: 8, flexShrink: 0 },
    rowBottom:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowUnit:     { fontSize: 12, color: '#6b7a99' },
    rowUnitBold: { fontWeight: '600', color: '#1a2540' },
    rowPreview:  { fontSize: 13, color: '#8a97b5' },

    badge: {
        backgroundColor: BLUE, borderRadius: 10,
        minWidth: 20, height: 20,
        paddingHorizontal: 5,
        alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    separator: { height: 1, backgroundColor: '#f0f4ff', marginLeft: 76 },

    emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
    emptyText: { color: '#8a97b5', fontSize: 15 },
});
