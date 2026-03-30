import { useState, useEffect, useRef, ChangeEvent } from 'react';
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
import { Plus, Trash2, Upload, AlertTriangle, MinusCircle, PlusCircle } from 'lucide-react';
import { formatMoney } from '@/utils/formatters';

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
// Form data types (strings, matching SolicitudPagoForm)
// ---------------------------------------------------------------------------

interface ItemFormData {
  descripcion: string;
  descripcion_detallada: string;
  cantidad: string;
  unidad: string;
  precio_unitario: string;
  id?: number;
}

interface AjusteFormData {
  tipo: 'aumento' | 'disminucion';
  descripcion: string;
  monto: string;
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
  const [proveedor, setProveedor] = useState('');
  const [fecha, setFecha] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // --- datos bancarios ---
  const [beneficiario, setBeneficiario] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');

  // --- items (strings) ---
  const [editItems, setEditItems] = useState<ItemFormData[]>([]);

  // --- ITBMS ---
  const [itbmsActivo, setItbmsActivo] = useState(true);

  // --- ajustes ---
  const [editAjustes, setEditAjustes] = useState<AjusteFormData[]>([]);

  // --- comprobante ---
  const [fechaPago, setFechaPago] = useState('');
  const [comprobanteFiles, setComprobanteFiles] = useState<File[]>([]);
  const comprobanteInputRef = useRef<HTMLInputElement>(null);

  // --- factura ---
  const [fechaFactura, setFechaFactura] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [tipoFactura, setTipoFactura] = useState('');
  const [facturaFiles, setFacturaFiles] = useState<File[]>([]);
  const facturaInputRef = useRef<HTMLInputElement>(null);

  // --- UI state ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Reset all state when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    setMotivo('');
    setError('');
    setProveedor(solicitud.proveedor);
    setFecha(solicitud.fecha?.slice(0, 10) ?? '');
    setObservaciones(solicitud.observaciones ?? '');
    setBeneficiario(solicitud.beneficiario ?? '');
    setBanco(solicitud.banco ?? '');
    setTipoCuenta(solicitud.tipo_cuenta ?? '');
    setNumeroCuenta(solicitud.numero_cuenta ?? '');

    // Initialize items as strings
    setEditItems(
      items.map((it) => ({
        id: it.id,
        descripcion: it.descripcion,
        descripcion_detallada: it.descripcion_detallada || '',
        cantidad: String(it.cantidad),
        unidad: it.unidad,
        precio_unitario: String(it.precio_unitario),
      })),
    );

    // Separate ITBMS from other ajustes
    const itbmsAjuste = ajustes.find(
      (a) => a.tipo === 'impuesto' && a.porcentaje === 7,
    );
    setItbmsActivo(!!itbmsAjuste);
    const otrosAjustes = ajustes.filter((a) => a !== itbmsAjuste);
    setEditAjustes(
      otrosAjustes.map((a) => ({
        tipo: (a.tipo === 'impuesto' ? 'aumento' : 'disminucion') as
          | 'aumento'
          | 'disminucion',
        descripcion: a.descripcion || '',
        monto: String(a.monto),
      })),
    );

    // Comprobante
    setFechaPago(comprobante?.fecha_pago?.slice(0, 10) ?? '');
    setComprobanteFiles([]);

    // Factura
    setFechaFactura(factura?.fecha_factura?.slice(0, 10) ?? '');
    setNumeroFactura(factura?.numero_factura ?? '');
    setTipoFactura(factura?.tipo ?? '');
    setFacturaFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------

  const calculateItemTotal = (item: ItemFormData) => {
    const cant = parseFloat(item.cantidad) || 0;
    const precio = parseFloat(item.precio_unitario) || 0;
    return cant * precio;
  };

  const subtotal = editItems.reduce(
    (sum, item) => sum + calculateItemTotal(item),
    0,
  );

  const itbmsMonto = itbmsActivo ? subtotal * 0.07 : 0;

  const totalAumentos = editAjustes
    .filter((a) => a.tipo === 'aumento')
    .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);

  const totalDisminuciones = editAjustes
    .filter((a) => a.tipo === 'disminucion')
    .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);

  const montoTotal = subtotal + itbmsMonto + totalAumentos - totalDisminuciones;

  // ---------------------------------------------------------------------------
  // Item helpers
  // ---------------------------------------------------------------------------

  const handleItemChange = (
    index: number,
    field: keyof ItemFormData,
    value: string,
  ) => {
    setEditItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const addItem = () =>
    setEditItems((prev) => [
      ...prev,
      {
        descripcion: '',
        descripcion_detallada: '',
        cantidad: '1',
        unidad: 'unidad',
        precio_unitario: '',
      },
    ]);

  const removeItem = (index: number) => {
    if (editItems.length > 1) {
      setEditItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // ---------------------------------------------------------------------------
  // Ajuste helpers
  // ---------------------------------------------------------------------------

  const handleAjusteChange = (
    index: number,
    field: keyof AjusteFormData,
    value: string,
  ) => {
    setEditAjustes((prev) => {
      const newAjustes = [...prev];
      newAjustes[index] = { ...newAjustes[index], [field]: value };
      return newAjustes;
    });
  };

  const toggleAjusteTipo = (index: number) => {
    setEditAjustes((prev) => {
      const newAjustes = [...prev];
      newAjustes[index] = {
        ...newAjustes[index],
        tipo: newAjustes[index].tipo === 'aumento' ? 'disminucion' : 'aumento',
      };
      return newAjustes;
    });
  };

  const addAjuste = () =>
    setEditAjustes((prev) => [
      ...prev,
      { tipo: 'disminucion', descripcion: '', monto: '' },
    ]);

  const removeAjuste = (index: number) => {
    setEditAjustes((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    setError('');

    if (!motivo.trim()) {
      setError('Debe indicar el motivo de la corrección.');
      return;
    }

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
      const validItems = editItems.filter(
        (i) => i.descripcion.trim() && parseFloat(i.precio_unitario) > 0,
      );
      const itemsPayload = validItems.map((item) => ({
        id: item.id || undefined,
        descripcion: item.descripcion.trim(),
        descripcion_detallada: item.descripcion_detallada?.trim() || null,
        cantidad: parseFloat(item.cantidad) || 1,
        unidad: item.unidad || 'unidad',
        precio_unitario: parseFloat(item.precio_unitario) || 0,
      }));
      fd.append('items', JSON.stringify(itemsPayload));

      // Ajustes
      const ajustesPayload = [
        // ITBMS
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
        // Other ajustes
        ...editAjustes
          .filter((a) => a.descripcion.trim() && parseFloat(a.monto) > 0)
          .map((a) => ({
            tipo: a.tipo === 'aumento' ? 'impuesto' : 'descuento',
            descripcion: a.descripcion.trim(),
            porcentaje: null,
            monto: parseFloat(a.monto),
          })),
      ];
      fd.append('ajustes', JSON.stringify(ajustesPayload));

      // Comprobante
      if (comprobante) {
        fd.append('fecha_pago', fechaPago);
      }
      for (const f of comprobanteFiles) {
        fd.append('archivos_comprobante', f);
      }

      // Factura
      if (factura) {
        fd.append('fecha_factura', fechaFactura);
        fd.append('numero_factura', numeroFactura);
        fd.append('tipo', tipoFactura);
      }
      for (const f of facturaFiles) {
        fd.append('archivos_factura', f);
      }

      await api.post(`/solicitudes-pago/${solicitud.id}/corregir`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onClose();
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setError(
        axiosErr.response?.data?.message ||
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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[750px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Agregar Item
            </Button>
          </div>

          {/* Table Header - Desktop */}
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
            {editItems.map((item, index) => {
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
                            handleItemChange(index, 'cantidad', e.target.value)
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(index)}
                        disabled={editItems.length === 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <span className="font-medium">
                        {formatMoney(itemTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
                    <Input
                      placeholder="Descripcion del item"
                      value={item.descripcion}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleItemChange(index, 'descripcion', e.target.value)
                      }
                      className="h-8 text-sm"
                    />
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
                      disabled={editItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary rows — desktop */}
          <div className="hidden sm:block border-t pt-2 mt-2 space-y-1">
            {/* Subtotal */}
            <div className="grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
              <div></div>
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
                    className="h-4 w-4 text-red-400 cursor-pointer shrink-0"
                    onClick={() => setItbmsActivo(false)}
                  />
                ) : (
                  <PlusCircle
                    className="h-4 w-4 text-green-600 cursor-pointer shrink-0"
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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                {itbmsActivo ? (
                  <MinusCircle
                    className="h-4 w-4 text-red-400 cursor-pointer shrink-0"
                    onClick={() => setItbmsActivo(false)}
                  />
                ) : (
                  <PlusCircle
                    className="h-4 w-4 text-green-600 cursor-pointer shrink-0"
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

        {/* ---- Ajustes ---- */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Ajustes</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAjuste}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Agregar Ajuste
            </Button>
          </div>

          {editAjustes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin ajustes.</p>
          ) : (
            <div className="space-y-2">
              {editAjustes.map((ajuste, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 w-8 p-0 shrink-0 font-bold text-base ${ajuste.tipo === 'aumento' ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`}
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

        <Separator />

        {/* ---- Comprobante ---- */}
        {comprobante && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Comprobante de pago</h3>
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
                        setComprobanteFiles(Array.from(e.target.files));
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
                    {comprobanteFiles.length > 0
                      ? `${comprobanteFiles.length} archivo(s) seleccionado(s)`
                      : 'Seleccionar archivos'}
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* ---- Factura ---- */}
        {factura && (
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
                      setFacturaFiles(Array.from(e.target.files));
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
                  {facturaFiles.length > 0
                    ? `${facturaFiles.length} archivo(s) seleccionado(s)`
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
            disabled={saving || !motivo.trim()}
            onClick={handleSubmit}
          >
            {saving ? 'Guardando...' : 'Guardar corrección'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
