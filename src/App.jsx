import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginN from './pages/LoginN';
import DashboardNew from './pages/DashboardNew';
import { Loader2 } from 'lucide-react';

// Componente principal que decide qué mostrar
const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Cargando Sistema Andrei...</p>
                </div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <DashboardNew />;
    }

    return <LoginN />;
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