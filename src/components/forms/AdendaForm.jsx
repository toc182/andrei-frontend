import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

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
        tipo: 'tiempo',
        nueva_fecha_fin: '',
        dias_extension: '',
        nuevo_monto: '',
        monto_adicional: '',
        justificacion: null,
        observaciones: '',
        estado: 'en_proceso'
    });

    useEffect(() => {
        if (editingAdenda) {
            setFormData({
                tipo: editingAdenda.tipo || 'tiempo',
                nueva_fecha_fin: editingAdenda.nueva_fecha_fin ? editingAdenda.nueva_fecha_fin.split('T')[0] : '',
                dias_extension: editingAdenda.dias_extension || '',
                nuevo_monto: editingAdenda.nuevo_monto || '',
                monto_adicional: editingAdenda.monto_adicional || '',
                justificacion: editingAdenda.justificacion || null,
                observaciones: editingAdenda.observaciones || '',
                estado: editingAdenda.estado || 'en_proceso'
            });
        } else {
            setFormData({
                tipo: 'tiempo',
                nueva_fecha_fin: '',
                dias_extension: '',
                nuevo_monto: '',
                monto_adicional: '',
                justificacion: null,
                observaciones: '',
                estado: 'en_proceso'
            });
        }
    }, [editingAdenda, isOpen]);

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

    const handleSelectChange = (name, value) => {
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingAdenda ? 'Editar Adenda' : 'Nueva Adenda'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Información de la Adenda */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground">Información de la Adenda</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Adenda *</Label>
                                <Select
                                    value={formData.tipo}
                                    onValueChange={(value) => handleSelectChange('tipo', value)}
                                    disabled={loading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tipos.map(tipo => (
                                            <SelectItem key={tipo.value} value={tipo.value}>
                                                {tipo.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Select
                                    value={formData.estado}
                                    onValueChange={(value) => handleSelectChange('estado', value)}
                                    disabled={loading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {estados.map(estado => (
                                            <SelectItem key={estado.value} value={estado.value}>
                                                {estado.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Cambios de Tiempo */}
                    {(formData.tipo === 'tiempo' || formData.tipo === 'mixta') && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground">Modificación de Tiempo</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nueva Fecha de Terminación *</Label>
                                    <Input
                                        type="date"
                                        name="nueva_fecha_fin"
                                        value={formData.nueva_fecha_fin}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Días de Extensión</Label>
                                    <Input
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
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground">Modificación de Costo</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nuevo Monto Total (USD)</Label>
                                    <Input
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

                                <div className="space-y-2">
                                    <Label>Monto Adicional (USD)</Label>
                                    <Input
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

                    {/* Observaciones */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground">Observaciones</h3>

                        <div className="space-y-2">
                            <Label>Observaciones Adicionales</Label>
                            <Textarea
                                name="observaciones"
                                value={formData.observaciones}
                                onChange={handleInputChange}
                                placeholder="Observaciones adicionales..."
                                rows={2}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingAdenda ? 'Actualizar Adenda' : 'Crear Adenda'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AdendaForm;
