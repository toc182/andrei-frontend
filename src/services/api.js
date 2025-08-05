import axios from 'axios';

// Configuración base para API
const api = axios.create({
    baseURL: 'https://andrei-backend-production.up.railway.app/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Funciones de autenticación
export const authAPI = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },

    register: async (nombre, email, password, rol = 'operario') => {
        const response = await api.post('/auth/register', { nombre, email, password, rol });
        return response.data;
    },

    getProfile: async () => {
        const response = await api.get('/auth/profile');
        return response.data;
    },

    verifyToken: async () => {
        const response = await api.get('/auth/verify');
        return response.data;
    }
};

export default api;