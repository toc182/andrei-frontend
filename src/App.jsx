import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './styles/globals.css';
import './styles/components/standardTable.css';
import './styles/components/standardModal.css';
import './App.css';

// Componente principal que decide qué mostrar
const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Cargando Sistema Andrei...</p>
            </div>
        );
    }

    return isAuthenticated ? <Dashboard /> : <Login />;
};

// App principal con el provider de autenticación
const App = () => {
    return (
        <AuthProvider>
            <div className="App">
                <AppContent />
            </div>
        </AuthProvider>
    );
};

export default App;