// PresupuestoHoja — la hoja de un presupuesto armado desde el desglose.
//
// Los renglones, las cantidades y los precios vienen copiados del desglose el
// dia que se armo, y aqui no se tocan. Lo unico que se escribe es la columna de
// COSTO unitario, que va antes que el precio. El total es una fila mas de la
// tabla, cada numero debajo de su columna.
//
// El ancho de las columnas es FIJO (table-fixed): escribir un costo cambia el
// largo de los numeros de la fila, y la tabla no puede moverse mientras se
// escribe.
//
// La hoja NO pone su propia cabecera. Vive dentro de una pestana de Control de
// Costos, y dos cabeceras encimadas —el titulo de la pantalla y el de la hoja—
// se leian como dos maneras distintas de salir. En vez de eso reporta hacia
// arriba, con onCabecera, el nombre del presupuesto y el estado del boton de
// guardar; la pantalla que la contiene los pinta en su titulo. Para salir se
// pincha la pestana «Presupuestos».

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, ErrorState, TableSkeleton } from '@/components/shell';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import { padClass, grupoBgClass } from '@/components/desglose/desglosePad';
import { NumberCell } from './NumberCell';
import {
  avanceCostos, computeTotales, costosCambiados, esContenedor, toHojaRows,
  TOTAL_KEY, type HojaRow,
} from '@/lib/presupuestoHoja';
import {
  getPresupuesto, guardarCostos, PresupuestoConflictError,
  type PresupuestoDoc,
} from '@/lib/presupuestoApi';

const TH = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

/** Lo que la hoja necesita que pinte la cabecera de arriba. */
export interface CabeceraHoja {
  /** El nombre del presupuesto; mientras carga, la palabra sola. */
  titulo: string;
  guardar: () => void;
  puedeGuardar: boolean;
  guardando: boolean;
}

interface Props {
  projectId: number;
  presupuestoId: number;
  onCabecera?: (cabecera: CabeceraHoja) => void;
}

export default function PresupuestoHoja({ projectId, presupuestoId, onCabecera }: Props) {
  const [doc, setDoc] = useState<PresupuestoDoc | null>(null);
  const [rows, setRows] = useState<HojaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      const d = await getPresupuesto(projectId, presupuestoId);
      setDoc(d);
      setRows(toHojaRows(d.renglones));
    } catch (err) {
      console.error('Error cargando el presupuesto:', err);
      setError('No se pudo cargar el presupuesto.');
    } finally {
      setLoading(false);
    }
  }, [projectId, presupuestoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const totales = useMemo(() => computeTotales(rows), [rows]);
  const avance = useMemo(() => avanceCostos(rows), [rows]);
  const cambios = useMemo(
    () => (doc ? costosCambiados(doc.renglones, rows) : []),
    [doc, rows],
  );

  const setCosto = (id: number, costoUnitario: number | null) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, costoUnitario } : r)));

  // useCallback, no una funcion suelta: viaja hacia arriba dentro de la
  // cabecera, y una identidad nueva en cada pintado dispararia el aviso otra
  // vez sin que haya cambiado nada.
  const guardar = useCallback(async () => {
    if (!doc) return;
    try {
      setGuardando(true);
      setConflicto(null);
      const d = await guardarCostos(projectId, presupuestoId, doc.presupuesto.updatedAt, cambios);
      setDoc(d);
      setRows(toHojaRows(d.renglones));
    } catch (err) {
      if (err instanceof PresupuestoConflictError) {
        setConflicto(err.message);
      } else {
        console.error('Error guardando el presupuesto:', err);
        setConflicto('No se pudo guardar. Intenta de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  }, [doc, projectId, presupuestoId, cambios]);

  const titulo = doc?.presupuesto.nombre ?? 'Presupuesto';
  const puedeGuardar = doc != null && cambios.length > 0 && !guardando;

  useEffect(() => {
    onCabecera?.({ titulo, guardar, puedeGuardar, guardando });
  }, [onCabecera, titulo, guardar, puedeGuardar, guardando]);

  if (loading) {
    return (
      <Card className="overflow-hidden p-0"><Table><TableSkeleton columns={6} /></Table></Card>
    );
  }

  if (error || !doc) {
    return (
      <Card className="overflow-hidden p-0">
        <ErrorState description={error ?? undefined} onRetry={cargar} />
      </Card>
    );
  }

  const total = totales.get(TOTAL_KEY) ?? { costo: 0, precio: 0 };

  return (
    <div className="space-y-4">
      {conflicto && (
        <Alert
          variant="error"
          title={conflicto}
          actions={<Button variant="outline" size="sm" onClick={cargar}>Recargar</Button>}
        />
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className={`${TH} w-[90px] whitespace-nowrap`}>Item</TableHead>
                <TableHead className={TH}>Descripción</TableHead>
                <TableHead className={`${TH} w-[80px] whitespace-nowrap`}>Unidad</TableHead>
                <TableHead className={`${TH} w-[110px] whitespace-nowrap text-right`}>Cantidad</TableHead>
                {/* El costo va antes que el precio, y es lo unico editable. */}
                <TableHead className={`${TH} w-[140px] whitespace-nowrap text-right`}>Costo unit.</TableHead>
                <TableHead className={`${TH} w-[150px] whitespace-nowrap text-right`}>Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const contenedor = esContenedor(rows, i);
                const t = totales.get(r.id) ?? { costo: 0, precio: 0 };
                const esGrupo = r.tipo === 'grupo';
                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      'border-b border-slate-100 last:border-0',
                      esGrupo && grupoBgClass(r.depth),
                    )}
                  >
                    <TableCell className="truncate px-4 py-2 text-sm tabular-nums">
                      {r.codigo}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-sm">
                      <div className={cn('truncate', padClass(r.depth), esGrupo && 'font-semibold')}>
                        {r.descripcion}
                      </div>
                    </TableCell>
                    <TableCell className="truncate px-4 py-2 text-sm text-slate-700">
                      {contenedor ? '' : r.unidad ?? ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                      {contenedor ? '' : r.cantidad ?? ''}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      {!contenedor && (
                        <NumberCell
                          key={`costo-${r.id}`}
                          ariaLabel={`Costo unitario de ${r.descripcion || r.codigo}`}
                          value={r.costoUnitario}
                          onCommit={(v) => setCosto(r.id, v)}
                          className="w-full"
                        />
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums',
                        contenedor ? 'text-muted-foreground' : 'text-slate-700',
                      )}
                    >
                      {/* Sin costo escrito no se inventa un cero: se marca que falta. */}
                      {!contenedor && r.costoUnitario == null
                        ? <span className="text-muted-foreground">—</span>
                        : formatMoney(t.costo)}
                    </TableCell>
                  </TableRow>
                );
              })}

              <TableRow className="border-t-2 border-border bg-muted/30 hover:bg-muted/30">
                <TableCell />
                <TableCell className="px-4 py-3 text-sm font-bold">Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums">
                  {formatMoney(total.costo)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            {avance.sinCosto > 0
              ? `Faltan ${avance.sinCosto} de ${avance.conCosto + avance.sinCosto} renglones por costear`
              : `Los ${avance.conCosto} renglones tienen costo`}
          </span>
          {cambios.length > 0 && <span>Hay cambios sin guardar</span>}
        </div>
      </Card>
    </div>
  );
}
