import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import api from '../../services/api';
import StandardModal from '../common/StandardModal';

const EquipoStatusForm = ({ equipo, onClose, onSuccess }) => {
    const [selectedStatus, setSelectedStatus] = useState(equipo?.estado || 'en_operacion');
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const estadosDisponibles = [
        { value: 'en_operacion', label: 'En Operación', class: 'status-green' },
        { value: 'standby', label: 'Standby', class: 'status-blue' },
        { value: 'en_mantenimiento', label: 'En Mantenimiento', class: 'status-yellow' },
        { value: 'fuera_de_servicio', label: 'Fuera de Servicio', class: 'status-red' }
    ];

    const getEstadoInfo = (estado) => {
        return estadosDisponibles.find(e => e.value === estado) || estadosDisponibles[0];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const updateData = {
                estado: selectedStatus,
                observaciones: observaciones || null
            };

            await api.put(`/equipos/${equipo.id}/status`, updateData);

            onSuccess && onSuccess();
            onClose && onClose();
        } catch (error) {
            console.error('Error al actualizar estado del equipo:', error);
            setError(error.response?.data?.message || 'Error al actualizar el estado del equipo');
        } finally {
            setLoading(false);
        }
    };

    const currentStatusInfo = getEstadoInfo(equipo?.estado);
    const newStatusInfo = getEstadoInfo(selectedStatus);

    const footer = (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
                type="submit"
                form="status-form"
                className="btn btn-primary btn-sm"
                disabled={loading || selectedStatus === equipo?.estado}
            >
                {loading ? 'Actualizando...' : 'Actualizar Estado'}
            </button>
        </div>
    );

    return (
        <StandardModal
            isOpen={true}
            onClose={onClose}
            title="Cambiar Estado del Equipo"
            footer={footer}
            className="equipo-status-form-modal"
        >
            <form id="status-form" onSubmit={handleSubmit} className="form-container">
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div className="modal-row">
                    <label className="modal-row-label">Equipo:</label>
                    <span className="modal-row-value">
                        <strong>{equipo?.codigo}</strong> - {equipo?.descripcion}
                    </span>
                </div>

                <div className="modal-row">
                    <label className="modal-row-label">Estado Actual:</label>
                    <span className="modal-row-value">
                        <span className={`status-badge ${currentStatusInfo.class}`}>
                            {currentStatusInfo.label}
                        </span>
                    </span>
                </div>

                <div>
                    <label>Nuevo Estado *</label>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        required
                    >
                        {estadosDisponibles.map(estado => (
                            <option key={estado.value} value={estado.value}>
                                {estado.label}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedStatus !== equipo?.estado && (
                    <div className="modal-row">
                        <label className="modal-row-label">Nuevo Estado:</label>
                        <span className="modal-row-value">
                            <span className={`status-badge ${newStatusInfo.class}`}>
                                {newStatusInfo.label}
                            </span>
                        </span>
                    </div>
                )}

                <div>
                    <label>Observaciones</label>
                    <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        rows="3"
                        placeholder="Motivo del cambio de estado (opcional)..."
                    />
                </div>
            </form>
        </StandardModal>
    );
};

export default EquipoStatusForm;