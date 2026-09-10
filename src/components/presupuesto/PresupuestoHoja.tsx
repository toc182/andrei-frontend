// PresupuestoHoja — la hoja de un presupuesto. La misma tabla sirve a las dos
// maneras de armarlo, y lo que cambia es cuanto se deja tocar:
//
//   'desglose' — los renglones, las cantidades y los precios vienen copiados
//     del desglose el dia que se armo, y aqui no se tocan. Lo unico que se
//     escribe es la columna de COSTO unitario, y al guardar viaja solo el diff.
//
//   'cero' — la hoja se escribe entera: texto, montos, filas, grupos y
//     jerarquia. Al guardar viaja completa y reemplaza lo que hubiera.
//
// El costo va antes que el precio, y el total es una fila mas de la tabla, cada
// numero debajo de su columna.
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
import {
  ChevronDown, ChevronUp, IndentDecrease, IndentIncrease, Plus, Trash2,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, ErrorState, TableSkeleton } from '@/components/shell';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import { padClass, grupoBgClass } from '@/components/desglose/desglosePad';
import { NumberCell } from './NumberCell';
import { TextCell } from './TextCell';
import {
  agregarAlFinal, avanceCostos, borrarFila, computeTotales, costosCambiados,
  desindentar, esContenedor, hojaCambiada, indentar, indentParentIndex,
  insertarFila, filaInicial, moverFila, puedeDesindentar, puedeIndentar,
  puedeMover, tieneHijos, toHojaRows, toWireRenglones, TOTAL_KEY, type HojaRow,
} from '@/lib/presupuestoHoja';
import {
  getPresupuesto, guardarCostos, guardarHoja, PresupuestoConflictError,
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

/** Una hoja armada desde cero que llega vacia nace con una fila: pedirle al
 *  usuario que adivine el primer paso frente a una tabla en blanco fue justo lo
 *  que hundio la pantalla anterior. */
const filasIniciales = (doc: PresupuestoDoc): HojaRow[] =>
  doc.presupuesto.origen === 'cero' && doc.renglones.length === 0
    ? filaInicial()
    : toHojaRows(doc.renglones);

export default function PresupuestoHoja({ projectId, presupuestoId, onCabecera }: Props) {
  const [doc, setDoc] = useState<PresupuestoDoc | null>(null);
  const [rows, setRows] = useState<HojaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);
  // Indentar bajo un item lo convierte en grupo y le borra sus montos: eso se
  // pregunta antes, nunca se hace callado.
  const [porPromover, setPorPromover] = useState<{ i: number; padre: number } | null>(null);
  // Borrar un grupo se lleva su rama entera, asi que esa tambien se pregunta.
  const [porBorrar, setPorBorrar] = useState<number | null>(null);
  // La fila seleccionada es sobre la que actua la barra de controles, igual que
  // en el editor de desglose. null = ninguna, y la barra sale apagada.
  const [seleccion, setSeleccion] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      const d = await getPresupuesto(projectId, presupuestoId);
      setDoc(d);
      setRows(filasIniciales(d));
    } catch (err) {
      console.error('Error cargando el presupuesto:', err);
      setError('No se pudo cargar el presupuesto.');
    } finally {
      setLoading(false);
    }
  }, [projectId, presupuestoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const editable = doc?.presupuesto.origen === 'cero';

  const totales = useMemo(() => computeTotales(rows), [rows]);
  const avance = useMemo(() => avanceCostos(rows), [rows]);
  const cambios = useMemo(
    () => (doc ? costosCambiados(doc.renglones, rows) : []),
    [doc, rows],
  );
  const hayCambios = useMemo(
    () => (!doc ? false : editable ? hojaCambiada(doc.renglones, rows) : cambios.length > 0),
    [doc, editable, rows, cambios],
  );

  const setCampo = (tempId: number, patch: Partial<HojaRow>) =>
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));

  // Indentar pide primero convertir el padre en grupo cuando es un item; el
  // modelo se niega mientras no lo sea, asi que las dos cosas van juntas.
  const pedirIndentar = (i: number) => {
    const padre = indentParentIndex(rows, i);
    if (padre < 0) return;
    if (rows[padre].tipo === 'item') {
      setPorPromover({ i, padre });
      return;
    }
    setRows((prev) => indentar(prev, i));
  };

  const promoverEIndentar = () => {
    if (!porPromover) return;
    const { i, padre } = porPromover;
    setRows((prev) => indentar(
      prev.map((r, k) => (k === padre
        ? { ...r, tipo: 'grupo' as const, unidad: null, cantidad: null, costoUnitario: null }
        : r)),
      i,
    ));
    setPorPromover(null);
  };

  // Agregar entra debajo de la fila seleccionada —dentro, si es un grupo— y al
  // final de la hoja cuando no hay ninguna seleccionada.
  const agregar = (tipo: 'grupo' | 'item') => setRows((prev) => (
    seleccion == null ? agregarAlFinal(prev, tipo) : insertarFila(prev, seleccion, tipo)
  ));

  // Borrar un grupo se lleva sus hijos, asi que ahi se pregunta; una fila suelta
  // se va sin ceremonia, que es como se corrige un renglon de mas.
  const pedirBorrar = (i: number) => {
    if (tieneHijos(rows, i)) { setPorBorrar(i); return; }
    setRows((prev) => borrarFila(prev, i));
    setSeleccion(null);
  };

  const borrarConfirmado = () => {
    if (porBorrar == null) return;
    setRows((prev) => borrarFila(prev, porBorrar));
    setSeleccion(null);
    setPorBorrar(null);
  };

  // useCallback, no una funcion suelta: viaja hacia arriba dentro de la
  // cabecera, y una identidad nueva en cada pintado dispararia el aviso otra
  // vez sin que haya cambiado nada.
  const guardar = useCallback(async () => {
    if (!doc) return;
    try {
      setGuardando(true);
      setConflicto(null);
      const d = doc.presupuesto.origen === 'cero'
        ? await guardarHoja(projectId, presupuestoId, doc.presupuesto.updatedAt, toWireRenglones(rows))
        : await guardarCostos(projectId, presupuestoId, doc.presupuesto.updatedAt, cambios);
      setDoc(d);
      setRows(filasIniciales(d));
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
  }, [doc, projectId, presupuestoId, rows, cambios]);

  const titulo = doc?.presupuesto.nombre ?? 'Presupuesto';
  const puedeGuardar = doc != null && hayCambios && !guardando;

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

      {/* Los mismos controles que el editor de desglose, en el mismo orden: las
          operaciones de estructura actúan sobre la fila seleccionada y salen
          apagadas mientras no haya ninguna. */}
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => agregar('item')}>
            <Plus className="mr-2 h-4 w-4" /> Agregar fila
          </Button>
          <Button variant="outline" size="sm" onClick={() => agregar('grupo')}>
            <Plus className="mr-2 h-4 w-4" /> Agregar grupo
          </Button>

          <div className="ml-2 flex items-center gap-1 border-l border-border pl-3">
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => seleccion != null && setRows((p) => desindentar(p, seleccion))}
              disabled={seleccion == null || !puedeDesindentar(rows, seleccion)}
              title="Sacar un nivel"
            >
              <IndentDecrease className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => seleccion != null && pedirIndentar(seleccion)}
              disabled={seleccion == null || !puedeIndentar(rows, seleccion)}
              title="Meter dentro del de arriba"
            >
              <IndentIncrease className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => seleccion != null && setRows((p) => moverFila(p, seleccion, -1))}
              disabled={seleccion == null || !puedeMover(rows, seleccion, -1)}
              title="Subir"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => seleccion != null && setRows((p) => moverFila(p, seleccion, 1))}
              disabled={seleccion == null || !puedeMover(rows, seleccion, 1)}
              title="Bajar"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => seleccion != null && pedirBorrar(seleccion)}
              disabled={seleccion == null}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <span className="ml-1 text-xs text-muted-foreground">
            {seleccion == null
              ? 'Pincha una fila para moverla, anidarla o borrarla'
              : 'Los botones actúan sobre la fila marcada'}
          </span>
        </div>
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
                {/* El costo va antes que el precio, y es lo unico editable
                    cuando la hoja salio de un desglose. */}
                <TableHead className={`${TH} w-[140px] whitespace-nowrap text-right`}>Costo unit.</TableHead>
                <TableHead className={`${TH} w-[150px] whitespace-nowrap text-right`}>Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const contenedor = esContenedor(rows, i);
                const t = totales.get(r.tempId) ?? { costo: 0, precio: 0 };
                const esGrupo = r.tipo === 'grupo';
                return (
                  <TableRow
                    key={r.tempId}
                    onClick={editable ? () => setSeleccion(i) : undefined}
                    className={cn(
                      'border-b border-slate-100 last:border-0',
                      esGrupo && grupoBgClass(r.depth),
                      editable && 'cursor-default',
                      // La marca de seleccion gana sobre la banda del grupo: es
                      // sobre esta fila que van a actuar los botones de arriba.
                      editable && seleccion === i && 'bg-slate-200 hover:bg-slate-200',
                    )}
                  >
                    <TableCell className="truncate px-4 py-2 text-sm tabular-nums">
                      {editable ? (
                        <TextCell
                          key={`cod-${r.tempId}`}
                          ariaLabel={`Item de ${r.descripcion || 'la fila'}`}
                          value={r.codigo}
                          maxLength={60}
                          onCommit={(v) => setCampo(r.tempId, { codigo: v })}
                          className="tabular-nums"
                        />
                      ) : r.codigo}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-sm">
                      <div className={cn(padClass(r.depth), esGrupo && 'font-semibold')}>
                        {editable ? (
                          <TextCell
                            key={`desc-${r.tempId}`}
                            ariaLabel="Descripción de la fila"
                            value={r.descripcion}
                            placeholder={esGrupo ? 'Nombre del grupo' : 'Descripción'}
                            onCommit={(v) => setCampo(r.tempId, { descripcion: v })}
                            className={cn(esGrupo && 'font-semibold')}
                          />
                        ) : <div className="truncate">{r.descripcion}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="truncate px-4 py-2 text-sm text-slate-700">
                      {contenedor ? '' : editable ? (
                        <TextCell
                          key={`uni-${r.tempId}`}
                          ariaLabel={`Unidad de ${r.descripcion || r.codigo}`}
                          value={r.unidad ?? ''}
                          maxLength={30}
                          onCommit={(v) => setCampo(r.tempId, { unidad: v || null })}
                        />
                      ) : r.unidad ?? ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                      {contenedor ? '' : editable ? (
                        <NumberCell
                          key={`cant-${r.tempId}`}
                          ariaLabel={`Cantidad de ${r.descripcion || r.codigo}`}
                          value={r.cantidad}
                          onCommit={(v) => setCampo(r.tempId, { cantidad: v })}
                          className="w-full"
                        />
                      ) : r.cantidad ?? ''}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      {!contenedor && (
                        <NumberCell
                          key={`costo-${r.tempId}`}
                          ariaLabel={`Costo unitario de ${r.descripcion || r.codigo}`}
                          value={r.costoUnitario}
                          onCommit={(v) => setCampo(r.tempId, { costoUnitario: v })}
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
          {hayCambios && <span>Hay cambios sin guardar</span>}
        </div>
      </Card>

      <AlertDialog open={porBorrar !== null} onOpenChange={(o) => { if (!o) setPorBorrar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar «{porBorrar != null ? rows[porBorrar]?.descripcion || 'este grupo' : ''}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Es un grupo: se va con todas las filas que tiene dentro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrarConfirmado} className={buttonVariants({ variant: 'destructive' })}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={porPromover !== null} onOpenChange={(o) => { if (!o) setPorPromover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Convertir «{porPromover ? rows[porPromover.padre]?.descripcion || 'la fila de arriba' : ''}» en grupo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Para meter esta fila dentro, la de arriba tiene que ser un grupo. Un grupo no
              lleva montos propios: su total sale de lo que tiene dentro, así que se pierden
              su unidad, su cantidad y su costo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={promoverEIndentar}>Convertir en grupo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
