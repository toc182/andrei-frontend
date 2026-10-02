/**
 * Marcar una orden como recibida: llegó completa, en un solo paso.
 *
 * No se escriben cantidades. Las entregas parciales se quitaron (Ivan,
 * 2026-10-02): son casos raros, y un proveedor que despacha por partes lleva
 * una orden por despacho. Al marcarla se debe la orden entera y desde ese día
 * corre el término de pago.
 *
 * El vale firmado es opcional aquí: en obra la foto a veces llega después, y
 * se puede subir luego desde la historia de la orden.
 */
import { useEffect, useMemo, useState } from 'react';
import { FileText, PackageCheck, X } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert, DatePicker } from '@/components/shell';
import { Button } from '@/components/ui/button';
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

export default function RecibirDialog({ orden, open, onOpenChange, onListo }: Props) {
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState('');
  const [vale, setVale] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFecha(hoyISO());
    setNota('');
    setVale(null);
    setError(null);
  }, [open]);

  const vence = useMemo(() => {
    if (fecha.length !== 10) return null;
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + orden.termino_dias);
    return d.toISOString().slice(0, 10);
  }, [fecha, orden.termino_dias]);

  const { encima, props: zona } = useSoltarArchivos({
    tipos: TIPOS,
    activo: open && !guardando,
    alSoltar: (aceptados, rechazados) => {
      if (aceptados[0]) setVale(aceptados[0]);
      setError(rechazados.length ? 'El vale tiene que ser una foto o un PDF.' : null);
    },
  });

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await api.post(`/ordenes-compra/${orden.id}/recibir`, {
        fecha,
        nota: nota.trim() || undefined,
      });
      if (vale) {
        const fd = new FormData();
        fd.append('archivo', vale);
        fd.append('entrega_id', String(res.data.data.id));
        fd.append('descripcion', 'Vale de entrega');
        try {
          await api.post(`/ordenes-compra/${orden.id}/adjuntos`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          // La orden ya quedó recibida: lo que falló es solo la foto, que se
          // puede volver a subir desde la historia.
          onListo();
          setError('La orden quedó recibida, pero el vale no se pudo subir. Súbelo desde la historia.');
          return;
        }
      }
      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo marcar como recibida');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title="Marcar como recibida"
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
          <Button
            onClick={() => void guardar()}
            disabled={guardando || fecha.length !== 10}
            className="flex-1 sm:flex-none"
          >
            <PackageCheck className="mr-2 h-4 w-4" />
            {guardando ? 'Guardando...' : 'Marcar como recibida'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error" title={error} />}

        <div>
          <Label className="text-xs">Fecha en que llegó *</Label>
          <DatePicker value={fecha} onChange={setFecha} className="mt-1.5" />
        </div>

        <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border px-4 py-3">
          <span className="text-sm text-slate-700">Llegó todo lo pedido. Pasa a Por pagar:</span>
          <span className="text-lg font-bold tabular-nums">{plata(orden.monto_total)}</span>
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
                : `${orden.termino_dias} días desde que llegó.`
            }
          />
        )}

        <div>
          <Label className="text-xs">Vale de entrega</Label>
          <div
            {...zona}
            className={cn(
              'relative mt-1.5 rounded-lg border p-3',
              encima ? 'border-teal ring-2 ring-teal/30' : 'border-dashed border-slate-300',
            )}
          >
            {encima && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/90 text-sm font-semibold text-teal">
                Suelta el vale aquí
              </div>
            )}
            {vale ? (
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{vale.name}</span>
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Quitar el vale"
                  onClick={() => setVale(null)}
                >
                  <X className="h-3.5 w-3.5 text-error" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1 py-2 text-center text-sm">
                <span className="font-semibold text-primary">Tomar una foto o subir el vale firmado</span>
                <span className="hidden text-xs text-muted-foreground md:inline">
                  o arrástralo aquí
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept={TIPOS.join(',')}
                  onChange={(e) => {
                    setVale(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs" htmlFor="nota-recibida">
            Nota
          </Label>
          <Textarea
            id="nota-recibida"
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
