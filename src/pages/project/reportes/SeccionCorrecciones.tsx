/**
 * La sección Correcciones del detalle de un reporte.
 *
 * Solo muestra lo que cambió: lo quitado tachado, lo agregado subrayado, y
 * todo lo de un mismo «Guardar cambios» bajo una sola fecha. El diseño lo
 * aprobó Ivan sobre una maqueta el 2026-09-16. Las líneas vienen armadas del
 * servidor (reporteCambios.ts), las mismas que imprime el PDF: aquí no se
 * decide qué se muestra, solo cómo se ve.
 *
 * En pantalla ancha, la fecha y quién a la izquierda y los cambios a la
 * derecha; en el teléfono, todo apilado.
 */

import { Fragment } from 'react';
import { type Correccion, type Trozo, fechaHoraPanama } from './tipos';

function PedazoDeRenglon({ trozo }: { trozo: Trozo }) {
  switch (trozo.tipo) {
    // Rojo y verde apagados, sin fondo (Ivan, 2026-09-16: «demasiado
    // llamativos»): el color de la marca mezclado con el gris del texto
    // secundario, igual que en el PDF, y así también en modo oscuro. En srgb y
    // no en oklch: en oklch la mezcla gira el tono y el rojo sale morado. Lo que
    // dice qué pasó es el tachado y el subrayado.
    case 'quitado':
      return (
        <del className="text-[color-mix(in_srgb,var(--color-error)_30%,var(--color-muted-foreground))] decoration-error/35">
          {trozo.texto}
        </del>
      );
    case 'agregado':
      return (
        <ins className="text-[color-mix(in_srgb,var(--color-success)_35%,var(--color-muted-foreground))] decoration-success/35 underline-offset-[3px]">
          {trozo.texto}
        </ins>
      );
    case 'corte':
      return <span className="text-muted-foreground">{trozo.texto}</span>;
    case 'nota':
      return <span className="text-[13px] text-muted-foreground">{trozo.texto}</span>;
    default:
      return <>{trozo.texto}</>;
  }
}

export default function SeccionCorrecciones({ correcciones }: { correcciones: Correccion[] }) {
  return (
    <div className="divide-y divide-slate-100">
      {correcciones.map((c) => (
        <div
          key={c.id}
          className="grid gap-1.5 py-3 first:pt-0 last:pb-0 md:grid-cols-[10.5rem_1fr] md:gap-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm leading-5 md:block">
            <div className="tabular-nums text-muted-foreground">{fechaHoraPanama(c.created_at)}</div>
            <div>{c.usuario_nombre}</div>
          </div>
          <div className="min-w-0 space-y-2">
            {c.cambios.map((k, i) => (
              <div key={i} className="md:grid md:grid-cols-[9.5rem_1fr] md:gap-3">
                <div className="text-[13px] leading-[18px] text-muted-foreground md:leading-[22px]">
                  {k.etiqueta}
                </div>
                <div className="min-w-0 space-y-1 break-words text-[15px] leading-[22px]">
                  {k.renglones.map((r, j) => (
                    <div key={j}>
                      {r.map((t, n) => (
                        <Fragment key={n}>
                          {n > 0 && ' '}
                          <PedazoDeRenglon trozo={t} />
                        </Fragment>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
