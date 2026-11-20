// La tabla de Permisos: una fila por sección, Ver / Crear / Editar / Borrar y
// «Además». Verde = puede (Ivan, 2026-10-07). Paso 1: cada casilla es una llave
// de hoy y ninguna enciende otra, porque hoy son independientes.
import { Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CATALOGO, COLUMNAS, FIJO, type Celda, type Fijo, type Llave, type Permisos, type Seccion } from './catalogo';

interface Props {
  permisos: Permisos;
  onCambiar?: (llave: Llave) => void;
  /** Gerencia: todo encendido, nada se cambia. */
  bloqueada?: boolean;
}

// Las columnas de la retícula en computadora: sección, las cuatro, «Además».
const RETICULA = 'md:grid md:grid-cols-[minmax(0,230px)_repeat(4,60px)_minmax(0,1fr)] md:items-center md:gap-x-1';
const SPAN = ['', 'md:col-span-1', 'md:col-span-2', 'md:col-span-3', 'md:col-span-4'];

function InfoSeccion({ seccion }: { seccion: Seccion }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Qué es ${seccion.nombre}`}
          className="inline-flex shrink-0 items-center justify-center rounded text-muted-foreground hover:text-navy focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[280px] px-3 py-2 text-sm leading-snug">
        {seccion.info}
      </PopoverContent>
    </Popover>
  );
}

export function TablaPermisos({ permisos, onCambiar, bloqueada = false }: Props) {
  const caja = (llave: Llave, texto: string, conTexto: boolean) => {
    const puede = bloqueada || !!permisos[llave];
    return (
      <label
        key={llave}
        title={texto}
        className={cn(
          'inline-flex items-start gap-1.5 py-0.5 text-[12.5px] leading-snug',
          bloqueada ? 'cursor-default' : 'cursor-pointer',
          puede && !bloqueada ? 'font-semibold text-success' : 'text-muted-foreground',
        )}
      >
        <Checkbox
          checked={puede}
          disabled={bloqueada}
          onCheckedChange={() => onCambiar?.(llave)}
          aria-label={texto}
          className="mt-px data-[state=checked]:border-success data-[state=checked]:bg-success disabled:cursor-default"
        />
        {conTexto && <span>{texto}</span>}
      </label>
    );
  };

  const fijo = (celda: Fijo) => (
    <span title={FIJO[celda].ayuda} className="cursor-default whitespace-nowrap text-[11.5px] text-muted-foreground">
      {FIJO[celda].texto}
    </span>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className={cn('hidden border-b border-border bg-slate-200 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground', RETICULA)}>
        <div>Sección</div>
        {COLUMNAS.map((c) => (
          <div key={c.k} className="text-center">{c.n}</div>
        ))}
        <div className="pl-2.5">Además</div>
      </div>

      {CATALOGO.map((g, gi) => (
        <div key={g.grupo} className={cn(gi > 0 && 'border-t border-border')}>
          <div className="px-3 pb-1 pt-3.5">
            <div className="max-w-[230px] font-heading text-sm font-semibold text-navy">{g.grupo}</div>
            <div className="max-w-[230px] text-xs text-muted-foreground">{g.nota}</div>
          </div>

          {g.secciones.map((s, si) => {
            const celdas = s.celdas ?? {};
            // En el teléfono: lo que no es casilla, en una línea («Todos: ver, crear»).
            const porTipo: Record<string, string[]> = {};
            COLUMNAS.forEach((c, i) => {
              if (s.junto && i >= s.junto.desde && i <= s.junto.hasta) return;
              const v = celdas[c.k];
              if (v && typeof v !== 'object') (porTipo[FIJO[v].texto] ??= []).push(c.n.toLowerCase());
            });

            return (
              <div
                key={s.k}
                className={cn('px-3 hover:bg-slate-50/60', si > 0 && 'border-t border-slate-100', RETICULA)}
              >
                <div className="flex min-w-0 flex-col pb-1 pt-2 md:py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[13.5px] text-foreground">
                    <span>{s.nombre}</span>
                    <InfoSeccion seccion={s} />
                  </span>
                  {s.nota && <span className="text-[11.5px] leading-snug text-muted-foreground">{s.nota}</span>}
                </div>

                {/* Teléfono: las casillas con su texto, una tras otra */}
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 pb-2 md:hidden">
                  {s.va && <span className="text-[12.5px] italic text-muted-foreground">{s.va}</span>}
                  {s.junto && caja(s.junto.llave, s.junto.texto, true)}
                  {COLUMNAS.map((c, i) => {
                    if (s.junto && i >= s.junto.desde && i <= s.junto.hasta) return null;
                    const v = celdas[c.k];
                    return v && typeof v === 'object' ? caja(v.llave, c.n, true) : null;
                  })}
                  {(s.extras ?? []).map((e) => caja(e.llave, e.nombre, true))}
                </div>
                {Object.keys(porTipo).length > 0 && (
                  <div className="-mt-1 pb-2 text-[11.5px] text-muted-foreground md:hidden">
                    {Object.entries(porTipo).map(([t, cols]) => `${t}: ${cols.join(', ')}`).join(' · ')}
                  </div>
                )}

                {/* Computadora: la retícula */}
                {s.va ? (
                  <div className={cn('hidden items-center pl-[22px] md:flex', SPAN[4])}>
                    <span className="text-[12.5px] italic text-muted-foreground">{s.va}</span>
                  </div>
                ) : (
                  COLUMNAS.map((c, i) => {
                    if (s.junto && i === s.junto.desde) {
                      return (
                        <div
                          key={c.k}
                          className={cn('hidden min-w-0 items-center pl-[22px] md:flex', SPAN[s.junto.hasta - s.junto.desde + 1])}
                        >
                          {caja(s.junto.llave, s.junto.texto, true)}
                        </div>
                      );
                    }
                    if (s.junto && i > s.junto.desde && i <= s.junto.hasta) return null;
                    const v: Celda | undefined = celdas[c.k];
                    return (
                      <div key={c.k} className="hidden justify-center md:flex">
                        {typeof v === 'string' ? fijo(v) : v ? caja(v.llave, c.n, false) : null}
                      </div>
                    );
                  })
                )}
                <div className="hidden flex-wrap gap-x-4 gap-y-0.5 py-1.5 pl-2.5 md:flex">
                  {(s.extras ?? []).map((e) => caja(e.llave, e.nombre, true))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
