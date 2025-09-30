import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StandardModal from './common/StandardModal';

const LicitacionForm = ({
    licitacionId = null,
    isOpen,
    onClose,
    onSave
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        numero_licitacion: '',
        nombre: '',
        entidad_licitante: '',
        fecha_cierre: '',
        presupuesto_referencial: '',
        estado_licitacion: 'activa',
        fecha_publicacion: '',
        tipo_obra: '',
        plazo_ejecucion: '',
        observaciones: ''
    });

    const estados = [
        { value: 'activa', label: 'Activa' },
        { value: 'presentada', label: 'Presentada' },
        { value: 'ganada', label: 'Ganada' },
        { value: 'perdida', label: 'Perdida' },
        { value: 'sin_interes', label: 'Sin Interés' },
        { value: 'cancelada', label: 'Cancelada' }
    ];

    useEffect(() => {
        if (isOpen) {
            if (licitacionId) {
                loadLicitacion();
            } else {
                setFormData({
                    numero_licitacion: '',
                    nombre: '',
                    entidad_licitante: '',
                    fecha_cierre: '',
                    presupuesto_referencial: '',
                    estado_licitacion: 'activa',
                    fecha_publicacion: '',
                    tipo_obra: '',
                    plazo_ejecucion: '',
                    observaciones: ''
                });
                setError('');
            }
        }
    }, [licitacionId, isOpen]);

    const loadLicitacion = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/licitaciones/${licitacionId}`);

            if (response.data.success) {
                const licitacion = response.data.licitacion;
                setFormData({
                    numero_licitacion: licitacion.numero_licitacion || '',
                    nombre: licitacion.nombre || '',
                    entidad_licitante: licitacion.entidad_licitante || '',
                    fecha_cierre: licitacion.fecha_cierre ? licitacion.fecha_cierre.split('T')[0] : '',
                    presupuesto_referencial: licitacion.presupuesto_referencial || '',
                    estado_licitacion: licitacion.estado_licitacion || 'activa',
                    fecha_publicacion: licitacion.fecha_publicacion ? licitacion.fecha_publicacion.split('T')[0] : '',
                    tipo_obra: licitacion.tipo_obra || '',
                    plazo_ejecucion: licitacion.plazo_ejecucion || '',
                    observaciones: licitacion.observaciones || ''
                });
            }
        } catch (error) {
            console.error('Error cargando licitación:', error);
            setError('Error al cargar los datos de la licitación');
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

        if (!formData.numero_licitacion.trim()) {
            errors.push('El número de licitación es obligatorio');
        }

        if (!formData.nombre.trim()) {
            errors.push('El nombre de la licitación es obligatorio');
        }

        if (!formData.entidad_licitante.trim()) {
            errors.push('La entidad licitante es obligatoria');
        }

        if (!formData.fecha_cierre) {
            errors.push('La fecha de cierre es obligatoria');
        }

        if (formData.fecha_publicacion && formData.fecha_cierre) {
            if (new Date(formData.fecha_publicacion) >= new Date(formData.fecha_cierre)) {
                errors.push('La fecha de cierre debe ser posterior a la fecha de publicación');
            }
        }

        if (formData.presupuesto_referencial && isNaN(parseFloat(formData.presupuesto_referencial))) {
            errors.push('El presupuesto referencial debe ser un número válido');
        }

        if (formData.plazo_ejecucion && isNaN(parseInt(formData.plazo_ejecucion))) {
            errors.push('El plazo de ejecución debe ser un número válido');
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
                presupuesto_referencial: formData.presupuesto_referencial ? parseFloat(formData.presupuesto_referencial) : null,
                plazo_ejecucion: formData.plazo_ejecucion ? parseInt(formData.plazo_ejecucion) : null
            };

            Object.keys(submitData).forEach(key => {
                if (submitData[key] === '') {
                    submitData[key] = null;
                }
            });

            let response;
            if (licitacionId) {
                response = await api.put(`/licitaciones/${licitacionId}`, submitData);
            } else {
                response = await api.post('/licitaciones', submitData);
            }

            if (response.data.success) {
                onSave && onSave(response.data.licitacion);
                onClose();
            } else {
                setError(response.data.message || 'Error al guardar la licitación');
            }

        } catch (error) {
            console.error('Error guardando licitación:', error);
            setError(error.response?.data?.message || 'Error de conexión al guardar la licitación');
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
                form="licitacion-form"
                className="btn-primary"
                disabled={loading}
            >
                {loading ? (
                    licitacionId ? 'Actualizando...' : 'Creando...'
                ) : (
                    licitacionId ? 'Actualizar Licitación' : 'Crear Licitación'
                )}
            </button>
        </div>
    );

    return (
        <StandardModal
            isOpen={isOpen}
            onClose={onClose}
            title={licitacionId ? 'Editar Licitación' : 'Nueva Licitación'}
            footer={footer}
            className="form-container"
        >
            {loading && !formData.nombre && (
                <div >
                    <div className="loading-spinner"></div>
                    <p>Cargando datos de la licitación...</p>
                </div>
            )}

            <form id="licitacion-form" onSubmit={handleSubmit}>
                    <div >
                        <h3>Información Básica</h3>

                        <div >
                            <div >
                                <label>Número de Licitación *</label>
                                <input
                                    type="text"
                                    name="numero_licitacion"
                                    value={formData.numero_licitacion}
                                    onChange={handleInputChange}
                                    placeholder="Ej: LPN-001-2025"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Estado</label>
                                <select
                                    name="estado_licitacion"
                                    value={formData.estado_licitacion}
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
                                <label>Nombre de la Licitación *</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Construcción de acueducto rural"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div >
                            <div >
                                <label>Entidad Licitante *</label>
                                <input
                                    type="text"
                                    name="entidad_licitante"
                                    value={formData.entidad_licitante}
                                    onChange={handleInputChange}
                                    placeholder="Ej: IDAAN - Instituto de Acueductos"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Tipo de Obra</label>
                                <input
                                    type="text"
                                    name="tipo_obra"
                                    value={formData.tipo_obra}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Acueducto, Alcantarillado, Planta"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div >
                        <h3>Fechas y Plazos</h3>

                        <div >
                            <div >
                                <label>Fecha de Publicación</label>
                                <input
                                    type="date"
                                    name="fecha_publicacion"
                                    value={formData.fecha_publicacion}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                />
                            </div>

                            <div >
                                <label>Fecha de Cierre *</label>
                                <input
                                    type="date"
                                    name="fecha_cierre"
                                    value={formData.fecha_cierre}
                                    onChange={handleInputChange}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div >
                            <div >
                                <label>Plazo de Ejecución (días)</label>
                                <input
                                    type="number"
                                    name="plazo_ejecucion"
                                    value={formData.plazo_ejecucion}
                                    onChange={handleInputChange}
                                    placeholder="365"
                                    min="1"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div >
                        <h3>Información Financiera</h3>

                        <div >
                            <div >
                                <label>Presupuesto Referencial (USD)</label>
                                <input
                                    type="number"
                                    name="presupuesto_referencial"
                                    value={formData.presupuesto_referencial}
                                    onChange={handleInputChange}
                                    placeholder="2500000"
                                    step="0.01"
                                    min="0"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div >
                        <h3>Observaciones</h3>

                        <div >
                            <div>
                                <label>Observaciones</label>
                                <textarea
                                    name="observaciones"
                                    value={formData.observaciones}
                                    onChange={handleInputChange}
                                    placeholder="Observaciones sobre la licitación..."
                                    rows={3}
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

export default LicitacionForm;