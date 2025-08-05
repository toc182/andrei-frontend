import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Verificar token al cargar la aplicación
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
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

    const login = async (email, password) => {
        try {
            const response = await authAPI.login(email, password);
            if (response.success) {
                localStorage.setItem('token', response.token);
                setUser(response.user);
                setIsAuthenticated(true);
                return { success: true };
            }
            return { success: false, message: response.message };
        } catch (error) {
            const message = error.response?.data?.message || 'Error de conexión';
            return { success: false, message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
