/**
 * Registrar una entrega: lo que de verdad llegó a la obra.
 *
 * Es la pieza sobre la que descansa todo lo demás. Hasta que una entrega se
 * registra, la orden no debe nada; al registrarla, ese monto pasa a Por pagar y
 * al costo del proyecto, y arranca SU propio plazo —el de esta entrega, no el
 * de la orden—.
 */
import { useEffect, useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert, DatePicker } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fechaCorta, plata } from '../formato';
import type { OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function EntregaDialog({ orden, open, onOpenChange, onListo }: Props) {
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState('');
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [archivo, setArchivo] = useState<File | null>(null);
  const [descripcionArchivo, setDescripcionArchivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFecha(hoyISO());
    setNota('');
    setCantidades({});
    setArchivo(null);
    setDescripcionArchivo('');
    setError(null);
  }, [open]);

  const tasa = Number(orden.itbms_tasa);

  const renglones = useMemo(
    () =>
      orden.items.map((i) => {
        const falta = Number(i.cantidad) - Number(i.recibido_cantidad);
        const escrito = Number(cantidades[i.id] ?? 0);
        return {
          ...i,
          falta,
          escrito,
          importe: escrito > 0 ? escrito * Number(i.precio_unitario) : 0,
        };
      }),
    [orden.items, cantidades],
  );

  const subtotal = renglones.reduce((s, r) => s + r.importe, 0);
  const itbms = Math.round(subtotal * tasa * 100) / 100;
  const total = Math.round((subtotal + itbms) * 100) / 100;

  const vence = useMemo(() => {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + orden.termino_dias);
    return d.toISOString().slice(0, 10);
  }, [fecha, orden.termino_dias]);

  const deMas = renglones.find((r) => r.escrito > r.falta);
  const puedeGuardar =
    !guardando && subtotal > 0 && !deMas && fecha.length === 10;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await api.post(`/ordenes-compra/${orden.id}/entregas`, {
        fecha,
        nota: nota.trim() || undefined,
        items: renglones
          .filter((r) => r.escrito > 0)
          .map((r) => ({ item_id: r.id, cantidad: r.escrito })),
      });

      // El documento va aparte, sobre la entrega ya creada: en obra la foto del
      // vale llega del teléfono y a veces después.
      if (archivo) {
        const fd = new FormData();
        fd.append('archivo', archivo);
        fd.append('entrega_id', String(res.data.data.id));
        if (descripcionArchivo.trim()) fd.append('descripcion', descripcionArchivo.trim());
        await api.post(`/ordenes-compra/${orden.id}/adjuntos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo registrar la entrega');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="complex"
      title="Registrar una entrega"
      description={`${orden.numero} · ${orden.proveedor} · ${orden.proyecto_nombre ?? ''}`}
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {subtotal > 0
              ? `Al registrarla, ${plata(total)} pasan a Por pagar y al costo del proyecto.`
              : 'Escriba lo que llegó de cada renglón.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={!puedeGuardar}>
              {guardando ? 'Registrando...' : 'Registrar entrega'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <Alert variant="error" title={error} />}

        <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
          <div>
            <Label className="text-xs">Fecha de la entrega *</Label>
            <DatePicker value={fecha} onChange={setFecha} className="mt-1.5" />
          </div>
          <Alert
            variant="warning"
            title={`Esta entrega se paga a más tardar el ${fechaCorta(vence)}`}
            description={`${orden.termino_dias} días después de recibida. Las otras entregas de la orden cuentan sus propios días.`}
          />
        </div>

        <div>
          <Label className="text-xs mb-2 block">Qué llegó</Label>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                  <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Descripción
                  </TableHead>
                  <TableHead className="w-[84px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pedido
                  </TableHead>
                  <TableHead className="w-[92px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ya recibido
                  </TableHead>
                  <TableHead className="w-[76px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Falta
                  </TableHead>
                  <TableHead className="w-[116px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Llegó ahora
                  </TableHead>
                  <TableHead className="w-[112px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Importe
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renglones.map((r) => (
                  <TableRow key={r.id} className="border-b border-slate-100 last:border-0">
                    <TableCell className="px-3 py-2 text-sm text-slate-700">
                      {r.descripcion}
                      <span className="text-muted-foreground">
                        {' '}
                        · {r.unidad} · {plata(r.precio_unitario)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
                      {Number(r.cantidad).toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
                      {Number(r.recibido_cantidad).toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
                      {r.falta.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      {r.falta <= 0 ? (
                        <span className="text-xs text-muted-foreground">Completo</span>
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={cantidades[r.id] ?? ''}
                          placeholder="0"
                          onChange={(e) =>
                            setCantidades((c) => ({ ...c, [r.id]: e.target.value }))
                          }
                          className={`h-8 text-right tabular-nums ${
                            r.escrito > r.falta ? 'border-error' : ''
                          }`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                      {r.importe > 0 ? plata(r.importe) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end border-t border-border bg-slate-50 px-3 py-3">
              <div className="w-72 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sub total de esta entrega</span>
                  <span className="tabular-nums text-slate-700">{plata(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-1.5 text-sm">
                  <span className="text-muted-foreground">
                    ITBMS {(tasa * 100).toFixed(0)}%
                  </span>
                  <span className="tabular-nums text-slate-700">{plata(itbms)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-700">Queda por pagar</span>
                  <span className="text-lg font-bold tabular-nums">{plata(total)}</span>
                </div>
              </div>
            </div>
          </div>
          {deMas && (
            <p className="mt-2 text-xs text-error">
              De «{deMas.descripcion}» solo faltan {deMas.falta.toLocaleString('en-US')}.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Documento de entrega</Label>
            <div className="mt-1.5 rounded-lg border border-border p-3">
              {archivo ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{archivo.name}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label="Quitar el archivo"
                      onClick={() => setArchivo(null)}
                    >
                      <X className="h-3.5 w-3.5 text-error" />
                    </Button>
                  </div>
                  <Input
                    value={descripcionArchivo}
                    onChange={(e) => setDescripcionArchivo(e.target.value)}
                    placeholder="Descripción del archivo"
                    className="mt-2 h-8"
                  />
                </>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary">
                  <Upload className="h-4 w-4" />
                  Subir archivo
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs" htmlFor="nota-entrega">
              Nota de la entrega
            </Label>
            <Textarea
              id="nota-entrega"
              rows={4}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Quién recibió, faltantes, daños..."
              className="mt-1.5 resize-none"
            />
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
