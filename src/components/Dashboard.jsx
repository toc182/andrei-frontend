import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectsHub from './ProjectsHub';
import ProjectForm from './ProjectForm';
import api from '../services/api';
import SeguimientoHub from './SeguimientoHub';
import Clientes from './Clientes';
import CostsHub from './CostsHub';
import DocumentForm from './DocumentForm';
import DocumentosHub from './DocumentosHub';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faBuilding, faChartLine, faUsers, faDollarSign, faBoxes, faUserCog, faSignOutAlt, faFileText } from '@fortawesome/free-solid-svg-icons';
import '../styles/globals.css';
import '../styles/layout.css';
import '../styles/navigation.css';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [currentView, setCurrentView] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expandedMenu, setExpandedMenu] = useState(null);
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

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const toggleSubmenu = (menuKey) => {
        setExpandedMenu(expandedMenu === menuKey ? null : menuKey);
    };

    const handleMenuClick = (view, submenu = null) => {
        setCurrentView(submenu || view);
        if (!submenu && expandedMenu) {
            setExpandedMenu(null);
        }
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
                    <h3>■ Gestión de Proyectos</h3>
                    <p>Administra todos los proyectos de construcción, desde planificación hasta finalización</p>
                    <button
                        className="action-btn"
                        onClick={() => setCurrentView('projects')}
                    >
                        Ver Proyectos
                    </button>
                </div>
                <div className="action-card">
                    <h3>⟨ Seguimiento de Tuberías</h3>
                    <p>Control de avance de instalación de tuberías por frentes de trabajo</p>
                    <button
                        className="action-btn"
                        onClick={() => setCurrentView('seguimiento')}
                    >
                        Ver Seguimiento
                    </button>
                </div>
                <div className="action-card">
                    <h3>◉ Gestión de Clientes</h3>
                    <p>Administrar información de clientes y contactos</p>
                    <button
                        className="action-btn"
                        onClick={() => setCurrentView('clientes')}
                    >
                        Ver Clientes
                    </button>
                </div>

                <div className="action-card">
                    <h3>$ Control de Costos</h3>
                    <p>Presupuestos, gastos y control financiero de proyectos</p>
                    <button
                        className="action-btn"
                        onClick={() => setCurrentView('costs')}
                    >
                        Ver Costos
                    </button>
                </div>

                <div className="action-card">
                    <h3>□ Control de Materiales</h3>
                    <p>Inventario y control de materiales de construcción</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>◎ Gestión de Usuarios</h3>
                    <p>Administración de usuarios del sistema</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>◰ Reportes y Analytics</h3>
                    <p>Informes detallados y análisis de proyectos</p>
                    <button className="action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="action-card">
                    <h3>◆ Configuración</h3>
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
            case 'projects-proyectos':
            case 'projects-licitaciones':
            case 'projects-oportunidades':
                return <ProjectsHub onStatsUpdate={loadDashboardStats} activeTab={currentView.includes('-') ? currentView.split('-')[1] : 'proyectos'} />;
            case 'seguimiento':
                return <SeguimientoHub />;
            case 'clientes':
                return <Clientes />;
            case 'costs':
                return <CostsHub />;
            case 'documentos':
                return <DocumentosHub onDocumentClick={(docId) => setCurrentView(docId)} />;
            case 'doc-acuerdo-consorcio':
                return <DocumentForm documentType="acuerdo-consorcio" />;
            case 'doc-carta-adhesion':
                return <DocumentForm documentType="carta-adhesion" />;
            case 'doc-medidas-retorsion':
                return <DocumentForm documentType="medidas-retorsion" />;
            case 'doc-no-incapacidad':
                return <DocumentForm documentType="no-incapacidad" />;
            case 'doc-pacto-integridad':
                return <DocumentForm documentType="pacto-integridad" />;
            default:
                return renderDashboardHome();
        }
    };

    return (
        <div className="dashboard-layout">
            {/* Mobile Header */}
            <header className="mobile-header">
                <button className="hamburger-btn" onClick={toggleSidebar}>
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <img src={logo} alt="Pinellas Logo" className="mobile-logo" />
                <div className="mobile-user">
                    <span>{user?.nombre}</span>
                </div>
            </header>

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                        onClick={() => handleMenuClick('dashboard')}
                    >
                        <span className="nav-icon"><FontAwesomeIcon icon={faHome} /></span>
                        <span className="nav-text">Dashboard</span>
                    </button>

                    <div className="nav-group">
                        <button
                            className={`nav-item nav-parent ${expandedMenu === 'projects' ? 'expanded' : ''} ${['projects', 'projects-proyectos', 'projects-licitaciones', 'projects-oportunidades'].includes(currentView) ? 'active' : ''}`}
                            onClick={() => {
                                setCurrentView('projects');
                                setExpandedMenu('projects');
                            }}
                        >
                            <span className="nav-icon"><FontAwesomeIcon icon={faBuilding} /></span>
                            <span className="nav-text">Proyectos</span>
                            <span className="nav-arrow">{expandedMenu === 'projects' ? '▼' : '▶'}</span>
                        </button>
                        
                        {expandedMenu === 'projects' && (
                            <div className="nav-submenu">
                                <button
                                    className={`nav-subitem ${currentView === 'projects' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('projects', 'projects')}
                                >
                                    <span className="nav-text">Proyectos</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'projects-licitaciones' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('projects', 'projects-licitaciones')}
                                >
                                    <span className="nav-text">Licitaciones</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'projects-oportunidades' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('projects', 'projects-oportunidades')}
                                >
                                    <span className="nav-text">Oportunidades</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        className={`nav-item ${currentView === 'seguimiento' ? 'active' : ''}`}
                        onClick={() => handleMenuClick('seguimiento')}
                    >
                        <span className="nav-icon"><FontAwesomeIcon icon={faChartLine} /></span>
                        <span className="nav-text">Seguimiento</span>
                    </button>

                    <button
                        className={`nav-item ${currentView === 'clientes' ? 'active' : ''}`}
                        onClick={() => handleMenuClick('clientes')}
                    >
                        <span className="nav-icon"><FontAwesomeIcon icon={faUsers} /></span>
                        <span className="nav-text">Clientes</span>
                    </button>

                    <button
                        className={`nav-item ${currentView === 'costs' ? 'active' : ''}`}
                        onClick={() => handleMenuClick('costs')}
                    >
                        <span className="nav-icon">$</span>
                        <span className="nav-text">Costos</span>
                    </button>

                    <div className="nav-group">
                        <button
                            className={`nav-item nav-parent ${(expandedMenu === 'documentos' || currentView.startsWith('doc-')) ? 'expanded' : ''} ${currentView === 'documentos' ? 'active' : ''}`}
                            onClick={() => {
                                if (expandedMenu === 'documentos') {
                                    setExpandedMenu(null);
                                } else {
                                    setCurrentView('documentos');
                                    setExpandedMenu('documentos');
                                }
                            }}
                        >
                            <span className="nav-icon"><FontAwesomeIcon icon={faFileText} /></span>
                            <span className="nav-text">Documentos</span>
                            <span className="nav-arrow">{(expandedMenu === 'documentos' || currentView.startsWith('doc-')) ? '▼' : '▶'}</span>
                        </button>
                        
                        {(expandedMenu === 'documentos' || currentView.startsWith('doc-')) && (
                            <div className="nav-submenu">
                                <button
                                    className={`nav-subitem ${currentView === 'doc-acuerdo-consorcio' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('doc-acuerdo-consorcio')}
                                >
                                    <span className="nav-text">Acuerdo de Consorcio</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'doc-carta-adhesion' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('doc-carta-adhesion')}
                                >
                                    <span className="nav-text">Carta de Adhesión</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'doc-medidas-retorsion' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('doc-medidas-retorsion')}
                                >
                                    <span className="nav-text">Medidas de Retorsión</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'doc-no-incapacidad' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('doc-no-incapacidad')}
                                >
                                    <span className="nav-text">No Incapacidad</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'doc-pacto-integridad' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('doc-pacto-integridad')}
                                >
                                    <span className="nav-text">Pacto de Integridad</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <button className="nav-item nav-disabled">
                        <span className="nav-icon"><FontAwesomeIcon icon={faBoxes} /></span>
                        <span className="nav-text">Materiales</span>
                    </button>

                    {user?.rol === 'admin' && (
                        <button className="nav-item nav-disabled">
                            <span className="nav-icon"><FontAwesomeIcon icon={faUserCog} /></span>
                            <span className="nav-text">Usuarios</span>
                        </button>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-name">{user?.nombre}</div>
                        <div className="user-role">{user?.rol}</div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        <span className="nav-icon"><FontAwesomeIcon icon={faSignOutAlt} /></span>
                        <span className="nav-text">Salir</span>
                    </button>
                </div>
            </aside>

            {/* Sidebar Overlay for Mobile */}
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={toggleSidebar}></div>
            )}


            {/* Main Content */}
            <main className={`main-content ${sidebarOpen ? 'content-shifted' : ''}`}>
                {renderContent()}
            </main>
        </div>
    );
};

export default Dashboard;