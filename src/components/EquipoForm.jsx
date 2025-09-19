import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';

const EquipoForm = ({ equipo = null, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        codigo: '',
        descripcion: '',
        marca: '',
        modelo: '',
        ano: new Date().getFullYear(),
        motor: '',
        chasis: '',
        costo: '',
        valor_actual: '',
        rata_mes: '',
        observaciones: '',
        owner: 'Pinellas'
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Cargar datos del equipo en modo edición
    useEffect(() => {
        if (equipo) {
            setFormData({
                codigo: equipo.codigo || '',
                descripcion: equipo.descripcion || '',
                marca: equipo.marca || '',
                modelo: equipo.modelo || '',
                ano: equipo.ano || new Date().getFullYear(),
                motor: equipo.motor || '',
                chasis: equipo.chasis || '',
                costo: equipo.costo || '',
                valor_actual: equipo.valor_actual || '',
                rata_mes: equipo.rata_mes || '',
                observaciones: equipo.observaciones || '',
                owner: equipo.owner || 'Pinellas'
            });
        }
    }, [equipo]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const equipoData = {
                codigo: formData.codigo || null,
                descripcion: formData.descripcion,
                marca: formData.marca,
                modelo: formData.modelo,
                ano: parseInt(formData.ano),
                motor: formData.motor || null,
                chasis: formData.chasis || null,
                costo: formData.costo ? parseFloat(formData.costo) : null,
                valor_actual: formData.valor_actual ? parseFloat(formData.valor_actual) : null,
                rata_mes: formData.rata_mes ? parseFloat(formData.rata_mes) : null,
                observaciones: formData.observaciones || null,
                owner: formData.owner
            };

            if (equipo) {
                // Actualizar equipo existente
                await api.put(`/equipos/${equipo.id}`, equipoData);
            } else {
                // Crear nuevo equipo
                await api.post('/equipos', equipoData);
            }

            onSuccess && onSuccess();
            onClose && onClose();
        } catch (error) {
            console.error('Error al guardar equipo:', error);
            setError(error.response?.data?.message || 'Error al guardar el equipo');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`¿Está seguro de eliminar el equipo ${formData.descripcion}?`)) {
            try {
                setLoading(true);
                await api.delete(`/equipos/${equipo.id}`);
                onSuccess && onSuccess();
                onClose && onClose();
            } catch (error) {
                console.error('Error deleting equipo:', error);
                setError('Error al eliminar el equipo');
                setLoading(false);
            }
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content equipos-form-modal">
                <div className="modal-header">
                    <h2>{equipo ? 'Editar Equipo' : 'Agregar Nuevo Equipo'}</h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                <form className="project-form" onSubmit={handleSubmit}>
                    <div style={{ padding: '0 2rem 1.5rem 2rem' }}>
                        {error && (
                            <div className="form-error">
                                {error}
                            </div>
                        )}

                        {/* Información Básica */}
                        <div className="form-section">
                            <h3>Información Básica</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Propietario *</label>
                                    <select
                                        name="owner"
                                        value={formData.owner}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="Pinellas">Pinellas</option>
                                        <option value="COCP">COCP</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Código</label>
                                    <input
                                        type="text"
                                        name="codigo"
                                        value={formData.codigo}
                                        onChange={handleChange}
                                        placeholder="Ej: 01-19"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Descripción *</label>
                                <input
                                    type="text"
                                    name="descripcion"
                                    value={formData.descripcion}
                                    onChange={handleChange}
                                    required
                                    placeholder="Ej: Retroexcavadora, Pala 21 Ton"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Marca *</label>
                                    <input
                                        type="text"
                                        name="marca"
                                        value={formData.marca}
                                        onChange={handleChange}
                                        required
                                        placeholder="Ej: John Deere, Caterpillar"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Modelo *</label>
                                    <input
                                        type="text"
                                        name="modelo"
                                        value={formData.modelo}
                                        onChange={handleChange}
                                        required
                                        placeholder="Ej: 310K, 320 GX"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Año *</label>
                                <input
                                    type="number"
                                    name="ano"
                                    value={formData.ano}
                                    onChange={handleChange}
                                    required
                                    min="1900"
                                    max="2030"
                                />
                            </div>
                        </div>

                        {/* Especificaciones Técnicas */}
                        <div className="form-section">
                            <h3>Especificaciones Técnicas</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label># Motor</label>
                                    <input
                                        type="text"
                                        name="motor"
                                        value={formData.motor}
                                        onChange={handleChange}
                                        placeholder="Número de motor"
                                    />
                                </div>

                                <div className="form-group">
                                    <label># Chasis</label>
                                    <input
                                        type="text"
                                        name="chasis"
                                        value={formData.chasis}
                                        onChange={handleChange}
                                        placeholder="Número de chasis"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Información Financiera */}
                        <div className="form-section">
                            <h3>Información Financiera</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Costo</label>
                                    <input
                                        type="number"
                                        name="costo"
                                        value={formData.costo}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Valor Actual</label>
                                    <input
                                        type="number"
                                        name="valor_actual"
                                        value={formData.valor_actual}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Rata/Mes</label>
                                <input
                                    type="number"
                                    name="rata_mes"
                                    value={formData.rata_mes}
                                    onChange={handleChange}
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>


                        {/* Observaciones */}
                        <div className="form-section">
                            <div className="form-group full-width">
                                <label>Observaciones</label>
                                <textarea
                                    name="observaciones"
                                    value={formData.observaciones}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Observaciones adicionales..."
                                />
                            </div>
                        </div>

                        {/* Botones de acción */}
                        <div className="form-actions">
                            <div>
                                {equipo && (
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={handleDelete}
                                        disabled={loading}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                        Eliminar Equipo
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={onClose}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading && <div className="btn-spinner"></div>}
                                    {equipo ? 'Actualizar' : 'Guardar'} Equipo
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EquipoForm;