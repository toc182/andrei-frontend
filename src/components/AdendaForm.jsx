import React, { useState } from 'react';

const AdendaForm = ({ 
    projectId, 
    isOpen, 
    onClose, 
    onSave,
    editingAdenda = null 
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        tipo: editingAdenda?.tipo || 'tiempo',
        nueva_fecha_fin: editingAdenda?.nueva_fecha_fin ? editingAdenda.nueva_fecha_fin.split('T')[0] : '',
        dias_extension: editingAdenda?.dias_extension || '',
        nuevo_monto: editingAdenda?.nuevo_monto || '',
        monto_adicional: editingAdenda?.monto_adicional || '',
        justificacion: editingAdenda?.justificacion || null,
        observaciones: editingAdenda?.observaciones || '',
        estado: editingAdenda?.estado || 'en_proceso'
    });

    const tipos = [
        { value: 'tiempo', label: 'Extensión de Tiempo' },
        { value: 'costo', label: 'Modificación de Costo' },
        { value: 'mixta', label: 'Tiempo y Costo' }
    ];

    const estados = [
        { value: 'en_proceso', label: 'En Proceso' },
        { value: 'aprobada', label: 'Aprobada' },
        { value: 'rechazada', label: 'Rechazada' }
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = () => {
        const errors = [];

        if ((formData.tipo === 'tiempo' || formData.tipo === 'mixta') && !formData.nueva_fecha_fin) {
            errors.push('Nueva fecha de fin es requerida para adendas de tiempo');
        }

        if ((formData.tipo === 'costo' || formData.tipo === 'mixta') && !formData.nuevo_monto && !formData.monto_adicional) {
            errors.push('Nuevo monto o monto adicional es requerido para adendas de costo');
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
                proyecto_id: projectId,
                ...formData,
                nuevo_monto: formData.nuevo_monto ? parseFloat(formData.nuevo_monto) : null,
                monto_adicional: formData.monto_adicional ? parseFloat(formData.monto_adicional) : null,
                dias_extension: formData.dias_extension ? parseInt(formData.dias_extension) : null,
                justificacion: null,
                fecha_solicitud: new Date().toISOString().split('T')[0]
            };

            // Clean empty values
            Object.keys(submitData).forEach(key => {
                if (submitData[key] === '') {
                    submitData[key] = null;
                }
            });

            onSave(submitData);

        } catch (error) {
            console.error('Error guardando adenda:', error);
            setError('Error al guardar la adenda');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content adenda-modal">
                <div className="modal-header">
                    <h2>{editingAdenda ? 'Editar Adenda' : 'Nueva Adenda'}</h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="project-form">
                    <div className="form-section">
                        <h3>Información de la Adenda</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Tipo de Adenda *</label>
                                <select
                                    name="tipo"
                                    value={formData.tipo}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                    required
                                >
                                    {tipos.map(tipo => (
                                        <option key={tipo.value} value={tipo.value}>
                                            {tipo.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

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

                    {/* Cambios de Tiempo */}
                    {(formData.tipo === 'tiempo' || formData.tipo === 'mixta') && (
                        <div className="form-section">
                            <h3>Modificación de Tiempo</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nueva Fecha de Terminación *</label>
                                    <input
                                        type="date"
                                        name="nueva_fecha_fin"
                                        value={formData.nueva_fecha_fin}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Días de Extensión</label>
                                    <input
                                        type="number"
                                        name="dias_extension"
                                        value={formData.dias_extension}
                                        onChange={handleInputChange}
                                        placeholder="90"
                                        min="1"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cambios de Costo */}
                    {(formData.tipo === 'costo' || formData.tipo === 'mixta') && (
                        <div className="form-section">
                            <h3>Modificación de Costo</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nuevo Monto Total (USD)</label>
                                    <input
                                        type="number"
                                        name="nuevo_monto"
                                        value={formData.nuevo_monto}
                                        onChange={handleInputChange}
                                        placeholder="2500000"
                                        step="0.01"
                                        min="0"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Monto Adicional (USD)</label>
                                    <input
                                        type="number"
                                        name="monto_adicional"
                                        value={formData.monto_adicional}
                                        onChange={handleInputChange}
                                        placeholder="250000"
                                        step="0.01"
                                        min="0"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Justificación */}
                    <div className="form-section">
                        <h3>Observaciones</h3>


                        <div className="form-row">
                            <div className="form-group full-width">
                                <label>Observaciones Adicionales</label>
                                <textarea
                                    name="observaciones"
                                    value={formData.observaciones}
                                    onChange={handleInputChange}
                                    placeholder="Observaciones adicionales..."
                                    rows={2}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="form-error">
                            {error}
                        </div>
                    )}

                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="btn-spinner"></div>
                                    {editingAdenda ? 'Actualizando...' : 'Creando...'}
                                </>
                            ) : (
                                editingAdenda ? 'Actualizar Adenda' : 'Crear Adenda'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdendaForm;