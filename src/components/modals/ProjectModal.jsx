import React, { useState } from 'react';
import StandardModal from '../common/StandardModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes } from '@fortawesome/free-solid-icons';

const ProjectModal = ({ isOpen, onClose, project, onSave, isEditing = false }) => {
    const [formData, setFormData] = useState({
        nombre: project?.nombre || '',
        nombre_corto: project?.nombre_corto || '',
        cliente_nombre: project?.cliente_nombre || '',
        cliente_abreviatura: project?.cliente_abreviatura || '',
        descripcion: project?.descripcion || '',
        estado: project?.estado || 'planning',
        monto_contrato_original: project?.monto_contrato_original || 0,
        fecha_inicio: project?.fecha_inicio || '',
        fecha_fin_estimada: project?.fecha_fin_estimada || ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
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
            await onSave(formData);
            onClose();
        } catch (err) {
            setError(err.message || 'Error al guardar el proyecto');
        } finally {
            setLoading(false);
        }
    };

    const estados = [
        { value: 'planning', label: 'Planificación' },
        { value: 'active', label: 'Activo' },
        { value: 'paused', label: 'Pausado' },
        { value: 'completed', label: 'Completado' },
        { value: 'cancelled', label: 'Cancelado' }
    ];

    const footer = (
        <>
            <button
                type="button"
                className="standard-modal-btn standard-modal-btn-secondary"
                onClick={onClose}
                disabled={loading}
            >
                <FontAwesomeIcon icon={faTimes} />
                Cancelar
            </button>
            <button
                type="submit"
                form="project-form"
                className="standard-modal-btn standard-modal-btn-primary"
                disabled={loading}
            >
                <FontAwesomeIcon icon={faSave} />
                {loading ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear')}
            </button>
        </>
    );

    return (
        <StandardModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            footer={footer}
            className="projects-standard-modal-content"
        >
            {error && (
                <div className="standard-modal-error">
                    {error}
                </div>
            )}

            <form id="project-form" className="standard-modal-form" onSubmit={handleSubmit}>
                {/* Fila 1: Nombre y Nombre Corto */}
                <div className="projects-standard-modal-form-row">
                    <div className="standard-modal-form-group">
                        <label htmlFor="nombre">Nombre del Proyecto</label>
                        <input
                            type="text"
                            id="nombre"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            required
                            placeholder="Ingrese el nombre completo del proyecto"
                        />
                    </div>
                    <div className="standard-modal-form-group">
                        <label htmlFor="nombre_corto">Nombre Corto</label>
                        <input
                            type="text"
                            id="nombre_corto"
                            name="nombre_corto"
                            value={formData.nombre_corto}
                            onChange={handleInputChange}
                            placeholder="Nombre abreviado"
                        />
                    </div>
                </div>

                {/* Fila 2: Cliente y Abreviatura */}
                <div className="projects-standard-modal-form-row">
                    <div className="standard-modal-form-group">
                        <label htmlFor="cliente_nombre">Cliente</label>
                        <input
                            type="text"
                            id="cliente_nombre"
                            name="cliente_nombre"
                            value={formData.cliente_nombre}
                            onChange={handleInputChange}
                            required
                            placeholder="Nombre del cliente"
                        />
                    </div>
                    <div className="standard-modal-form-group">
                        <label htmlFor="cliente_abreviatura">Abreviatura Cliente</label>
                        <input
                            type="text"
                            id="cliente_abreviatura"
                            name="cliente_abreviatura"
                            value={formData.cliente_abreviatura}
                            onChange={handleInputChange}
                            placeholder="Abreviatura del cliente"
                        />
                    </div>
                </div>

                {/* Fila 3: Estado y Monto */}
                <div className="projects-standard-modal-form-row">
                    <div className="standard-modal-form-group">
                        <label htmlFor="estado">Estado</label>
                        <select
                            id="estado"
                            name="estado"
                            value={formData.estado}
                            onChange={handleInputChange}
                            required
                        >
                            {estados.map(estado => (
                                <option key={estado.value} value={estado.value}>
                                    {estado.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="standard-modal-form-group">
                        <label htmlFor="monto_contrato_original">Monto del Contrato (B/.)</label>
                        <input
                            type="number"
                            id="monto_contrato_original"
                            name="monto_contrato_original"
                            value={formData.monto_contrato_original}
                            onChange={handleInputChange}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Fila 4: Fechas */}
                <div className="projects-standard-modal-form-row">
                    <div className="standard-modal-form-group">
                        <label htmlFor="fecha_inicio">Fecha de Inicio</label>
                        <input
                            type="date"
                            id="fecha_inicio"
                            name="fecha_inicio"
                            value={formData.fecha_inicio}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="standard-modal-form-group">
                        <label htmlFor="fecha_fin_estimada">Fecha Fin Estimada</label>
                        <input
                            type="date"
                            id="fecha_fin_estimada"
                            name="fecha_fin_estimada"
                            value={formData.fecha_fin_estimada}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                {/* Descripción */}
                <div className="standard-modal-form-group">
                    <label htmlFor="descripcion">Descripción</label>
                    <textarea
                        id="descripcion"
                        name="descripcion"
                        value={formData.descripcion}
                        onChange={handleInputChange}
                        placeholder="Descripción detallada del proyecto..."
                        rows={4}
                    />
                </div>
            </form>
        </StandardModal>
    );
};

export default ProjectModal;