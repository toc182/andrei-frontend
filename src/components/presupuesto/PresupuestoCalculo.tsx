// PresupuestoCalculo — la tabla de calculo que se despliega DEBAJO de un
// renglon de la hoja (aprobado por Ivan el 2026-08-24: se despliega en su
// sitio, no en una ventana).
//
// La regla, en una linea: cada FILA es una cosa real —un trabajador, un
// material, un equipo— y TODAS las columnas multiplican. Una casilla vacia no
// multiplica. Los nombres de las columnas los escribe el usuario y son propios
// de cada renglon, por eso la cabecera es editable.

import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import {
  calculoTotal, calculoTotalPorClase, lineaTotal, newUid,
  type CalculoLinea, type Clase, type RenglonCalculo,
} from '@/lib/presupuestoModel';
import { NumberCell } from './NumberCell';
import { cellInputClass as cellInput } from './celdas';

const CLASES: { value: Clase; label: string }[] = [
  { value: 'mano_obra', label: 'Mano de obra' },
  { value: 'material', label: 'Material' },
  { value: 'equipo', label: 'Equipo' },
];

interface PresupuestoCalculoProps {
  calculo: RenglonCalculo;
  /** En los items cada linea dice si es mano de obra, material o equipo; en
   *  Costos Generales esa columna no existe. */
  mostrarClase: boolean;
  /** Cantidad del item, para repartir el costo y mostrar el unitario. */
  cantidad: number | null;
  unidad: string | null;
  onChange: (calculo: RenglonCalculo) => void;
}

export function PresupuestoCalculo({
  calculo, mostrarClase, cantidad, unidad, onChange,
}: PresupuestoCalculoProps) {
  const { columnas, lineas } = calculo;
  const total = calculoTotal(calculo);
  const unitario = cantidad != null && cantidad !== 0 ? total / cantidad : null;

  const setLinea = (uid: string, patch: Partial<CalculoLinea>) =>
    onChange({ ...calculo, lineas: lineas.map((l) => (l.uid === uid ? { ...l, ...patch } : l)) });

  const setValor = (linea: CalculoLinea, colUid: string, valor: number | null) =>
    setLinea(linea.uid, { valores: { ...linea.valores, [colUid]: valor } });

  const addColumna = () =>
    onChange({ ...calculo, columnas: [...columnas, { uid: newUid(), nombre: '' }] });

  // Al quitar una columna se limpian sus casillas en todas las lineas: dejar
  // valores huerfanos haria que el backend rechace el guardado.
  const removeColumna = (uid: string) =>
    onChange({
      columnas: columnas.filter((c) => c.uid !== uid),
      lineas: lineas.map((l) => {
        const { [uid]: _quitada, ...resto } = l.valores;
        return { ...l, valores: resto };
      }),
    });

  const addLinea = () =>
    onChange({
      ...calculo,
      lineas: [...lineas, { uid: newUid(), concepto: '', clase: null, valores: {} }],
    });

  const removeLinea = (uid: string) =>
    onChange({ ...calculo, lineas: lineas.filter((l) => l.uid !== uid) });

  const colCount = (mostrarClase ? 2 : 1) + columnas.length + 2;

  return (
    <div className="border-l-2 border-l-teal bg-muted/40 py-2 pl-4 pr-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {mostrarClase && (
                <th className="px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Qué es
                </th>
              )}
              <th className="w-full px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Concepto
              </th>
              {columnas.map((c) => (
                <th key={c.uid} className="px-2 py-1.5 align-bottom">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-teal">×</span>
                    <Input
                      value={c.nombre}
                      placeholder="Columna"
                      maxLength={30}
                      onChange={(e) =>
                        onChange({
                          ...calculo,
                          columnas: columnas.map((x) =>
                            x.uid === c.uid ? { ...x, nombre: e.target.value } : x),
                        })
                      }
                      className={cn(cellInput, 'w-24 text-center')}
                    />
                    <button
                      type="button"
                      title="Quitar columna"
                      aria-label="Quitar columna"
                      onClick={() => removeColumna(c.uid)}
                      className="text-muted-foreground transition-colors hover:text-error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-2 py-1.5">
                <button
                  type="button"
                  onClick={addColumna}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-3 w-3" />
                  columna
                </button>
              </th>
              <th className="px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.uid} className="group border-b border-border/60 last:border-0">
                {mostrarClase && (
                  <td className="px-2 py-1">
                    <Select
                      value={l.clase ?? 'ninguna'}
                      onValueChange={(v) =>
                        setLinea(l.uid, { clase: v === 'ninguna' ? null : (v as Clase) })}
                    >
                      <SelectTrigger className={cn(cellInput, 'w-[132px]')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ninguna">Sin clasificar</SelectItem>
                        {CLASES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                )}
                <td className="px-2 py-1">
                  <Input
                    value={l.concepto}
                    placeholder={mostrarClase ? 'Concreto, albañil, vibrador…' : 'Capataz, albañil, ayudante…'}
                    onChange={(e) => setLinea(l.uid, { concepto: e.target.value })}
                    className={cn(cellInput, 'w-full')}
                  />
                </td>
                {columnas.map((c) => (
                  <td key={c.uid} className="px-2 py-1">
                    <NumberCell
                      key={`${l.uid}-${c.uid}`}
                      ariaLabel={c.nombre || 'Multiplicador'}
                      value={l.valores[c.uid] ?? null}
                      onCommit={(v) => setValor(l, c.uid, v)}
                      className="w-24"
                    />
                  </td>
                ))}
                <td />
                <td className="whitespace-nowrap px-2 py-1 text-right font-medium tabular-nums">
                  <div className="flex items-center justify-end gap-2">
                    {formatMoney(lineaTotal(calculo, l))}
                    <button
                      type="button"
                      title="Eliminar línea"
                      aria-label="Eliminar línea"
                      onClick={() => removeLinea(l.uid)}
                      className="invisible text-muted-foreground transition-colors group-hover:visible hover:text-error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            <tr>
              <td colSpan={colCount} className="px-2 py-1.5">
                <button
                  type="button"
                  onClick={addLinea}
                  className="flex items-center gap-1 text-xs font-semibold text-teal transition-opacity hover:opacity-80"
                >
                  <Plus className="h-3.5 w-3.5" />
                  agregar línea
                </button>
              </td>
            </tr>

            {/* Subtotales por mundo: solo en items, y solo los que tienen algo.
                Sirven para ver cuanto pesa la mano de obra dentro del item. */}
            {mostrarClase && CLASES.map(({ value, label }) => {
              const t = calculoTotalPorClase(calculo, value);
              if (!t) return null;
              return (
                <tr key={value} className="text-muted-foreground">
                  <td colSpan={colCount - 1} className="px-2 py-0.5 text-right text-xs">{label}</td>
                  <td className="whitespace-nowrap px-2 py-0.5 text-right text-xs tabular-nums">
                    {formatMoney(t)}
                  </td>
                </tr>
              );
            })}

            <tr className="border-t border-border font-semibold">
              <td colSpan={colCount - 1} className="px-2 py-1.5 text-right">
                Costo del renglón
                {unitario != null && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {formatMoney(unitario)} por {unidad || 'unidad'}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                {formatMoney(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}