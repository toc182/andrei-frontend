import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import api from '../../services/api';
import StandardModal from '../common/StandardModal';

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

    const footer = (
        <div>
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
                    className="btn btn-danger"
                    onClick={onClose}
                    disabled={loading}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="equipo-form"
                    className="btn btn-primary"
                    disabled={loading}
                >
                    {loading ? 'Guardando...' : `${equipo ? 'Actualizar' : 'Guardar'} Equipo`}
                </button>
            </div>
        </div>
    );

    return (
        <StandardModal
            isOpen={true}
            onClose={onClose}
            title={equipo ? 'Editar Equipo' : 'Agregar Nuevo Equipo'}
            footer={footer}
            className="equipos-form-modal"
        >
            <form id="equipo-form" onSubmit={handleSubmit} className="form-container">
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div>
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

                <div>
                    <label>Código</label>
                    <input
                        type="text"
                        name="codigo"
                        value={formData.codigo}
                        onChange={handleChange}
                        placeholder="Ej: 01-19"
                    />
                </div>

                <div>
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

                <div>
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

                <div>
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

                <div>
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

                <div>
                    <label># Motor</label>
                    <input
                        type="text"
                        name="motor"
                        value={formData.motor}
                        onChange={handleChange}
                        placeholder="Número de motor"
                    />
                </div>

                <div>
                    <label># Chasis</label>
                    <input
                        type="text"
                        name="chasis"
                        value={formData.chasis}
                        onChange={handleChange}
                        placeholder="Número de chasis"
                    />
                </div>

                <div>
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

                <div>
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

                <div>
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

                <div>
                    <label>Observaciones</label>
                    <textarea
                        name="observaciones"
                        value={formData.observaciones}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Observaciones adicionales..."
                    />
                </div>
            </form>
        </StandardModal>
    );
};

export default EquipoForm;