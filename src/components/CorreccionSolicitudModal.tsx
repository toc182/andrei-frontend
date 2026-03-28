import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import api from '@/services/api';
import { Plus, Trash2, Upload, Loader2, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SolicitudData {
  id: number;
  estado: string;
  proveedor: string;
  fecha: string;
  observaciones: string | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  updated_at: string;
}

interface ItemData {
  id: number;
  descripcion: string;
  descripcion_detallada: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  precio_total: number;
}

interface AjusteData {
  tipo: string;
  descripcion: string;
  porcentaje: number | null;
  monto: number;
}

interface ComprobanteData {
  fecha_pago: string;
}

interface FacturaData {
  fecha_factura: string;
  numero_factura: string | null;
  tipo: string;
}

interface CorreccionSolicitudModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  solicitud: SolicitudData;
  items: ItemData[];
  ajustes: AjusteData[];
  comprobante?: ComprobanteData | null;
  factura?: FacturaData | null;
}

// ---------------------------------------------------------------------------
// Editable item type (local state uses a temp key for new rows)
// ---------------------------------------------------------------------------

interface EditableItem {
  _key: number; // stable key for React list
  id: number | null;
  descripcion: string;
  descripcion_detallada: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
}

interface EditableAjuste {
  _key: number;
  tipo: string;
  descripcion: string;
  porcentaje: number | null;
  monto: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let keyCounter = 0;
function nextKey() {
  return ++keyCounter;
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CorreccionSolicitudModal({
  open,
  onClose,
  onSuccess,
  solicitud,
  items,
  ajustes,
  comprobante,
  factura,
}: CorreccionSolicitudModalProps) {
  // --- motivo ---
  const [motivo, setMotivo] = useState('');

  // --- datos principales ---
  const [proveedor, setProveedor] = useState(solicitud.proveedor);
  const [fecha, setFecha] = useState(solicitud.fecha?.slice(0, 10) ?? '');
  const [observaciones, setObservaciones] = useState(
    solicitud.observaciones ?? '',
  );

  // --- datos bancarios ---
  const [beneficiario, setBeneficiario] = useState(
    solicitud.beneficiario ?? '',
  );
  const [banco, setBanco] = useState(solicitud.banco ?? '');
  const [tipoCuenta, setTipoCuenta] = useState(solicitud.tipo_cuenta ?? '');
  const [numeroCuenta, setNumeroCuenta] = useState(
    solicitud.numero_cuenta ?? '',
  );

  // --- items ---
  const [editItems, setEditItems] = useState<EditableItem[]>(() =>
    items.map((it) => ({
      _key: nextKey(),
      id: it.id,
      descripcion: it.descripcion,
      descripcion_detallada: it.descripcion_detallada,
      cantidad: it.cantidad,
      unidad: it.unidad,
      precio_unitario: it.precio_unitario,
    })),
  );

  // --- ajustes ---
  const [editAjustes, setEditAjustes] = useState<EditableAjuste[]>(() =>
    ajustes.map((a) => ({
      _key: nextKey(),
      tipo: a.tipo,
      descripcion: a.descripcion,
      porcentaje: a.porcentaje,
      monto: a.monto,
    })),
  );

  // --- comprobante ---
  const [fechaPago, setFechaPago] = useState(
    comprobante?.fecha_pago?.slice(0, 10) ?? '',
  );
  const [archivosComprobante, setArchivosComprobante] = useState<File[]>([]);
  const comprobanteInputRef = useRef<HTMLInputElement>(null);

  // --- factura ---
  const [fechaFactura, setFechaFactura] = useState(
    factura?.fecha_factura?.slice(0, 10) ?? '',
  );
  const [numeroFactura, setNumeroFactura] = useState(
    factura?.numero_factura ?? '',
  );
  const [tipoFactura, setTipoFactura] = useState(factura?.tipo ?? '');
  const [archivosFactura, setArchivosFactura] = useState<File[]>([]);
  const facturaInputRef = useRef<HTMLInputElement>(null);

  // --- UI state ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Computed totals
  // ---------------------------------------------------------------------------

  const subtotal = useMemo(
    () =>
      editItems.reduce(
        (sum, it) => sum + (it.cantidad || 0) * (it.precio_unitario || 0),
        0,
      ),
    [editItems],
  );

  const ajustesTotal = useMemo(
    () => editAjustes.reduce((sum, a) => sum + (a.monto || 0), 0),
    [editAjustes],
  );

  const total = subtotal + ajustesTotal;

  // ---------------------------------------------------------------------------
  // Change detection
  // ---------------------------------------------------------------------------

  const hasChanges = useMemo(() => {
    if (proveedor !== solicitud.proveedor) return true;
    if (fecha !== (solicitud.fecha?.slice(0, 10) ?? '')) return true;
    if (observaciones !== (solicitud.observaciones ?? '')) return true;
    if (beneficiario !== (solicitud.beneficiario ?? '')) return true;
    if (banco !== (solicitud.banco ?? '')) return true;
    if (tipoCuenta !== (solicitud.tipo_cuenta ?? '')) return true;
    if (numeroCuenta !== (solicitud.numero_cuenta ?? '')) return true;

    // items changed?
    if (editItems.length !== items.length) return true;
    for (let i = 0; i < editItems.length; i++) {
      const e = editItems[i];
      const o = items[i];
      if (
        e.descripcion !== o.descripcion ||
        e.cantidad !== o.cantidad ||
        e.unidad !== o.unidad ||
        e.precio_unitario !== o.precio_unitario
      )
        return true;
    }

    // ajustes changed?
    if (editAjustes.length !== ajustes.length) return true;
    for (let i = 0; i < editAjustes.length; i++) {
      const e = editAjustes[i];
      const o = ajustes[i];
      if (
        e.tipo !== o.tipo ||
        e.descripcion !== o.descripcion ||
        e.monto !== o.monto
      )
        return true;
    }

    // comprobante
    if (comprobante && fechaPago !== (comprobante.fecha_pago?.slice(0, 10) ?? ''))
      return true;
    if (archivosComprobante.length > 0) return true;

    // factura
    if (factura) {
      if (fechaFactura !== (factura.fecha_factura?.slice(0, 10) ?? ''))
        return true;
      if (numeroFactura !== (factura.numero_factura ?? '')) return true;
      if (tipoFactura !== (factura.tipo ?? '')) return true;
    }
    if (archivosFactura.length > 0) return true;

    return false;
  }, [
    proveedor,
    fecha,
    observaciones,
    beneficiario,
    banco,
    tipoCuenta,
    numeroCuenta,
    editItems,
    editAjustes,
    fechaPago,
    archivosComprobante,
    fechaFactura,
    numeroFactura,
    tipoFactura,
    archivosFactura,
    solicitud,
    items,
    ajustes,
    comprobante,
    factura,
  ]);

  const canSave = motivo.trim().length > 0 && hasChanges && !saving;

  // ---------------------------------------------------------------------------
  // Item helpers
  // ---------------------------------------------------------------------------

  const addItem = useCallback(() => {
    setEditItems((prev) => [
      ...prev,
      {
        _key: nextKey(),
        id: null,
        descripcion: '',
        descripcion_detallada: null,
        cantidad: 1,
        unidad: 'und',
        precio_unitario: 0,
      },
    ]);
  }, []);

  const removeItem = useCallback((key: number) => {
    setEditItems((prev) => prev.filter((it) => it._key !== key));
  }, []);

  const updateItem = useCallback(
    (key: number, field: keyof EditableItem, value: string | number) => {
      setEditItems((prev) =>
        prev.map((it) => (it._key === key ? { ...it, [field]: value } : it)),
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Ajuste helpers
  // ---------------------------------------------------------------------------

  const addAjuste = useCallback(() => {
    setEditAjustes((prev) => [
      ...prev,
      {
        _key: nextKey(),
        tipo: 'impuesto',
        descripcion: '',
        porcentaje: null,
        monto: 0,
      },
    ]);
  }, []);

  const removeAjuste = useCallback((key: number) => {
    setEditAjustes((prev) => prev.filter((a) => a._key !== key));
  }, []);

  const updateAjuste = useCallback(
    (
      key: number,
      field: keyof EditableAjuste,
      value: string | number | null,
    ) => {
      setEditAjustes((prev) =>
        prev.map((a) => (a._key === key ? { ...a, [field]: value } : a)),
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    setError('');
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append('motivo', motivo.trim());
      fd.append('updated_at', solicitud.updated_at);

      // Solicitud fields
      fd.append('proveedor', proveedor);
      fd.append('fecha', fecha);
      fd.append('observaciones', observaciones);
      fd.append('beneficiario', beneficiario);
      fd.append('banco', banco);
      fd.append('tipo_cuenta', tipoCuenta);
      fd.append('numero_cuenta', numeroCuenta);

      // Items
      fd.append(
        'items',
        JSON.stringify(
          editItems.map((it) => ({
            id: it.id,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            unidad: it.unidad,
            precio_unitario: it.precio_unitario,
          })),
        ),
      );

      // Ajustes
      fd.append(
        'ajustes',
        JSON.stringify(
          editAjustes.map((a) => ({
            tipo: a.tipo,
            descripcion: a.descripcion,
            porcentaje: a.porcentaje,
            monto: a.monto,
          })),
        ),
      );

      // Comprobante
      if (comprobante) {
        fd.append('fecha_pago', fechaPago);
      }
      for (const f of archivosComprobante) {
        fd.append('archivos_comprobante', f);
      }

      // Factura
      if (factura) {
        fd.append('fecha_factura', fechaFactura);
        fd.append('numero_factura', numeroFactura);
        fd.append('tipo', tipoFactura);
      }
      for (const f of archivosFactura) {
        fd.append('archivos_factura', f);
      }

      await api.post(`/solicitudes-pago/${solicitud.id}/corregir`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string } };
      };
      setError(
        axiosErr.response?.data?.error ||
          'Error al guardar la corrección. Intente nuevamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corregir Solicitud #{solicitud.id}</DialogTitle>
          <DialogDescription>
            Modifique los campos necesarios e indique el motivo de la
            corrección.
          </DialogDescription>
        </DialogHeader>

        {/* ---- Motivo ---- */}
        <div className="space-y-2">
          <Label htmlFor="correccion-motivo" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Motivo de la corrección *
          </Label>
          <Textarea
            id="correccion-motivo"
            placeholder="Explique por qué se realiza esta corrección..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <Separator />

        {/* ---- Datos principales ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Datos principales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="corr-proveedor">Proveedor</Label>
              <Input
                id="corr-proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="corr-fecha">Fecha</Label>
              <Input
                id="corr-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="corr-observaciones">Observaciones</Label>
            <Textarea
              id="corr-observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* ---- Datos bancarios ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Datos bancarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="corr-beneficiario">Beneficiario</Label>
              <Input
                id="corr-beneficiario"
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="corr-banco">Banco</Label>
              <Input
                id="corr-banco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="corr-tipo-cuenta">Tipo de cuenta</Label>
              <Select value={tipoCuenta} onValueChange={setTipoCuenta}>
                <SelectTrigger id="corr-tipo-cuenta">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corriente">Corriente</SelectItem>
                  <SelectItem value="ahorros">Ahorros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="corr-numero-cuenta">Número de cuenta</Label>
              <Input
                id="corr-numero-cuenta"
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ---- Items ---- */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>

          {editItems.map((item) => (
            <div
              key={item._key}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-2 space-y-1">
                  <Label>Descripción</Label>
                  <Input
                    value={item.descripcion}
                    onChange={(e) =>
                      updateItem(item._key, 'descripcion', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.cantidad}
                    onChange={(e) =>
                      updateItem(
                        item._key,
                        'cantidad',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unidad</Label>
                  <Input
                    value={item.unidad}
                    onChange={(e) =>
                      updateItem(item._key, 'unidad', e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div className="space-y-1">
                  <Label>Precio unitario</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.precio_unitario}
                    onChange={(e) =>
                      updateItem(
                        item._key,
                        'precio_unitario',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Total</Label>
                  <p className="text-sm font-medium py-2">
                    ${formatCurrency(item.cantidad * item.precio_unitario)}
                  </p>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeItem(item._key)}
                    disabled={editItems.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="text-right text-sm">
            Subtotal: <span className="font-semibold">${formatCurrency(subtotal)}</span>
          </div>
        </div>

        <Separator />

        {/* ---- Ajustes ---- */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ajustes</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAjuste}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>

          {editAjustes.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin ajustes</p>
          )}

          {editAjustes.map((ajuste) => (
            <div
              key={ajuste._key}
              className="rounded-md border p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end"
            >
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={ajuste.tipo}
                  onValueChange={(v) => updateAjuste(ajuste._key, 'tipo', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="impuesto">Impuesto</SelectItem>
                    <SelectItem value="descuento">Descuento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Descripción</Label>
                <Input
                  value={ajuste.descripcion}
                  onChange={(e) =>
                    updateAjuste(ajuste._key, 'descripcion', e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="any"
                  value={ajuste.monto}
                  onChange={(e) =>
                    updateAjuste(
                      ajuste._key,
                      'monto',
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeAjuste(ajuste._key)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
              </div>
            </div>
          ))}

          {editAjustes.length > 0 && (
            <div className="text-right text-sm">
              Ajustes:{' '}
              <span className="font-semibold">${formatCurrency(ajustesTotal)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Total ---- */}
        <div className="text-right font-semibold">
          Total: ${formatCurrency(total)}
        </div>

        <Separator />

        {/* ---- Comprobante ---- */}
        {comprobante && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Comprobante</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="corr-fecha-pago">Fecha de pago</Label>
                  <Input
                    id="corr-fecha-pago"
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Reemplazar archivos</Label>
                  <input
                    ref={comprobanteInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setArchivosComprobante(Array.from(e.target.files));
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => comprobanteInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {archivosComprobante.length > 0
                      ? `${archivosComprobante.length} archivo(s) seleccionado(s)`
                      : 'Seleccionar archivos'}
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* ---- Factura ---- */}
        {factura && solicitud.estado === 'facturada' && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Factura</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="corr-fecha-factura">Fecha de factura</Label>
                  <Input
                    id="corr-fecha-factura"
                    type="date"
                    value={fechaFactura}
                    onChange={(e) => setFechaFactura(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="corr-numero-factura">Número de factura</Label>
                  <Input
                    id="corr-numero-factura"
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="corr-tipo-factura">Tipo</Label>
                  <Select value={tipoFactura} onValueChange={setTipoFactura}>
                    <SelectTrigger id="corr-tipo-factura">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                      <SelectItem value="no_fiscal">No fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reemplazar archivos de factura</Label>
                <input
                  ref={facturaInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setArchivosFactura(Array.from(e.target.files));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto"
                  onClick={() => facturaInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {archivosFactura.length > 0
                    ? `${archivosFactura.length} archivo(s) seleccionado(s)`
                    : 'Seleccionar archivos'}
                </Button>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* ---- Error ---- */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}

        {/* ---- Actions ---- */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSubmit}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar corrección
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
