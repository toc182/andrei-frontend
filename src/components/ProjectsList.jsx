import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectForm from './ProjectForm';
import api from '../services/api';

const ProjectsList = ({ onStatsUpdate }) => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({});
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [viewingProject, setViewingProject] = useState(null);

    // Estados disponibles
    const estados = [
        { value: '', label: 'Todos los estados' },
        { value: 'planificacion', label: 'Planificación' },
        { value: 'en_curso', label: 'En Curso' },
        { value: 'pausado', label: 'Pausado' },
        { value: 'completado', label: 'Completado' },
        { value: 'cancelado', label: 'Cancelado' }
    ];

    // Cargar proyectos
    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await api.get('/projects');

            if (response.data.success) {
                setProjects(response.data.proyectos);
                setPagination(response.data.pagination);
                setError('');
            } else {
                setError('Error cargando proyectos');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('Error de conexión al cargar proyectos');
        } finally {
            setLoading(false);
        }
    };

    // Cargar proyectos al montar
    useEffect(() => {
        loadProjects();
    }, []);

    // Manejar guardado de proyecto
    const handleProjectSave = (savedProject) => {
        // Recargar la lista
        loadProjects();
        // Actualizar estadísticas del dashboard
        if (onStatsUpdate) {
            onStatsUpdate();
        }
        setShowCreateForm(false);
        setEditingProject(null);
    };

    // Manejar visualización de detalles
    const handleViewProject = async (projectId) => {
        try {
            setLoading(true);
            const response = await api.get(`/projects/${projectId}`);
            
            if (response.data.success) {
                setViewingProject(response.data.proyecto);
            } else {
                setError('Error al cargar los detalles del proyecto');
            }
        } catch (error) {
            console.error('Error cargando proyecto:', error);
            setError('Error de conexión al cargar el proyecto');
        } finally {
            setLoading(false);
        }
    };

    // Manejar edición
    const handleEditProject = (project) => {
        setEditingProject(project);
    };

    // Manejar eliminación
    const handleDeleteProject = async (projectId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const response = await api.delete(`/projects/${projectId}`);

            if (response.data.success) {
                // Recargar la lista
                loadProjects();
                // Actualizar estadísticas
                if (onStatsUpdate) {
                    onStatsUpdate();
                }
                setProjectToDelete(null);
            } else {
                setError('Error al eliminar el proyecto');
            }
        } catch (error) {
            console.error('Error eliminando proyecto:', error);
            setError('Error de conexión al eliminar el proyecto');
        }
    };

    // Formatear fecha
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-ES');
    };

    // Formatear monto
    const formatMoney = (amount) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount);
    };

    // Obtener clase CSS para estado
    const getStatusClass = (estado) => {
        const statusClasses = {
            'planificacion': 'status-planning',
            'en_curso': 'status-active',
            'pausado': 'status-paused',
            'completado': 'status-completed',
            'cancelado': 'status-cancelled'
        };
        return statusClasses[estado] || '';
    };

    // Obtener texto del estado
    const getStatusText = (estado) => {
        const statusTexts = {
            'planificacion': 'Planificación',
            'en_curso': 'En Curso',
            'pausado': 'Pausado',
            'completado': 'Completado',
            'cancelado': 'Cancelado'
        };
        return statusTexts[estado] || estado;
    };

    if (loading && projects.length === 0) {
        return (
            <div className="projects-container">
                <div className="projects-loading">
                    <div className="loading-spinner"></div>
                    <p>Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="projects-container">
            {/* Header */}
            <div className="projects-header">
                <h1>Gestión de Proyectos</h1>
                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        + Agregar Proyecto
                    </button>
                )}
            </div>


            {/* Error */}
            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={loadProjects}>Reintentar</button>
                </div>
            )}

            {/* Tabla de Proyectos */}
            <div className="projects-table-container">
                <table className="projects-table">
                    <thead>
                    <tr>
                        <th>Proyecto</th>
                        <th>Cliente</th>
                        <th>Contratista</th>
                        <th>Ing. Residente</th>
                        <th>Estado</th>
                        <th>Fecha Inicio</th>
                        <th>Fecha Fin Est.</th>
                        <th>Monto Contrato</th>
                        <th>Acciones</th>
                    </tr>
                    </thead>
                    <tbody>
                    {projects.length === 0 ? (
                        <tr>
                            <td colSpan="9" className="no-data">
                                {loading ? 'Cargando proyectos...' : 'No se encontraron proyectos'}
                            </td>
                        </tr>
                    ) : (
                        projects.map(project => (
                            <tr key={project.id} onClick={() => handleViewProject(project.id)} style={{cursor: 'pointer'}}>
                                <td className="project-name">
                                    {project.nombre_corto || project.nombre}
                                </td>
                                <td className="project-client">
                                    {project.cliente_abreviatura || '-'}
                                </td>
                                <td>{project.contratista || '-'}</td>
                                <td>{project.ingeniero_residente || '-'}</td>
                                <td>
                                        <span className={`status-badge ${getStatusClass(project.estado)}`}>
                                            {getStatusText(project.estado)}
                                        </span>
                                </td>
                                <td>{formatDate(project.fecha_inicio)}</td>
                                <td>{formatDate(project.fecha_fin_estimada)}</td>
                                <td className="project-money">
                                    {formatMoney(project.monto_total || project.monto_contrato_original)}
                                </td>
                                <td className="project-actions">
                                    <button
                                        className="btn-action btn-view"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewProject(project.id);
                                        }}
                                        title="Ver detalles"
                                    >
                                        👁️
                                    </button>

                                    {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                        <>
                                            <button
                                                className="btn-action btn-edit"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditProject(project);
                                                }}
                                                title="Editar proyecto"
                                            >
                                                ✏️
                                            </button>

                                            {user?.rol === 'admin' && (
                                                <button
                                                    className="btn-action btn-delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteProject(project.id);
                                                    }}
                                                    title="Eliminar proyecto"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>


            {/* Modal para crear proyecto */}
            <ProjectForm
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                onSave={handleProjectSave}
            />

            {/* Modal para editar proyecto */}
            <ProjectForm
                projectId={editingProject?.id}
                isOpen={!!editingProject}
                onClose={() => setEditingProject(null)}
                onSave={handleProjectSave}
            />

            {/* Modal para ver detalles del proyecto */}
            {viewingProject && (
                <div className="modal-overlay" onClick={() => setViewingProject(null)}>
                    <div className="modal-content project-details-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalles del Proyecto</h2>
                            <button
                                className="modal-close"
                                onClick={() => setViewingProject(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="project-details">
                            {/* Información Básica */}
                            <div className="details-section">
                                <h3>Información Básica</h3>
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <label>Nombre del Proyecto:</label>
                                        <span>{viewingProject.nombre}</span>
                                    </div>
                                    {viewingProject.nombre_corto && (
                                        <div className="detail-item">
                                            <label>Nombre Corto:</label>
                                            <span>{viewingProject.nombre_corto}</span>
                                        </div>
                                    )}
                                    {viewingProject.codigo_proyecto && (
                                        <div className="detail-item">
                                            <label>Código:</label>
                                            <span>{viewingProject.codigo_proyecto}</span>
                                        </div>
                                    )}
                                    <div className="detail-item">
                                        <label>Estado:</label>
                                        <span className={`status-badge ${getStatusClass(viewingProject.estado)}`}>
                                            {getStatusText(viewingProject.estado)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Cliente */}
                            {viewingProject.cliente_nombre && (
                                <div className="details-section">
                                    <h3>Cliente</h3>
                                    <div className="details-grid">
                                        <div className="detail-item">
                                            <label>Nombre:</label>
                                            <span>{viewingProject.cliente_nombre}</span>
                                        </div>
                                        {viewingProject.cliente_abreviatura && (
                                            <div className="detail-item">
                                                <label>Abreviatura:</label>
                                                <span className="client-abbreviation">{viewingProject.cliente_abreviatura}</span>
                                            </div>
                                        )}
                                        {viewingProject.cliente_contacto && (
                                            <div className="detail-item">
                                                <label>Contacto:</label>
                                                <span>{viewingProject.cliente_contacto}</span>
                                            </div>
                                        )}
                                        {viewingProject.cliente_telefono && (
                                            <div className="detail-item">
                                                <label>Teléfono:</label>
                                                <span>{viewingProject.cliente_telefono}</span>
                                            </div>
                                        )}
                                        {viewingProject.cliente_email && (
                                            <div className="detail-item">
                                                <label>Email:</label>
                                                <span>{viewingProject.cliente_email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Equipo de Trabajo */}
                            <div className="details-section">
                                <h3>Equipo de Trabajo</h3>
                                <div className="details-grid">
                                    {viewingProject.contratista && (
                                        <div className="detail-item">
                                            <label>Contratista:</label>
                                            <span>{viewingProject.contratista}</span>
                                        </div>
                                    )}
                                    {viewingProject.ingeniero_residente && (
                                        <div className="detail-item">
                                            <label>Ingeniero Residente:</label>
                                            <span>{viewingProject.ingeniero_residente}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fechas */}
                            <div className="details-section">
                                <h3>Cronograma</h3>
                                <div className="details-grid">
                                    {viewingProject.fecha_inicio && (
                                        <div className="detail-item">
                                            <label>Fecha de Inicio:</label>
                                            <span>{formatDate(viewingProject.fecha_inicio)}</span>
                                        </div>
                                    )}
                                    {viewingProject.fecha_fin_estimada && (
                                        <div className="detail-item">
                                            <label>Fecha Fin Estimada:</label>
                                            <span>{formatDate(viewingProject.fecha_fin_estimada)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Información Contractual */}
                            <div className="details-section">
                                <h3>Información Contractual</h3>
                                <div className="details-grid">
                                    {viewingProject.contrato && (
                                        <div className="detail-item">
                                            <label>Número de Contrato:</label>
                                            <span>{viewingProject.contrato}</span>
                                        </div>
                                    )}
                                    {viewingProject.acto_publico && (
                                        <div className="detail-item">
                                            <label>Acto Público:</label>
                                            <span>{viewingProject.acto_publico}</span>
                                        </div>
                                    )}
                                    {(viewingProject.presupuesto_base || viewingProject.monto_contrato_original) && (
                                        <>
                                            {viewingProject.presupuesto_base && (
                                                <div className="detail-item">
                                                    <label>Presupuesto Base:</label>
                                                    <span className="project-money">{formatMoney(viewingProject.presupuesto_base)}</span>
                                                </div>
                                            )}
                                            {viewingProject.itbms && (
                                                <div className="detail-item">
                                                    <label>ITBMS (7%):</label>
                                                    <span className="project-money">{formatMoney(viewingProject.itbms)}</span>
                                                </div>
                                            )}
                                            {viewingProject.monto_total && (
                                                <div className="detail-item">
                                                    <label>Monto Total:</label>
                                                    <span className="project-money">{formatMoney(viewingProject.monto_total)}</span>
                                                </div>
                                            )}
                                            {!viewingProject.monto_total && viewingProject.monto_contrato_original && (
                                                <div className="detail-item">
                                                    <label>Monto del Contrato:</label>
                                                    <span className="project-money">{formatMoney(viewingProject.monto_contrato_original)}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Observaciones */}
                            {viewingProject.datos_adicionales?.observaciones && (
                                <div className="details-section">
                                    <h3>Observaciones</h3>
                                    <div className="detail-item full-width">
                                        <p className="observations">{viewingProject.datos_adicionales.observaciones}</p>
                                    </div>
                                </div>
                            )}

                            {/* Metadatos */}
                            <div className="details-section">
                                <h3>Información del Sistema</h3>
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <label>Creado:</label>
                                        <span>{formatDate(viewingProject.created_at)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Última Actualización:</label>
                                        <span>{formatDate(viewingProject.updated_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsList;