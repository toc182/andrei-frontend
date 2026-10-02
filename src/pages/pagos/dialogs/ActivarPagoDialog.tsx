/**
 * Activar la solicitud de pago de una orden recibida.
 *
 * La orden llega completa, una sola vez, y el pago se amarra a esa recepción
 * (es la que tiene el vencimiento). Arranca con todo lo que falta por pedir:
 * pagar completo es lo normal, pero se puede pagar menos y dejar el resto para
 * después.
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';
import { AppDialog, Alert, ApprovalPillBar } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { diasHasta, fechaCorta, plata } from '../formato';
import { aprobadoresDe, type OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

const dos = (n: number) => Math.round(n * 100) / 100;

export default function ActivarPagoDialog({ orden, open, onOpenChange, onListo }: Props) {
  const recepcion = orden.entregas[0] ?? null;
  const disponible = recepcion ? dos(Number(recepcion.monto_total) - Number(recepcion.reclamado)) : 0;

  const [monto, setMonto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMonto(disponible > 0 ? disponible.toFixed(2) : '');
    setObservaciones('');
    setError(null);
  }, [open, disponible]);

  const escrito = dos(Number(monto.replace(/,/g, '')) || 0);
  const deMas = escrito > disponible;
  const puede = !guardando && escrito > 0 && !deMas && recepcion !== null;

  const guardar = async () => {
    if (!recepcion) return;
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${orden.id}/activar-pago`, {
        entregas: [{ entrega_id: recepcion.id, monto: escrito }],
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

  const vencida = recepcion ? diasHasta(recepcion.vence) < 0 : false;

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

        {!recepcion || disponible <= 0 ? (
          <Alert
            variant="info"
            title="No hay nada por pedir"
            description="Todo lo que se debe de esta orden ya tiene su solicitud de pago."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100 rounded-lg border border-border">
              <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Total de la orden</span>
                <span className="tabular-nums">{plata(recepcion.monto_total)}</span>
              </div>
              {Number(recepcion.reclamado) > 0 && (
                <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Ya tiene solicitud de pago</span>
                  <span className="tabular-nums">{plata(recepcion.reclamado)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 px-4 py-2.5 text-sm font-semibold">
                <span>Falta por pedir</span>
                <span className="tabular-nums">{plata(disponible)}</span>
              </div>
              <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Vence</span>
                <span className={vencida ? 'font-semibold text-error' : 'text-slate-700'}>
                  {fechaCorta(recepcion.vence)}
                  {vencida ? ' · vencida' : ''}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-xs" htmlFor="monto-pago">
                Monto de la solicitud
              </Label>
              <Input
                id="monto-pago"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={`mt-1.5 h-10 text-right text-base font-semibold tabular-nums ${
                  deMas ? 'border-error' : ''
                }`}
              />
              <p className={`mt-1.5 text-xs ${deMas ? 'text-error' : 'text-muted-foreground'}`}>
                {deMas
                  ? `Solo quedan ${plata(disponible)} por pedir.`
                  : 'Se puede pagar menos y dejar el resto para después.'}
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
