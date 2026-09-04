// APARTADO — esta pantalla no esta enganchada a ninguna ruta.
//
// Fue el primer intento de la Hoja de Presupuesto: dos bloques (Items y Costos
// Generales) y calculo por partes en cada renglon. Ivan la vio el 2026-09-01 y
// la descarto — "lo siento enredado", "no se como empezar ni para que es cada
// seccion", "se ve muy largo" — porque intenta servir todas las maneras de
// armar un presupuesto a la vez. Se conserva entera para cuando se retomen esas
// otras maneras; sus llamadas a la API (bloquesApi) hay que rehacerlas antes.
//
// La pantalla viva es pages/project/ProjectPresupuesto.tsx.
//
// Es lo que la empresa calcula que le va a COSTAR la obra, y de ahi sale el
// precio que se le manda al cliente. No se confunde con el desglose de precios
// del contrato (seccion Cuentas): son pantallas distintas y no quedan atadas.
//
// Dos bloques: los items del trabajo y los Costos Generales (supervision,
// campamento, seguros, la cuadrilla cuando no va por item). Cualquier renglon
// de los dos bloques puede abrirse y calcularse por partes: se despliega debajo
// una tabla donde cada FILA es una cosa real y TODAS las columnas multiplican.
//
// El factor de la hoja vive en la cabecera y multiplica TODOS los renglones,
// para que la suma de lo que se ve cuadre con el precio enviado. El ITBMS va al
// final, sobre el total.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Calculator, MoreHorizontal, Plus, Save,
  Indent, Outdent, ArrowUp, ArrowDown, Trash2, Pencil, FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PageHeader, SectionHeader, Alert, EmptyState, ErrorState, TableSkeleton,
} from '@/components/shell';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import { padClass, grupoBgClass } from '@/components/desglose/desglosePad';
import { PresupuestoCalculo } from '@/components/presupuesto/PresupuestoCalculo';
import { NumberCell } from '@/components/presupuesto/NumberCell';
import { cellInputClass } from '@/components/presupuesto/celdas';
import {
  appendRow, blankRow, computeTotals, deleteSubtree, emptyCalculo, hasChildren,
  indentRows, insertRowAfter, moveSubtree, canMoveSubtree,
  outdentRows, precioUnitarioMostrado, resumenHoja, toWireRenglones,
  GENERALES_TOTAL_KEY, ITEMS_TOTAL_KEY,
  type PresupuestoRow, type Seccion,
} from '@/lib/presupuestoModel';
import {
  getPresupuesto, savePresupuesto, wireToRows, PresupuestoConflictError,
} from './bloquesApi';

const SECCIONES: { key: Seccion; titulo: string; vacio: string }[] = [
  {
    key: 'items',
    titulo: 'Items',
    vacio: 'Todavía no hay items. Agrega el primero para empezar a calcular.',
  },
  {
    key: 'generales',
    titulo: 'Costos Generales',
    vacio: 'Lo que no cuelga de ningún item: supervisión, campamento, seguros, imprevistos.',
  },
];

/** Hoja nueva: un item y un costo general, para que la pantalla no nazca en
 *  blanco y se vea de una vez donde va cada cosa. */
const hojaInicial = (): PresupuestoRow[] => [
  blankRow(1, 'items', 'item', 0),
  blankRow(2, 'generales', 'item', 0),
];

interface PresupuestoPorBloquesProps {
  projectId: number;
}

export default function PresupuestoPorBloques({ projectId }: PresupuestoPorBloquesProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existe, setExiste] = useState(false);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<PresupuestoRow[]>([]);
  const [factor, setFactor] = useState(1);
  const [itbmsTasa, setItbmsTasa] = useState<number | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      const doc = await getPresupuesto(projectId);
      if (doc) {
        setExiste(true);
        setBaseUpdatedAt(doc.presupuesto.updatedAt);
        setRows(wireToRows(doc.renglones));
        setFactor(doc.presupuesto.factor);
        setItbmsTasa(doc.presupuesto.itbmsTasa);
      } else {
        setExiste(false);
        setBaseUpdatedAt(null);
        setRows([]);
        setFactor(1);
        setItbmsTasa(null);
      }
      setExpandidos(new Set());
      setDirty(false);
    } catch (err) {
      console.error('Error cargando el presupuesto:', err);
      setError('No se pudo cargar el presupuesto.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicar = (next: PresupuestoRow[]) => {
    // Las operaciones del modelo devuelven la MISMA referencia cuando la
    // jugada era ilegal; ahi no hay nada que ensuciar.
    setRows((prev) => {
      if (next !== prev) setDirty(true);
      return next;
    });
  };

  const patchRow = (i: number, patch: Partial<PresupuestoRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const totals = useMemo(() => computeTotals(rows), [rows]);
  const resumen = useMemo(
    () => resumenHoja(rows, factor, itbmsTasa),
    [rows, factor, itbmsTasa],
  );

  const toggleExpandido = (tempId: number) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });

  /** Enciende o apaga el calculo por partes de un renglon. Al encenderlo se
   *  abre solo: para eso se pidio. */
  const toggleCalculo = (i: number) => {
    const r = rows[i];
    if (r.usaCalculo) {
      patchRow(i, { usaCalculo: false });
    } else {
      patchRow(i, { usaCalculo: true, calculo: r.calculo ?? emptyCalculo() });
      setExpandidos((prev) => new Set(prev).add(r.tempId));
    }
  };

  const guardar = async () => {
    try {
      setSaving(true);
      setConflicto(null);
      const doc = await savePresupuesto(
        projectId, baseUpdatedAt, toWireRenglones(rows), factor, itbmsTasa,
      );
      setExiste(true);
      setBaseUpdatedAt(doc.presupuesto.updatedAt);
      setRows(wireToRows(doc.renglones));
      setFactor(doc.presupuesto.factor);
      setItbmsTasa(doc.presupuesto.itbmsTasa);
      setDirty(false);
    } catch (err) {
      if (err instanceof PresupuestoConflictError) {
        setConflicto(err.message);
      } else {
        console.error('Error guardando el presupuesto:', err);
        setConflicto('No se pudo guardar. Intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Presupuesto" />
        <Card><CardContent className="p-0"><Table><TableSkeleton columns={6} /></Table></CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Presupuesto" />
        <Card><CardContent className="p-0"><ErrorState description={error} onRetry={cargar} /></CardContent></Card>
      </div>
    );
  }

  if (!existe && rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Presupuesto"
          subtitle="Lo que calculas que te va a costar la obra, y el precio que le mandas al cliente."
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileSpreadsheet}
              title="Este proyecto todavía no tiene presupuesto"
              description="Empieza una hoja en blanco: los items del trabajo arriba y los Costos Generales abajo."
              action={
                <Button onClick={() => { setRows(hojaInicial()); setDirty(true); }}>
                  <Plus className="mr-1 h-4 w-4" />
                  Empezar el presupuesto
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderSeccion = (seccion: Seccion, titulo: string, vacio: string) => {
    const indices = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.seccion === seccion);
    const subtotalKey = seccion === 'items' ? ITEMS_TOTAL_KEY : GENERALES_TOTAL_KEY;
    const subtotal = (totals.get(subtotalKey) ?? 0) * factor;

    return (
      <section key={seccion}>
        <SectionHeader
          title={titulo}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => aplicar(appendRow(rows, seccion, 'item'))}
            >
              <Plus className="mr-1 h-4 w-4" />
              Agregar renglón
            </Button>
          }
        />
        <Card>
          <CardContent className="p-0">
            {indices.length === 0 ? (
              <EmptyState title="Sin renglones" description={vacio} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px] whitespace-nowrap">Código</TableHead>
                      <TableHead className="w-full">Descripción</TableHead>
                      <TableHead className="w-[90px] whitespace-nowrap">Unidad</TableHead>
                      <TableHead className="w-[110px] whitespace-nowrap text-right">Cantidad</TableHead>
                      <TableHead className="w-[130px] whitespace-nowrap text-right">Costo unit.</TableHead>
                      <TableHead className="w-[140px] whitespace-nowrap text-right">Total</TableHead>
                      <TableHead className="w-[44px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indices.map(({ r, i }) => {
                      const contenedor = r.tipo === 'grupo' && hasChildren(rows, i);
                      const abierto = expandidos.has(r.tempId);
                      const unitario = precioUnitarioMostrado(rows, i);
                      const total = (totals.get(r.tempId) ?? 0) * factor;

                      return [
                        <TableRow
                          key={r.tempId}
                          className={cn(
                            'border-b border-slate-100',
                            r.tipo === 'grupo' && grupoBgClass(r.depth),
                          )}
                        >
                          <TableCell className="whitespace-nowrap px-4 py-1.5 tabular-nums">
                            <div className="flex items-center gap-1">
                              {r.usaCalculo ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandido(r.tempId)}
                                  title={abierto ? 'Cerrar el cálculo' : 'Ver el cálculo'}
                                  aria-label={abierto ? 'Cerrar el cálculo' : 'Ver el cálculo'}
                                  className="text-teal"
                                >
                                  {abierto
                                    ? <ChevronDown className="h-4 w-4" />
                                    : <ChevronRight className="h-4 w-4" />}
                                </button>
                              ) : (
                                <span className="inline-block w-4" />
                              )}
                              <Input
                                value={r.codigo}
                                maxLength={60}
                                onChange={(e) => patchRow(i, { codigo: e.target.value })}
                                className={cn(cellInputClass, 'w-[56px] tabular-nums')}
                              />
                            </div>
                          </TableCell>

                          <TableCell className="px-4 py-1.5">
                            <div className={padClass(r.depth)}>
                              <Input
                                value={r.descripcion}
                                placeholder={r.tipo === 'grupo' ? 'Nombre de la sección' : 'Descripción del renglón'}
                                onChange={(e) => patchRow(i, { descripcion: e.target.value })}
                                className={cn(
                                  cellInputClass, 'w-full',
                                  r.tipo === 'grupo' && 'font-semibold',
                                )}
                              />
                            </div>
                          </TableCell>

                          <TableCell className="px-4 py-1.5">
                            {!contenedor && (
                              <Input
                                value={r.unidad ?? ''}
                                maxLength={30}
                                placeholder="m³"
                                onChange={(e) => patchRow(i, { unidad: e.target.value || null })}
                                className={cn(cellInputClass, 'w-[72px]')}
                              />
                            )}
                          </TableCell>

                          <TableCell className="px-4 py-1.5 text-right">
                            {!contenedor && (
                              <NumberCell
                                key={`cant-${r.tempId}`}
                                ariaLabel="Cantidad"
                                value={r.cantidad}
                                onCommit={(v) => patchRow(i, { cantidad: v })}
                                className="w-[92px]"
                              />
                            )}
                          </TableCell>

                          <TableCell className="px-4 py-1.5 text-right">
                            {!contenedor && (
                              r.usaCalculo ? (
                                // Con calculo el unitario no se escribe: sale de
                                // repartir el costo calculado entre la cantidad.
                                <span className="pr-2 text-muted-foreground tabular-nums">
                                  {unitario != null ? formatMoney(unitario * factor) : '—'}
                                </span>
                              ) : (
                                <NumberCell
                                  key={`pu-${r.tempId}`}
                                  ariaLabel="Costo unitario"
                                  value={r.precioUnitario}
                                  onCommit={(v) => patchRow(i, { precioUnitario: v })}
                                  className="w-[112px]"
                                />
                              )
                            )}
                          </TableCell>

                          <TableCell
                            className={cn(
                              'whitespace-nowrap px-4 py-1.5 text-right tabular-nums',
                              contenedor && 'text-muted-foreground',
                            )}
                          >
                            {formatMoney(total)}
                          </TableCell>

                          <TableCell className="px-2 py-1.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Opciones del renglón">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!contenedor && (
                                  <DropdownMenuItem onClick={() => toggleCalculo(i)}>
                                    {r.usaCalculo ? (
                                      <><Pencil className="mr-2 h-4 w-4" />Escribir el costo a mano</>
                                    ) : (
                                      <><Calculator className="mr-2 h-4 w-4" />Calcular por partes</>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => aplicar(insertRowAfter(rows, i, 'item'))}>
                                  <Plus className="mr-2 h-4 w-4" />Insertar renglón debajo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => aplicar(insertRowAfter(rows, i, 'grupo'))}>
                                  <Plus className="mr-2 h-4 w-4" />Insertar sección debajo
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => aplicar(indentRows(rows, i))}>
                                  <Indent className="mr-2 h-4 w-4" />Meter dentro de la sección
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => aplicar(outdentRows(rows, i))}>
                                  <Outdent className="mr-2 h-4 w-4" />Sacar de la sección
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canMoveSubtree(rows, i, -1)}
                                  onClick={() => aplicar(moveSubtree(rows, i, -1))}
                                >
                                  <ArrowUp className="mr-2 h-4 w-4" />Subir
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canMoveSubtree(rows, i, 1)}
                                  onClick={() => aplicar(moveSubtree(rows, i, 1))}
                                >
                                  <ArrowDown className="mr-2 h-4 w-4" />Bajar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-error focus:text-error"
                                  onClick={() => aplicar(deleteSubtree(rows, i))}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>,

                        r.usaCalculo && abierto && r.calculo ? (
                          <TableRow key={`calc-${r.tempId}`} className="hover:bg-transparent">
                            <TableCell colSpan={7} className="bg-muted/40 p-0">
                              <PresupuestoCalculo
                                calculo={r.calculo}
                                mostrarClase={seccion === 'items'}
                                cantidad={r.cantidad}
                                unidad={r.unidad}
                                onChange={(calculo) => patchRow(i, { calculo })}
                              />
                            </TableCell>
                          </TableRow>
                        ) : null,
                      ];
                    })}

                    <TableRow className="border-t border-border bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="px-4 py-2 text-right font-semibold">
                        Subtotal {titulo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums">
                        {formatMoney(subtotal)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presupuesto"
        subtitle="Lo que calculas que te va a costar la obra, y el precio que le mandas al cliente."
      >
        {/* El factor va a la vista en la cabecera y multiplica TODOS los
            renglones, para que la suma de lo que se ve cuadre con el precio. */}
        <div className="flex items-center gap-2">
          <Label htmlFor="factor-hoja" className="whitespace-nowrap text-sm text-muted-foreground">
            Factor
          </Label>
          <NumberCell
            key={`factor-${baseUpdatedAt ?? 'nuevo'}`}
            value={factor}
            ariaLabel="Factor de la hoja"
            onCommit={(v) => { setFactor(v != null && v > 0 ? v : 1); setDirty(true); }}
            className="w-[86px]"
          />
        </div>
        <Button onClick={guardar} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </PageHeader>

      {conflicto && (
        <Alert
          variant="error"
          title={conflicto}
          actions={<Button variant="outline" size="sm" onClick={cargar}>Recargar</Button>}
        />
      )}

      {SECCIONES.map((s) => renderSeccion(s.key, s.titulo, s.vacio))}

      <section>
        <SectionHeader title="Total de la hoja" />
        <Card>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Costo (suma de los renglones, sin factor)</span>
              <span className="tabular-nums">{formatMoney(resumen.costo)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Factor</span>
              <span className="tabular-nums">× {factor}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(resumen.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ITBMS</span>
                <NumberCell
                  key={`itbms-${baseUpdatedAt ?? 'nuevo'}`}
                  value={itbmsTasa}
                  ariaLabel="Tasa de ITBMS"
                  placeholder="7"
                  onCommit={(v) => { setItbmsTasa(v); setDirty(true); }}
                  className="w-[68px]"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <span className="tabular-nums">{formatMoney(resumen.itbms)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(resumen.total)}</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}