import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ProjectForm = ({
                         projectId = null,
                         isOpen,
                         onClose,
                         onSave
                     }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        nombre: '',
        nombre_corto: '',
        contratista: '',
        ingeniero_residente: '',
        fecha_inicio: '',
        fecha_fin_estimada: '',
        estado: 'planificacion',
        monto_contrato_original: '',
        contrato: '',
        acto_publico: '',
        datos_adicionales: {
            superficie_m2: '',
            pisos: '',
            tipo_estructura: '',
            observaciones: ''
        }
    });

    const estados = [
        { value: 'planificacion', label: 'Planificación' },
        { value: 'en_curso', label: 'En Curso' },
        { value: 'pausado', label: 'Pausado' },
        { value: 'completado', label: 'Completado' },
        { value: 'cancelado', label: 'Cancelado' }
    ];

    const tiposEstructura = [
        { value: '', label: 'Seleccionar tipo...' },
        { value: 'concreto_armado', label: 'Concreto Armado' },
        { value: 'acero', label: 'Estructura de Acero' },
        { value: 'mixta', label: 'Estructura Mixta' },
        { value: 'madera', label: 'Estructura de Madera' },
        { value: 'prefabricado', label: 'Prefabricado' }
    ];

    // Cargar datos del proyecto si es edición
    useEffect(() => {
        if (projectId && isOpen) {
            loadProject();
        } else if (isOpen && !projectId) {
            // Reset form para nuevo proyecto
            setFormData({
                nombre: '',
                nombre_corto: '',
                contratista: '',
                ingeniero_residente: '',
                fecha_inicio: '',
                fecha_fin_estimada: '',
                estado: 'planificacion',
                monto_contrato_original: '',
                contrato: '',
                acto_publico: '',
                datos_adicionales: {
                    superficie_m2: '',
                    pisos: '',
                    tipo_estructura: '',
                    observaciones: ''
                }
            });
            setError('');
        }
    }, [projectId, isOpen]);

    const loadProject = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/projects/${projectId}`);

            if (response.data.success) {
                const project = response.data.proyecto;
                setFormData({
                    nombre: project.nombre || '',
                    nombre_corto: project.nombre_corto || '',
                    contratista: project.contratista || '',
                    ingeniero_residente: project.ingeniero_residente || '',
                    fecha_inicio: project.fecha_inicio ? project.fecha_inicio.split('T')[0] : '',
                    fecha_fin_estimada: project.fecha_fin_estimada ? project.fecha_fin_estimada.split('T')[0] : '',
                    estado: project.estado || 'planificacion',
                    monto_contrato_original: project.monto_contrato_original || '',
                    contrato: project.contrato || '',
                    acto_publico: project.acto_publico || '',
                    datos_adicionales: {
                        superficie_m2: project.datos_adicionales?.superficie_m2 || '',
                        pisos: project.datos_adicionales?.pisos || '',
                        tipo_estructura: project.datos_adicionales?.tipo_estructura || '',
                        observaciones: project.datos_adicionales?.observaciones || ''
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando proyecto:', error);
            setError('Error al cargar los datos del proyecto');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name.startsWith('datos_adicionales.')) {
            const field = name.replace('datos_adicionales.', '');
            setFormData(prev => ({
                ...prev,
                datos_adicionales: {
                    ...prev.datos_adicionales,
                    [field]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const validateForm = () => {
        const errors = [];

        if (!formData.nombre.trim()) {
            errors.push('El nombre del proyecto es obligatorio');
        }

        if (formData.fecha_inicio && formData.fecha_fin_estimada) {
            if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin_estimada)) {
                errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
            }
        }

        if (formData.monto_contrato_original && isNaN(parseFloat(formData.monto_contrato_original))) {
            errors.push('El monto del contrato debe ser un número válido');
        }

        if (formData.datos_adicionales.pisos && isNaN(parseInt(formData.datos_adicionales.pisos))) {
            errors.push('El número de pisos debe ser un número entero');
        }

        if (formData.datos_adicionales.superficie_m2 && isNaN(parseFloat(formData.datos_adicionales.superficie_m2))) {
            errors.push('La superficie debe ser un número válido');
        }

        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            setError(validationErrors.join(', '));
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Preparar datos para envío
            const submitData = {
                ...formData,
                // Convertir valores numéricos
                monto_contrato_original: formData.monto_contrato_original ? parseFloat(formData.monto_contrato_original) : null,
                datos_adicionales: {
                    ...formData.datos_adicionales,
                    superficie_m2: formData.datos_adicionales.superficie_m2 ? parseFloat(formData.datos_adicionales.superficie_m2) : null,
                    pisos: formData.datos_adicionales.pisos ? parseInt(formData.datos_adicionales.pisos) : null
                }
            };

            // Limpiar campos vacíos
            Object.keys(submitData).forEach(key => {
                if (submitData[key] === '') {
                    submitData[key] = null;
                }
            });

            Object.keys(submitData.datos_adicionales).forEach(key => {
                if (submitData.datos_adicionales[key] === '') {
                    submitData.datos_adicionales[key] = null;
                }
            });

            let response;
            if (projectId) {
                // Editar proyecto existente
                response = await api.put(`/projects/${projectId}`, submitData);
            } else {
                // Crear nuevo proyecto
                response = await api.post('/projects', submitData);
            }

            if (response.data.success) {
                onSave && onSave(response.data.proyecto);
                onClose();
            } else {
                setError(response.data.message || 'Error al guardar el proyecto');
            }

        } catch (error) {
            console.error('Error guardando proyecto:', error);
            setError(error.response?.data?.message || 'Error de conexión al guardar el proyecto');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content project-form-modal">
                <div className="modal-header">
                    <h2>{projectId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                {loading && !formData.nombre && (
                    <div className="form-loading">
                        <div className="loading-spinner"></div>
                        <p>Cargando datos del proyecto...</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="project-form">
                    {/* Información Básica */}
                    <div className="form-section">
                        <h3>Información Básica</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Nombre del Proyecto *</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Edificio Torre Central"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Nombre Corto</label>
                                <input
                                    type="text"
                                    name="nombre_corto"
                                    value={formData.nombre_corto}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Torre Central"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Contratista</label>
                                <input
                                    type="text"
                                    name="contratista"
                                    value={formData.contratista}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Constructora Panama S.A."
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Ingeniero Residente</label>
                                <input
                                    type="text"
                                    name="ingeniero_residente"
                                    value={formData.ingeniero_residente}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Ing. Carlos Mendoza"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Estado</label>
                                <select
                                    name="estado"
                                    value={formData.estado}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                >
                                    {estados.map(estado => (
                                        <option key={estado.value} value={estado.value}>
                                            {estado.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Fechas */}
                    <div className="form-section">
                        <h3>Cronograma</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Fecha de Inicio</label>
                                <input
                                    type="date"
                                    name="fecha_inicio"
                                    value={formData.fecha_inicio}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Fecha Fin Estimada</label>
                                <input
                                    type="date"
                                    name="fecha_fin_estimada"
                                    value={formData.fecha_fin_estimada}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Información Contractual */}
                    <div className="form-section">
                        <h3>Información Contractual</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Número de Contrato</label>
                                <input
                                    type="text"
                                    name="contrato"
                                    value={formData.contrato}
                                    onChange={handleInputChange}
                                    placeholder="Ej: CT-2025-001"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Acto Público</label>
                                <input
                                    type="text"
                                    name="acto_publico"
                                    value={formData.acto_publico}
                                    onChange={handleInputChange}
                                    placeholder="Ej: AP-001-2025"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Monto del Contrato Original (USD)</label>
                                <input
                                    type="number"
                                    name="monto_contrato_original"
                                    value={formData.monto_contrato_original}
                                    onChange={handleInputChange}
                                    placeholder="2500000"
                                    step="0.01"
                                    min="0"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Datos Técnicos */}
                    <div className="form-section">
                        <h3>Datos Técnicos</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Superficie (m²)</label>
                                <input
                                    type="number"
                                    name="datos_adicionales.superficie_m2"
                                    value={formData.datos_adicionales.superficie_m2}
                                    onChange={handleInputChange}
                                    placeholder="5000"
                                    step="0.01"
                                    min="0"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Número de Pisos</label>
                                <input
                                    type="number"
                                    name="datos_adicionales.pisos"
                                    value={formData.datos_adicionales.pisos}
                                    onChange={handleInputChange}
                                    placeholder="15"
                                    min="1"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Tipo de Estructura</label>
                                <select
                                    name="datos_adicionales.tipo_estructura"
                                    value={formData.datos_adicionales.tipo_estructura}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                >
                                    {tiposEstructura.map(tipo => (
                                        <option key={tipo.value} value={tipo.value}>
                                            {tipo.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group full-width">
                                <label>Observaciones</label>
                                <textarea
                                    name="datos_adicionales.observaciones"
                                    value={formData.datos_adicionales.observaciones}
                                    onChange={handleInputChange}
                                    placeholder="Observaciones adicionales del proyecto..."
                                    rows={3}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="form-error">
                            {error}
                        </div>
                    )}

                    {/* Botones */}
                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                            disabled={loading}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="btn-spinner"></div>
                                    {projectId ? 'Actualizando...' : 'Creando...'}
                                </>
                            ) : (
                                projectId ? 'Actualizar Proyecto' : 'Crear Proyecto'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectForm;