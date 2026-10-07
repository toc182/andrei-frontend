/**
 * Registrar una factura de la orden: llegó una parte del material.
 *
 * La orden llega por partes y cada parte trae su factura (Ivan, 2026-10-05).
 * No se escriben cantidades: número, fecha, monto y el papel. Cada factura se
 * paga a los días de crédito contados desde SU fecha.
 *
 * Los archivos son opcionales aquí: en obra la foto a veces llega después, y
 * se puede subir luego desde el renglón de la factura.
 */
import { useEffect, useMemo, useState } from 'react';
import { FileText, ReceiptText, X } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert, DatePicker } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSoltarArchivos } from '@/hooks/useSoltarArchivos';
import { cn } from '@/lib/utils';
import { fechaCorta, plata } from '../formato';
import type { OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dos = (n: number) => Math.round(n * 100) / 100;

export default function FacturaDialog({ orden, open, onOpenChange, onListo }: Props) {
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNumero('');
    setFecha(hoyISO());
    setMonto('');
    setNota('');
    setArchivos([]);
    setError(null);
  }, [open]);

  const vence = useMemo(() => {
    if (fecha.length !== 10) return null;
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + orden.termino_dias);
    return d.toISOString().slice(0, 10);
  }, [fecha, orden.termino_dias]);

  const escrito = dos(Number(monto.replace(/,/g, '')) || 0);
  const facturado = dos(Number(orden.recibido) + escrito);
  const puede = !guardando && numero.trim() !== '' && fecha.length === 10 && escrito > 0;

  const { encima, props: zona } = useSoltarArchivos({
    tipos: TIPOS,
    activo: open && !guardando,
    alSoltar: (aceptados, rechazados) => {
      if (aceptados.length) setArchivos((a) => [...a, ...aceptados]);
      setError(rechazados.length ? 'Los archivos tienen que ser fotos o PDF.' : null);
    },
  });

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await api.post(`/ordenes-compra/${orden.id}/facturas`, {
        numero_factura: numero.trim(),
        fecha,
        monto: escrito,
        nota: nota.trim() || undefined,
      });
      for (const archivo of archivos) {
        const fd = new FormData();
        fd.append('archivo', archivo);
        fd.append('entrega_id', String(res.data.data.id));
        try {
          await api.post(`/ordenes-compra/${orden.id}/adjuntos`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          // La factura ya quedó registrada: lo que falló es solo el archivo,
          // que se puede volver a subir desde su renglón.
          onListo();
          setError(
            'La factura quedó registrada, pero un archivo no se pudo subir. Súbelo desde su renglón en Facturas.',
          );
          return;
        }
      }
      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo registrar la factura');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title="Registrar factura"
      description={`${orden.numero} · ${orden.proveedor}`}
      footer={
        <div className="flex w-full gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={!puede} className="flex-1 sm:flex-none">
            <ReceiptText className="mr-2 h-4 w-4" />
            {guardando ? 'Guardando...' : 'Registrar factura'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error" title={error} />}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label className="text-xs" htmlFor="factura-numero">
              No. de factura *
            </Label>
            <Input
              id="factura-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              autoComplete="off"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">Fecha de la factura *</Label>
            <DatePicker value={fecha} onChange={setFecha} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-xs" htmlFor="factura-monto">
              Monto *
            </Label>
            <Input
              id="factura-monto"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="mt-1.5 text-right tabular-nums"
            />
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border px-4 py-3">
          <span className="text-sm text-slate-700">Facturado con esta:</span>
          <span className="text-lg font-bold tabular-nums">
            {plata(facturado)}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              de {plata(orden.monto_total)}
            </span>
          </span>
        </div>

        {vence && (
          <Alert
            variant="warning"
            title={
              orden.termino_dias === 0
                ? 'Se paga de contado'
                : `Se paga a más tardar el ${fechaCorta(vence)}`
            }
            description={
              orden.termino_dias === 0
                ? undefined
                : `${orden.termino_dias} días desde la fecha de la factura.`
            }
          />
        )}

        <div>
          <Label className="text-xs">Factura y vale de entrega</Label>
          <div
            {...zona}
            className={cn(
              'relative mt-1.5 rounded-lg border p-3',
              encima ? 'border-teal ring-2 ring-teal/30' : 'border-dashed border-slate-300',
            )}
          >
            {encima && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/90 text-sm font-semibold text-teal">
                Suelta los archivos aquí
              </div>
            )}
            {archivos.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {archivos.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{a.name}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Quitar ${a.name}`}
                      onClick={() => setArchivos((todos) => todos.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5 text-error" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex cursor-pointer flex-col items-center gap-1 py-2 text-center text-sm">
              <span className="font-semibold text-primary">
                {archivos.length ? 'Agregar otro archivo' : 'Tomar una foto o subir los archivos'}
              </span>
              <span className="hidden text-xs text-muted-foreground md:inline">o arrástralos aquí</span>
              <input
                type="file"
                multiple
                className="hidden"
                accept={TIPOS.join(',')}
                onChange={(e) => {
                  const nuevos = Array.from(e.target.files ?? []);
                  if (nuevos.length) setArchivos((a) => [...a, ...nuevos]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div>
          <Label className="text-xs" htmlFor="factura-nota">
            Nota
          </Label>
          <Textarea
            id="factura-nota"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Quién recibió, observaciones..."
            className="mt-1.5 resize-none"
          />
        </div>
      </div>
    </AppDialog>
  );
}
