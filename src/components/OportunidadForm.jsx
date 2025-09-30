import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StandardModal from './common/StandardModal';

const OportunidadForm = ({
    oportunidadId = null,
    isOpen,
    onClose,
    onSave
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        nombre_oportunidad: '',
        cliente_potencial: '',
        contacto_referido: '',
        valor_estimado: '',
        estado_oportunidad: 'prospecto',
        fecha_identificacion: '',
        fecha_siguiente_seguimiento: '',
        probabilidad_cierre: '',
        tipo_trabajo: '',
        notas_comerciales: ''
    });

    const estados = [
        { value: 'prospecto', label: 'Prospecto' },
        { value: 'calificada', label: 'Calificada' },
        { value: 'propuesta', label: 'En Propuesta' },
        { value: 'negociacion', label: 'En Negociación' },
        { value: 'cerrada', label: 'Cerrada' },
        { value: 'perdida', label: 'Perdida' }
    ];

    useEffect(() => {
        if (isOpen) {
            if (oportunidadId) {
                loadOportunidad();
            } else {
                setFormData({
                    nombre_oportunidad: '',
                    cliente_potencial: '',
                    contacto_referido: '',
                    valor_estimado: '',
                    estado_oportunidad: 'prospecto',
                    fecha_identificacion: new Date().toISOString().split('T')[0],
                    fecha_siguiente_seguimiento: '',
                    probabilidad_cierre: '',
                    tipo_trabajo: '',
                    notas_comerciales: ''
                });
                setError('');
            }
        }
    }, [oportunidadId, isOpen]);

    const loadOportunidad = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/oportunidades/${oportunidadId}`);

            if (response.data.success) {
                const oportunidad = response.data.oportunidad;
                setFormData({
                    nombre_oportunidad: oportunidad.nombre_oportunidad || '',
                    cliente_potencial: oportunidad.cliente_potencial || '',
                    contacto_referido: oportunidad.contacto_referido || '',
                    valor_estimado: oportunidad.valor_estimado || '',
                    estado_oportunidad: oportunidad.estado_oportunidad || 'prospecto',
                    fecha_identificacion: oportunidad.fecha_identificacion ? oportunidad.fecha_identificacion.split('T')[0] : '',
                    fecha_siguiente_seguimiento: oportunidad.fecha_siguiente_seguimiento ? oportunidad.fecha_siguiente_seguimiento.split('T')[0] : '',
                    probabilidad_cierre: oportunidad.probabilidad_cierre || '',
                    tipo_trabajo: oportunidad.tipo_trabajo || '',
                    notas_comerciales: oportunidad.notas_comerciales || ''
                });
            }
        } catch (error) {
            console.error('Error cargando oportunidad:', error);
            setError('Error al cargar los datos de la oportunidad');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = () => {
        const errors = [];

        if (!formData.nombre_oportunidad.trim()) {
            errors.push('El nombre de la oportunidad es obligatorio');
        }

        if (!formData.cliente_potencial.trim()) {
            errors.push('El cliente potencial es obligatorio');
        }

        if (formData.valor_estimado && isNaN(parseFloat(formData.valor_estimado))) {
            errors.push('El valor estimado debe ser un número válido');
        }

        if (formData.probabilidad_cierre) {
            const prob = parseFloat(formData.probabilidad_cierre);
            if (isNaN(prob) || prob < 0 || prob > 100) {
                errors.push('La probabilidad debe ser un número entre 0 y 100');
            }
        }

        if (formData.fecha_identificacion && formData.fecha_siguiente_seguimiento) {
            if (new Date(formData.fecha_siguiente_seguimiento) <= new Date(formData.fecha_identificacion)) {
                errors.push('La fecha de seguimiento debe ser posterior a la fecha de identificación');
            }
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

            const submitData = {
                ...formData,
                valor_estimado: formData.valor_estimado ? parseFloat(formData.valor_estimado) : null,
                probabilidad_cierre: formData.probabilidad_cierre ? parseFloat(formData.probabilidad_cierre) : null
            };

            Object.keys(submitData).forEach(key => {
                if (submitData[key] === '') {
                    submitData[key] = null;
                }
            });

            let response;
            if (oportunidadId) {
                response = await api.put(`/oportunidades/${oportunidadId}`, submitData);
            } else {
                response = await api.post('/oportunidades', submitData);
            }

            if (response.data.success) {
                onSave && onSave(response.data.oportunidad);
                onClose();
            } else {
                setError(response.data.message || 'Error al guardar la oportunidad');
            }

        } catch (error) {
            console.error('Error guardando oportunidad:', error);
            setError(error.response?.data?.message || 'Error de conexión al guardar la oportunidad');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const footer = (
        <div >
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
                form="oportunidad-form"
                className="btn-primary"
                disabled={loading}
            >
                {loading ? (
                    oportunidadId ? 'Actualizando...' : 'Creando...'
                ) : (
                    oportunidadId ? 'Actualizar Oportunidad' : 'Crear Oportunidad'
                )}
            </button>
        </div>
    );

    return (
        <StandardModal
            isOpen={isOpen}
            onClose={onClose}
            title={oportunidadId ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
            footer={footer}
            className="form-container"
        >
            {loading && !formData.nombre_oportunidad && (
                <div >
                    <div className="loading-spinner"></div>
                    <p>Cargando datos de la oportunidad...</p>
                </div>
            )}

            <form id="oportunidad-form" onSubmit={handleSubmit}>
                    <div >
                        <h3>Información Básica</h3>

                        <div >
                            <div >
                                <label>Nombre de la Oportunidad *</label>
                                <input
                                    type="text"
                                    name="nombre_oportunidad"
                                    value={formData.nombre_oportunidad}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Sistema de agua potable Villa Nueva"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Estado</label>
                                <select
                                    name="estado_oportunidad"
                                    value={formData.estado_oportunidad}
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

                        <div >
                            <div >
                                <label>Cliente Potencial *</label>
                                <input
                                    type="text"
                                    name="cliente_potencial"
                                    value={formData.cliente_potencial}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Municipio de Capira"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Contacto Referido</label>
                                <input
                                    type="text"
                                    name="contacto_referido"
                                    value={formData.contacto_referido}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Ing. María González"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div >
                            <div >
                                <label>Tipo de Trabajo</label>
                                <input
                                    type="text"
                                    name="tipo_trabajo"
                                    value={formData.tipo_trabajo}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Acueducto, Alcantarillado, Planta"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div >
                        <h3>Información Comercial</h3>

                        <div >
                            <div >
                                <label>Valor Estimado (USD)</label>
                                <input
                                    type="number"
                                    name="valor_estimado"
                                    value={formData.valor_estimado}
                                    onChange={handleInputChange}
                                    placeholder="1500000"
                                    step="0.01"
                                    min="0"
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Probabilidad de Cierre (%)</label>
                                <input
                                    type="number"
                                    name="probabilidad_cierre"
                                    value={formData.probabilidad_cierre}
                                    onChange={handleInputChange}
                                    placeholder="75"
                                    min="0"
                                    max="100"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div >
                            <div >
                                <label>Fecha de Identificación</label>
                                <input
                                    type="date"
                                    name="fecha_identificacion"
                                    value={formData.fecha_identificacion}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Próximo Seguimiento</label>
                                <input
                                    type="date"
                                    name="fecha_siguiente_seguimiento"
                                    value={formData.fecha_siguiente_seguimiento}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div >
                        <h3>Notas Comerciales</h3>

                        <div >
                            <div>
                                <label>Notas Comerciales</label>
                                <textarea
                                    name="notas_comerciales"
                                    value={formData.notas_comerciales}
                                    onChange={handleInputChange}
                                    placeholder="Notas sobre reuniones, contactos, estrategia comercial..."
                                    rows={4}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                {error && (
                    <div >
                        {error}
                    </div>
                )}
            </form>
        </StandardModal>
    );
};

export default OportunidadForm;