import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useAuthStore = create((set) => ({
    user:  null,
    token: null,

    setAuth: async (user, token) => {
        await AsyncStorage.setItem('token', token);
        set({ user, token });
    },

    logout: async () => {
        await AsyncStorage.removeItem('token');
        set({ user: null, token: null });
    },

    loadFromStorage: async () => {
        const token = await AsyncStorage.getItem('token');
        if (token) set({ token });
    },
}));

export default useAuthStore;
