import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse, User } from '@/types';

// Configuración base para API
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.PROD
    ? 'https://andrei-backend-production.up.railway.app/api'
    : 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Interceptor de respuesta: si el token expira o es inválido, cerrar sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl: string = error?.config?.url ?? '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/change-password');

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

// Tipos para respuestas de autenticación
interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  user: User;
}

interface ProfileResponse {
  success: boolean;
  user: User;
}

interface VerifyResponse {
  success: boolean;
  valid: boolean;
  user: User;
}

// Funciones de autenticación
export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  register: async (
    nombre: string,
    email: string,
    password: string,
    rol: User['rol'] = 'usuario',
  ): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>('/auth/register', {
      nombre,
      email,
      password,
      rol,
    });
    return response.data;
  },

  getProfile: async (): Promise<ProfileResponse> => {
    const response = await api.get<ProfileResponse>('/auth/profile');
    return response.data;
  },

  verifyToken: async (): Promise<VerifyResponse> => {
    const response = await api.get<VerifyResponse>('/auth/verify');
    return response.data;
  },

  changePassword: async (
    password_actual: string | null,
    password_nueva: string,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/change-password',
      { password_actual, password_nueva },
    );
    return response.data;
  },
};

export default api;
