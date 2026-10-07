/**
 * Activar una solicitud de pago con las facturas de la orden.
 *
 * Cada factura vence por su cuenta, pero lo normal es pagarlas juntas (Ivan,
 * 2026-10-06: «lo más seguro es que la pague toda junta»). Así que la ventana
 * arranca con todas las que tienen algo por pedir marcadas, cada una por lo que
 * le falta; se desmarcan las que no van, y de cada una se puede pedir menos y
 * dejar el resto para después. Sale UNA solicitud, con un renglón por factura.
 */
import { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { AppDialog, Alert, ApprovalPillBar } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { diasHasta, fechaCorta, nombreFactura, plata } from '../formato';
import { aprobadoresDe, type OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

const dos = (n: number) => Math.round(n * 100) / 100;
const numero = (s: string) => dos(Number(s.replace(/,/g, '')) || 0);

export default function ActivarPagoDialog({ orden, open, onOpenChange, onListo }: Props) {
  // Las que todavía tienen algo por pedir, la que vence primero arriba.
  const pendientes = useMemo(
    () =>
      orden.entregas
        .map((f) => ({ ...f, disponible: dos(Number(f.monto_total) - Number(f.reclamado)) }))
        .filter((f) => f.disponible > 0)
        .sort((a, b) => a.vence.localeCompare(b.vence)),
    [orden.entregas],
  );

  const [marcadas, setMarcadas] = useState<Record<number, boolean>>({});
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMarcadas(Object.fromEntries(pendientes.map((f) => [f.id, true])));
    setMontos(
      Object.fromEntries(
        pendientes.map((f) => [
          f.id,
          f.disponible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ]),
      ),
    );
    setObservaciones('');
    setError(null);
    // Solo al abrir: un refresco de la orden por detrás no debe deshacer lo marcado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const elegidas = pendientes.filter((f) => marcadas[f.id]);
  const deMas = (f: (typeof pendientes)[number]) => numero(montos[f.id] ?? '') > f.disponible;
  const total = dos(elegidas.reduce((s, f) => s + numero(montos[f.id] ?? ''), 0));
  const puede =
    !guardando &&
    elegidas.length > 0 &&
    elegidas.every((f) => numero(montos[f.id] ?? '') > 0 && !deMas(f));

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${orden.id}/activar-pago`, {
        entregas: elegidas.map((f) => ({ entrega_id: f.id, monto: numero(montos[f.id] ?? '') })),
        observaciones: observaciones.trim() || undefined,
      });
      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo activar la solicitud');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title="Activar solicitud de pago"
      description={`${orden.numero} · ${orden.proveedor} · ${orden.proyecto_nombre ?? ''}`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={!puede} className="flex-1 sm:flex-none">
            {guardando ? 'Creando...' : 'Crear la solicitud'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <Alert variant="error" title={error} />}

        {pendientes.length === 0 ? (
          <Alert
            variant="info"
            title="No hay nada por pedir"
            description="Todo lo que se debe de esta orden ya tiene su solicitud de pago."
          />
        ) : (
          <>
            <div>
              <Label className="text-xs">Facturas que se pagan</Label>
              <div className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-border">
                {pendientes.map((f) => {
                  const marcada = !!marcadas[f.id];
                  const vencida = diasHasta(f.vence) < 0;
                  const conSolicitud = Number(f.reclamado) > 0;
                  return (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Checkbox
                        id={`pagar-${f.id}`}
                        checked={marcada}
                        onCheckedChange={(v) => setMarcadas((m) => ({ ...m, [f.id]: v === true }))}
                        aria-label={`Pagar ${nombreFactura(f)}`}
                      />
                      <label htmlFor={`pagar-${f.id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm font-medium text-foreground">
                          {nombreFactura(f)}
                        </span>
                        <span
                          className={cn(
                            'block text-xs tabular-nums',
                            vencida ? 'font-semibold text-error' : 'text-muted-foreground',
                          )}
                        >
                          Vence {fechaCorta(f.vence)}
                          {vencida ? ' · vencida' : ''}
                          {conSolicitud ? ` · ya tiene solicitud por ${plata(f.reclamado)}` : ''}
                        </span>
                      </label>
                      <Input
                        inputMode="decimal"
                        value={montos[f.id] ?? ''}
                        onChange={(e) => setMontos((m) => ({ ...m, [f.id]: e.target.value }))}
                        disabled={!marcada}
                        aria-label={`Monto de ${nombreFactura(f)}`}
                        className={cn(
                          'h-9 w-32 shrink-0 text-right tabular-nums',
                          marcada && deMas(f) && 'border-error',
                        )}
                      />
                    </div>
                  );
                })}
                <div className="flex items-baseline justify-between gap-3 bg-slate-50 px-4 py-2.5">
                  <span className="text-sm font-semibold text-foreground">
                    Total de la solicitud
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {elegidas.length} {elegidas.length === 1 ? 'factura' : 'facturas'}
                    </span>
                  </span>
                  <span className="text-lg font-bold tabular-nums">{plata(total)}</span>
                </div>
              </div>
              <p
                className={cn(
                  'mt-1.5 text-xs',
                  elegidas.some(deMas) ? 'text-error' : 'text-muted-foreground',
                )}
              >
                {elegidas.some(deMas)
                  ? 'Un monto es mayor que lo que falta por pedir de su factura.'
                  : 'De cada factura se puede pedir menos y dejar el resto para después.'}
              </p>
            </div>

            <div>
              <Label className="text-xs" htmlFor="obs-activar">
                Observaciones
              </Label>
              <Textarea
                id="obs-activar"
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Lo que deba ver quien aprueba..."
                className="mt-1.5 resize-none"
              />
            </div>

            {orden.aprobadores.length > 0 && (
              <Alert
                variant="info"
                title="Pasa por los aprobadores del proyecto, en ese orden"
                description={
                  <span className="flex items-center gap-3">
                    <ApprovalPillBar
                      aprobadores={aprobadoresDe(orden).map((a) => ({
                        ...a,
                        estado: 'pendiente',
                      }))}
                    />
                    <span>{orden.aprobadores.map((a) => a.nombre).join(' → ')}</span>
                  </span>
                }
              />
            )}
          </>
        )}
      </div>
    </AppDialog>
  );
}
