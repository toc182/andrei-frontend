/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { authAPI } from '../services/api';
import type { User, UserPermissions } from '@/types';

// Types for auth context
interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<LoginResult>;
    logout: () => void;
    hasPermission: (permiso: keyof UserPermissions) => boolean;
    isAdminOrCoAdmin: boolean;
}

interface LoginResult {
    success: boolean;
    message?: string;
}

interface AuthProviderProps {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    // Verificar token al cargar la aplicación
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async (): Promise<void> => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const response = await authAPI.verifyToken();
                if (response.success) {
                    setUser(response.user);
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem('token');
                }
            }
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<LoginResult> => {
        try {
            const response = await authAPI.login(email, password);
            if (response.success) {
                localStorage.setItem('token', response.token);
                setUser(response.user);
                setIsAuthenticated(true);
                return { success: true };
            }
            return { success: false, message: response.message };
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { message?: string } } };
            const message = axiosError.response?.data?.message || 'Error de conexión';
            return { success: false, message };
        }
    };

    const logout = (): void => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    const isAdminOrCoAdmin = useMemo(() => {
        return user?.rol === 'admin' || user?.rol === 'co-admin';
    }, [user?.rol]);

    const hasPermission = useCallback((permiso: keyof UserPermissions): boolean => {
        // admin y co-admin tienen todos los permisos
        if (user?.rol === 'admin' || user?.rol === 'co-admin') return true;
        // usuario verifica su permiso específico
        return user?.permissions?.[permiso] ?? false;
    }, [user?.rol, user?.permissions]);

    const value: AuthContextType = {
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        hasPermission,
        isAdminOrCoAdmin,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
