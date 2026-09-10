// ComparativoPartidas — lo presupuestado contra lo gastado, partida por partida.
//
// Es el cuadro con el que se controla una obra de verdad, y la razon de haber
// anclado el gasto a las partidas del PRESUPUESTO oficial: los dos lados —lo
// que se penso gastar y lo que se lleva gastado— cuelgan de la misma fila, asi
// que se pueden poner uno al lado del otro.
//
// Salen TODAS las partidas del presupuesto, tengan gasto o no: el cuadro es el
// presupuesto entero, y una partida sin empezar tambien dice algo. Las que aun
// no tienen gasto van apagadas para que no compitan con las que si.
//
// Abajo, lo que no cae en ninguna fila —pagos sin partida, o asignados a una
// partida que despues se borro— sale aparte, para que la suma del cuadro cierre
// con el "Gastado hasta hoy" de arriba. Un cuadro que no cuadra con su propia
// pantalla no se puede usar para decidir nada.

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shell';
import { formatMoney } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { ComparativoFila } from '@/lib/costosApi';

const TH = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

interface ComparativoPartidasProps {
  filas: ComparativoFila[];
  sinPartida: { monto: number; pagos: number };
  /** Nombre del presupuesto con la estrella; null si el proyecto no tiene. */
  presupuestoNombre: string | null;
}

/** El relleno de la barra. Verde mientras sobra, ambar al arrimarse al tope,
 *  rojo al pasarse. Sin presupuesto contra que medir, es gasto suelto: rojo. */
function colorBarra(presupuestado: number | null, gastado: number): string {
  if (presupuestado == null || presupuestado <= 0) return 'bg-error';
  const pct = (gastado / presupuestado) * 100;
  if (pct > 100) return 'bg-error';
  if (pct >= 90) return 'bg-warning';
  return 'bg-teal';
}

export default function ComparativoPartidas({
  filas, sinPartida, presupuestoNombre,
}: ComparativoPartidasProps) {
  const totales = useMemo(() => {
    const presupuesto = filas.reduce((s, f) => s + (f.presupuestado ?? 0), 0);
    const enPartidas = filas.reduce((s, f) => s + f.gastado, 0);
    return { presupuesto, enPartidas, total: enPartidas + sinPartida.monto };
  }, [filas, sinPartida.monto]);

  const conGasto = filas.filter((f) => f.gastado > 0).length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-[18px] py-3">
        <h3 className="text-sm font-semibold">Presupuestado contra gastado</h3>
        <span className="text-[11.5px] text-muted-foreground">
          {filas.length} {filas.length === 1 ? 'partida' : 'partidas'}
          {conGasto > 0 && `, ${conGasto} con gasto`}
          {presupuestoNombre && ` · ${presupuestoNombre}`}
        </span>
      </div>

      {filas.length === 0 ? (
        <EmptyState
          title="Este proyecto todavía no tiene presupuesto oficial"
          description="Las partidas salen del presupuesto marcado con la estrella. Sin él no hay contra qué comparar renglón por renglón."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                  <TableHead className={`${TH} w-[80px] whitespace-nowrap`}>Item</TableHead>
                  <TableHead className={TH}>Partida</TableHead>
                  <TableHead className={`${TH} w-[130px] whitespace-nowrap text-right`}>Presupuesto</TableHead>
                  <TableHead className={`${TH} w-[130px] whitespace-nowrap text-right`}>Gastado</TableHead>
                  <TableHead className={`${TH} w-[130px]`}>Avance</TableHead>
                  <TableHead className={`${TH} w-[130px] whitespace-nowrap text-right`}>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => {
                  const sinGasto = f.gastado === 0;
                  const diferencia = f.gastado - (f.presupuestado ?? 0);
                  const ancho = f.presupuestado != null && f.presupuestado > 0
                    ? Math.min(100, (f.gastado / f.presupuestado) * 100)
                    : f.gastado > 0 ? 100 : 0;

                  return (
                    <TableRow
                      key={f.rowUid}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <TableCell
                        className={cn(
                          'truncate px-4 py-2 text-sm tabular-nums',
                          sinGasto ? 'text-slate-400' : 'text-muted-foreground',
                        )}
                      >
                        {f.item}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'truncate px-4 py-2 text-sm',
                          sinGasto ? 'text-slate-400' : 'text-foreground',
                        )}
                      >
                        {f.descripcion}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums',
                          sinGasto ? 'text-slate-400' : 'text-slate-700',
                        )}
                      >
                        {f.presupuestado != null ? formatMoney(f.presupuestado) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums',
                          sinGasto ? 'text-slate-400' : 'text-slate-700',
                        )}
                      >
                        {sinGasto ? '—' : formatMoney(f.gastado)}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="h-[7px] w-full overflow-hidden rounded-full bg-slate-100">
                          {ancho > 0 && (
                            <div
                              className={cn('h-full rounded-full', colorBarra(f.presupuestado, f.gastado))}
                              // El ancho es un dato, no una clase: sale de la
                              // division y cambia en cada fila.
                              style={{ width: `${ancho}%` }}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums',
                          sinGasto ? 'text-slate-400'
                            : diferencia > 0 ? 'font-semibold text-error' : 'text-success',
                        )}
                      >
                        {sinGasto
                          ? '—'
                          : `${diferencia > 0 ? '+' : '−'}${formatMoney(Math.abs(diferencia))}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {sinPartida.monto !== 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-warning/[0.06] px-4 py-2.5 text-sm text-warning">
              <span>
                {sinPartida.pagos === 1
                  ? '1 pago sin partida, que no entra en ninguna fila'
                  : `${sinPartida.pagos} pagos sin partida, que no entran en ninguna fila`}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(sinPartida.monto)}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Presupuesto <span className="font-medium tabular-nums text-foreground">{formatMoney(totales.presupuesto)}</span>
              {' · '}gastado en partidas <span className="font-medium tabular-nums text-foreground">{formatMoney(totales.enPartidas)}</span>
            </span>
            <span>
              Gastado total <span className="font-semibold tabular-nums text-foreground">{formatMoney(totales.total)}</span>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
