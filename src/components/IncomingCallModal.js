import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import useCallStore from '../stores/useCallStore';
import api from '../services/api';
import { startRingtone, stopRingtone } from '../utils/ringtone';

function fmt(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

const TIMEOUT = 30;

export default function IncomingCallModal({ navigationRef }) {
    const { status, callerName, token, livekitUrl, unitId, setActive, reset } = useCallStore();
    const [ringSeconds, setRingSeconds] = useState(0);

    // Play ringtone + vibrate while ringing; stop both when modal closes
    useEffect(() => {
        if (status !== 'ringing') return;
        Vibration.vibrate([0, 1000, 1000], true);
        startRingtone();
        return () => {
            Vibration.cancel();
            stopRingtone();
        };
    }, [status]);

    // Count up while ringing
    useEffect(() => {
        if (status !== 'ringing') { setRingSeconds(0); return; }
        setRingSeconds(0);
        const t = setInterval(() => setRingSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [status]);

    // Auto-decline after TIMEOUT seconds
    useEffect(() => {
        if (status !== 'ringing') return;
        const timer = setTimeout(async () => {
            try { await api.post('/calls/end', { unit_id: unitId }); } catch {}
            reset();
        }, TIMEOUT * 1000);
        return () => clearTimeout(timer);
    }, [status]);

    const handleAnswer = () => {
        setActive();
        navigationRef.current?.navigate('Call', { token, livekitUrl, callerName, unitId });
    };

    const handleDecline = async () => {
        try { await api.post('/calls/end', { unit_id: unitId }); } catch {}
        reset();
    };

    const remaining = TIMEOUT - ringSeconds;

    return (
        <Modal
            visible={status === 'ringing'}
            transparent
            animationType="slide"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>
                                {(callerName ?? 'R').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <Text style={styles.label}>INCOMING CALL</Text>
                        <Text style={styles.name}>{callerName ?? 'Reception'}</Text>
                    </View>

                    {/* Ringing timer */}
                    <View style={styles.timerRow}>
                        <View style={styles.timerBadge}>
                            <Text style={styles.timerLabel}>Ringing</Text>
                            <Text style={styles.timerValue}>{fmt(ringSeconds)}</Text>
                        </View>
                        <View style={[styles.timerBadge, styles.timerBadgeWarning]}>
                            <Text style={styles.timerLabel}>Auto-decline in</Text>
                            <Text style={[styles.timerValue, remaining <= 10 && styles.timerValueUrgent]}>
                                0:{String(remaining).padStart(2, '0')}
                            </Text>
                        </View>
                    </View>

                    {/* Buttons */}
                    <View style={styles.btns}>
                        <TouchableOpacity onPress={handleDecline} style={[styles.btn, styles.decline]}>
                            <Text style={styles.declineText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleAnswer} style={[styles.btn, styles.answer]}>
                            <Text style={styles.answerText}>Answer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 48,
        alignItems: 'center',
        gap: 0,
    },

    header: { alignItems: 'center', marginBottom: 20 },
    avatarCircle: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#1A56A0',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
    },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
    label:      { fontSize: 11, color: '#8a97b5', fontWeight: '600', letterSpacing: 1.5, marginBottom: 4 },
    name:       { fontSize: 22, fontWeight: '700', color: '#0F2B5B' },

    timerRow: {
        flexDirection: 'row', gap: 12,
        width: '100%', marginBottom: 28,
    },
    timerBadge: {
        flex: 1, backgroundColor: '#f0f4ff',
        borderRadius: 14, paddingVertical: 10,
        alignItems: 'center', gap: 2,
    },
    timerBadgeWarning: { backgroundColor: '#fff7ed' },
    timerLabel:        { fontSize: 10, color: '#8a97b5', fontWeight: '600', letterSpacing: 0.8 },
    timerValue:        { fontSize: 20, fontWeight: '700', color: '#0F2B5B' },
    timerValueUrgent:  { color: '#c2410c' },

    btns:        { flexDirection: 'row', gap: 16, width: '100%' },
    btn:         { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    decline:     { backgroundColor: '#fee2e2' },
    answer:      { backgroundColor: '#dcfce7' },
    declineText: { fontSize: 16, fontWeight: '700', color: '#b91c1c' },
    answerText:  { fontSize: 16, fontWeight: '700', color: '#15803d' },
});
