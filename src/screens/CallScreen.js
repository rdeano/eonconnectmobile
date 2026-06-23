import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    LiveKitRoom,
    AudioSession,
    useLocalParticipant,
    useParticipants,
} from '@livekit/react-native';
import api from '../services/api';
import useCallStore from '../stores/useCallStore';

function fmt(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function CallControls({ unitId, onEnd }) {
    const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
    const participants = useParticipants();
    const remoteJoined = participants.some((p) => !p.isLocal);

    const [waitSeconds, setWaitSeconds] = useState(0);
    const [callSeconds, setCallSeconds] = useState(0);

    // Count up while waiting for the other party
    useEffect(() => {
        if (remoteJoined) { setWaitSeconds(0); return; }
        setWaitSeconds(0);
        const t = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [remoteJoined]);

    // Count up once connected
    useEffect(() => {
        if (!remoteJoined) { setCallSeconds(0); return; }
        setCallSeconds(0);
        const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [remoteJoined]);

    // Auto-cancel outgoing call if remote never joins within 30 seconds.
    // Safe for answered-incoming calls too: the receptionist is already in the
    // room so remoteJoined becomes true within seconds, clearing this timer.
    useEffect(() => {
        if (remoteJoined) return;
        const t = setTimeout(async () => {
            try { await api.post('/calls/end', { unit_id: unitId }); } catch {}
            onEnd();
        }, 30_000);
        return () => clearTimeout(t);
    }, [remoteJoined]);

    const toggleMic = () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);

    return (
        <View style={styles.inner}>
            {/* Status + timer */}
            {remoteJoined ? (
                <View style={styles.statusBlock}>
                    <View style={styles.connectedDot} />
                    <Text style={styles.statusLabel}>Connected</Text>
                    <Text style={styles.timerText}>{fmt(callSeconds)}</Text>
                </View>
            ) : (
                <View style={styles.statusBlock}>
                    <View style={styles.waitingDot} />
                    <Text style={styles.statusLabel}>Ringing…</Text>
                    <Text style={styles.timerText}>{fmt(waitSeconds)}</Text>
                </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
                <View style={styles.controlWrap}>
                    <TouchableOpacity onPress={toggleMic} style={[
                        styles.controlBtn,
                        !isMicrophoneEnabled && styles.controlBtnMuted,
                    ]}>
                        <Text style={styles.controlIcon}>{isMicrophoneEnabled ? '🎙' : '🔇'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.controlLabel}>
                        {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
                    </Text>
                </View>

                <View style={styles.controlWrap}>
                    <TouchableOpacity onPress={onEnd} style={[styles.controlBtn, styles.endBtn]}>
                        <Text style={styles.controlIcon}>📵</Text>
                    </TouchableOpacity>
                    <Text style={styles.controlLabel}>End</Text>
                </View>
            </View>
        </View>
    );
}

export default function CallScreen({ navigation, route }) {
    const { token, livekitUrl, callerName, unitId } = route.params;
    const callStatus = useCallStore((s) => s.status);

    useEffect(() => {
        AudioSession.startAudioSession();
        return () => { AudioSession.stopAudioSession(); };
    }, []);

    // Go back whenever the call is reset — covers both local end and remote hang-up via FCM.
    useEffect(() => {
        if (callStatus === 'idle') navigation.goBack();
    }, [callStatus, navigation]);

    const handleEnd = useCallback(async () => {
        useCallStore.getState().reset(); // triggers the effect above to go back
        try { await api.post('/calls/end', { unit_id: unitId }); } catch {}
    }, [unitId]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#0F2B5B" />

            <View style={styles.header}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                        {(callerName ?? 'R').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.callerName}>{callerName ?? 'Reception'}</Text>
                <Text style={styles.headerSub}>Voice Call</Text>
            </View>

            <LiveKitRoom
                serverUrl={livekitUrl}
                token={token}
                connect
                audio
                video={false}
                onDisconnected={handleEnd}
            >
                <CallControls unitId={unitId} onEnd={handleEnd} />
            </LiveKitRoom>
        </SafeAreaView>
    );
}

const DARKBLUE = '#0F2B5B';

const styles = StyleSheet.create({
    safe:   { flex: 1, backgroundColor: DARKBLUE },
    header: { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },

    avatarCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
    },
    avatarText:  { color: '#fff', fontSize: 32, fontWeight: '700' },
    callerName:  { color: '#fff', fontSize: 24, fontWeight: '700' },
    headerSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },

    inner: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 64 },

    statusBlock: { alignItems: 'center', marginBottom: 48, gap: 6 },
    statusLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500', letterSpacing: 0.5 },
    timerText:   { color: '#fff', fontSize: 36, fontWeight: '300', letterSpacing: 2 },

    connectedDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: '#4ade80',
    },
    waitingDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: '#fbbf24',
    },

    controls:    { flexDirection: 'row', gap: 40 },
    controlWrap: { alignItems: 'center', gap: 8 },
    controlBtn:  {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    controlBtnMuted: { backgroundColor: 'rgba(251,191,36,0.25)' },
    endBtn:          { backgroundColor: '#dc2626' },
    controlIcon:     { fontSize: 24 },
    controlLabel:    { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
});
