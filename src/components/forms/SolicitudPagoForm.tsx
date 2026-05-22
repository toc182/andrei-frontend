/**
 * SolicitudPagoForm Component
 * Modal form for creating and editing solicitudes de pago
 * Sections: Datos principales, Items dinámicos, ITBMS, Ajustes, Datos bancarios
 */

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MinusCircle,
  PlusCircle,
  Paperclip,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { formatMoney } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

// --- Types ---

type EstadoSolicitud =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada'
  | 'pagada'
  | 'facturada';

interface SolicitudPago {
  id: number;
  proyecto_id: number | null;
  numero: string;
  fecha: string;
  proveedor: string;
  preparado_por: number;
  solicitado_por: number | null;
  requisicion_id: number | null;
  subtotal: number;
  descuentos: number;
  impuestos: number;
  monto_total: number;
  estado: EstadoSolicitud;
  observaciones: string | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  urgente: boolean;
  pinellas_paga?: boolean;
  mensaje?: string | null;
}

interface SolicitudItem {
  id?: number;
  cantidad: number;
  unidad: string;
  descripcion: string;
  descripcion_detallada: string | null;
  precio_unitario: number;
  precio_total: number;
}

interface SolicitudAjuste {
  id?: number;
  tipo: string;
  descripcion: string;
  porcentaje: number | null;
  monto: number;
}

interface MemberOption {
  id: number;
  nombre: string;
  tipo_usuario: string | null;
}

interface RequisicionOption {
  id: number;
  numero: string;
}

interface ItemFormData {
  descripcion: string;
  descripcion_detallada: string;
  cantidad: string;
  unidad: string;
  precio_unitario: string;
  expanded: boolean;
}

interface AjusteFormData {
  tipo: 'aumento' | 'disminucion';
  descripcion: string;
  monto: string;
}

interface SolicitudPagoFormProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingSolicitud?: SolicitudPago | null;
  existingItems?: SolicitudItem[];
  existingAjustes?: SolicitudAjuste[];
}

const emptyItem: ItemFormData = {
  descripcion: '',
  descripcion_detallada: '',
  cantidad: '1',
  unidad: 'unidad',
  precio_unitario: '',
  expanded: false,
};

const emptyAjuste: AjusteFormData = {
  tipo: 'disminucion',
  descripcion: '',
  monto: '',
};

// Zod schema — single source of truth for scalar-field validation.
const solicitudFormSchema = z.object({
  proveedor: z.string().trim().min(1, 'El proveedor es requerido'),
  fecha: z.string().min(1, 'La fecha es requerida'),
  solicitado_por: z.string().refine((v) => v && v !== 'none', {
    message: 'Debes seleccionar quién está solicitando el pago',
  }),
  observaciones: z.string(),
  urgente: z.boolean(),
  pinellas_paga: z.boolean(),
  beneficiario: z.string(),
  banco: z.string(),
  tipo_cuenta: z.string(),
  numero_cuenta: z.string(),
  mensaje: z.string().max(1000, 'Máximo 1000 caracteres'),
});

type SolicitudFormData = z.infer<typeof solicitudFormSchema>;

const todayDate = (): string => new Date().toISOString().split('T')[0];

const defaultFormValues = (userId?: number): SolicitudFormData => ({
  proveedor: '',
  fecha: todayDate(),
  solicitado_por: userId?.toString() ?? 'none',
  observaciones: '',
  urgente: false,
  pinellas_paga: false,
  beneficiario: '',
  banco: '',
  tipo_cuenta: 'none',
  numero_cuenta: '',
  mensaje: '',
});

export default function SolicitudPagoForm({
  projectId,
  isOpen,
  onClose,
  onSave,
  editingSolicitud,
  existingItems = [],
  existingAjustes = [],
}: SolicitudPagoFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const adjuntoFormRef = useRef<HTMLInputElement>(null);

  // Dynamic items & ajustes — stay as plain state (intermixed UI/data state,
  // no useFieldArray precedent in the codebase).
  const [items, setItems] = useState<ItemFormData[]>([{ ...emptyItem }]);
  const [itbmsActivo, setItbmsActivo] = useState(true);
  const [ajustes, setAjustes] = useState<AjusteFormData[]>([]);

  // Options
  const [miembrosProyecto, setMiembrosProyecto] = useState<MemberOption[]>([]);
  const [, setRequisiciones] = useState<RequisicionOption[]>([]);
  const [nextNumero, setNextNumero] = useState<string>('');

  // Form (react-hook-form + Zod)
  const form = useForm<SolicitudFormData>({
    resolver: zodResolver(solicitudFormSchema),
    defaultValues: defaultFormValues(user?.id),
  });

  // Load options when modal opens
  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  // Populate form when editing or reset for new
  useEffect(() => {
    if (!isOpen) return;

    if (editingSolicitud) {
      form.reset({
        proveedor: editingSolicitud.proveedor ?? '',
        fecha: editingSolicitud.fecha
          ? editingSolicitud.fecha.split('T')[0]
          : '',
        solicitado_por:
          editingSolicitud.solicitado_por?.toString() ?? 'none',
        observaciones: editingSolicitud.observaciones ?? '',
        urgente: !!editingSolicitud.urgente,
        pinellas_paga: !!editingSolicitud.pinellas_paga,
        beneficiario: editingSolicitud.beneficiario ?? '',
        banco: editingSolicitud.banco ?? '',
        tipo_cuenta: editingSolicitud.tipo_cuenta ?? 'none',
        numero_cuenta: editingSolicitud.numero_cuenta ?? '',
        mensaje: editingSolicitud.mensaje ?? '',
      });

      if (existingItems.length > 0) {
        setItems(
          existingItems.map((item) => ({
            descripcion: item.descripcion || '',
            descripcion_detallada: item.descripcion_detallada || '',
            cantidad: item.cantidad?.toString() || '1',
            unidad: item.unidad || 'unidad',
            precio_unitario: item.precio_unitario?.toString() || '',
            expanded: false,
          })),
        );
      } else {
        setItems([{ ...emptyItem }]);
      }

      // Separar ITBMS de ajustes normales
      const itbmsAjuste = existingAjustes.find(
        (a) => a.tipo === 'impuesto' && a.porcentaje === 7,
      );
      setItbmsActivo(!!itbmsAjuste);
      const otrosAjustes = existingAjustes.filter((a) => a !== itbmsAjuste);
      if (otrosAjustes.length > 0) {
        setAjustes(
          otrosAjustes.map((a) => ({
            tipo: (a.tipo === 'impuesto' ? 'aumento' : 'disminucion') as
              | 'aumento'
              | 'disminucion',
            descripcion: a.descripcion || '',
            monto: a.monto?.toString() || '',
          })),
        );
      } else {
        setAjustes([]);
      }
    } else {
      // New solicitud
      form.reset(defaultFormValues(user?.id));
      setItems([{ ...emptyItem }]);
      setItbmsActivo(true);
      setAjustes([]);
      setPendingFiles([]);
    }
    setError(null);
    setItemsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSolicitud, isOpen, user]);

  const loadOptions = async () => {
    try {
      const [membersRes, reqRes, numRes] = await Promise.all([
        api.get(`/project-members/project/${projectId}`),
        api.get(`/requisiciones/project/${projectId}`),
        editingSolicitud
          ? Promise.resolve(null)
          : api.get(`/solicitudes-pago/project/${projectId}/next-number`),
      ]);

      if (membersRes.data.success) {
        setMiembrosProyecto(
          (membersRes.data.members || [])
            .filter((m: { user_id?: number }) => m.user_id)
            .map(
              (m: {
                user_id: number;
                nombre_display: string;
                tipo_usuario?: string | null;
              }) => ({
                id: m.user_id,
                nombre: m.nombre_display,
                tipo_usuario: m.tipo_usuario || null,
              }),
            ),
        );
      }
      if (reqRes.data.success) {
        setRequisiciones(
          (reqRes.data.requisiciones || []).map(
            (r: { id: number; numero: string }) => ({
              id: r.id,
              numero: r.numero,
            }),
          ),
        );
      }
      if (numRes?.data?.success) {
        setNextNumero(numRes.data.numero);
      }
    } catch (err) {
      console.error('Error loading options:', err);
    }
  };

  // Calculations
  const calculateItemTotal = (item: ItemFormData) => {
    const cantidad = parseFloat(item.cantidad) || 0;
    const precioUnitario = parseFloat(item.precio_unitario) || 0;
    return cantidad * precioUnitario;
  };

  const subtotal = items.reduce(
    (sum, item) => sum + calculateItemTotal(item),
    0,
  );

  const itbmsMonto = itbmsActivo ? subtotal * 0.07 : 0;

  const totalAumentos = ajustes
    .filter((a) => a.tipo === 'aumento')
    .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);

  const totalDisminuciones = ajustes
    .filter((a) => a.tipo === 'disminucion')
    .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);

  const montoTotal = subtotal + itbmsMonto + totalAumentos - totalDisminuciones;

  // Item handlers
  const handleItemChange = (
    index: number,
    field: keyof ItemFormData,
    value: string | boolean,
  ) => {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Ajuste handlers
  const handleAjusteChange = (
    index: number,
    field: keyof AjusteFormData,
    value: string,
  ) => {
    setAjustes((prev) => {
      const newAjustes = [...prev];
      newAjustes[index] = { ...newAjustes[index], [field]: value };
      return newAjustes;
    });
  };

  const toggleAjusteTipo = (index: number) => {
    setAjustes((prev) => {
      const newAjustes = [...prev];
      newAjustes[index] = {
        ...newAjustes[index],
        tipo: newAjustes[index].tipo === 'aumento' ? 'disminucion' : 'aumento',
      };
      return newAjustes;
    });
  };

  const addAjuste = () => setAjustes((prev) => [...prev, { ...emptyAjuste }]);

  const removeAjuste = (index: number) => {
    setAjustes((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit — react-hook-form invokes onSubmit only after Zod validation passes.
  const onSubmit = async (data: SolicitudFormData) => {
    // Items validation lives outside Zod since items[] is plain state.
    const validItems = items.filter(
      (i) => i.descripcion.trim() && parseFloat(i.precio_unitario) > 0,
    );
    if (validItems.length === 0) {
      setItemsError('Debe incluir al menos un item con descripción y precio');
      return;
    }
    setItemsError(null);
    setError(null);
    setLoading(true);

    try {
      const payload = {
        proyecto_id: projectId,
        fecha: data.fecha,
        proveedor: data.proveedor.trim(),
        solicitado_por:
          data.solicitado_por && data.solicitado_por !== 'none'
            ? parseInt(data.solicitado_por, 10)
            : null,
        requisicion_id: null,
        observaciones: data.observaciones.trim() || null,
        urgente: data.urgente,
        pinellas_paga: data.pinellas_paga,
        beneficiario: data.beneficiario.trim() || null,
        banco: data.banco.trim() || null,
        tipo_cuenta:
          data.tipo_cuenta && data.tipo_cuenta !== 'none'
            ? data.tipo_cuenta
            : null,
        numero_cuenta: data.numero_cuenta.trim() || null,
        items: validItems.map((item) => ({
          cantidad: parseFloat(item.cantidad) || 1,
          unidad: item.unidad || 'unidad',
          descripcion: item.descripcion.trim(),
          descripcion_detallada: item.descripcion_detallada.trim() || null,
          precio_unitario: parseFloat(item.precio_unitario),
        })),
        ajustes: [
          // ITBMS como ajuste de tipo impuesto
          ...(itbmsActivo
            ? [
                {
                  tipo: 'impuesto',
                  descripcion: 'ITBMS 7%',
                  porcentaje: 7,
                  monto: subtotal * 0.07,
                },
              ]
            : []),
          // Ajustes normales (mapear a tipos de DB: aumento→impuesto, disminucion→descuento)
          ...ajustes
            .filter((a) => a.descripcion.trim() && parseFloat(a.monto) > 0)
            .map((a) => ({
              tipo: a.tipo === 'aumento' ? 'impuesto' : 'descuento',
              descripcion: a.descripcion.trim(),
              porcentaje: null,
              monto: parseFloat(a.monto),
            })),
        ],
      };

      if (editingSolicitud) {
        await api.put(`/solicitudes-pago/${editingSolicitud.id}`, payload);

        // PUT general no acepta mensaje. Enviar aparte solo si cambió.
        const mensajeTrim = data.mensaje.trim();
        const previo = (editingSolicitud.mensaje ?? '').trim();
        if (mensajeTrim !== previo) {
          await api.put(`/solicitudes-pago/${editingSolicitud.id}/mensaje`, {
            mensaje: mensajeTrim || null,
          });
        }
      } else {
        const createRes = await api.post('/solicitudes-pago', {
          ...payload,
          mensaje: data.mensaje.trim() || null,
        });

        // Upload pending files if any
        if (pendingFiles.length > 0 && createRes.data.solicitud?.id) {
          try {
            const formData = new FormData();
            pendingFiles.forEach((f) => formData.append('archivos', f));
            await api.post(
              `/solicitudes-pago/${createRes.data.solicitud.id}/adjuntos`,
              formData,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
              },
            );
          } catch (uploadErr) {
            console.error('Error uploading adjuntos:', uploadErr);
          }
        }
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving solicitud:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message ||
          'Error al guardar la solicitud de pago',
      );
    } finally {
      setLoading(false);
    }
  };

  const isSubmitting = form.formState.isSubmitting || loading;

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={onClose}
      size="complex"
      title={
        editingSolicitud
          ? `Editar ${editingSolicitud.numero}`
          : `Nueva Solicitud de Pago${nextNumero ? ` (${nextNumero})` : ''}`
      }
      description="Registra una nueva solicitud de pago"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="solicitud-pago-form"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Guardando...'
              : editingSolicitud
                ? 'Actualizar'
                : 'Crear Solicitud'}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id="solicitud-pago-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
        >
          {error && <Alert variant="error" title={error} className="mb-1" />}

          {/* Section 1: Datos principales */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Datos Principales
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="proveedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Proveedor *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del proveedor"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Fecha *</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="solicitado_por"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Solicitado por</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar</SelectItem>
                        {miembrosProyecto
                          .filter(
                            (m) =>
                              m.tipo_usuario === 'interno' || !m.tipo_usuario,
                          )
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id.toString()}>
                              {m.nombre}
                            </SelectItem>
                          ))}
                        {miembrosProyecto.some(
                          (m) => m.tipo_usuario === 'externo',
                        ) &&
                          miembrosProyecto.some(
                            (m) =>
                              m.tipo_usuario === 'interno' || !m.tipo_usuario,
                          ) && <div className="my-1 h-px bg-border" />}
                        {miembrosProyecto
                          .filter((m) => m.tipo_usuario === 'externo')
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id.toString()}>
                              {m.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Requisicion vinculada — oculto temporalmente; siempre se envia null. */}
            </div>

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="urgente"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-sm text-muted-foreground">
                          Marcar como urgente
                        </span>
                      </label>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pinellas_paga"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-sm text-muted-foreground">
                          Pinellas paga — pendiente de reembolso
                        </span>
                      </label>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section 2: Items */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Items
            </h3>

            {itemsError && (
              <p className="text-sm font-medium text-destructive">
                {itemsError}
              </p>
            )}

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Descripcion</span>
              <span>Cant.</span>
              <span>Unidad</span>
              <span>P. Unit. (B/.)</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>

            {/* Items Rows */}
            <div className="space-y-2">
              {items.map((item, index) => {
                const itemTotal = calculateItemTotal(item);
                return (
                  <div key={index} className="space-y-1">
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-2 p-3 border rounded-lg">
                      <Input
                        placeholder="Descripcion del item"
                        value={item.descripcion}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleItemChange(index, 'descripcion', e.target.value)
                        }
                        className="h-9"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Cant.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.cantidad}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              handleItemChange(
                                index,
                                'cantidad',
                                e.target.value,
                              )
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unidad</Label>
                          <Select
                            value={item.unidad}
                            onValueChange={(v) =>
                              handleItemChange(index, 'unidad', v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unidad">Und</SelectItem>
                              <SelectItem value="metro">Metro</SelectItem>
                              <SelectItem value="m2">M2</SelectItem>
                              <SelectItem value="m3">M3</SelectItem>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="galon">Galon</SelectItem>
                              <SelectItem value="global">Global</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">P. Unit.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.precio_unitario}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              handleItemChange(
                                index,
                                'precio_unitario',
                                e.target.value,
                              )
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() =>
                              handleItemChange(
                                index,
                                'expanded',
                                !item.expanded,
                              )
                            }
                          >
                            {item.expanded ? (
                              <ChevronDown className="h-3 w-3 mr-1" />
                            ) : (
                              <ChevronRight className="h-3 w-3 mr-1" />
                            )}
                            Detalle
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(index)}
                            disabled={items.length === 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-medium">
                          {formatMoney(itemTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-6 p-0 shrink-0"
                          onClick={() =>
                            handleItemChange(index, 'expanded', !item.expanded)
                          }
                          title="Descripcion detallada"
                        >
                          {item.expanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                        <Input
                          placeholder="Descripcion del item"
                          value={item.descripcion}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleItemChange(
                              index,
                              'descripcion',
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cantidad}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleItemChange(index, 'cantidad', e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                      <Select
                        value={item.unidad}
                        onValueChange={(v) =>
                          handleItemChange(index, 'unidad', v)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unidad">Und</SelectItem>
                          <SelectItem value="metro">Metro</SelectItem>
                          <SelectItem value="m2">M2</SelectItem>
                          <SelectItem value="m3">M3</SelectItem>
                          <SelectItem value="kg">Kg</SelectItem>
                          <SelectItem value="galon">Galon</SelectItem>
                          <SelectItem value="global">Global</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.precio_unitario}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleItemChange(
                            index,
                            'precio_unitario',
                            e.target.value,
                          )
                        }
                        className="h-8 text-sm"
                      />
                      <div className="text-sm text-right font-medium">
                        {formatMoney(itemTotal)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Expanded: descripcion detallada */}
                    {item.expanded && (
                      <div className="sm:pl-8 sm:pr-10">
                        <Textarea
                          placeholder="Descripcion detallada del item..."
                          rows={2}
                          value={item.descripcion_detallada}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'descripcion_detallada',
                              e.target.value,
                            )
                          }
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary rows — desktop: same grid as items */}
            <div className="hidden sm:block border-t pt-2 mt-2 space-y-1">
              {/* Agregar Item + Subtotal */}
              <div className="grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar Item
                  </Button>
                </div>
                <div></div>
                <div></div>
                <div className="text-sm text-muted-foreground text-right">
                  Subtotal:
                </div>
                <div className="text-sm font-medium text-right">
                  {formatMoney(subtotal)}
                </div>
                <div></div>
              </div>
              {/* ITBMS */}
              <div className="grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
                <div></div>
                <div></div>
                <div></div>
                <div className="text-sm text-muted-foreground text-right flex items-center justify-end gap-1">
                  {itbmsActivo ? (
                    <MinusCircle
                      className="h-4 w-4 text-error cursor-pointer shrink-0"
                      onClick={() => setItbmsActivo(false)}
                    />
                  ) : (
                    <PlusCircle
                      className="h-4 w-4 text-success cursor-pointer shrink-0"
                      onClick={() => setItbmsActivo(true)}
                    />
                  )}
                  <span
                    className={itbmsActivo ? '' : 'text-muted-foreground/50'}
                  >
                    ITBMS (7%):
                  </span>
                </div>
                <div
                  className={`text-sm font-medium text-right ${itbmsActivo ? '' : 'text-muted-foreground/50'}`}
                >
                  {itbmsActivo ? formatMoney(itbmsMonto) : '—'}
                </div>
                <div></div>
              </div>
              {/* Total */}
              <div className="grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center border-t pt-1">
                <div></div>
                <div></div>
                <div></div>
                <div className="text-base font-bold text-right">TOTAL:</div>
                <div className="text-base font-bold text-right">
                  {formatMoney(montoTotal)}
                </div>
                <div></div>
              </div>
            </div>

            {/* Summary rows — mobile */}
            <div className="sm:hidden border-t pt-2 mt-2 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Agregar Item
              </Button>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  {itbmsActivo ? (
                    <MinusCircle
                      className="h-4 w-4 text-error cursor-pointer shrink-0"
                      onClick={() => setItbmsActivo(false)}
                    />
                  ) : (
                    <PlusCircle
                      className="h-4 w-4 text-success cursor-pointer shrink-0"
                      onClick={() => setItbmsActivo(true)}
                    />
                  )}
                  <span
                    className={itbmsActivo ? '' : 'text-muted-foreground/50'}
                  >
                    ITBMS (7%):
                  </span>
                </span>
                <span
                  className={`font-medium ${itbmsActivo ? '' : 'text-muted-foreground/50'}`}
                >
                  {itbmsActivo ? formatMoney(itbmsMonto) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-1">
                <span>TOTAL:</span>
                <span>{formatMoney(montoTotal)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Ajustes */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ajustes
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAjuste}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Agregar Ajuste
              </Button>
            </div>

            {ajustes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ajustes.</p>
            ) : (
              <div className="space-y-2">
                {ajustes.map((ajuste, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`h-8 w-8 p-0 shrink-0 font-bold text-base ${ajuste.tipo === 'aumento' ? 'text-success border-success/30' : 'text-error border-error/30'}`}
                      onClick={() => toggleAjusteTipo(index)}
                      title={
                        ajuste.tipo === 'aumento'
                          ? 'Aumento (click para cambiar)'
                          : 'Disminucion (click para cambiar)'
                      }
                    >
                      {ajuste.tipo === 'aumento' ? '+' : '-'}
                    </Button>
                    <Input
                      placeholder="Descripcion del ajuste"
                      value={ajuste.descripcion}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleAjusteChange(index, 'descripcion', e.target.value)
                      }
                      className="h-8 text-sm flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={ajuste.monto}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleAjusteChange(index, 'monto', e.target.value)
                      }
                      className="h-8 text-sm w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAjuste(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Datos bancarios */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Datos Bancarios
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="beneficiario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Beneficiario</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del beneficiario"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="banco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Banco</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del banco"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo_cuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tipo de Cuenta</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar</SelectItem>
                        <SelectItem value="ahorro">Ahorro</SelectItem>
                        <SelectItem value="corriente">Corriente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numero_cuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Numero de Cuenta</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Numero de cuenta"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section 5: Adjuntos (solo creacion) */}
          {!editingSolicitud && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> Adjuntos
              </h3>
              <div>
                <input
                  ref={adjuntoFormRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setPendingFiles((prev) => [
                        ...prev,
                        ...Array.from(e.target.files!),
                      ]);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjuntoFormRef.current?.click()}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar Adjuntos
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                  PDF, JPG o PNG. Max 10MB por archivo.
                </span>
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-1">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded text-sm"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setPendingFiles((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <FormField
            control={form.control}
            name="mensaje"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Mensaje (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Mensaje corto visible en la lista..."
                    rows={2}
                    maxLength={1000}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </AppDialog>
  );
}
