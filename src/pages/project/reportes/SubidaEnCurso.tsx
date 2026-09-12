/**
 * El panel que tapa la pantalla mientras se manda el reporte.
 *
 * Ivan lo eligió mirando tres opciones (2026-09-11). La razón de que bloquee y
 * no sea un aviso discreto: el ingeniero que mandó el mismo reporte tres veces
 * dijo «no sabía si se había mandado». Un panel que no deja tocar nada no se
 * puede no ver, y hace imposible pulsar Guardar dos veces.
 *
 * No usa AppDialog a propósito: DialogContent trae una equis fija de cerrar, y
 * en un panel que bloquea eso sería un botón que no cierra, que es peor que no
 * tenerlo. Tampoco vive en components/shell porque se usa en un solo sitio; si
 * hiciera falta en otro, entonces se promueve y se documenta en las
 * convenciones, como manda la regla.
 *
 * Lo que NO dice: nada de «si sales pierdes los cambios». Sería mentira —lo
 * escrito se guarda antes de subir las fotos— y es justo la clase de mensaje
 * falso que hizo desconfiar al ingeniero.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Progreso =
  | { paso: 'datos' }
  | { paso: 'fotos'; hechas: number; total: number }
  | { paso: 'enviando' };

/** Cuánto lleva la barra. Las fotos son lo que de verdad tarda. */
function porcentaje(p: Progreso): number {
  if (p.paso === 'datos') return 6;
  if (p.paso === 'enviando') return 96;
  return p.total > 0 ? 6 + Math.round((p.hechas / p.total) * 88) : 94;
}

type EstadoPaso = 'hecho' | 'ahora' | 'pendiente';

function Paso({ estado, children }: { estado: EstadoPaso; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 text-sm',
        estado === 'pendiente' && 'text-muted-foreground',
        estado === 'hecho' && 'text-slate-700',
        estado === 'ahora' && 'font-semibold text-foreground',
      )}
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2',
          estado === 'hecho' && 'border-success bg-success text-white',
          estado === 'ahora' && 'border-primary',
          estado === 'pendiente' && 'border-border',
        )}
      >
        {estado === 'hecho' && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
        {estado === 'ahora' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
      </span>
      {children}
    </li>
  );
}

export default function SubidaEnCurso({
  progreso,
  fotos,
}: {
  progreso: Progreso | null;
  fotos: number;
}) {
  if (!progreso) return null;

  const orden = { datos: 0, fotos: 1, enviando: 2 } as const;
  const actual = orden[progreso.paso];
  const estado = (i: number): EstadoPaso =>
    actual > i ? 'hecho' : actual === i ? 'ahora' : 'pendiente';

  return (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/55" />
        <DialogPrimitive.Content
          // Bloquea de verdad: ni escape, ni clic fuera, ni foco fuera.
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg"
        >
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
            Enviando el reporte
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
            No cierres esta página.
          </DialogPrimitive.Description>

          <ul className="my-5 flex flex-col gap-3">
            <Paso estado={estado(0)}>Datos del reporte</Paso>
            <Paso estado={estado(1)}>
              {progreso.paso === 'fotos'
                ? `Fotos ${progreso.hechas} de ${progreso.total}`
                : fotos > 0
                  ? `Fotos ${actual > 1 ? fotos : 0} de ${fotos}`
                  : 'Sin fotos'}
            </Paso>
            <Paso estado={estado(2)}>Listo</Paso>
          </ul>

          <div className="h-[7px] overflow-hidden rounded-full bg-muted">
            {/* Ancho calculado: es el único valor que no puede ser una clase. */}
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${porcentaje(progreso)}%` }}
            />
          </div>

          <p className="mt-3.5 text-center text-[13px] text-muted-foreground">
            Si algo falla no se pierde nada de lo que escribiste.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
