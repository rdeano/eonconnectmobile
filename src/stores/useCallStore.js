import { create } from 'zustand';

const useCallStore = create((set) => ({
    status: 'idle',       // idle | calling | ringing | active
    roomName: null,
    token: null,
    livekitUrl: null,
    callerName: null,
    unitId: null,

    setCalling: (roomName, token, livekitUrl, unitId) =>
        set({ status: 'calling', roomName, token, livekitUrl, unitId }),

    setRinging: (roomName, token, livekitUrl, callerName, unitId) =>
        set({ status: 'ringing', roomName, token, livekitUrl, callerName, unitId }),

    setActive: () => set({ status: 'active' }),

    reset: () => set({
        status: 'idle', roomName: null, token: null,
        livekitUrl: null, callerName: null, unitId: null,
    }),
}));

export default useCallStore;
