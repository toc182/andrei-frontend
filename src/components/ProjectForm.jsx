import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StandardModal from './common/StandardModal';
import '../styles/components/standardModal.css';

const ProjectForm = ({
                         projectId = null,
                         isOpen,
                         onClose,
                         onSave,
                         onDelete
                     }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [clientes, setClientes] = useState([]);
    const [loadingClientes, setLoadingClientes] = useState(true);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        nombre_corto: '',
        cliente_id: '',
        contratista: '',
        ingeniero_residente: '',
        fecha_inicio: '',
        fecha_fin_estimada: '',
        estado: 'planificacion',
        monto_contrato_original: '',
        presupuesto_base: '',
        itbms: '',
        monto_total: '',
        contrato: '',
        acto_publico: '',
        datos_adicionales: {
            observaciones: '',
            es_consorcio: false,
            socios: [
                { nombre: 'Pinellas, S.A.', porcentaje: 100 }
            ]
        }
    });

    const estados = [
        { value: 'planificacion', label: 'Planificación' },
        { value: 'en_curso', label: 'En Curso' },
        { value: 'pausado', label: 'Pausado' },
        { value: 'completado', label: 'Completado' },
        { value: 'cancelado', label: 'Cancelado' }
    ];


    // Cargar clientes
    const loadClientes = async () => {
        try {
            setLoadingClientes(true);
            const response = await api.get('/clientes');
            if (response.data.success) {
                setClientes(response.data.clientes);
            }
        } catch (error) {
            console.error('Error cargando clientes:', error);
        } finally {
            setLoadingClientes(false);
        }
    };

    // Cargar datos del proyecto si es edición
    useEffect(() => {
        if (isOpen) {
            loadClientes();
            
            if (projectId) {
                loadProject();
            } else {
                // Reset form para nuevo proyecto
                setFormData({
                    nombre: '',
                    nombre_corto: '',
                    cliente_id: '',
                    contratista: '',
                    ingeniero_residente: '',
                    fecha_inicio: '',
                    fecha_fin_estimada: '',
                    estado: 'planificacion',
                    monto_contrato_original: '',
                    presupuesto_base: '',
                    itbms: '',
                    monto_total: '',
                    contrato: '',
                    acto_publico: '',
                    datos_adicionales: {
                        observaciones: '',
                        es_consorcio: false,
                        socios: [
                            { nombre: 'Pinellas, S.A.', porcentaje: 100 }
                        ]
                    }
                });
                setError('');
            }
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
                    cliente_id: project.cliente_id || '',
                    contratista: project.contratista || '',
                    ingeniero_residente: project.ingeniero_residente || '',
                    fecha_inicio: project.fecha_inicio ? project.fecha_inicio.split('T')[0] : '',
                    fecha_fin_estimada: project.fecha_fin_estimada ? project.fecha_fin_estimada.split('T')[0] : '',
                    estado: project.estado || 'planificacion',
                    monto_contrato_original: project.monto_contrato_original || '',
                    presupuesto_base: project.presupuesto_base || '',
                    itbms: project.itbms || '',
                    monto_total: project.monto_total || '',
                    contrato: project.contrato || '',
                    acto_publico: project.acto_publico || '',
                    datos_adicionales: {
                        observaciones: project.datos_adicionales?.observaciones || '',
                        es_consorcio: project.datos_adicionales?.es_consorcio || false,
                        socios: project.datos_adicionales?.socios || [
                            { nombre: 'Pinellas, S.A.', porcentaje: 100 }
                        ]
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
        const { name, value, type, checked } = e.target;

        if (name.startsWith('datos_adicionales.')) {
            const field = name.replace('datos_adicionales.', '');
            
            if (field === 'es_consorcio') {
                setFormData(prev => ({
                    ...prev,
                    datos_adicionales: {
                        ...prev.datos_adicionales,
                        [field]: checked,
                        // Reset consortium data when unchecking
                        socios: checked ? prev.datos_adicionales.socios : [{ nombre: 'Pinellas, S.A.', porcentaje: 100 }]
                    }
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    datos_adicionales: {
                        ...prev.datos_adicionales,
                        [field]: value
                    }
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    // Handle partner changes
    const handlePartnerChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            datos_adicionales: {
                ...prev.datos_adicionales,
                socios: prev.datos_adicionales.socios.map((socio, i) => 
                    i === index ? { ...socio, [field]: field === 'porcentaje' ? parseFloat(value) || 0 : value } : socio
                )
            }
        }));
    };

    // Add partner
    const addPartner = () => {
        if (formData.datos_adicionales.socios.length < 4) {
            setFormData(prev => ({
                ...prev,
                datos_adicionales: {
                    ...prev.datos_adicionales,
                    socios: [...prev.datos_adicionales.socios, { nombre: '', porcentaje: 0 }]
                }
            }));
        }
    };

    // Remove partner
    const removePartner = (index) => {
        if (formData.datos_adicionales.socios.length > 1) {
            setFormData(prev => ({
                ...prev,
                datos_adicionales: {
                    ...prev.datos_adicionales,
                    socios: prev.datos_adicionales.socios.filter((_, i) => i !== index)
                }
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
        
        if (formData.presupuesto_base && isNaN(parseFloat(formData.presupuesto_base))) {
            errors.push('El presupuesto base debe ser un número válido');
        }
        
        if (formData.itbms && isNaN(parseFloat(formData.itbms))) {
            errors.push('El ITBMS debe ser un número válido');
        }
        
        if (formData.monto_total && isNaN(parseFloat(formData.monto_total))) {
            errors.push('El monto total debe ser un número válido');
        }

        // Consortium validation
        if (formData.datos_adicionales.es_consorcio) {
            const socios = formData.datos_adicionales.socios;
            const totalPercentage = socios.reduce((sum, socio) => sum + (socio.porcentaje || 0), 0);
            
            if (Math.abs(totalPercentage - 100) > 0.01) {
                errors.push('La suma de porcentajes debe ser exactamente 100%');
            }

            socios.forEach((socio, index) => {
                if (!socio.nombre.trim()) {
                    errors.push(`El nombre del socio ${index + 1} es obligatorio`);
                }
                if (socio.porcentaje <= 0) {
                    errors.push(`El porcentaje del socio ${index + 1} debe ser mayor a 0`);
                }
            });
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
                presupuesto_base: formData.presupuesto_base ? parseFloat(formData.presupuesto_base) : null,
                itbms: formData.itbms ? parseFloat(formData.itbms) : null,
                monto_total: formData.monto_total ? parseFloat(formData.monto_total) : null,
                datos_adicionales: {
                    ...formData.datos_adicionales
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

    // Footer for the main form
    const mainModalFooter = (
        <div>
            <div>
                {projectId && user?.rol === 'admin' && onDelete && (
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setShowDeleteConfirmation(true)}
                        disabled={loading}
                    >
                        🗑 Eliminar Proyecto
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onClose}
                    disabled={loading}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="project-form"
                    className="btn btn-primary"
                    disabled={loading}
                >
                    {loading ? (
                        projectId ? 'Actualizando...' : 'Creando...'
                    ) : (
                        projectId ? 'Actualizar Proyecto' : 'Crear Proyecto'
                    )}
                </button>
            </div>
        </div>
    );

    // Footer for the delete confirmation modal
    const deleteModalFooter = (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
                type="button"
                onClick={() => setShowDeleteConfirmation(false)}
                className="btn btn-secondary"
                disabled={loading}
            >
                Cancelar
            </button>
            <button
                type="button"
                onClick={() => {
                    onDelete(projectId);
                    setShowDeleteConfirmation(false);
                    onClose();
                }}
                className="btn btn-danger"
                disabled={loading}
            >
                Sí, Eliminar Proyecto
            </button>
        </div>
    );

    if (!isOpen) return null;

    return (
        <>
            <StandardModal
                isOpen={isOpen && !showDeleteConfirmation}
                onClose={onClose}
                title={projectId ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                footer={mainModalFooter}
                size="large"
                className="form-container"
            >

                {loading && !formData.nombre && (
                    <div >
                        <div className="loading-spinner"></div>
                        <p>Cargando datos del proyecto...</p>
                    </div>
                )}

                <form id="project-form" onSubmit={handleSubmit}>
                    <div>
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

                    <div>
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

                    <div>
                        <label>Cliente</label>
                        <select
                            name="cliente_id"
                            value={formData.cliente_id}
                            onChange={handleInputChange}
                            disabled={loading || loadingClientes}
                        >
                            <option value="">Seleccionar cliente...</option>
                            {clientes.map(cliente => (
                                <option key={cliente.id} value={cliente.id}>
                                    {cliente.nombre} {cliente.abreviatura && `(${cliente.abreviatura})`}
                                </option>
                            ))}
                        </select>
                        {loadingClientes && <small>Cargando clientes...</small>}
                    </div>

                    <div>
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

                    <div>
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

                    <div>
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

                    <div>
                        <label>Fecha de Inicio</label>
                        <input
                            type="date"
                            name="fecha_inicio"
                            value={formData.fecha_inicio}
                            onChange={handleInputChange}
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label>Fecha de Terminación</label>
                        <input
                            type="date"
                            name="fecha_fin_estimada"
                            value={formData.fecha_fin_estimada}
                            onChange={handleInputChange}
                            disabled={loading}
                        />
                    </div>

                    <div>
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

                    <div>
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

                    <div>
                        <label>Presupuesto Base (USD)</label>
                        <input
                            type="number"
                            name="presupuesto_base"
                            value={formData.presupuesto_base}
                            onChange={handleInputChange}
                            placeholder="2300000"
                            step="0.01"
                            min="0"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label>ITBMS (7%)</label>
                        <input
                            type="number"
                            name="itbms"
                            value={formData.itbms}
                            onChange={handleInputChange}
                            placeholder="161000"
                            step="0.01"
                            min="0"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label>Monto Total (USD)</label>
                        <input
                            type="number"
                            name="monto_total"
                            value={formData.monto_total}
                            onChange={handleInputChange}
                            placeholder="2461000"
                            step="0.01"
                            min="0"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label>Contratista</label>
                        <input
                            type="radio"
                            name="datos_adicionales.es_consorcio"
                            value="false"
                            checked={!formData.datos_adicionales.es_consorcio}
                            onChange={(e) => handleInputChange({
                                target: {
                                    name: "datos_adicionales.es_consorcio",
                                    type: "checkbox",
                                    checked: false
                                }
                            })}
                            disabled={loading}
                        />
                        Pinellas
                        <input
                            type="radio"
                            name="datos_adicionales.es_consorcio"
                            value="true"
                            checked={formData.datos_adicionales.es_consorcio}
                            onChange={(e) => handleInputChange({
                                target: {
                                    name: "datos_adicionales.es_consorcio",
                                    type: "checkbox",
                                    checked: true
                                }
                            })}
                            disabled={loading}
                        />
                        Consorcio
                    </div>

                    {formData.datos_adicionales.es_consorcio && (
                        <>
                            {formData.datos_adicionales.socios.length < 4 && (
                                <div style={{textAlign: 'center'}}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={addPartner}
                                        disabled={loading}
                                        style={{marginTop: '5px', marginBottom: '5px'}}
                                    >
                                        + Agregar Socio
                                    </button>
                                </div>
                            )}

                            {formData.datos_adicionales.socios.map((socio, index) => (
                                <React.Fragment key={index}>
                                    <div>
                                        {formData.datos_adicionales.socios.length > 1 &&
                                         !(index === 0 && socio.nombre === 'Pinellas, S.A.') ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn-remove"
                                                    onClick={() => removePartner(index)}
                                                    disabled={loading}
                                                    title="Eliminar socio"
                                                    style={{width: '30px'}}
                                                >
                                                    ✕
                                                </button>
                                                <label style={{width: '120px'}}>Socio {index + 1} *</label>
                                            </>
                                        ) : (
                                            <label style={{width: '150px'}}>Socio {index + 1} *</label>
                                        )}
                                        <input
                                            type="text"
                                            value={socio.nombre}
                                            onChange={(e) => handlePartnerChange(index, 'nombre', e.target.value)}
                                            placeholder="Nombre de la empresa"
                                            disabled={loading || (index === 0 && socio.nombre === 'Pinellas, S.A.')}
                                        />
                                    </div>
                                    <div>
                                        <label>Porcentaje(%) *</label>
                                        <input
                                            type="number"
                                            value={socio.porcentaje}
                                            onChange={(e) => handlePartnerChange(index, 'porcentaje', e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            disabled={loading}
                                        />
                                    </div>
                                </React.Fragment>
                            ))}

                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px'}}>
                                Total: {formData.datos_adicionales.socios.reduce((sum, socio) => sum + (socio.porcentaje || 0), 0).toFixed(2)}%
                                {Math.abs(formData.datos_adicionales.socios.reduce((sum, socio) => sum + (socio.porcentaje || 0), 0) - 100) > 0.01 && (
                                    <span className="error-message" style={{marginLeft: '5px'}}>⚠️ Debe sumar 100%</span>
                                )}
                            </div>
                        </>
                    )}

                    <div>
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

                    {/* Error */}
                    {error && (
                        <div >
                            {error}
                        </div>
                    )}

                </form>
            </StandardModal>

            {/* Delete Confirmation Modal */}
            <StandardModal
                isOpen={showDeleteConfirmation}
                onClose={() => setShowDeleteConfirmation(false)}
                title="⚠️ Eliminar Proyecto"
                footer={deleteModalFooter}
                size="default"
                className="delete-confirmation-modal"
            >
                <p><strong>¿Estás seguro de que quieres eliminar este proyecto?</strong></p>
                <p>Esta acción no se puede deshacer. Se eliminarán todos los datos del proyecto, incluyendo:</p>
                <ul>
                    <li>Toda la información del proyecto</li>
                    <li>Adendas asociadas</li>
                    <li>Reportes y seguimiento</li>
                </ul>
                <div className="project-to-delete">
                    <strong>Proyecto:</strong> {formData.nombre || 'Sin nombre'}
                </div>
            </StandardModal>
        </>
    );
};

export default ProjectForm;