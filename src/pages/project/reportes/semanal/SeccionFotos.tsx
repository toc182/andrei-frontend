/**
 * Las fotos del reporte semanal: se eligen entre las que ya están en los
 * reportes diarios de la semana, hasta quince.
 *
 * No se sube ninguna (decisión de Ivan): las fotos ya están en el sistema, así
 * que elegirlas no depende de la señal que haya en la obra. Cada una conserva
 * la leyenda que tiene en su diario.
 */

import { Check } from 'lucide-react';
import { Alert } from '@/components/shell';
import { FOTOS_MAX, diaCorto, type FotoSemana } from './tipos';

export default function SeccionFotos({
  fotos, elegidas, onCambio,
}: {
  fotos: FotoSemana[];
  elegidas: number[];
  onCambio: (ids: number[]) => void;
}) {
  const porDia = fotos.reduce<Record<string, FotoSemana[]>>((acc, f) => {
    (acc[f.fecha] ??= []).push(f);
    return acc;
  }, {});
  const dias = Object.keys(porDia).sort();
  const lleno = elegidas.length >= FOTOS_MAX;

  const alternar = (id: number) => {
    const i = elegidas.indexOf(id);
    if (i >= 0) onCambio(elegidas.filter((x) => x !== id));
    else if (!lleno) onCambio([...elegidas, id]);
  };

  if (fotos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Los reportes diarios de esta semana no tienen fotos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Toca las fotos que van en el reporte, hasta {FOTOS_MAX}. Salen con la leyenda que tienen
        en su reporte diario.
      </p>

      {lleno && (
        <Alert
          variant="warning"
          title={`Ya elegiste ${FOTOS_MAX} fotos`}
          description="Quita una para poder elegir otra."
        />
      )}

      {dias.map((dia) => (
        <div key={dia}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {diaCorto(dia)}{' '}
            <span className="font-normal normal-case tracking-normal">
              · {porDia[dia].length} {porDia[dia].length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {porDia[dia].map((f) => {
              const puesto = elegidas.indexOf(f.id);
              const elegida = puesto >= 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => alternar(f.id)}
                  className="text-left"
                >
                  <span
                    className={`relative block aspect-square overflow-hidden rounded border ${
                      elegida ? 'border-navy ring-2 ring-navy' : 'border-border'
                    } ${!elegida && lleno ? 'opacity-60' : ''}`}
                  >
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                    {elegida ? (
                      <>
                        <span className="absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1 text-[11px] font-semibold tabular-nums text-white">
                          {puesto + 1}
                        </span>
                        <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-navy text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      </>
                    ) : (
                      <span className="absolute right-1 top-1 h-5 w-5 rounded-full border-2 border-white bg-ink/25" />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-tight text-muted-foreground">
                    {f.leyenda ?? <span className="italic text-slate-400">Sin leyenda</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
