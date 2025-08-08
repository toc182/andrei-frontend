import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectForm from './ProjectForm';
import api from '../services/api';

const ProjectsList = ({ onStatsUpdate }) => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({
        search: '',
        estado: '',
        page: 1,
        limit: 10
    });
    const [pagination, setPagination] = useState({});
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);

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
            const params = new URLSearchParams();

            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params.append(key, filters[key]);
                }
            });

            const response = await api.get(`/projects?${params.toString()}`);

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

    // Cargar proyectos al montar y cuando cambien los filtros
    useEffect(() => {
        loadProjects();
    }, [filters]);

    // Manejar cambios en filtros
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: 1 // Reset página al filtrar
        }));
    };

    // Manejar paginación
    const handlePageChange = (newPage) => {
        setFilters(prev => ({
            ...prev,
            page: newPage
        }));
    };

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
                <div className="header-title">
                    <h1>Gestión de Proyectos</h1>
                    <p>Administra todos los proyectos de construcción</p>
                </div>

                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        + Nuevo Proyecto
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="projects-filters">
                <div className="filter-group">
                    <label>Buscar:</label>
                    <input
                        type="text"
                        placeholder="Código, nombre, contratista..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <label>Estado:</label>
                    <select
                        value={filters.estado}
                        onChange={(e) => handleFilterChange('estado', e.target.value)}
                    >
                        {estados.map(estado => (
                            <option key={estado.value} value={estado.value}>
                                {estado.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Por página:</label>
                    <select
                        value={filters.limit}
                        onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
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
                        <th>Código</th>
                        <th>Proyecto</th>
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
                            <tr key={project.id}>
                                <td className="project-code">
                                    {project.codigo_proyecto || `PRY-${project.id}`}
                                </td>
                                <td className="project-name">
                                    <div className="project-main-name">{project.nombre}</div>
                                    {project.nombre_corto && (
                                        <div className="project-short-name">{project.nombre_corto}</div>
                                    )}
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
                                    {formatMoney(project.monto_contrato_original)}
                                </td>
                                <td className="project-actions">
                                    <button
                                        className="btn-action btn-view"
                                        onClick={() => console.log('Ver proyecto:', project.id)}
                                        title="Ver detalles"
                                    >
                                        👁️
                                    </button>

                                    {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                        <>
                                            <button
                                                className="btn-action btn-edit"
                                                onClick={() => handleEditProject(project)}
                                                title="Editar proyecto"
                                            >
                                                ✏️
                                            </button>

                                            {user?.rol === 'admin' && (
                                                <button
                                                    className="btn-action btn-delete"
                                                    onClick={() => handleDeleteProject(project.id)}
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

            {/* Paginación */}
            {pagination.total_pages > 1 && (
                <div className="projects-pagination">
                    <div className="pagination-info">
                        Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1} - {
                        Math.min(pagination.current_page * pagination.per_page, pagination.total_records)
                    } de {pagination.total_records} proyectos
                    </div>

                    <div className="pagination-buttons">
                        <button
                            onClick={() => handlePageChange(pagination.current_page - 1)}
                            disabled={pagination.current_page <= 1}
                        >
                            ← Anterior
                        </button>

                        {[...Array(pagination.total_pages)].map((_, index) => {
                            const page = index + 1;
                            if (
                                page === 1 ||
                                page === pagination.total_pages ||
                                (page >= pagination.current_page - 2 && page <= pagination.current_page + 2)
                            ) {
                                return (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={pagination.current_page === page ? 'active' : ''}
                                    >
                                        {page}
                                    </button>
                                );
                            } else if (
                                page === pagination.current_page - 3 ||
                                page === pagination.current_page + 3
                            ) {
                                return <span key={page}>...</span>;
                            }
                            return null;
                        })}

                        <button
                            onClick={() => handlePageChange(pagination.current_page + 1)}
                            disabled={pagination.current_page >= pagination.total_pages}
                        >
                            Siguiente →
                        </button>
                    </div>
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
            />
        </div>
    );
};

export default ProjectsList;