import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectForm from './ProjectForm';
import AdendaForm from './AdendaForm';
import StandardModal from './common/StandardModal';
import StandardTable from './common/StandardTable';
import SectionHeader from './common/SectionHeader';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faPenToSquare, faCog, faWrench, faTools, faPlus, faBuilding, faTrash } from '@fortawesome/free-solid-svg-icons';
import '../styles/pages/proyectos.css';
import '../styles/components/badges.css';

const ProjectsList = ({ onStatsUpdate }) => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({});
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [viewingProject, setViewingProject] = useState(null); // Tabla original
    const [viewingProjectExperimental, setViewingProjectExperimental] = useState(null); // Tabla experimental
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

    // Función para ver proyecto - TABLA EXPERIMENTAL
    const handleViewProjectExperimental = async (projectId) => {
        try {
            setLoading(true);
            const [projectResponse, adendasResponse] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/adendas/project/${projectId}`)
            ]);

            if (projectResponse.data.success) {
                setViewingProjectExperimental(projectResponse.data.proyecto);
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

    // Función para abrir modal - TABLA EXPERIMENTAL
    const handleRowClickExperimental = (projectId, event) => {
        handleViewProjectExperimental(projectId);
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
            'planificacion': 'status-yellow',
            'en_curso': 'status-green',
            'pausado': 'status-blue',
            'completado': 'status-gray',
            'cancelado': 'status-red'
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
            'en_proceso': 'status-yellow',
            'aprobada': 'status-green',
            'rechazada': 'status-red'
        };
        return statusClasses[estado] || 'status-yellow';
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
                const adendasResponse = await api.get(`/adendas/project/${viewingProjectExperimental.id}`);
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
            if (viewingProjectExperimental) {
                const adendasResponse = await api.get(`/adendas/project/${viewingProjectExperimental.id}`);
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
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="section-container">
            {/* Header */}
            <SectionHeader
                title="Proyectos"
                icon={faBuilding}
                actionButton={(user?.rol === 'admin' || user?.rol === 'project_manager') ? {
                    icon: faPlus,
                    onClick: () => setShowCreateForm(true),
                    className: 'btn-circular'
                } : null}
            />


            {/* Error */}
            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={loadProjects}>Reintentar</button>
                </div>
            )}




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


            {/* Modal para ver detalles del proyecto - TABLA EXPERIMENTAL (Nuevo Sistema) */}
            <StandardModal
                isOpen={!!viewingProjectExperimental}
                onClose={() => setViewingProjectExperimental(null)}
                title={viewingProjectExperimental?.nombre_corto || "Detalles del Proyecto"}
                size="large"
                footer={(
                    (user?.rol === 'admin' || user?.rol === 'project_manager') && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowAdendaForm(true)}
                        >
                            + Agregar Adenda
                        </button>
                    )
                )}
            >
                {viewingProjectExperimental && (
                    <div>
                        <div className="modal-row">
                            <label className="modal-row-label">Proyecto:</label>
                            <span className="modal-row-value">{viewingProjectExperimental.nombre}</span>
                        </div>

                        {viewingProjectExperimental.codigo_proyecto && (
                            <div className="modal-row">
                                <label className="modal-row-label">Código:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.codigo_proyecto}</span>
                            </div>
                        )}

                        <div className="modal-row">
                            <label className="modal-row-label">Estado:</label>
                            <span className="modal-row-value">
                                <span className={`status-badge ${getStatusClass(viewingProjectExperimental.estado)}`}>
                                    {getStatusText(viewingProjectExperimental.estado)}
                                </span>
                            </span>
                        </div>

                        {viewingProjectExperimental.cliente_nombre && (
                            <div className="modal-row">
                                <label className="modal-row-label">Cliente:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.cliente_nombre}</span>
                            </div>
                        )}

                        {viewingProjectExperimental.cliente_abreviatura && (
                            <div className="modal-row">
                                <label className="modal-row-label">Abreviatura:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.cliente_abreviatura}</span>
                            </div>
                        )}

                        {viewingProjectExperimental.cliente_contacto && (
                            <div className="modal-row">
                                <label className="modal-row-label">Contacto:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.cliente_contacto}</span>
                            </div>
                        )}

                        {viewingProjectExperimental.cliente_telefono && (
                            <div className="modal-row">
                                <label className="modal-row-label">Teléfono:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.cliente_telefono}</span>
                            </div>
                        )}

                        {viewingProjectExperimental.cliente_email && (
                            <div className="modal-row">
                                <label className="modal-row-label">Email:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.cliente_email}</span>
                            </div>
                        )}

                        {viewingProjectExperimental.contratista && (
                            <div className="modal-row">
                                <label className="modal-row-label">Contratista:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.contratista}</span>
                            </div>
                        )}

                        {viewingProjectExperimental.ingeniero_residente && (
                            <div className="modal-row">
                                <label className="modal-row-label">Ingeniero Residente:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.ingeniero_residente}</span>
                            </div>
                        )}

                        {/* Fecha de Inicio */}
                        {viewingProjectExperimental.fecha_inicio && (
                            <div className="modal-row">
                                <label className="modal-row-label">Fecha de Inicio:</label>
                                <span className="modal-row-value">{formatDate(viewingProjectExperimental.fecha_inicio)}</span>
                            </div>
                        )}

                        {/* Fecha de Terminación */}
                        {viewingProjectExperimental.fecha_fin_estimada && (
                            <div className="modal-row">
                                <label className="modal-row-label">Fecha de Terminación:</label>
                                <span className="modal-row-value">{formatDate(viewingProjectExperimental.fecha_fin_estimada)}</span>
                            </div>
                        )}

                        {/* Presupuesto Base */}
                        {viewingProjectExperimental.presupuesto_base && (
                            <div className="modal-row">
                                <label className="modal-row-label">Presupuesto Base:</label>
                                <span className="modal-row-value">{formatMoney(viewingProjectExperimental.presupuesto_base)}</span>
                            </div>
                        )}

                        {/* ITBMS */}
                        {viewingProjectExperimental.itbms && (
                            <div className="modal-row">
                                <label className="modal-row-label">ITBMS (7%):</label>
                                <span className="modal-row-value">{formatMoney(viewingProjectExperimental.itbms)}</span>
                            </div>
                        )}

                        {/* Monto Total */}
                        {viewingProjectExperimental.monto_total && (
                            <div className="modal-row">
                                <label className="modal-row-label">Monto Total:</label>
                                <span className="modal-row-value">{formatMoney(viewingProjectExperimental.monto_total)}</span>
                            </div>
                        )}

                        {/* Monto del Contrato (alternativo) */}
                        {!viewingProjectExperimental.monto_total && viewingProjectExperimental.monto_contrato_original && (
                            <div className="modal-row">
                                <label className="modal-row-label">Monto del Contrato:</label>
                                <span className="modal-row-value">{formatMoney(viewingProjectExperimental.monto_contrato_original)}</span>
                            </div>
                        )}

                        {/* Número de Contrato */}
                        {viewingProjectExperimental.contrato && (
                            <div className="modal-row">
                                <label className="modal-row-label">Número de Contrato:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.contrato}</span>
                            </div>
                        )}

                        {/* Acto Público */}
                        {viewingProjectExperimental.acto_publico && (
                            <div className="modal-row">
                                <label className="modal-row-label">Acto Público:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.acto_publico}</span>
                            </div>
                        )}

                        {/* Observaciones */}
                        {viewingProjectExperimental.datos_adicionales?.observaciones && (
                            <div className="modal-row">
                                <label className="modal-row-label">Observaciones:</label>
                                <span className="modal-row-value">{viewingProjectExperimental.datos_adicionales.observaciones}</span>
                            </div>
                        )}

                        {/* Adendas */}
                        {projectAdendas.length > 0 && (
                            <div className="modal-section">
                                {projectAdendas.map(adenda => (
                                    <React.Fragment key={adenda.id}>
                                            <div className="modal-row">
                                                <label className="modal-row-label">Adenda #{adenda.numero_adenda}:</label>
                                                <div className="modal-row-value">
                                                    <>
                                                        <span className={`status-badge ${getAdendaStatusClass(adenda.estado)}`}>
                                                            {getAdendaStatusText(adenda.estado)}
                                                        </span>
                                                        {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                                            <>
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
                                                            </>
                                                        )}
                                                    </>
                                                </div>
                                            </div>
                                            <div className="modal-row">
                                                <label className="modal-row-label">Tipo:</label>
                                                <span className="modal-row-value">{getAdendaTypeText(adenda.tipo)}</span>
                                            </div>
                                            {adenda.nueva_fecha_fin && (
                                                <div className="modal-row">
                                                    <label className="modal-row-label">Nueva Fecha de Terminación:</label>
                                                    <span className="modal-row-value">
                                                        {formatDate(adenda.nueva_fecha_fin)}
                                                        {adenda.dias_extension && (
                                                            <span> (+{adenda.dias_extension} días)</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {adenda.nuevo_monto && (
                                                <div className="modal-row">
                                                    <label className="modal-row-label">Nuevo Monto:</label>
                                                    <span className="modal-row-value">{formatMoney(adenda.nuevo_monto)}</span>
                                                </div>
                                            )}
                                            {adenda.monto_adicional && (
                                                <div className="modal-row">
                                                    <label className="modal-row-label">Monto Adicional:</label>
                                                    <span className="modal-row-value">{formatMoney(adenda.monto_adicional)}</span>
                                                </div>
                                            )}
                                            {adenda.observaciones && (
                                                <div className="modal-row">
                                                    <label className="modal-row-label">Observaciones:</label>
                                                    <span className="modal-row-value">{adenda.observaciones}</span>
                                                </div>
                                            )}
                                            <div className="modal-row">
                                                <label className="modal-row-label">Solicitada:</label>
                                                <span className="modal-row-value">
                                                    {formatDate(adenda.fecha_solicitud)}
                                                    {adenda.fecha_aprobacion && (
                                                        <span> | Aprobada: {formatDate(adenda.fecha_aprobacion)}</span>
                                                    )}
                                                </span>
                                            </div>
                                    </React.Fragment>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </StandardModal>

            {/* Modal para crear/editar adenda */}
            <AdendaForm
                projectId={viewingProjectExperimental?.id}
                isOpen={showAdendaForm}
                onClose={() => {
                    setShowAdendaForm(false);
                    setEditingAdenda(null);
                }}
                onSave={handleAdendaSave}
                editingAdenda={editingAdenda}
            />

            {/* ===== TABLA DE PROYECTOS (StandardTable Component) ===== */}
            <StandardTable
                className="projects-standard-table-container"
                tableClassName="projects-standard-table"
                columns={[
                        { header: 'Proyecto', accessor: 'nombre_corto' },
                        { header: 'Cliente', accessor: 'cliente_abreviatura' },
                        {
                            header: 'Estado',
                            render: (project) => (
                                <span className={`status-badge ${getStatusClass(project.estado)}`}>
                                    {getStatusText(project.estado)}
                                </span>
                            )
                        },
                        {
                            header: 'Monto',
                            render: (project) => (
                                <span>
                                    {formatMoney(project.monto_total || project.monto_contrato_original || 0)}
                                </span>
                            )
                        },
                        {
                            header: '',
                            render: (project) => (
                                (user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                    <button
                                        className="standard-table-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditProject(project);
                                        }}
                                        title="Editar proyecto"
                                    >
                                        <FontAwesomeIcon icon={faEdit} />
                                    </button>
                                )
                            )
                        }
                    ]}
                    data={projects}
                    onRowClick={(project) => handleRowClickExperimental(project.id)}
                    emptyMessage="No hay proyectos disponibles"
                />
        </div>
    );
};

export default ProjectsList;