/**
 * El formulario de la orden de compra: alta y edición, el mismo.
 *
 * Cambia poco entre los dos casos, y lo que cambia importa: si la orden ya
 * salió al proveedor, solo la toca un administrador, el motivo del cambio es
 * obligatorio y cada campo que se mueve queda anotado. Por eso el aviso de
 * arriba no es decorativo — es lo único que avisa de que esto ya no es un
 * borrador.
 */
import { useEffect, useMemo, useState } from 'react';
import { Paperclip, Plus, Upload, X } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert, DatePicker } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { plata } from '../formato';
import { abrirAdjunto } from '../adjuntos';
import { useSoltarArchivos } from '@/hooks/useSoltarArchivos';
import { cn } from '@/lib/utils';
import type { OrdenDetalle } from '../tiposDetalle';

interface Categoria {
  id: number;
  nombre: string;
}

interface Renglon {
  /** Solo los que ya existen: los nuevos no tienen id hasta que se guardan. */
  id?: number;
  cantidad: string;
  unidad: string;
  descripcion: string;
  precio_unitario: string;
}

// Sin código de producto: Ivan lo quitó el 2026-10-02 —quien lo necesite lo ve
// en la cotización adjunta—. Una orden recibida ya no se edita, así que aquí no
// hay renglones con material llegado que cuidar.
type CampoRenglon = 'cantidad' | 'unidad' | 'descripcion' | 'precio_unitario';

const ETIQUETA_CAMPO: Record<CampoRenglon, string> = {
  cantidad: 'Cantidad',
  unidad: 'Unidad',
  descripcion: 'Descripción',
  precio_unitario: 'Precio unit.',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Sin orden es un alta; con orden, una edición. */
  orden?: OrdenDetalle | null;
  proyectoId?: number | null;
  proyectoNombre?: string;
  esAdmin: boolean;
  onListo: (ordenId: number) => void;
}

const TERMINOS = [0, 15, 30, 45, 60, 90];
const vacio = (): Renglon => ({
  cantidad: '',
  unidad: 'unidad',
  descripcion: '',
  precio_unitario: '',
});

const num = (s: string) => Number(String(s).replace(/,/g, '')) || 0;
const dos = (n: number) => Math.round(n * 100) / 100;

export default function OrdenFormDialog({
  open,
  onOpenChange,
  orden,
  proyectoId,
  proyectoNombre,
  esAdmin,
  onListo,
}: Props) {
  const editando = Boolean(orden);
  const yaSalio = orden?.estado === 'enviada' || orden?.estado === 'cerrada';

  const [proveedor, setProveedor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ruc, setRuc] = useState('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [termino, setTermino] = useState('30');
  const [entrega, setEntrega] = useState<'sitio' | 'local'>('sitio');
  const [condiciones, setCondiciones] = useState('');
  const [descuento, setDescuento] = useState('0');
  const [renglones, setRenglones] = useState<Renglon[]>([vacio()]);
  const [motivo, setMotivo] = useState('');
  const [archivos, setArchivos] = useState<{ archivo: File; descripcion: string }[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazados, setRechazados] = useState<string | null>(null);

  // Los archivos también se pueden arrastrar al recuadro de adjuntos. Se suben
  // al guardar, igual que los del botón.
  const { encima, props: zona } = useSoltarArchivos({
    tipos: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    activo: open && !guardando,
    alSoltar: (aceptados, rechazo) => {
      setRechazados(
        rechazo.length
          ? `${rechazo.map((f) => f.name).join(', ')}: solo se adjuntan PDF, JPG, PNG y WEBP.`
          : null,
      );
      if (aceptados.length) {
        setArchivos((prev) => [
          ...prev,
          ...aceptados.map((archivo) => ({ archivo, descripcion: '' })),
        ]);
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMotivo('');
    setArchivos([]);
    setRechazados(null);
    if (orden) {
      setProveedor(orden.proveedor);
      setDescripcion(orden.descripcion ?? '');
      setRuc(orden.proveedor_ruc ?? '');
      setCategoriaId(orden.categoria_id ? String(orden.categoria_id) : '');
      setFecha(orden.fecha.slice(0, 10));
      setTermino(String(orden.termino_dias));
      setEntrega(orden.entrega);
      setCondiciones(orden.condiciones ?? '');
      setDescuento(Number(orden.descuento).toFixed(2));
      setRenglones(
        orden.items.map((i) => ({
          id: i.id,
          cantidad: String(Number(i.cantidad)),
          unidad: i.unidad,
          descripcion: i.descripcion,
          precio_unitario: Number(i.precio_unitario).toFixed(2),
        })),
      );
    } else {
      setProveedor('');
      setDescripcion('');
      setRuc('');
      setCategoriaId('');
      setFecha(new Date().toISOString().slice(0, 10));
      setTermino('30');
      setEntrega('sitio');
      setCondiciones('');
      setDescuento('0');
      setRenglones([vacio()]);
    }
  }, [open, orden]);

  useEffect(() => {
    if (!open) return;
    api
      .get('/costs/categories')
      .then((r) => setCategorias(r.data.categories ?? []))
      .catch(() => setCategorias([]));
  }, [open]);

  const tasa = orden ? Number(orden.itbms_tasa) : 0.07;
  const calculado = useMemo(() => {
    const conTotal = renglones.map((r) => ({
      ...r,
      total: dos(num(r.cantidad) * num(r.precio_unitario)),
    }));
    const subtotal = dos(conTotal.reduce((s, r) => s + r.total, 0));
    const desc = dos(num(descuento));
    const itbms = dos((subtotal - desc) * tasa);
    return { conTotal, subtotal, desc, itbms, total: dos(subtotal - desc + itbms) };
  }, [renglones, descuento, tasa]);

  const faltaAlgo =
    renglones.every((r) => !r.descripcion.trim()) ||
    renglones.some((r) => r.descripcion.trim() && (num(r.cantidad) <= 0 || !r.precio_unitario)) ||
    !proveedor.trim();
  const faltaMotivo = Boolean(yaSalio) && motivo.trim().length === 0;
  const puede = !guardando && !faltaAlgo && !faltaMotivo && calculado.desc <= calculado.subtotal;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const items = renglones
        .filter((r) => r.descripcion.trim())
        .map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          cantidad: num(r.cantidad),
          unidad: r.unidad || 'unidad',
          descripcion: r.descripcion.trim(),
          precio_unitario: num(r.precio_unitario),
        }));

      const cuerpo = {
        fecha,
        proveedor: proveedor.trim(),
        proveedor_ruc: ruc.trim() || null,
        descripcion: descripcion.trim() || null,
        categoria_id: categoriaId ? Number(categoriaId) : null,
        termino_dias: Number(termino),
        entrega,
        condiciones: condiciones.trim() || null,
        descuento: calculado.desc,
        items,
      };

      let id: number;
      if (orden) {
        await api.put(`/ordenes-compra/${orden.id}`, {
          ...cuerpo,
          ...(yaSalio ? { motivo: motivo.trim() } : {}),
        });
        id = orden.id;
      } else {
        const res = await api.post('/ordenes-compra', { ...cuerpo, proyecto_id: proyectoId });
        id = res.data.data.id;
      }

      for (const a of archivos) {
        const fd = new FormData();
        fd.append('archivo', a.archivo);
        if (a.descripcion.trim()) fd.append('descripcion', a.descripcion.trim());
        await api.post(`/ordenes-compra/${id}/adjuntos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      onListo(id);
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo guardar la orden');
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = (i: number, campo: keyof Renglon, valor: string) =>
    setRenglones((rs) => rs.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)));

  // Las cajitas de un renglón y su botón de quitar se escriben una vez y salen
  // en los dos dibujos: la tabla de la computadora y los bloques del teléfono.
  type ConTotal = (typeof calculado.conTotal)[number];
  const campoRenglon = (r: ConTotal, i: number, campo: CampoRenglon, className: string) => {
    const numerico = campo === 'cantidad' || campo === 'precio_unitario';
    return (
      <Input
        inputMode={numerico ? 'decimal' : undefined}
        aria-label={`${ETIQUETA_CAMPO[campo]} del renglón ${i + 1}`}
        value={r[campo]}
        onChange={(e) => cambiar(i, campo, e.target.value)}
        placeholder={campo === 'descripcion' ? 'Descripción del producto o servicio' : undefined}
        className={cn(
          className,
          numerico && 'text-right tabular-nums',
        )}
      />
    );
  };
  const botonQuitar = (r: ConTotal, i: number) => (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7"
      aria-label={`Quitar el renglón ${i + 1}`}
      disabled={renglones.length === 1}
      onClick={() => setRenglones((rs) => rs.filter((_, j) => j !== i))}
    >
      <X className="h-3.5 w-3.5 text-error" />
    </Button>
  );

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="complex"
      title={editando ? `Editar ${orden!.numero}` : 'Nueva orden de compra'}
      description={
        editando
          ? `${orden!.proveedor} · ${orden!.proyecto_nombre ?? ''}`
          : (proyectoNombre ?? '')
      }
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground">
            {yaSalio
              ? 'Solo un administrador puede editar una orden ya enviada.'
              : 'Al crearla pasa a aprobación. Se envía al proveedor cuando esté aprobada.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={!puede} className="flex-1 sm:flex-none">
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear orden'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <Alert variant="error" title={error} />}

        {yaSalio && (
          <Alert
            variant="warning"
            title="Esta orden ya salió al proveedor."
            description="Cada cambio queda anotado con tu nombre y la hora, y el papel se vuelve a generar. Avisarle al proveedor no lo hace el sistema."
          />
        )}
        {yaSalio && !esAdmin && (
          <Alert variant="error" title="Solo un administrador puede guardar estos cambios." />
        )}

        <div>
          <Label className="text-xs" htmlFor="descripcion-orden">
            Descripción
          </Label>
          <Input
            id="descripcion-orden"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={160}
            placeholder="De qué es la compra, en una línea"
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Es lo que se lee en la lista para saber de qué se trata sin abrirla.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Proveedor *</Label>
            <Input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">RUC</Label>
            <Input
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder="000000-0-000000 DV 00"
              className="mt-1.5 tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fecha de la orden *</Label>
            <DatePicker value={fecha} onChange={setFecha} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-xs">Término de pago *</Label>
            <Select value={termino} onValueChange={setTermino}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMINOS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d === 0 ? 'Contado' : `${d} días`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Los días se cuentan desde cada entrega, por separado.
            </p>
          </div>
          <div>
            <Label className="text-xs">Entrega</Label>
            <RadioGroup
              value={entrega}
              onValueChange={(v) => setEntrega(v as 'sitio' | 'local')}
              className="mt-2.5 flex items-center gap-5"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="sitio" id="entrega-sitio" />
                <Label htmlFor="entrega-sitio" className="font-normal">
                  En sitio
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="local" id="entrega-local" />
                <Label htmlFor="entrega-local" className="font-normal">
                  Retiro en el local
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Detalle de compra</Label>
          <div className="overflow-hidden rounded-lg border border-border">
            {/* Teléfono: un bloque por renglón, con cajitas donde se puede
                escribir. En la tabla no cabían y el botón de
                guardar quedaba fuera de la pantalla (Ivan, 2026-10-02). */}
            <div className="divide-y divide-slate-100 md:hidden">
              {calculado.conTotal.map((r, i) => (
                <div key={r.id ?? `n${i}`} className="space-y-2 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Renglón {i + 1}
                    </span>
                    {botonQuitar(r, i)}
                  </div>
                  {campoRenglon(r, i, 'descripcion', 'h-9')}
                  <div className="grid grid-cols-3 gap-2">
                    {(['cantidad', 'unidad', 'precio_unitario'] as const).map((campo) => (
                      <div key={campo}>
                        <span className="text-xs text-muted-foreground">{ETIQUETA_CAMPO[campo]}</span>
                        {campoRenglon(r, i, campo, 'mt-1 h-9')}
                      </div>
                    ))}
                  </div>
                  <p className="text-right text-sm">
                    <span className="text-muted-foreground">Total </span>
                    <span className="font-semibold tabular-nums">{plata(r.total)}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                    <TableHead className="w-[84px] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cant.
                    </TableHead>
                    <TableHead className="w-[84px] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Unidad
                    </TableHead>
                    <TableHead className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Descripción
                    </TableHead>
                    <TableHead className="w-[104px] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      P. Unit.
                    </TableHead>
                    <TableHead className="w-[112px] px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="w-[48px] px-2 py-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculado.conTotal.map((r, i) => (
                    <TableRow key={r.id ?? `n${i}`} className="border-b border-slate-100 last:border-0">
                      <TableCell className="px-2 py-2">{campoRenglon(r, i, 'cantidad', 'h-8')}</TableCell>
                      <TableCell className="px-2 py-2">{campoRenglon(r, i, 'unidad', 'h-8')}</TableCell>
                      <TableCell className="px-2 py-2">
                        {campoRenglon(r, i, 'descripcion', 'h-8')}
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        {campoRenglon(r, i, 'precio_unitario', 'h-8')}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                        {plata(r.total)}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-center">{botonQuitar(r, i)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-4 border-t border-border bg-slate-50 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenglones((rs) => [...rs, vacio()])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar renglón
              </Button>
              <div className="w-full space-y-1.5 sm:w-72">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sub total</span>
                  <span className="tabular-nums text-slate-700">{plata(calculado.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Label className="text-muted-foreground font-normal" htmlFor="descuento">
                    Descuento
                  </Label>
                  <Input
                    id="descuento"
                    inputMode="decimal"
                    value={descuento}
                    onChange={(e) => setDescuento(e.target.value)}
                    className="h-8 w-28 text-right tabular-nums"
                  />
                </div>
                <div className="flex items-center justify-between border-b border-border pb-1.5 text-sm">
                  <span className="text-muted-foreground">ITBMS {(tasa * 100).toFixed(0)}%</span>
                  <span className="tabular-nums text-slate-700">{plata(calculado.itbms)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-700">Total de la orden</span>
                  <span className="text-lg font-bold tabular-nums">{plata(calculado.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Adjuntos</Label>
            <div
              {...zona}
              className={cn(
                'relative mt-1.5 overflow-hidden rounded-lg border',
                encima ? 'border-teal ring-2 ring-teal/30' : 'border-border',
              )}
            >
              {encima && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/90 text-sm font-semibold text-teal">
                  Suelta los archivos para adjuntarlos
                </div>
              )}
              {/* Los que la orden ya tiene. Se ven y se abren aquí; se quitan
                  desde la orden, en su recuadro de adjuntos. */}
              {orden?.adjuntos.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 border-b border-slate-100 p-3"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => void abrirAdjunto(orden.id, a.id)}
                    className="truncate text-left text-sm text-primary hover:underline"
                    title={a.descripcion ?? a.nombre_original}
                  >
                    {a.nombre_original}
                  </button>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">Ya adjunto</span>
                </div>
              ))}
              {archivos.map((a, i) => (
                <div key={`${a.archivo.name}-${i}`} className="border-b border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{a.archivo.name}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Quitar ${a.archivo.name}`}
                      onClick={() => setArchivos((f) => f.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5 text-error" />
                    </Button>
                  </div>
                  <Input
                    value={a.descripcion}
                    placeholder="Descripción del archivo"
                    onChange={(e) =>
                      setArchivos((f) =>
                        f.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)),
                      )
                    }
                    className="mt-2 h-8"
                  />
                </div>
              ))}
              <div className="bg-slate-50 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary">
                  <Upload className="h-4 w-4" />
                  Subir archivo
                  <span className="hidden font-normal text-muted-foreground md:inline">
                    o arrástralo aquí
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setArchivos((prev) => [...prev, { archivo: f, descripcion: '' }]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            {rechazados && <p className="mt-1.5 text-xs text-error">{rechazados}</p>}
          </div>
          <div>
            <Label className="text-xs" htmlFor="condiciones">
              Comentarios y condiciones de compra
            </Label>
            <Textarea
              id="condiciones"
              rows={8}
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              placeholder="Lo que el proveedor tiene que leer en el papel..."
              className="mt-1.5 resize-none"
            />
          </div>
        </div>

        {yaSalio && (
          <div>
            <Label className="text-xs" htmlFor="motivo">
              Motivo del cambio *
            </Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué cambia una orden que ya salió"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Se guarda junto al cambio, para que después se sepa por qué.
            </p>
          </div>
        )}
      </div>
    </AppDialog>
  );
}
