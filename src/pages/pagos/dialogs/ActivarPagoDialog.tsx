/**
 * Activar la solicitud de pago de una orden.
 *
 * Se paga POR ENTREGA, no contra el saldo suelto de la orden: cada entrega
 * tiene su propio vencimiento, y un monto suelto no sabría cuál reloj está
 * parando. De cada entrega se puede pagar menos y dejar el resto para después.
 */
import { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { AppDialog, Alert, ApprovalPillBar } from '@/components/shell';
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
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Solo entran las entregas que todavía tienen algo por reclamar. */
  const pendientes = useMemo(
    () =>
      orden.entregas
        .map((e) => ({ ...e, disponible: dos(Number(e.monto_total) - Number(e.reclamado)) }))
        .filter((e) => e.disponible > 0),
    [orden.entregas],
  );

  useEffect(() => {
    if (!open) return;
    // Arranca con todo lo pendiente: pagar completo es lo normal, y bajar un
    // número cuesta menos que escribirlos todos.
    setMontos(Object.fromEntries(pendientes.map((e) => [e.id, e.disponible.toFixed(2)])));
    setObservaciones('');
    setError(null);
  }, [open, pendientes]);

  const lineas = pendientes.map((e) => ({
    ...e,
    escrito: dos(Number(String(montos[e.id] ?? '').replace(/,/g, '')) || 0),
  }));
  const total = dos(lineas.reduce((s, l) => s + l.escrito, 0));
  const deMas = lineas.find((l) => l.escrito > l.disponible);
  const puede = !guardando && total > 0 && !deMas;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${orden.id}/activar-pago`, {
        entregas: lineas
          .filter((l) => l.escrito > 0)
          .map((l) => ({ entrega_id: l.id, monto: l.escrito })),
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={!puede}>
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
            title="No hay nada por pagar todavía"
            description="Lo que llegó ya tiene su solicitud. Registre una entrega para poder pagar más."
          />
        ) : (
          <>
            <div>
              <Label className="text-xs">Qué se va a pagar</Label>
              <p className="mb-2 mt-1 text-xs text-muted-foreground">
                Solo entra lo que ya llegó. De los {plata(orden.monto_total)} de la orden,
                faltan {plata(orden.falta_por_retirar)} por retirar.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                      <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Entrega
                      </TableHead>
                      <TableHead className="w-[104px] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vence
                      </TableHead>
                      <TableHead className="w-[112px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pendiente
                      </TableHead>
                      <TableHead className="w-[128px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        A pagar
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l) => {
                      const dias = diasHasta(l.vence);
                      return (
                        <TableRow key={l.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="px-3 py-2 text-sm text-slate-700">
                            {fechaCorta(l.fecha)}
                            <span className="block text-xs text-muted-foreground">
                              {l.items
                                .map(
                                  (i) =>
                                    `${i.descripcion}, ${Number(i.cantidad).toLocaleString('en-US')} ${i.unidad}`,
                                )
                                .join(' · ')}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`px-3 py-2 text-sm tabular-nums ${
                              dias < 0 ? 'font-semibold text-error' : dias <= 7 ? 'text-warning' : 'text-slate-700'
                            }`}
                          >
                            {fechaCorta(l.vence)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
                            {plata(l.disponible)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Input
                              inputMode="decimal"
                              value={montos[l.id] ?? ''}
                              onChange={(e) =>
                                setMontos((m) => ({ ...m, [l.id]: e.target.value }))
                              }
                              className={`h-8 text-right tabular-nums ${
                                l.escrito > l.disponible ? 'border-error' : ''
                              }`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-baseline justify-between gap-4 border-t border-border bg-slate-50 px-3 py-3">
                  <span className="text-xs text-muted-foreground">
                    Se puede pagar menos y dejar el resto para después.
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      Monto de la solicitud
                    </span>
                    <span className="text-lg font-bold tabular-nums">{plata(total)}</span>
                  </span>
                </div>
              </div>
              {deMas && (
                <p className="mt-2 text-xs text-error">
                  De la entrega del {fechaCorta(deMas.fecha)} solo quedan{' '}
                  {plata(deMas.disponible)} por pagar.
                </p>
              )}
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
