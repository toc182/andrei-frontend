import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginN from './pages/LoginN';
import Dashboard from './pages/Dashboard';
import DashboardNew from './pages/DashboardNew';
import { Loader2 } from 'lucide-react';

// ⚠️ CAMBIAR ESTO PARA PROBAR EL NUEVO LAYOUT
const USE_NEW_LAYOUT = true; // true = nuevo layout Shadcn, false = layout viejo

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
        return USE_NEW_LAYOUT ? <DashboardNew /> : <Dashboard />;
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