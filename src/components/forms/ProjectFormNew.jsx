import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Shadcn Components
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, Plus } from 'lucide-react';

/**
 * Schema de validación con Zod
 */
const projectSchema = z.object({
    nombre: z.string().min(1, 'El nombre del proyecto es obligatorio'),
    nombre_corto: z.string().optional(),
    cliente_id: z.string().optional(),
    contratista: z.string().optional(),
    ingeniero_residente: z.string().optional(),
    fecha_inicio: z.string().optional(),
    fecha_fin_estimada: z.string().optional(),
    estado: z.enum(['planificacion', 'en_curso', 'pausado', 'completado', 'cancelado']),
    monto_contrato_original: z.string().optional(),
    presupuesto_base: z.string().optional(),
    itbms: z.string().optional(),
    monto_total: z.string().optional(),
    contrato: z.string().optional(),
    acto_publico: z.string().optional(),
    datos_adicionales: z.object({
        observaciones: z.string().optional(),
        es_consorcio: z.boolean(),
        socios: z.array(z.object({
            nombre: z.string(),
            porcentaje: z.number()
        }))
    })
}).refine((data) => {
    // Validar que fecha_fin sea posterior a fecha_inicio
    if (data.fecha_inicio && data.fecha_fin_estimada) {
        return new Date(data.fecha_inicio) < new Date(data.fecha_fin_estimada);
    }
    return true;
}, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    path: ['fecha_fin_estimada']
}).refine((data) => {
    // Validar que los porcentajes del consorcio sumen 100%
    if (data.datos_adicionales.es_consorcio) {
        const total = data.datos_adicionales.socios.reduce((sum, socio) => sum + socio.porcentaje, 0);
        return Math.abs(total - 100) < 0.01;
    }
    return true;
}, {
    message: 'La suma de porcentajes debe ser exactamente 100%',
    path: ['datos_adicionales', 'socios']
});

/**
 * Formulario de Proyectos con Shadcn/ui
 * Migrado desde ProjectForm.jsx (StandardModal)
 *
 * Features:
 * - React Hook Form + Zod para validación
 * - Soporte para Consorcio con múltiples socios
 * - Modal de confirmación de eliminación
 * - Loading states
 * - Validación en tiempo real
 */

const ProjectFormNew = ({
    projectId = null,
    isOpen,
    onClose,
    onSave,
    onDelete
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [clientes, setClientes] = useState([]);
    const [loadingClientes, setLoadingClientes] = useState(true);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    // React Hook Form
    const form = useForm({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            nombre: '',
            nombre_corto: '',
            cliente_id: '',
            contratista: '',
            ingeniero_residente: '',
            fecha_inicio: '',
            fecha_fin_estimada: '',
            estado: 'planificacion',
            monto_contrato_original: '',
            presupuesto_base: '',
            itbms: '',
            monto_total: '',
            contrato: '',
            acto_publico: '',
            datos_adicionales: {
                observaciones: '',
                es_consorcio: false,
                socios: [
                    { nombre: 'Pinellas, S.A.', porcentaje: 100 }
                ]
            }
        }
    });

    const estados = [
        { value: 'planificacion', label: 'Planificación' },
        { value: 'en_curso', label: 'En Curso' },
        { value: 'pausado', label: 'Pausado' },
        { value: 'completado', label: 'Completado' },
        { value: 'cancelado', label: 'Cancelado' }
    ];

    // Watch para reactive values
    const watchEsConsorcio = form.watch('datos_adicionales.es_consorcio');
    const watchSocios = form.watch('datos_adicionales.socios');

    // Cargar clientes
    const loadClientes = async () => {
        try {
            setLoadingClientes(true);
            const response = await api.get('/clientes');
            if (response.data.success) {
                setClientes(response.data.clientes);
            }
        } catch (error) {
            console.error('Error cargando clientes:', error);
        } finally {
            setLoadingClientes(false);
        }
    };

    // Cargar datos del proyecto si es edición
    useEffect(() => {
        if (isOpen) {
            loadClientes();

            if (projectId) {
                loadProject();
            } else {
                // Reset form para nuevo proyecto
                form.reset();
                setError('');
            }
        }
    }, [projectId, isOpen]);

    const loadProject = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/projects/${projectId}`);

            if (response.data.success) {
                const project = response.data.proyecto;

                // Cargar datos en react-hook-form
                form.reset({
                    nombre: project.nombre || '',
                    nombre_corto: project.nombre_corto || '',
                    cliente_id: project.cliente_id ? String(project.cliente_id) : '',
                    contratista: project.contratista || '',
                    ingeniero_residente: project.ingeniero_residente || '',
                    fecha_inicio: project.fecha_inicio ? project.fecha_inicio.split('T')[0] : '',
                    fecha_fin_estimada: project.fecha_fin_estimada ? project.fecha_fin_estimada.split('T')[0] : '',
                    estado: project.estado || 'planificacion',
                    monto_contrato_original: project.monto_contrato_original ? String(project.monto_contrato_original) : '',
                    presupuesto_base: project.presupuesto_base ? String(project.presupuesto_base) : '',
                    itbms: project.itbms ? String(project.itbms) : '',
                    monto_total: project.monto_total ? String(project.monto_total) : '',
                    contrato: project.contrato || '',
                    acto_publico: project.acto_publico || '',
                    datos_adicionales: {
                        observaciones: project.datos_adicionales?.observaciones || '',
                        es_consorcio: project.datos_adicionales?.es_consorcio || false,
                        socios: project.datos_adicionales?.socios || [
                            { nombre: 'Pinellas, S.A.', porcentaje: 100 }
                        ]
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando proyecto:', error);
            setError('Error al cargar los datos del proyecto');
        } finally {
            setLoading(false);
        }
    };

    // Handlers para consorcio
    const handlePartnerChange = (index, field, value) => {
        const currentSocios = form.getValues('datos_adicionales.socios');
        const updatedSocios = currentSocios.map((socio, i) =>
            i === index
                ? { ...socio, [field]: field === 'porcentaje' ? parseFloat(value) || 0 : value }
                : socio
        );
        form.setValue('datos_adicionales.socios', updatedSocios);
    };

    const addPartner = () => {
        const currentSocios = form.getValues('datos_adicionales.socios');
        if (currentSocios.length < 4) {
            form.setValue('datos_adicionales.socios', [
                ...currentSocios,
                { nombre: '', porcentaje: 0 }
            ]);
        }
    };

    const removePartner = (index) => {
        const currentSocios = form.getValues('datos_adicionales.socios');
        if (currentSocios.length > 1) {
            form.setValue(
                'datos_adicionales.socios',
                currentSocios.filter((_, i) => i !== index)
            );
        }
    };

    const handleSubmit = async (data) => {
        try {
            setLoading(true);
            setError('');

            // Preparar datos para envío
            const submitData = {
                ...data,
                // Convertir valores numéricos
                cliente_id: data.cliente_id ? parseInt(data.cliente_id) : null,
                monto_contrato_original: data.monto_contrato_original ? parseFloat(data.monto_contrato_original) : null,
                presupuesto_base: data.presupuesto_base ? parseFloat(data.presupuesto_base) : null,
                itbms: data.itbms ? parseFloat(data.itbms) : null,
                monto_total: data.monto_total ? parseFloat(data.monto_total) : null,
                datos_adicionales: {
                    ...data.datos_adicionales
                }
            };

            // Limpiar campos vacíos
            Object.keys(submitData).forEach(key => {
                if (submitData[key] === '') {
                    submitData[key] = null;
                }
            });

            Object.keys(submitData.datos_adicionales).forEach(key => {
                if (submitData.datos_adicionales[key] === '') {
                    submitData.datos_adicionales[key] = null;
                }
            });

            let response;
            if (projectId) {
                // Editar proyecto existente
                response = await api.put(`/projects/${projectId}`, submitData);
            } else {
                // Crear nuevo proyecto
                response = await api.post('/projects', submitData);
            }

            if (response.data.success) {
                onSave && onSave(response.data.proyecto);
                form.reset();
                onClose();
            } else {
                setError(response.data.message || 'Error al guardar el proyecto');
            }

        } catch (error) {
            console.error('Error guardando proyecto:', error);
            setError(error.response?.data?.message || 'Error de conexión al guardar el proyecto');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(projectId);
            setShowDeleteConfirmation(false);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal Principal */}
            <Dialog open={isOpen && !showDeleteConfirmation} onOpenChange={onClose}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {projectId ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                        </DialogTitle>
                        <DialogDescription>
                            {projectId
                                ? 'Modifica los datos del proyecto existente'
                                : 'Completa los datos para crear un nuevo proyecto'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {/* Loading state */}
                    {loading && !form.getValues('nombre') && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="mt-4 text-sm text-muted-foreground">
                                Cargando datos del proyecto...
                            </p>
                        </div>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Formulario */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        {/* Grid de 2 columnas para campos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Nombre del Proyecto */}
                            <FormField
                                control={form.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Nombre del Proyecto *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Edificio Torre Central"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Nombre Corto */}
                            <FormField
                                control={form.control}
                                name="nombre_corto"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre Corto</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Torre Central"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Cliente */}
                            <FormField
                                control={form.control}
                                name="cliente_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cliente</FormLabel>
                                        <FormControl>
                                            <select
                                                {...field}
                                                disabled={loading || loadingClientes}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="">Seleccionar cliente...</option>
                                                {clientes.map(cliente => (
                                                    <option key={cliente.id} value={cliente.id}>
                                                        {cliente.nombre} {cliente.abreviatura && `(${cliente.abreviatura})`}
                                                    </option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        {loadingClientes && (
                                            <p className="text-xs text-muted-foreground mt-1">Cargando clientes...</p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Contratista */}
                            <FormField
                                control={form.control}
                                name="contratista"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contratista</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Constructora Panama S.A."
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Ingeniero Residente */}
                            <FormField
                                control={form.control}
                                name="ingeniero_residente"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ingeniero Residente</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Ing. Carlos Mendoza"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Estado */}
                            <FormField
                                control={form.control}
                                name="estado"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estado</FormLabel>
                                        <FormControl>
                                            <select
                                                {...field}
                                                disabled={loading}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {estados.map(estado => (
                                                    <option key={estado.value} value={estado.value}>
                                                        {estado.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Fecha de Inicio */}
                            <FormField
                                control={form.control}
                                name="fecha_inicio"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha de Inicio</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Fecha de Terminación */}
                            <FormField
                                control={form.control}
                                name="fecha_fin_estimada"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha de Terminación</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Número de Contrato */}
                            <FormField
                                control={form.control}
                                name="contrato"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número de Contrato</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: CT-2025-001"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Acto Público */}
                            <FormField
                                control={form.control}
                                name="acto_publico"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Acto Público</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: AP-001-2025"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Presupuesto Base */}
                            <FormField
                                control={form.control}
                                name="presupuesto_base"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Presupuesto Base (USD)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="2300000"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* ITBMS */}
                            <FormField
                                control={form.control}
                                name="itbms"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ITBMS (7%)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="161000"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Monto Total */}
                            <FormField
                                control={form.control}
                                name="monto_total"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Monto Total (USD)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="2461000"
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Tipo de Contratista (Pinellas / Consorcio) */}
                        <FormField
                            control={form.control}
                            name="datos_adicionales.es_consorcio"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Contratista</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            value={field.value ? "consorcio" : "pinellas"}
                                            onValueChange={(value) => field.onChange(value === "consorcio")}
                                            disabled={loading}
                                            className="flex gap-4"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="pinellas" id="pinellas" />
                                                <Label htmlFor="pinellas" className="font-normal cursor-pointer">
                                                    Pinellas
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="consorcio" id="consorcio" />
                                                <Label htmlFor="consorcio" className="font-normal cursor-pointer">
                                                    Consorcio
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Sección de Consorcio */}
                        {watchEsConsorcio && (
                            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm">Socios del Consorcio</h4>
                                    {watchSocios.length < 4 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addPartner}
                                            disabled={loading}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Agregar Socio
                                        </Button>
                                    )}
                                </div>

                                {watchSocios.map((socio, index) => (
                                    <div key={index} className="space-y-3 md:space-y-0 md:grid md:grid-cols-[1fr_120px_40px] md:gap-3 md:items-start">
                                        {/* Nombre del Socio */}
                                        <div>
                                            <Label htmlFor={`socio-nombre-${index}`}>
                                                Socio {index + 1} *
                                            </Label>
                                            <Input
                                                id={`socio-nombre-${index}`}
                                                value={socio.nombre}
                                                onChange={(e) => handlePartnerChange(index, 'nombre', e.target.value)}
                                                placeholder="Nombre de la empresa"
                                                disabled={loading || (index === 0 && socio.nombre === 'Pinellas, S.A.')}
                                            />
                                        </div>

                                        {/* Porcentaje y Botón Eliminar en móvil */}
                                        <div className="flex gap-2 items-end md:contents">
                                            <div className="flex-1 md:flex-none">
                                                <Label htmlFor={`socio-porcentaje-${index}`}>
                                                    Porcentaje (%) *
                                                </Label>
                                                <Input
                                                    id={`socio-porcentaje-${index}`}
                                                    type="number"
                                                    value={socio.porcentaje}
                                                    onChange={(e) => handlePartnerChange(index, 'porcentaje', e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    disabled={loading}
                                                />
                                            </div>

                                            {/* Botón Eliminar */}
                                            <div className="flex items-end pb-0.5">
                                                {watchSocios.length > 1 && !(index === 0 && socio.nombre === 'Pinellas, S.A.') ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removePartner(index)}
                                                        disabled={loading}
                                                        className="h-10 w-10 p-0"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                ) : (
                                                    <div className="h-10 w-10" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Total de Porcentajes */}
                                <div className="flex items-center justify-center gap-2 p-3 bg-background rounded-md border">
                                    <span className="font-medium">Total:</span>
                                    <span className="text-lg font-bold">
                                        {watchSocios.reduce((sum, socio) => sum + (socio.porcentaje || 0), 0).toFixed(2)}%
                                    </span>
                                    {Math.abs(watchSocios.reduce((sum, socio) => sum + (socio.porcentaje || 0), 0) - 100) > 0.01 && (
                                        <Alert className="ml-2 p-2 inline-flex items-center border-destructive">
                                            <AlertDescription className="text-xs text-destructive">
                                                ⚠️ Debe sumar 100%
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Observaciones */}
                        <FormField
                            control={form.control}
                            name="datos_adicionales.observaciones"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Observaciones</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Observaciones adicionales del proyecto..."
                                            rows={3}
                                            disabled={loading}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Footer */}
                        <DialogFooter className="gap-2 flex-col sm:flex-row">
                            {projectId && user?.rol === 'admin' && onDelete && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => setShowDeleteConfirmation(true)}
                                    disabled={loading}
                                    className="sm:mr-auto w-full sm:w-auto"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar Proyecto
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={loading}
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {loading
                                    ? (projectId ? 'Actualizando...' : 'Creando...')
                                    : (projectId ? 'Actualizar Proyecto' : 'Crear Proyecto')
                                }
                            </Button>
                        </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmación de Eliminación */}
            <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Eliminar Proyecto
                        </DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="font-semibold">
                            ¿Estás seguro de que quieres eliminar este proyecto?
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Se eliminarán todos los datos del proyecto, incluyendo:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Toda la información del proyecto</li>
                            <li>Adendas asociadas</li>
                            <li>Reportes y seguimiento</li>
                        </ul>
                        <Alert>
                            <AlertDescription>
                                <strong>Proyecto:</strong> {form.getValues('nombre') || 'Sin nombre'}
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowDeleteConfirmation(false)}
                            disabled={loading}
                            className="w-full sm:w-auto"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={loading}
                            className="w-full sm:w-auto"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sí, Eliminar Proyecto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ProjectFormNew;
