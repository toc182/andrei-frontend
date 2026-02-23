import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Oportunidad } from '@/types';

interface OportunidadFormData {
    nombre_oportunidad: string;
    cliente_potencial: string;
    contacto_referido: string;
    valor_estimado: string;
    estado_oportunidad: 'prospecto' | 'calificada' | 'propuesta' | 'negociacion' | 'cerrada' | 'perdida';
    fecha_identificacion: string;
    fecha_siguiente_seguimiento: string;
    probabilidad_cierre: string;
    tipo_trabajo: string;
    notas_comerciales: string;
}

interface OportunidadFormProps {
    oportunidadId?: number | null;
    isOpen: boolean;
    onClose: () => void;
    onSave?: (oportunidad: Oportunidad) => void;
}

const OportunidadForm = ({
    oportunidadId = null,
    isOpen,
    onClose,
    onSave
}: OportunidadFormProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<OportunidadFormData>({
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
                    valor_estimado: oportunidad.valor_estimado?.toString() || '',
                    estado_oportunidad: oportunidad.estado_oportunidad || 'prospecto',
                    fecha_identificacion: oportunidad.fecha_identificacion ? oportunidad.fecha_identificacion.split('T')[0] : '',
                    fecha_siguiente_seguimiento: oportunidad.fecha_siguiente_seguimiento ? oportunidad.fecha_siguiente_seguimiento.split('T')[0] : '',
                    probabilidad_cierre: oportunidad.probabilidad_cierre?.toString() || '',
                    tipo_trabajo: oportunidad.tipo_trabajo || '',
                    notas_comerciales: oportunidad.notas_comerciales || ''
                });
            }
        } catch (err) {
            console.error('Error cargando oportunidad:', err);
            setError('Error al cargar los datos de la oportunidad');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = (): string[] => {
        const errors: string[] = [];

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

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            setError(validationErrors.join(', '));
            return;
        }

        try {
            setLoading(true);
            setError('');

            const submitData: Record<string, unknown> = {
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
                if (onSave) { onSave(response.data.oportunidad); }
                onClose();
            } else {
                setError(response.data.message || 'Error al guardar la oportunidad');
            }

        } catch (err: unknown) {
            console.error('Error guardando oportunidad:', err);
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Error de conexión al guardar la oportunidad');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{oportunidadId ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</DialogTitle>
                </DialogHeader>
            {loading && !formData.nombre_oportunidad && (
                <div>
                    <div className="loading-spinner"></div>
                    <p>Cargando datos de la oportunidad...</p>
                </div>
            )}

            <form id="oportunidad-form" onSubmit={handleSubmit}>
                    <div>
                        <h3>Información Básica</h3>

                        <div>
                            <div>
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

                            <div>
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

                        <div>
                            <div>
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

                            <div>
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

                        <div>
                            <div>
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

                    <div>
                        <h3>Información Comercial</h3>

                        <div>
                            <div>
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

                            <div>
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

                        <div>
                            <div>
                                <label>Fecha de Identificación</label>
                                <input
                                    type="date"
                                    name="fecha_identificacion"
                                    value={formData.fecha_identificacion}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                />
                            </div>

                            <div>
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

                    <div>
                        <h3>Notas Comerciales</h3>

                        <div>
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
                    <div className="error-message">
                        {error}
                    </div>
                )}
            </form>
                <DialogFooter className="flex justify-end gap-4">
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OportunidadForm;
