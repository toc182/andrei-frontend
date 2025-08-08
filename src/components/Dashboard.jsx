import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectsList from './ProjectsList';
import ProjectForm from './ProjectForm';
import api from '../services/api';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [currentView, setCurrentView] = useState('dashboard');
    const [stats, setStats] = useState({
        proyectos_activos: 0,
        proyectos_planificacion: 0,
        proyectos_completados: 0,
        total_proyectos: 0,
        monto_contratos_total: 0
    });
    const [loadingStats, setLoadingStats] = useState(true);

    // Cargar estadísticas del dashboard
    useEffect(() => {
        loadDashboardStats();
    }, []);

    const loadDashboardStats = async () => {
        try {
            setLoadingStats(true);
            const response = await api.get('/projects/stats/dashboard');

            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleLogout = () => {
        logout();
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const renderDashboardHome = () => (
        <div className="dashboard-content">
            <div className="dashboard-header">
                <h1>Panel de Control</h1>
                <p>Sistema de gestión de proyectos de construcción</p>
            </div>

            <div className="dashboard-stats">
                <div className="stat-card">
                    <h3>Proyectos Activos</h3>
                    <div className="stat-number">
                        {loadingStats ? '...' : stats.proyectos_activos}
                    </div>
                    <p>En ejecución</p>
                </div>

                <div className="stat-card">
                    <h3>En Planificación</h3>
                    <div className="stat-number">
                        {loadingStats ? '...' : stats.proyectos_planificacion}
                    </div>
                    <p>Por iniciar</p>
                </div>

                <div className="stat-card">
                    <h3>Completados</h3>
                    <div className="stat-number">
                        {loadingStats ? '...' : stats.proyectos_completados}
                    </div>
                    <p>Finalizados</p>
                </div>

                <div className="stat-card">
                    <h3>Total Proyectos</h3>
                    <div className="stat-number">
                        {loadingStats ? '...' : stats.total_proyectos}
                    </div>
                    <p>En el sistema</p>
                </div>

                <div className="stat-card stat-card-wide">
                    <h3>Valor Total de Contratos</h3>
                    <div className="stat-number stat-money">
                        {loadingStats ? '...' : formatMoney(stats.monto_contratos_total)}
                    </div>
                    <p>Suma de todos los contratos</p>
                </div>
            </div>

            <div className="dashboard-actions">
                <div className="action-card">
                    <h3>🏗️ Gestión de Proyectos</h3>
                    <p>Administra todos los proyectos de construcción, desde planificación hasta finalización</p>
                    <button
                        className="action-btn"
                        onClick={() => setCurrentView('projects')}
                    >
                        Ver Proyectos
                    </button>
                </div>

                <div className="action-card">
                    <h3>👥 Gestión de Clientes</h3>
                    <p>Administrar información de clientes y contactos</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>📦 Control de Materiales</h3>
                    <p>Inventario y control de materiales de construcción</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>👤 Gestión de Usuarios</h3>
                    <p>Administración de usuarios del sistema</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>📊 Reportes y Analytics</h3>
                    <p>Informes detallados y análisis de proyectos</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>⚙️ Configuración</h3>
                    <p>Configuración del sistema y preferencias</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (currentView) {
            case 'projects':
                return <ProjectsList onStatsUpdate={loadDashboardStats} />;
            default:
                return renderDashboardHome();
        }
    };

    return (
        <div className="dashboard">
            <nav className="navbar">
                <div className="nav-brand">
                    <h2
                        onClick={() => setCurrentView('dashboard')}
                        style={{ cursor: 'pointer' }}
                    >
                        Sistema Andrei
                    </h2>
                </div>

                <div className="nav-menu">
                    <button
                        className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setCurrentView('dashboard')}
                    >
                        🏠 Dashboard
                    </button>

                    <button
                        className={`nav-item ${currentView === 'projects' ? 'active' : ''}`}
                        onClick={() => setCurrentView('projects')}
                    >
                        🏗️ Proyectos
                    </button>

                    <button className="nav-item" disabled>
                        👥 Clientes
                    </button>

                    <button className="nav-item" disabled>
                        📦 Materiales
                    </button>

                    {user?.rol === 'admin' && (
                        <button className="nav-item" disabled>
                            👤 Usuarios
                        </button>
                    )}
                </div>

                <div className="nav-user">
                    <span>Bienvenido, {user?.nombre}</span>
                    <span className="user-role">({user?.rol})</span>
                    <button onClick={handleLogout} className="logout-btn">
                        Cerrar Sesión
                    </button>
                </div>
            </nav>

            {renderContent()}
        </div>
    );
};

export default Dashboard;