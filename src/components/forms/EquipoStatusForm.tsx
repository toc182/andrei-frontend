import { useState, FormEvent, ChangeEvent } from 'react';
import api from '../../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { EquipoExtended } from '@/types';

type EstadoEquipo = 'en_operacion' | 'standby' | 'en_mantenimiento' | 'fuera_de_servicio';

interface EstadoInfo {
    value: EstadoEquipo;
    label: string;
    class: string;
}

interface EquipoStatusFormProps {
    equipo: EquipoExtended;
    onClose: () => void;
    onSuccess?: () => void;
}

const EquipoStatusForm = ({ equipo, onClose, onSuccess }: EquipoStatusFormProps) => {
    const [selectedStatus, setSelectedStatus] = useState<EstadoEquipo>(equipo?.estado || 'en_operacion');
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const estadosDisponibles: EstadoInfo[] = [
        { value: 'en_operacion', label: 'En Operación', class: 'status-green' },
        { value: 'standby', label: 'Standby', class: 'status-blue' },
        { value: 'en_mantenimiento', label: 'En Mantenimiento', class: 'status-yellow' },
        { value: 'fuera_de_servicio', label: 'Fuera de Servicio', class: 'status-red' }
    ];

    const getEstadoInfo = (estado: EstadoEquipo): EstadoInfo => {
        return estadosDisponibles.find(e => e.value === estado) || estadosDisponibles[0];
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const updateData = {
                estado: selectedStatus,
                observaciones: observaciones || null
            };

            await api.put(`/equipos/${equipo.id}/status`, updateData);

            if (onSuccess) { onSuccess(); }
            if (onClose) { onClose(); }
        } catch (err: unknown) {
            console.error('Error al actualizar estado del equipo:', err);
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Error al actualizar el estado del equipo');
        } finally {
            setLoading(false);
        }
    };

    const currentStatusInfo = getEstadoInfo(equipo?.estado || 'en_operacion');
    const newStatusInfo = getEstadoInfo(selectedStatus);

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Cambiar Estado del Equipo</DialogTitle>
                </DialogHeader>
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
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedStatus(e.target.value as EstadoEquipo)}
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
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setObservaciones(e.target.value)}
                        rows={3}
                        placeholder="Motivo del cambio de estado (opcional)..."
                    />
                </div>
            </form>
                <DialogFooter className="flex justify-end gap-4">
                    <button
                        type="submit"
                        form="status-form"
                        className="btn btn-primary btn-sm"
                        disabled={loading || selectedStatus === equipo?.estado}
                    >
                        {loading ? 'Actualizando...' : 'Actualizar Estado'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EquipoStatusForm;
