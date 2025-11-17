import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectsHub from './ProjectsHub';
import api from '../services/api';
import Clientes from './Clientes';
import DocumentosHub from './DocumentosHub';
import DocumentForm from '../components/forms/DocumentForm';
import Equipos from './equipos/Equipos';
import EquiposInformacion from './equipos/EquiposInformacion';
import EquiposStatus from './equipos/EquiposStatus';
import AsignacionesEquipos from './equipos/AsignacionesEquipos';
import SectionHeader from '../components/common/SectionHeader';
import { TailwindTest } from '../components/TailwindTest';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faBuilding, faChartLine, faUsers, faDollarSign, faBoxes, faUserCog, faSignOutAlt, faFileText, faTruckPickup, faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import '../styles/pages/dashboard.css';

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

        // Auto-close sidebar en pantallas móviles después de seleccionar un item
        if (window.innerWidth <= 576) {
            setSidebarOpen(false);
        }
    };

    const formatMoney = (amount) => {
        const formatted = new Intl.NumberFormat('es-PA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
        return `B/. ${formatted}`;
    };

    const renderDashboardHome = () => (
        <div className="section-container">
            <SectionHeader
                title="Panel de Control"
                className="dashboard-header-centered"
            />

            {/* PRUEBA TEMPORAL DE TAILWIND - ELIMINAR DESPUÉS */}
            <TailwindTest />

            <div className="dashboard-stats-grid">
                <div className="dashboard-stat-card">
                    <h3>Proyectos Activos</h3>
                    <div className="dashboard-stat-number">
                        {loadingStats ? '...' : stats.proyectos_activos}
                    </div>
                    <p>En ejecución</p>
                </div>

                <div className="dashboard-stat-card">
                    <h3>En Planificación</h3>
                    <div className="dashboard-stat-number">
                        {loadingStats ? '...' : stats.proyectos_planificacion}
                    </div>
                    <p>Por iniciar</p>
                </div>

                <div className="dashboard-stat-card">
                    <h3>Completados</h3>
                    <div className="dashboard-stat-number">
                        {loadingStats ? '...' : stats.proyectos_completados}
                    </div>
                    <p>Finalizados</p>
                </div>

                <div className="dashboard-stat-card">
                    <h3>Total Proyectos</h3>
                    <div className="dashboard-stat-number">
                        {loadingStats ? '...' : stats.total_proyectos}
                    </div>
                    <p>En el sistema</p>
                </div>

                <div className="dashboard-stat-card">
                    <h3>Valor Total de Contratos</h3>
                    <div className="dashboard-stat-number dashboard-stat-money">
                        {loadingStats ? '...' : formatMoney(stats.monto_contratos_total)}
                    </div>
                </div>
            </div>

            <div className="dashboard-actions-grid">
                <div className="dashboard-action-card">
                    <h3><FontAwesomeIcon icon={faBuilding} /> Gestión de Proyectos</h3>
                    <p>Administra todos los proyectos de construcción, desde planificación hasta finalización</p>
                    <button
                        className="dashboard-action-btn"
                        onClick={() => setCurrentView('projects')}
                    >
                        Ver Proyectos
                    </button>
                </div>
                <div className="dashboard-action-card">
                    <h3><FontAwesomeIcon icon={faUsers} /> Gestión de Clientes</h3>
                    <p>Administrar información de clientes y contactos</p>
                    <button
                        className="dashboard-action-btn"
                        onClick={() => setCurrentView('clientes')}
                    >
                        Ver Clientes
                    </button>
                </div>

                <div className="dashboard-action-card">
                    <h3><FontAwesomeIcon icon={faTruckPickup} /> Gestión de Equipos</h3>
                    <p>Administrar equipos, asignaciones y estado de equipos</p>
                    <button
                        className="dashboard-action-btn"
                        onClick={() => setCurrentView('equipos')}
                    >
                        Ver Equipos
                    </button>
                </div>

                <div className="dashboard-action-card">
                    <h3><FontAwesomeIcon icon={faBoxes} /> Control de Materiales</h3>
                    <p>Inventario y control de materiales de construcción</p>
                    <button className="dashboard-action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="dashboard-action-card">
                    <h3><FontAwesomeIcon icon={faUserCog} /> Gestión de Usuarios</h3>
                    <p>Administración de usuarios del sistema</p>
                    <button className="dashboard-action-btn" disabled>
                        Próximamente
                    </button>
                </div>

                <div className="dashboard-action-card">
                    <h3><FontAwesomeIcon icon={faChartLine} /> Reportes y Analytics</h3>
                    <p>Informes detallados y análisis de proyectos</p>
                    <button className="dashboard-action-btn" disabled>
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
            case 'clientes':
                return <Clientes />;
            case 'equipos':
                return <Equipos />;
            case 'equipos-informacion':
                return <EquiposInformacion />;
            case 'equipos-status':
                return <EquiposStatus />;
            case 'equipos-asignaciones':
                return <AsignacionesEquipos />;
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
                            <span className="nav-arrow"><FontAwesomeIcon icon={expandedMenu === 'projects' ? faChevronDown : faChevronRight} /></span>
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
                        className={`nav-item ${currentView === 'clientes' ? 'active' : ''}`}
                        onClick={() => handleMenuClick('clientes')}
                    >
                        <span className="nav-icon"><FontAwesomeIcon icon={faUsers} /></span>
                        <span className="nav-text">Clientes</span>
                    </button>

                    <div className="nav-group">
                        <button
                            className={`nav-item nav-parent ${expandedMenu === 'equipos' ? 'expanded' : ''} ${['equipos', 'equipos-informacion', 'equipos-status', 'equipos-asignaciones'].includes(currentView) ? 'active' : ''}`}
                            onClick={() => {
                                setCurrentView('equipos');
                                setExpandedMenu('equipos');
                            }}
                        >
                            <span className="nav-icon"><FontAwesomeIcon icon={faTruckPickup} /></span>
                            <span className="nav-text">Equipos</span>
                            <span className="nav-arrow"><FontAwesomeIcon icon={expandedMenu === 'equipos' ? faChevronDown : faChevronRight} /></span>
                        </button>

                        {expandedMenu === 'equipos' && (
                            <div className="nav-submenu">
                                <button
                                    className={`nav-subitem ${currentView === 'equipos-informacion' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('equipos', 'equipos-informacion')}
                                >
                                    <span className="nav-text">Información de Equipos</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'equipos-status' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('equipos', 'equipos-status')}
                                >
                                    <span className="nav-text">Status de Equipos</span>
                                </button>
                                <button
                                    className={`nav-subitem ${currentView === 'equipos-asignaciones' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('equipos', 'equipos-asignaciones')}
                                >
                                    <span className="nav-text">Asignaciones</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="nav-group">
                        <button
                            className={`nav-item nav-parent ${(expandedMenu === 'documentos' || currentView.startsWith('doc-')) ? 'expanded' : ''} ${(currentView === 'documentos' || currentView.startsWith('doc-')) ? 'active' : ''}`}
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
                            <span className="nav-arrow"><FontAwesomeIcon icon={(expandedMenu === 'documentos' || currentView.startsWith('doc-')) ? faChevronDown : faChevronRight} /></span>
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