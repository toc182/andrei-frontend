import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectForm from './ProjectForm';
import AdendaForm from './AdendaForm';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faPenToSquare, faCog, faWrench, faTools, faCirclePlus, faBuilding } from '@fortawesome/free-solid-svg-icons';

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
    const [expandedRows, setExpandedRows] = useState(new Set());

    // Función para alternar expansión de fila
    const handleRowClick = (projectId, event) => {
        // Solo expandir en pantallas pequeñas, en grandes mostrar detalles
        const screenWidth = window.innerWidth;
        if (screenWidth > 1200) {
            // En pantallas grandes, abrir detalles del proyecto
            handleViewProject(projectId);
            return;
        }
        
        // En pantallas pequeñas, expandir/contraer fila
        event.stopPropagation();
        const newExpandedRows = new Set(expandedRows);
        if (newExpandedRows.has(projectId)) {
            newExpandedRows.delete(projectId);
        } else {
            newExpandedRows.add(projectId);
        }
        setExpandedRows(newExpandedRows);
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
            if (window.innerWidth > 1200) {
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
                            <React.Fragment key={project.id}>
                                <tr 
                                    className={`project-row ${expandedRows.has(project.id) ? 'expanded' : ''}`}
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
                            
                            {/* Fila expandible con detalles */}
                            {expandedRows.has(project.id) && (
                                <tr className="expanded-details">
                                    <td colSpan="5">
                                        <div className="project-details-expanded">
                                            {/* Información básica */}
                                            <div className="accordion-section">
                                                <h4>Información Básica</h4>
                                                <div className="detail-row">
                                                    <span className="detail-label">Nombre Completo:</span>
                                                    <span>{project.nombre}</span>
                                                </div>
                                                {project.codigo_proyecto && (
                                                    <div className="detail-row">
                                                        <span className="detail-label">Código:</span>
                                                        <span>{project.codigo_proyecto}</span>
                                                    </div>
                                                )}
                                                <div className="detail-row">
                                                    <span className="detail-label">Estado:</span>
                                                    <span className={`status-badge accordion-badge ${getStatusClass(project.estado)}`}>
                                                        {getStatusText(project.estado)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Cliente */}
                                            <div className="accordion-section">
                                                <h4>Cliente</h4>
                                                <div className="detail-row">
                                                    <span className="detail-label">Nombre:</span>
                                                    <span>{project.cliente_nombre || '-'}</span>
                                                </div>
                                                {project.cliente_abreviatura && (
                                                    <div className="detail-row">
                                                        <span className="detail-label">Abreviatura:</span>
                                                        <span>{project.cliente_abreviatura}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Equipo */}
                                            <div className="accordion-section">
                                                <h4>Equipo de Trabajo</h4>
                                                <div className="detail-row">
                                                    <span className="detail-label">Contratista:</span>
                                                    <span>{project.contratista || '-'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Ing. Residente:</span>
                                                    <span>{project.ingeniero_residente || '-'}</span>
                                                </div>
                                            </div>

                                            {/* Cronograma */}
                                            <div className="accordion-section">
                                                <h4>Cronograma</h4>
                                                <div className="detail-row">
                                                    <span className="detail-label">Fecha Inicio:</span>
                                                    <span>{formatDate(project.fecha_inicio)}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Fecha Terminación:</span>
                                                    <span>{formatDate(project.fecha_fin_estimada)}</span>
                                                </div>
                                            </div>

                                            {/* Información Contractual */}
                                            <div className="accordion-section">
                                                <h4>Información Contractual</h4>
                                                {project.contrato && (
                                                    <div className="detail-row">
                                                        <span className="detail-label">Número de Contrato:</span>
                                                        <span>{project.contrato}</span>
                                                    </div>
                                                )}
                                                <div className="detail-row">
                                                    <span className="detail-label">Monto Total:</span>
                                                    <span className="accordion-money">
                                                        {formatMoney(project.monto_total || project.monto_contrato_original || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
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
                            <h2>Detalles del Proyecto</h2>
                            <button
                                className="modal-close"
                                onClick={() => setViewingProject(null)}
                            >
                                ×
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
                                            <label>Fecha de Terminación:</label>
                                            <span>{formatDate(viewingProject.fecha_fin_estimada)}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Adendas */}
                                {projectAdendas.length > 0 && (
                                    <div className="adendas-section">
                                        <h4>Adendas del Proyecto</h4>
                                        <div className="adendas-list">
                                            {projectAdendas.map(adenda => (
                                                <div key={adenda.id} className="adenda-item">
                                                    <div className="adenda-header">
                                                        <span className="adenda-number">Adenda #{adenda.numero_adenda}</span>
                                                        <div className="adenda-header-right">
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
                                                                        ✏
                                                                    </button>
                                                                    <button
                                                                        className="btn-icon btn-delete"
                                                                        onClick={() => handleDeleteAdenda(adenda.id)}
                                                                        title="Eliminar adenda"
                                                                    >
                                                                        🗑
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="adenda-details">
                                                        <div className="adenda-type">
                                                            <strong>Tipo:</strong> {getAdendaTypeText(adenda.tipo)}
                                                        </div>
                                                        {adenda.nueva_fecha_fin && (
                                                            <div className="adenda-date">
                                                                <strong>Nueva Fecha de Terminación:</strong> {formatDate(adenda.nueva_fecha_fin)}
                                                                {adenda.dias_extension && (
                                                                    <span className="extension-days"> (+{adenda.dias_extension} días)</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {(adenda.nuevo_monto || adenda.monto_adicional) && (
                                                            <div className="adenda-cost">
                                                                {adenda.nuevo_monto && (
                                                                    <div><strong>Nuevo Monto:</strong> {formatMoney(adenda.nuevo_monto)}</div>
                                                                )}
                                                                {adenda.monto_adicional && (
                                                                    <div><strong>Monto Adicional:</strong> {formatMoney(adenda.monto_adicional)}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {adenda.observaciones && (
                                                            <div className="adenda-observations">
                                                                <strong>Observaciones:</strong> {adenda.observaciones}
                                                            </div>
                                                        )}
                                                        <div className="adenda-dates">
                                                            <small>Solicitada: {formatDate(adenda.fecha_solicitud)}</small>
                                                            {adenda.fecha_aprobacion && (
                                                                <small> | Aprobada: {formatDate(adenda.fecha_aprobacion)}</small>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
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