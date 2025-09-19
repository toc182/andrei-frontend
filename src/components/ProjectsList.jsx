import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectForm from './ProjectForm';
import AdendaForm from './AdendaForm';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faPenToSquare, faCog, faWrench, faTools, faCirclePlus, faBuilding, faTrash } from '@fortawesome/free-solid-svg-icons';

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
    const [projectAdendas, setProjectAdendas] = useState([]);
    const [showAdendaForm, setShowAdendaForm] = useState(false);
    const [editingAdenda, setEditingAdenda] = useState(null);

    // Función para abrir modal de detalles (todas las pantallas)
    const handleRowClick = (projectId, event) => {
        // Siempre abrir el modal de detalles
        handleViewProject(projectId);
    };

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

    // Cerrar acordeones en pantallas grandes
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setExpandedRows(new Set());
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
            const [projectResponse, adendasResponse] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/adendas/project/${projectId}`)
            ]);
            
            if (projectResponse.data.success) {
                setViewingProject(projectResponse.data.proyecto);
            } else {
                setError('Error al cargar los detalles del proyecto');
            }
            
            if (adendasResponse.data.success) {
                setProjectAdendas(adendasResponse.data.adendas);
            } else {
                setProjectAdendas([]);
            }
        } catch (error) {
            console.error('Error cargando proyecto:', error);
            setError('Error de conexión al cargar el proyecto');
            setProjectAdendas([]);
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


    // Formatear monto
    const formatMoney = (amount) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PAB',
            currencyDisplay: 'symbol',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount).replace('PAB', 'B/.');
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

    // Funciones para adendas
    const getAdendaStatusClass = (estado) => {
        const statusClasses = {
            'en_proceso': 'status-planning',
            'aprobada': 'status-completed',
            'rechazada': 'status-cancelled'
        };
        return statusClasses[estado] || 'status-planning';
    };

    const getAdendaStatusText = (estado) => {
        const statusTexts = {
            'en_proceso': 'En Proceso',
            'aprobada': 'Aprobada',
            'rechazada': 'Rechazada'
        };
        return statusTexts[estado] || estado;
    };

    const getAdendaTypeText = (tipo) => {
        const typeTexts = {
            'tiempo': 'Extensión de Tiempo',
            'costo': 'Modificación de Costo',
            'mixta': 'Tiempo y Costo'
        };
        return typeTexts[tipo] || tipo;
    };

    // Manejar adendas
    const handleAdendaSave = async (adendaData) => {
        try {
            setLoading(true);
            let response;
            
            if (editingAdenda) {
                response = await api.put(`/adendas/${editingAdenda.id}`, adendaData);
            } else {
                response = await api.post('/adendas', adendaData);
            }
            
            if (response.data.success) {
                // Recargar adendas del proyecto
                const adendasResponse = await api.get(`/adendas/project/${viewingProject.id}`);
                if (adendasResponse.data.success) {
                    setProjectAdendas(adendasResponse.data.adendas);
                }
                setShowAdendaForm(false);
                setEditingAdenda(null);
            }
        } catch (error) {
            console.error('Error guardando adenda:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAdenda = async (adendaId) => {
        if (!confirm('¿Estás seguro de eliminar esta adenda?')) return;
        
        try {
            setLoading(true);
            await api.delete(`/adendas/${adendaId}`);
            
            // Recargar adendas del proyecto
            if (viewingProject) {
                const adendasResponse = await api.get(`/adendas/project/${viewingProject.id}`);
                if (adendasResponse.data.success) {
                    setProjectAdendas(adendasResponse.data.adendas);
                }
            }
            
        } catch (error) {
            console.error('Error eliminando adenda:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && projects.length === 0) {
        return (
            <div className="section-container">
                <div className="projects-loading">
                    <div className="loading-spinner"></div>
                    <p>Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="section-container">
            {/* Header */}
            <div className="section-header">
                <h1><FontAwesomeIcon icon={faBuilding} /> Proyectos</h1>
                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                    <button
                        className="btn-add-icon"
                        onClick={() => setShowCreateForm(true)}
                        title="Agregar nuevo proyecto"
                    >
                        <FontAwesomeIcon icon={faCirclePlus} />
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
                        <th className="hide-mobile-sm">Estado</th>
                        <th className="hide-mobile-sm">Monto</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {projects.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="no-data">
                                {loading ? 'Cargando proyectos...' : 'No se encontraron proyectos'}
                            </td>
                        </tr>
                    ) : (
                        projects.map(project => (
                            <tr
                                key={project.id}
                                className="project-row"
                                onClick={(e) => handleRowClick(project.id, e)}
                                style={{cursor: 'pointer'}}
                            >
                                <td className="project-name">
                                    <span>{project.nombre_corto || project.nombre}</span>
                                </td>
                                <td className="project-client">
                                    {project.cliente_abreviatura || project.cliente_nombre || '-'}
                                </td>
                                <td className="hide-mobile-sm">
                                    <span className={`status-badge ${getStatusClass(project.estado)}`}>
                                        {getStatusText(project.estado)}
                                    </span>
                                </td>
                                <td className="project-money hide-mobile-sm">
                                    {formatMoney(project.monto_total || project.monto_contrato_original || 0)}
                                </td>
                                <td className="project-actions">
                                    {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                        <div className="edit-button-options">
                                            <button
                                                className="btn-edit-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditProject(project);
                                                }}
                                                title="Editar proyecto"
                                            >
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                        </div>
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
                onDelete={handleDeleteProject}
            />

            {/* Modal para ver detalles del proyecto */}
            {viewingProject && (
                <div className="modal-overlay" onClick={() => setViewingProject(null)}>
                    <div className="modal-content project-details-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <button
                                className="modal-close"
                                onClick={() => setViewingProject(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="project-details">
                            {/* Nombre del Proyecto */}
                            <div className="detail-row">
                                <label>Nombre del Proyecto:</label>
                                <span>{viewingProject.nombre}</span>
                            </div>

                            {/* Código */}
                            {viewingProject.codigo_proyecto && (
                                <div className="detail-row">
                                    <label>Código:</label>
                                    <span>{viewingProject.codigo_proyecto}</span>
                                </div>
                            )}

                            {/* Estado */}
                            <div className="detail-row">
                                <label>Estado:</label>
                                <span className={`status-badge ${getStatusClass(viewingProject.estado)}`}>
                                    {getStatusText(viewingProject.estado)}
                                </span>
                            </div>

                            {/* Cliente */}
                            {viewingProject.cliente_nombre && (
                                <div className="detail-row">
                                    <label>Cliente:</label>
                                    <span>{viewingProject.cliente_nombre}</span>
                                </div>
                            )}

                            {/* Abreviatura Cliente */}
                            {viewingProject.cliente_abreviatura && (
                                <div className="detail-row">
                                    <label>Abreviatura:</label>
                                    <span className="client-abbreviation">{viewingProject.cliente_abreviatura}</span>
                                </div>
                            )}

                            {/* Continuar con otros campos de cliente aquí */}
                            {viewingProject.cliente_contacto && (
                                <div className="detail-row">
                                    <label>Contacto:</label>
                                    <span>{viewingProject.cliente_contacto}</span>
                                </div>
                            )}

                            {viewingProject.cliente_telefono && (
                                <div className="detail-row">
                                    <label>Teléfono:</label>
                                    <span>{viewingProject.cliente_telefono}</span>
                                </div>
                            )}

                            {viewingProject.cliente_email && (
                                <div className="detail-row">
                                    <label>Email:</label>
                                    <span>{viewingProject.cliente_email}</span>
                                </div>
                            )}

                            {/* Contratista */}
                            {viewingProject.contratista && (
                                <div className="detail-row">
                                    <label>Contratista:</label>
                                    <span>{viewingProject.contratista}</span>
                                </div>
                            )}

                            {/* Ingeniero Residente */}
                            {viewingProject.ingeniero_residente && (
                                <div className="detail-row">
                                    <label>Ingeniero Residente:</label>
                                    <span>{viewingProject.ingeniero_residente}</span>
                                </div>
                            )}

                            {/* Fecha de Inicio */}
                            {viewingProject.fecha_inicio && (
                                <div className="detail-row">
                                    <label>Fecha de Inicio:</label>
                                    <span>{formatDate(viewingProject.fecha_inicio)}</span>
                                </div>
                            )}

                            {/* Fecha de Terminación */}
                            {viewingProject.fecha_fin_estimada && (
                                <div className="detail-row">
                                    <label>Fecha de Terminación:</label>
                                    <span>{formatDate(viewingProject.fecha_fin_estimada)}</span>
                                </div>
                            )}

                            {/* Presupuesto Base */}
                            {viewingProject.presupuesto_base && (
                                <div className="detail-row">
                                    <label>Presupuesto Base:</label>
                                    <span className="project-money">{formatMoney(viewingProject.presupuesto_base)}</span>
                                </div>
                            )}

                            {/* ITBMS */}
                            {viewingProject.itbms && (
                                <div className="detail-row">
                                    <label>ITBMS (7%):</label>
                                    <span className="project-money">{formatMoney(viewingProject.itbms)}</span>
                                </div>
                            )}

                            {/* Monto Total */}
                            {viewingProject.monto_total && (
                                <div className="detail-row">
                                    <label>Monto Total:</label>
                                    <span className="project-money">{formatMoney(viewingProject.monto_total)}</span>
                                </div>
                            )}

                            {/* Monto del Contrato (alternativo) */}
                            {!viewingProject.monto_total && viewingProject.monto_contrato_original && (
                                <div className="detail-row">
                                    <label>Monto del Contrato:</label>
                                    <span className="project-money">{formatMoney(viewingProject.monto_contrato_original)}</span>
                                </div>
                            )}

                            {/* Adendas */}
                            {projectAdendas.length > 0 && (
                                <div className="adendas-section">
                                    <h4>Adendas</h4>
                                    <div className="adendas-list">
                                        {projectAdendas.map(adenda => (
                                            <div key={adenda.id} className="adenda-item">
                                                <div className="detail-row">
                                                    <label>Adenda #{adenda.numero_adenda}:</label>
                                                    <span className="adenda-status-container">
                                                        <span className={`status-badge ${getAdendaStatusClass(adenda.estado)}`}>
                                                            {getAdendaStatusText(adenda.estado)}
                                                        </span>
                                                        {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                                            <div className="adenda-actions">
                                                                <button
                                                                    className="btn-icon btn-edit"
                                                                    onClick={() => {
                                                                        setEditingAdenda(adenda);
                                                                        setShowAdendaForm(true);
                                                                    }}
                                                                    title="Editar adenda"
                                                                >
                                                                    <FontAwesomeIcon icon={faEdit} />
                                                                </button>
                                                                <button
                                                                    className="btn-icon btn-delete"
                                                                    onClick={() => handleDeleteAdenda(adenda.id)}
                                                                    title="Eliminar adenda"
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="detail-row">
                                                    <label>Tipo:</label>
                                                    <span>{getAdendaTypeText(adenda.tipo)}</span>
                                                </div>
                                                {adenda.nueva_fecha_fin && (
                                                    <div className="detail-row">
                                                        <label>Nueva Fecha de Terminación:</label>
                                                        <span>
                                                            {formatDate(adenda.nueva_fecha_fin)}
                                                            {adenda.dias_extension && (
                                                                <span className="extension-days"> (+{adenda.dias_extension} días)</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                                {adenda.nuevo_monto && (
                                                    <div className="detail-row">
                                                        <label>Nuevo Monto:</label>
                                                        <span className="project-money">{formatMoney(adenda.nuevo_monto)}</span>
                                                    </div>
                                                )}
                                                {adenda.monto_adicional && (
                                                    <div className="detail-row">
                                                        <label>Monto Adicional:</label>
                                                        <span className="project-money">{formatMoney(adenda.monto_adicional)}</span>
                                                    </div>
                                                )}
                                                {adenda.observaciones && (
                                                    <div className="detail-row">
                                                        <label>Observaciones:</label>
                                                        <span>{adenda.observaciones}</span>
                                                    </div>
                                                )}
                                                <div className="detail-row">
                                                    <label>Solicitada:</label>
                                                    <span>
                                                        {formatDate(adenda.fecha_solicitud)}
                                                        {adenda.fecha_aprobacion && (
                                                            <span> | Aprobada: {formatDate(adenda.fecha_aprobacion)}</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Número de Contrato */}
                            {viewingProject.contrato && (
                                <div className="detail-row">
                                    <label>Número de Contrato:</label>
                                    <span>{viewingProject.contrato}</span>
                                </div>
                            )}

                            {/* Acto Público */}
                            {viewingProject.acto_publico && (
                                <div className="detail-row">
                                    <label>Acto Público:</label>
                                    <span>{viewingProject.acto_publico}</span>
                                </div>
                            )}

                            {/* Observaciones */}
                            {viewingProject.datos_adicionales?.observaciones && (
                                <div className="detail-row full-width">
                                    <label>Observaciones:</label>
                                    <p className="observations">{viewingProject.datos_adicionales.observaciones}</p>
                                </div>
                            )}

                            {/* Botones de Acción */}
                            <div className="project-actions-section">
                                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                    <button
                                        className="btn-primary"
                                        onClick={() => setShowAdendaForm(true)}
                                    >
                                        + Agregar Adenda
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para crear/editar adenda */}
            <AdendaForm
                projectId={viewingProject?.id}
                isOpen={showAdendaForm}
                onClose={() => {
                    setShowAdendaForm(false);
                    setEditingAdenda(null);
                }}
                onSave={handleAdendaSave}
                editingAdenda={editingAdenda}
            />
        </div>
    );
};

export default ProjectsList;