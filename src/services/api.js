import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
const api = axios.create({
    baseURL: 'http://192.168.254.100:8000/api/v1',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
