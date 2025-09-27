import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Seguimiento from './Seguimiento'; // Componente específico de Bonyic
import '../styles/components/badges.css';

const SeguimientoHub = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);

    // Cargar proyectos
    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await api.get('/projects');

            if (response.data.success) {
                setProjects(response.data.proyectos);
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

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
    };

    const goBackToHub = () => {
        setSelectedProject(null);
    };

    // Si hay un proyecto seleccionado, mostrar su seguimiento
    if (selectedProject) {
        // Si es el proyecto específico de Bonyic, usar el componente existente
        const isBonyicProject = selectedProject.id === (process.env.NODE_ENV === 'production' ? 5 : 3);
        
        if (isBonyicProject) {
            return (
                <div>
                    <div className="seguimiento-navigation">
                        <button 
                            className="btn-back"
                            onClick={goBackToHub}
                        >
                            ← Volver al Hub de Seguimiento
                        </button>
                        <h2>Seguimiento: {selectedProject.nombre}</h2>
                    </div>
                    <Seguimiento />
                </div>
            );
        } else {
            // Para otros proyectos, mostrar un dashboard básico (por ahora)
            return (
                <div>
                    <div className="seguimiento-navigation">
                        <button 
                            className="btn-back"
                            onClick={goBackToHub}
                        >
                            ← Volver al Hub de Seguimiento
                        </button>
                        <h2>Seguimiento: {selectedProject.nombre}</h2>
                    </div>
                    <div className="seguimiento-placeholder">
                        <div className="placeholder-content">
                            <h3>Seguimiento Personalizado</h3>
                            <p>El seguimiento para este proyecto será desarrollado según sus necesidades específicas.</p>
                            <div className="project-info">
                                <p><strong>Cliente:</strong> {selectedProject.cliente_nombre || 'No asignado'}</p>
                                <p><strong>Estado:</strong> {selectedProject.estado}</p>
                                <p><strong>Contratista:</strong> {selectedProject.contratista || 'No asignado'}</p>
                            </div>
                            <button className="btn-primary" disabled>
                                Configurar Seguimiento (Próximamente)
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // Vista principal del hub
    return (
        <div className="seguimiento-hub">
            <div className="hub-header">
                <h1>Hub de Seguimiento</h1>
                <p>Selecciona un proyecto para ver su seguimiento específico</p>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Cargando proyectos...</p>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.length === 0 ? (
                        <div className="empty-state">
                            <h3>No hay proyectos disponibles</h3>
                            <p>Crea un proyecto primero para comenzar con el seguimiento.</p>
                        </div>
                    ) : (
                        projects.map(project => {
                            const isBonyicProject = project.id === (process.env.NODE_ENV === 'production' ? 5 : 3);
                            return (
                                <div 
                                    key={project.id} 
                                    className={`project-card ${isBonyicProject ? 'bonyic-project' : 'standard-project'}`}
                                    onClick={() => handleProjectSelect(project)}
                                >
                                    <div className="project-card-header">
                                        <h3>{project.nombre_corto || project.nombre}</h3>
                                        {isBonyicProject && (
                                            <span className="special-badge">Seguimiento Activo</span>
                                        )}
                                    </div>
                                    
                                    <div className="project-card-info">
                                        <div className="info-row">
                                            <span className="label">Cliente:</span>
                                            <span>{project.cliente_abreviatura || project.cliente_nombre || 'No asignado'}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="label">Estado:</span>
                                            <span className={`status-badge status-${project.estado}`}>
                                                {project.estado}
                                            </span>
                                        </div>
                                        <div className="info-row">
                                            <span className="label">Contratista:</span>
                                            <span>{project.contratista || 'No asignado'}</span>
                                        </div>
                                    </div>

                                    <div className="project-card-footer">
                                        {isBonyicProject ? (
                                            <span className="action-text">Ver Seguimiento Detallado →</span>
                                        ) : (
                                            <span className="action-text">Configurar Seguimiento →</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default SeguimientoHub;