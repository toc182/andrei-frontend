// src/pages/cuentas/CuadroCuenta.tsx — Cuadro de Presentación de Cuenta (ETESA)
// dentro de la app. La cantidad ejecutada de "este periodo" es editable; % y
// valores se calculan en vivo. Espejo del mock aprobado, con tokens del ERP.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { SectionHeader, TableSkeleton, ErrorState } from '@/components/shell';
import { cn } from '@/lib/utils';
import { getCuadro, saveCuadro, type CuadroDoc } from '@/lib/cuadroApi';
import {
  calcLinea, calcTotales, depthMap, esContenedor, parentsSet, type CuadroLinea,
} from '@/lib/cuadroModel';

const LOCKED_ESTADOS = ['aprobada', 'pagada', 'aprobada_institucion', 'aprobada_contraloria'];
const PL = ['pl-2', 'pl-6', 'pl-10', 'pl-14'];
const DECIMALES = [2, 4, 7] as const;

const money = (n: number) => `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  cuentaId: number;
  onSaved?: () => void;
}

export default function CuadroCuenta({ cuentaId, onSaved }: Props) {
  const [doc, setDoc] = useState<CuadroDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decimales, setDecimales] = useState<number>(2);
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

  const guardar = async () => {
    if (!doc) return;
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

  if (loading) return <TableSkeleton rows={8} />;
  if (error || !doc) return <ErrorState onRetry={load} />;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Desglose de cuenta" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Decimales del %</span>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {DECIMALES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDecimales(d)}
                  aria-pressed={decimales === d}
                  className={cn(
                    'px-2.5 py-1 text-xs',
                    decimales === d ? 'bg-navy text-white' : 'bg-background text-muted-foreground',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {!locked && (
            <Button size="sm" onClick={guardar} disabled={!dirty || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar avance
            </Button>
          )}
        </div>
      </div>

      {/* Resumen de avance del periodo / total */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          % Avance del periodo:{' '}
          <span className="font-semibold tabular-nums text-navy">{pct(totales.pctPeriodo)}</span>
        </span>
        <span className="text-muted-foreground">
          % Avance del total:{' '}
          <span className="font-semibold tabular-nums text-navy">{pct(totales.pctTotal)}</span>
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-xs">
            <thead>
              <tr className="[&>th]:border [&>th]:border-border [&>th]:bg-muted [&>th]:p-1.5 [&>th]:text-center [&>th]:font-semibold">
                <th rowSpan={2} className="w-12">N°</th>
                <th rowSpan={2} className="min-w-[260px] text-left">Actividades</th>
                <th rowSpan={2} className="w-14">Unidad</th>
                <th colSpan={3}>Presupuesto estimado</th>
                <th colSpan={3}>Ejecutado hasta periodo anterior</th>
                <th colSpan={3}>Ejecutado en este periodo</th>
                <th colSpan={3}>Ejecutado total a la fecha</th>
                <th colSpan={3}>Trabajo por ejecutar</th>
              </tr>
              <tr className="[&>th]:border [&>th]:border-border [&>th]:bg-muted [&>th]:p-1.5 [&>th]:text-center [&>th]:font-medium">
                <th>Cant.</th><th>P. Unitario</th><th>Total</th>
                <th>Cant.</th><th>%</th><th>Valor</th>
                <th>Cant.</th><th>%</th><th>Valor</th>
                <th>Cant.</th><th>%</th><th>Valor</th>
                <th>Cant.</th><th>%</th><th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((l) => {
                const contenedor = esContenedor(l, parents);
                const depth = depths.get(l.rowUid) ?? 0;
                if (contenedor) {
                  return (
                    <tr key={l.rowUid} className="[&>td]:border [&>td]:border-border [&>td]:bg-muted [&>td]:p-1.5 [&>td]:font-semibold">
                      <td className="tabular-nums">{l.item}</td>
                      <td colSpan={17} className={PL[Math.min(depth, 3)]}>{l.descripcion}</td>
                    </tr>
                  );
                }
                const c = calcLinea(l, false, depth);
                return (
                  <tr key={l.rowUid} className="[&>td]:border [&>td]:border-border [&>td]:p-1.5 [&>td]:tabular-nums">
                    <td className="font-medium">{l.item}</td>
                    <td className={cn('whitespace-normal', PL[Math.min(depth, 3)])}>{l.descripcion}</td>
                    <td className="text-center">{l.unidad}</td>
                    {/* Presupuesto */}
                    <td className="text-right">{qty(l.cantidadPresupuesto ?? 0)}</td>
                    <td className="text-right">{money(l.precioUnitario ?? 0)}</td>
                    <td className="text-right">{money(c.presupuestoTotal)}</td>
                    {/* Hasta anterior */}
                    <td className="text-right">{qty(c.anterior.cant)}</td>
                    <td className="text-right">{pct(c.anterior.pct)}</td>
                    <td className="text-right">{money(c.anterior.valor)}</td>
                    {/* Este periodo (editable) — rojo, como el documento */}
                    <td className="text-right text-error">
                      {locked ? (
                        qty(l.cantidadEjecutada)
                      ) : (
                        <Input
                          value={edits[l.rowUid] ?? String(l.cantidadEjecutada)}
                          inputMode="decimal"
                          onChange={(e) => setEdits((p) => ({ ...p, [l.rowUid]: e.target.value }))}
                          className="h-7 w-20 px-1.5 text-right text-xs tabular-nums text-error"
                        />
                      )}
                    </td>
                    <td className="text-right text-error">{pct(c.este.pct)}</td>
                    <td className="text-right text-error">{money(c.este.valor)}</td>
                    {/* Total a la fecha */}
                    <td className="text-right">{qty(c.fecha.cant)}</td>
                    <td className="text-right">{pct(c.fecha.pct)}</td>
                    <td className="text-right">{money(c.fecha.valor)}</td>
                    {/* Por ejecutar */}
                    <td className="text-right">{qty(c.falta.cant)}</td>
                    <td className="text-right">{pct(c.falta.pct)}</td>
                    <td className="text-right">{money(c.falta.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="[&>td]:border [&>td]:border-border [&>td]:bg-muted [&>td]:p-1.5 [&>td]:font-semibold [&>td]:tabular-nums">
                <td colSpan={3} className="text-center">SUB-TOTAL</td>
                <td colSpan={2}></td>
                <td className="text-right">{money(totales.presupuesto)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{money(totales.anterior)}</td>
                <td colSpan={2}></td>
                <td className="text-right text-error">{money(totales.este)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{money(totales.fecha)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{money(totales.falta)}</td>
              </tr>
              <tr className="[&>td]:border [&>td]:border-border [&>td]:bg-muted [&>td]:p-1.5 [&>td]:font-semibold [&>td]:tabular-nums">
                <td colSpan={3} className="text-center">PORCENTAJE (%)</td>
                <td colSpan={2}></td>
                <td className="text-right">{pct(1)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{pct(totales.pctAnterior)}</td>
                <td colSpan={2}></td>
                <td className="text-right text-error">{pct(totales.pctPeriodo)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{pct(totales.pctTotal)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{pct(totales.pctFalta)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </section>
  );
}
