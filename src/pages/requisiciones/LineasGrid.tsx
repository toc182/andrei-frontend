/**
 * Las líneas de una requisición, como una tabla donde se escribe en la casilla.
 *
 * Es la misma retícula de las tablas de captura del desglose y del presupuesto
 * (FRONTEND_CONVENTIONS §22–23, «La retícula: una regla, dos colores»): texto
 * plano en cada casilla y la línea fuerte en toda ella. Ivan, 2026-10-02: «no me
 * gustan esos fields, me gustaría que se viera como una tabla». Cada casilla es
 * un campo sin borde ni anillo, así que se ve como texto y al hacer clic solo
 * aparece el cursor; Tab pasa a la siguiente, como en Excel.
 *
 * En el teléfono no cabe una tabla de cinco columnas: va un bloque por línea,
 * con sus cajitas, igual que el detalle de compra de la orden de compra.
 */
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { lineaVacia } from './lineas';
import type { LineaBorrador } from './tipos';

type Campo = 'cantidad' | 'unidad' | 'descripcion' | 'renglon_desglose';

const TOPE: Record<Campo, number> = { cantidad: 14, unidad: 50, descripcion: 500, renglon_desglose: 100 };

interface Props {
  lineas: LineaBorrador[];
  onChange: (lineas: LineaBorrador[]) => void;
  /** Las líneas con algún problema, por su posición (0, 1, 2…), para marcarlas. */
  conError?: Set<number>;
}

const CELDA = 'h-5 w-full min-w-0 rounded-none border-0 bg-transparent p-0 text-sm leading-5 shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0';
const CABECERA = 'border-b border-r border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap';

export function LineasGrid({ lineas, onChange, conError }: Props) {
  const cambiar = (i: number, campo: Campo, valor: string) =>
    onChange(lineas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  const quitar = (i: number) => {
    const resto = lineas.filter((_, j) => j !== i);
    onChange(resto.length ? resto : [lineaVacia()]);
  };
  const agregar = () => onChange([...lineas, lineaVacia()]);

  const etiqueta = (campo: Campo, n: number) =>
    ({ cantidad: 'Cantidad', unidad: 'Unidad', descripcion: 'Descripción', renglon_desglose: 'Renglón del desglose' })[campo] +
    `, línea ${n}`;

  const celda = (l: LineaBorrador, i: number, campo: Campo, className?: string) => (
    <Input
      aria-label={etiqueta(campo, i + 1)}
      value={l[campo]}
      maxLength={TOPE[campo]}
      inputMode={campo === 'cantidad' ? 'decimal' : undefined}
      onChange={(e) => cambiar(i, campo, e.target.value)}
      className={cn(CELDA, className)}
    />
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Teléfono: un bloque por línea. */}
      <div className="divide-y divide-slate-100 md:hidden">
        {lineas.map((l, i) => (
          <div key={l.clave} className={cn('space-y-2 px-3 py-3', conError?.has(i) && 'bg-error/[0.04]')}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Línea {i + 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                aria-label={`Quitar la línea ${i + 1}`}
                onClick={() => quitar(i)}
              >
                <X className="h-3.5 w-3.5 text-error" />
              </Button>
            </div>
            <Input
              aria-label={etiqueta('descripcion', i + 1)}
              placeholder="Descripción"
              value={l.descripcion}
              maxLength={TOPE.descripcion}
              onChange={(e) => cambiar(i, 'descripcion', e.target.value)}
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-muted-foreground">Cantidad</span>
                <Input
                  aria-label={etiqueta('cantidad', i + 1)}
                  value={l.cantidad}
                  inputMode="decimal"
                  maxLength={TOPE.cantidad}
                  onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                  className="mt-1 h-9 text-right tabular-nums"
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Unidad</span>
                <Input
                  aria-label={etiqueta('unidad', i + 1)}
                  value={l.unidad}
                  maxLength={TOPE.unidad}
                  onChange={(e) => cambiar(i, 'unidad', e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Renglón del desglose</span>
              <Input
                aria-label={etiqueta('renglon_desglose', i + 1)}
                value={l.renglon_desglose}
                maxLength={TOPE.renglon_desglose}
                onChange={(e) => cambiar(i, 'renglon_desglose', e.target.value)}
                className="mt-1 h-9 tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Escritorio: la retícula. Cada línea la dibuja UNA casilla —la vertical
          es su border-r, la horizontal su border-b—, la última columna sin
          border-r y la última fila sin border-b: el marco lo pone la caja. */}
      <div className="hidden md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-slate-200">
              <th className={cn(CABECERA, 'w-12 rounded-tl-lg text-center')}>N°</th>
              <th className={cn(CABECERA, 'w-28 text-center')}>Cantidad</th>
              <th className={cn(CABECERA, 'w-32 text-center')}>Unidad</th>
              <th className={cn(CABECERA, 'text-left')}>Descripción</th>
              <th className={cn(CABECERA, 'w-52 rounded-tr-lg border-r-0 text-center')}>Renglón del desglose</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const ultima = i === lineas.length - 1;
              const borde = cn('border-cuadro-line px-4 py-2', !ultima && 'border-b');
              return (
                <tr key={l.clave} className={cn('group', conError?.has(i) && 'bg-error/[0.04]')}>
                  <td className={cn(borde, 'border-r text-center tabular-nums text-muted-foreground')}>{i + 1}</td>
                  <td className={cn(borde, 'border-r')}>{celda(l, i, 'cantidad', 'text-center tabular-nums')}</td>
                  <td className={cn(borde, 'border-r')}>{celda(l, i, 'unidad', 'text-center')}</td>
                  <td className={cn(borde, 'border-r')}>{celda(l, i, 'descripcion')}</td>
                  <td className={cn(borde, 'relative')}>
                    {celda(l, i, 'renglon_desglose', 'text-center tabular-nums')}
                    {/* La ✕ de la línea asoma por la orilla derecha al pasar el
                        ratón, como en el desglose. */}
                    <button
                      type="button"
                      onClick={() => quitar(i)}
                      title="Quitar la línea"
                      aria-label={`Quitar la línea ${i + 1}`}
                      className={cn(
                        'absolute -right-3 top-1/2 z-20 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full',
                        'border border-border bg-card text-muted-foreground shadow-sm transition-colors',
                        'hover:border-error hover:text-error focus-visible:flex group-hover:flex',
                      )}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-b-lg border-t border-cuadro-line bg-slate-50 px-3 py-3">
        <Button variant="outline" size="sm" onClick={agregar}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar línea
        </Button>
      </div>
    </div>
  );
}
