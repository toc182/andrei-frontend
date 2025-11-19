import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardNew from './pages/DashboardNew';

// ⚠️ CAMBIAR ESTO PARA PROBAR EL NUEVO LAYOUT
const USE_NEW_LAYOUT = true; // true = nuevo layout Shadcn, false = layout viejo

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

    if (isAuthenticated) {
        return USE_NEW_LAYOUT ? <DashboardNew /> : <Dashboard />;
    }

    return <Login />;
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