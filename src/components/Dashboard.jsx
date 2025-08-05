import React from 'react';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="dashboard">
            <nav className="navbar">
                <div className="nav-brand">
                    <h2>Sistema Andrei</h2>
                </div>

                <div className="nav-user">
                    <span>Bienvenido, {user?.nombre}</span>
                    <span className="user-role">({user?.rol})</span>
                    <button onClick={handleLogout} className="logout-btn">
                        Cerrar Sesión
                    </button>
                </div>
            </nav>

            <div className="dashboard-content">
                <div className="dashboard-header">
                    <h1>Panel de Control</h1>
                    <p>Gestión de proyectos de construcción</p>
                </div>

                <div className="dashboard-stats">
                    <div className="stat-card">
                        <h3>Proyectos Activos</h3>
                        <div className="stat-number">0</div>
                        <p>Proyectos en curso</p>
                    </div>

                    <div className="stat-card">
                        <h3>Clientes</h3>
                        <div className="stat-number">0</div>
                        <p>Clientes registrados</p>
                    </div>

                    <div className="stat-card">
                        <h3>Usuarios</h3>
                        <div className="stat-number">1</div>
                        <p>Usuarios del sistema</p>
                    </div>

                    <div className="stat-card">
                        <h3>Materiales</h3>
                        <div className="stat-number">0</div>
                        <p>Items en inventario</p>
                    </div>
                </div>

                <div className="dashboard-actions">
                    <div className="action-card">
                        <h3>🏗️ Proyectos</h3>
                        <p>Gestionar proyectos de construcción</p>
                        <button className="action-btn" disabled>
                            Ver Proyectos
                        </button>
                    </div>

                    <div className="action-card">
                        <h3>👥 Clientes</h3>
                        <p>Administrar información de clientes</p>
                        <button className="action-btn" disabled>
                            Ver Clientes
                        </button>
                    </div>

                    <div className="action-card">
                        <h3>📦 Materiales</h3>
                        <p>Control de inventario de materiales</p>
                        <button className="action-btn" disabled>
                            Ver Inventario
                        </button>
                    </div>

                    <div className="action-card">
                        <h3>👤 Usuarios</h3>
                        <p>Gestión de usuarios del sistema</p>
                        <button className="action-btn" disabled>
                            Ver Usuarios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;