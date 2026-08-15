// src/pages/cuentas/CuadroCuenta.tsx — el "Desglose de cuenta": el Cuadro de
// Presentación de Cuenta (tipo ETESA) dentro de la app. La cantidad ejecutada
// de "este periodo" es editable; % y valores se calculan en vivo.
//
// Es una PANTALLA propia, no una sección del detalle: hay desgloses de cientos
// de filas y desplegarlos dentro de la cuenta aplastaba la página. Se entra
// desde la fila del desglose en "Documentos de la cuenta" y se sale con la
// flecha. Ver FRONTEND_CONVENTIONS.md §23.
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { ScrollBar } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2, Minus, Plus } from 'lucide-react';
import { PageHeader, TableSkeleton, ErrorState } from '@/components/shell';
import { grupoBgClass, padClass } from '@/components/desglose/desglosePad';
import { cn } from '@/lib/utils';
import { getCuadro, saveCuadro, type CuadroDoc } from '@/lib/cuadroApi';
import {
  calcLinea, calcTotales, cantidadDisponible, depthMap, esContenedor, parentsSet,
  validarCantidad, type CantidadError, type CuadroLinea,
} from '@/lib/cuadroModel';

const LOCKED_ESTADOS = ['aprobada', 'pagada', 'aprobada_institucion', 'aprobada_contraloria'];

/** Decimales del % — dos es el mínimo legible, diez es lo que llega a pedir
 *  la entidad cuando revisa que las sumas cuadren. */
const DEC_MIN = 2;
const DEC_MAX = 10;

const money = (n: number) => `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Retícula ────────────────────────────────────────────────────────────
// Una sola regla y los bordes no se enredan: la línea VERTICAL la dibuja el
// borde derecho de la celda y la HORIZONTAL el inferior — una línea, una
// celda, nunca dos pegadas. La última columna y la última fila no llevan
// borde: ese marco lo pone la Card.
const CELL = 'border-b border-r border-cuadro-grid bg-card px-2 py-1.5 align-middle leading-4';
const HEAD =
  'sticky z-30 h-[30px] border-b border-r border-cuadro-line bg-slate-200 px-2 py-1.5 '
  + 'text-center text-[11px] font-semibold uppercase leading-4 tracking-wide text-foreground whitespace-nowrap';
/** Totales: mismas líneas fuertes del encabezado y pegados al pie del panel. */
const FOOT =
  'sticky z-30 h-[30px] border-b border-r border-t-cuadro-line border-b-cuadro-line '
  + 'border-r-cuadro-line bg-slate-200 px-2 py-1.5 align-middle text-xs font-semibold leading-4';
/** Columnas congeladas: al correr a la derecha se sigue viendo qué actividad es. */
const FX1 = 'sticky left-0 z-20 w-[68px] min-w-[68px] max-w-[68px]';
const FX2 = 'sticky left-[68px] z-20 w-[300px] min-w-[300px] max-w-[300px]';
const NUM = 'text-right tabular-nums whitespace-nowrap';
/** Actividades respira un poco más que el resto: es la única columna de texto. */
const DESC_PAD = 'pl-3';
/** Sin borde derecho en la última celda de cada fila (el marco es la Card). */
const ROW = '[&>*:last-child]:border-r-0';

interface Props {
  cuentaId: number;
  /** Para el subtítulo: "Cuenta 3 · Proyecto". */
  cuentaNumero?: number;
  proyectoNombre?: string | null;
  onBack?: () => void;
  onSaved?: () => void;
  /** Abre la hoja que se imprime y se entrega. */
  onVistaPrevia?: () => void;
}

export default function CuadroCuenta({
  cuentaId, cuentaNumero, proyectoNombre, onBack, onSaved, onVistaPrevia,
}: Props) {
  const [doc, setDoc] = useState<CuadroDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decimales, setDecimales] = useState(DEC_MIN);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setDoc(await getCuadro(cuentaId));
      setEdits({});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cuentaId]);

  useEffect(() => { load(); }, [load]);

  const locked = doc ? LOCKED_ESTADOS.includes(doc.cuenta.estado) : true;

  const pct = useCallback(
    (frac: number) => `${(frac * 100).toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}%`,
    [decimales],
  );

  // Cantidad ejecutada efectiva de una fila (edición local si existe).
  const ejecutadaDe = useCallback(
    (l: CuadroLinea): number => {
      const e = edits[l.rowUid];
      if (e === undefined) return l.cantidadEjecutada;
      const n = parseFloat(e);
      return Number.isFinite(n) ? n : 0;
    },
    [edits],
  );

  // Filas con la cantidad de este periodo ya fusionada (para calcular en vivo).
  const merged = useMemo<CuadroLinea[]>(
    () => (doc ? doc.lineas.map((l) => ({ ...l, cantidadEjecutada: ejecutadaDe(l) })) : []),
    [doc, ejecutadaDe],
  );
  const parents = useMemo(() => parentsSet(merged), [merged]);
  const depths = useMemo(() => depthMap(merged), [merged]);
  const totales = useMemo(() => calcTotales(merged), [merged]);

  const dirty = useMemo(
    () =>
      !!doc &&
      Object.keys(edits).some((uid) => {
        const orig = doc.lineas.find((x) => x.rowUid === uid)?.cantidadEjecutada ?? 0;
        const cur = parseFloat(edits[uid]);
        return (Number.isFinite(cur) ? cur : 0) !== orig;
      }),
    [doc, edits],
  );

  // Errores por fila: nunca negativo, nunca más de lo disponible. Se calculan
  // sobre `merged` (lo que el usuario ve) y bloquean el guardado; el backend
  // repite la misma validación.
  const errores = useMemo(() => {
    const m = new Map<string, CantidadError>();
    for (const l of merged) {
      if (esContenedor(l, parents)) continue;
      const texto = edits[l.rowUid];
      const valor = texto === undefined ? l.cantidadEjecutada : parseFloat(texto);
      // Un campo vacío se guarda como 0, no es un error.
      if (texto !== undefined && texto.trim() === '') continue;
      const err = validarCantidad(valor, l);
      if (err) m.set(l.rowUid, err);
    }
    return m;
  }, [merged, parents, edits]);

  const guardar = async () => {
    if (!doc || errores.size > 0) return;
    setSaving(true);
    try {
      const payload = merged
        .filter((l) => !esContenedor(l, parents))
        .map((l) => ({ rowUid: l.rowUid, cantidadEjecutada: l.cantidadEjecutada }));
      const res = await saveCuadro(cuentaId, payload);
      setDoc(res);
      setEdits({});
      onSaved?.();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const subtitulo = [
    cuentaNumero != null ? `Cuenta ${cuentaNumero}` : null,
    proyectoNombre || null,
  ].filter(Boolean).join(' · ');

  const encabezado = (
    <div className="flex items-center gap-3">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Volver a la cuenta"
          className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <PageHeader title="Desglose de cuenta" subtitle={subtitulo || undefined} />
      <div className="ml-auto flex items-center gap-3">
        {!locked && doc && errores.size > 0 && (
          <span className="text-xs text-error">
            {errores.size} cantidad{errores.size === 1 ? '' : 'es'} fuera de rango
          </span>
        )}
        {onVistaPrevia && (
          <Button variant="outline" size="sm" onClick={onVistaPrevia}>
            <FileText className="mr-2 h-4 w-4" />
            Vista previa
          </Button>
        )}
        {!locked && doc && (
          <Button size="sm" onClick={guardar} disabled={!dirty || saving || errores.size > 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar avance
          </Button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="space-y-4">{encabezado}<TableSkeleton rows={8} /></div>;
  }
  if (error || !doc) {
    return <div className="space-y-4">{encabezado}<ErrorState onRetry={load} /></div>;
  }

  return (
    <div className="space-y-4">
      {encabezado}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
          <span>
            % Avance del periodo:{' '}
            <span className="font-semibold tabular-nums text-navy">{pct(totales.pctPeriodo)}</span>
          </span>
          <span>
            % Avance del total:{' '}
            <span className="font-semibold tabular-nums text-navy">{pct(totales.pctTotal)}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Decimales del %</span>
          <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-muted-foreground hover:text-foreground"
              aria-label="Menos decimales"
              disabled={decimales <= DEC_MIN}
              onClick={() => setDecimales((d) => Math.max(DEC_MIN, d - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-7 border-x border-border text-center text-[13px] font-semibold leading-7 tabular-nums text-foreground">
              {decimales}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-muted-foreground hover:text-foreground"
              aria-label="Más decimales"
              disabled={decimales >= DEC_MAX}
              onClick={() => setDecimales((d) => Math.min(DEC_MAX, d + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* El panel lleva sus DOS scrolls adentro: así la barra horizontal queda
          al pie del panel y no al final de una tabla de cientos de filas.
          Se compone con las primitivas de Radix (no con <ScrollArea>, que solo
          monta la barra vertical) para tener también la horizontal, y con
          type="always" para que esa barra esté siempre visible.
          El envoltorio display:table que mete Radix se deja como está: es lo
          que hace que el ancho real de la tabla llegue al viewport y por tanto
          lo que hace aparecer la barra horizontal. */}
      <Card className="overflow-hidden border-cuadro-line p-0">
        <ScrollAreaPrimitive.Root type="always" className="relative overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="max-h-[min(68vh,620px)] w-full overscroll-contain rounded-[inherit]">
          <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-xs">
            <thead>
              <tr className={ROW}>
                <th rowSpan={2} className={cn(HEAD, FX1, 'top-0 z-40')}>N°</th>
                <th rowSpan={2} className={cn(HEAD, FX2, 'top-0 z-40')}>Actividades</th>
                <th rowSpan={2} className={cn(HEAD, 'top-0 w-16')}>Unidad</th>
                <th colSpan={3} className={cn(HEAD, 'top-0')}>Presupuesto estimado</th>
                <th colSpan={3} className={cn(HEAD, 'top-0')}>Hasta periodo anterior</th>
                <th colSpan={3} className={cn(HEAD, 'top-0')}>Este periodo</th>
                <th colSpan={3} className={cn(HEAD, 'top-0')}>Total a la fecha</th>
                <th colSpan={3} className={cn(HEAD, 'top-0')}>Por ejecutar</th>
              </tr>
              <tr className={ROW}>
                {['Cant.', 'P. Unitario', 'Total',
                  'Cant.', '%', 'Valor',
                  'Cant.', '%', 'Valor',
                  'Cant.', '%', 'Valor',
                  'Cant.', '%', 'Valor'].map((h, i) => (
                    <th key={i} className={cn(HEAD, 'top-[30px] normal-case tracking-normal')}>{h}</th>
                  ))}
              </tr>
            </thead>

            <tbody>
              {merged.map((l, idx) => {
                const contenedor = esContenedor(l, parents);
                const depth = depths.get(l.rowUid) ?? 0;
                const ultima = idx === merged.length - 1;
                // La última fila no lleva línea inferior: el borde superior del
                // pie (que está siempre a la vista) es el que cierra el cuerpo.
                // Si ambas la dibujaran se verían dos líneas pegadas.
                const cierre = ultima ? 'border-b-0' : '';

                if (contenedor) {
                  // Banda de grupo: bloque limpio, ninguna línea vertical la
                  // corta. Las dos primeras celdas siguen congeladas para que
                  // el título no se pierda al desplazar.
                  return (
                    <tr
                      key={l.rowUid}
                      className={cn(ROW, grupoBgClass(depth), '[&>td]:border-r-transparent [&>td]:font-semibold')}
                    >
                      <td className={cn(CELL, FX1, cierre, 'bg-transparent text-center tabular-nums')}>
                        {l.item}
                      </td>
                      {/* La sangría va en un div, no en la celda: `pl-0` sobre
                          el <td> anularía su propio px-2 y el texto quedaría
                          pegado al borde (mismo patrón que DesgloseTableRow). */}
                      <td className={cn(CELL, FX2, cierre, DESC_PAD, 'bg-transparent')}>
                        <div className={padClass(depth)}>{l.descripcion}</div>
                      </td>
                      {Array.from({ length: 16 }, (_, i) => (
                        <td key={i} className={cn(CELL, cierre, 'bg-transparent')} />
                      ))}
                    </tr>
                  );
                }

                const c = calcLinea(l, false, depth);
                return (
                  <tr key={l.rowUid} className={cn(ROW, 'hover:[&>td]:bg-slate-50/70')}>
                    <td className={cn(CELL, FX1, cierre, 'text-center tabular-nums text-muted-foreground')}>
                      {l.item}
                    </td>
                    <td className={cn(CELL, FX2, cierre, DESC_PAD, 'break-words')}>
                      <div className={padClass(depth)}>{l.descripcion}</div>
                    </td>
                    <td className={cn(CELL, cierre, 'text-center tabular-nums whitespace-nowrap')}>{l.unidad}</td>

                    <td className={cn(CELL, NUM, cierre)}>{qty(l.cantidadPresupuesto ?? 0)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{money(l.precioUnitario ?? 0)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{money(c.presupuestoTotal)}</td>

                    <td className={cn(CELL, NUM, cierre)}>{qty(c.anterior.cant)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{pct(c.anterior.pct)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{money(c.anterior.valor)}</td>

                    {/* Este periodo — editable, en rojo como en el documento.
                        Tope: la cantidad disponible (presupuesto − anterior). */}
                    <td className={cn(CELL, NUM, cierre, 'text-error')}>
                      {locked ? (
                        qty(l.cantidadEjecutada)
                      ) : (
                        <Input
                          value={edits[l.rowUid] ?? String(l.cantidadEjecutada)}
                          inputMode="decimal"
                          min={0}
                          max={cantidadDisponible(l)}
                          aria-invalid={errores.has(l.rowUid) || undefined}
                          title={`Disponible: ${qty(cantidadDisponible(l))}`}
                          onChange={(e) => setEdits((p) => ({ ...p, [l.rowUid]: e.target.value }))}
                          className={cn(
                            'h-7 w-[84px] px-1.5 text-right text-xs tabular-nums text-error',
                            errores.has(l.rowUid) && 'border-error ring-1 ring-error/40',
                          )}
                        />
                      )}
                    </td>
                    <td className={cn(CELL, NUM, cierre, 'text-error')}>{pct(c.este.pct)}</td>
                    <td className={cn(CELL, NUM, cierre, 'text-error')}>{money(c.este.valor)}</td>

                    <td className={cn(CELL, NUM, cierre)}>{qty(c.fecha.cant)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{pct(c.fecha.pct)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{money(c.fecha.valor)}</td>

                    <td className={cn(CELL, NUM, cierre)}>{qty(c.falta.cant)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{pct(c.falta.pct)}</td>
                    <td className={cn(CELL, NUM, cierre)}>{money(c.falta.valor)}</td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totales pegados al pie: siempre a la vista, con las mismas
                líneas fuertes del encabezado. Los `bottom` son exactos porque
                cada fila mide justo 30px (16 de línea + 12 de padding + 1 de
                borde ≤ 30); si cambia el padding hay que rehacerlos. */}
            <tfoot>
              <tr className={ROW}>
                <td className={cn(FOOT, FX1, 'bottom-[30px] z-40 border-t')} />
                <td className={cn(FOOT, FX2, DESC_PAD, 'bottom-[30px] z-40 border-t')}>SUB-TOTAL</td>
                <td className={cn(FOOT, 'bottom-[30px] border-t')} />
                <td colSpan={2} className={cn(FOOT, 'bottom-[30px] border-t')} />
                <td className={cn(FOOT, NUM, 'bottom-[30px] border-t')}>{money(totales.presupuesto)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-[30px] border-t')} />
                <td className={cn(FOOT, NUM, 'bottom-[30px] border-t')}>{money(totales.anterior)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-[30px] border-t')} />
                <td className={cn(FOOT, NUM, 'bottom-[30px] border-t text-error')}>{money(totales.este)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-[30px] border-t')} />
                <td className={cn(FOOT, NUM, 'bottom-[30px] border-t')}>{money(totales.fecha)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-[30px] border-t')} />
                <td className={cn(FOOT, NUM, 'bottom-[30px] border-t')}>{money(totales.falta)}</td>
              </tr>
              <tr className={ROW}>
                <td className={cn(FOOT, FX1, 'bottom-0 z-40 border-b-0')} />
                <td className={cn(FOOT, FX2, DESC_PAD, 'bottom-0 z-40 border-b-0')}>PORCENTAJE (%)</td>
                <td className={cn(FOOT, 'bottom-0 border-b-0')} />
                <td colSpan={2} className={cn(FOOT, 'bottom-0 border-b-0')} />
                <td className={cn(FOOT, NUM, 'bottom-0 border-b-0')}>{pct(1)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-0 border-b-0')} />
                <td className={cn(FOOT, NUM, 'bottom-0 border-b-0')}>{pct(totales.pctAnterior)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-0 border-b-0')} />
                <td className={cn(FOOT, NUM, 'bottom-0 border-b-0 text-error')}>{pct(totales.pctPeriodo)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-0 border-b-0')} />
                <td className={cn(FOOT, NUM, 'bottom-0 border-b-0')}>{pct(totales.pctTotal)}</td>
                <td colSpan={2} className={cn(FOOT, 'bottom-0 border-b-0')} />
                <td className={cn(FOOT, NUM, 'bottom-0 border-b-0')}>{pct(totales.pctFalta)}</td>
              </tr>
            </tfoot>
          </table>
          </ScrollAreaPrimitive.Viewport>
          {/* z-50: por encima del encabezado y el pie fijos (z-30/z-40), o las
              barras quedan escondidas detrás de ellos. */}
          <ScrollBar orientation="vertical" className="z-50" />
          <ScrollBar orientation="horizontal" className="z-50" />
          <ScrollAreaPrimitive.Corner className="z-50" />
        </ScrollAreaPrimitive.Root>
      </Card>
    </div>
  );
}
