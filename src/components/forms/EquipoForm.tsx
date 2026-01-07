import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { EquipoExtended } from '@/types';

interface EquipoFormData {
    codigo: string;
    descripcion: string;
    marca: string;
    modelo: string;
    ano: number;
    motor: string;
    chasis: string;
    costo: string;
    valor_actual: string;
    rata_mes: string;
    observaciones: string;
    owner: 'Pinellas' | 'COCP';
}

interface EquipoFormProps {
    equipo?: EquipoExtended | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const EquipoForm = ({ equipo = null, onClose, onSuccess }: EquipoFormProps) => {
    const [formData, setFormData] = useState<EquipoFormData>({
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
                costo: equipo.costo?.toString() || '',
                valor_actual: equipo.valor_actual?.toString() || '',
                rata_mes: equipo.rata_mes?.toString() || '',
                observaciones: equipo.observaciones || '',
                owner: equipo.owner || 'Pinellas'
            });
        }
    }, [equipo]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const equipoData = {
                codigo: formData.codigo || null,
                descripcion: formData.descripcion,
                marca: formData.marca,
                modelo: formData.modelo,
                ano: parseInt(formData.ano.toString()),
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
        } catch (err: unknown) {
            console.error('Error al guardar equipo:', err);
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Error al guardar el equipo');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`¿Está seguro de eliminar el equipo ${formData.descripcion}?`)) {
            try {
                setLoading(true);
                await api.delete(`/equipos/${equipo!.id}`);
                onSuccess && onSuccess();
                onClose && onClose();
            } catch (err) {
                console.error('Error deleting equipo:', err);
                setError('Error al eliminar el equipo');
                setLoading(false);
            }
        }
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{equipo ? 'Editar Equipo' : 'Agregar Nuevo Equipo'}</DialogTitle>
                </DialogHeader>
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
                        rows={3}
                        placeholder="Observaciones adicionales..."
                    />
                </div>
            </form>
                <DialogFooter className="flex justify-between items-center gap-4">
                    {equipo && (
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={handleDelete}
                            disabled={loading}
                        >
                            Eliminar Equipo
                        </button>
                    )}
                    <button
                        type="submit"
                        form="equipo-form"
                        className="btn btn-primary btn-sm ml-auto"
                        disabled={loading}
                    >
                        {loading ? 'Guardando...' : `${equipo ? 'Actualizar' : 'Guardar'} Equipo`}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EquipoForm;
