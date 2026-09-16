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
    case 'quitado':
      return (
        <del className="rounded-sm bg-error/10 px-0.5 text-error decoration-[1.5px]">
          {trozo.texto}
        </del>
      );
    case 'agregado':
      return (
        <ins className="rounded-sm bg-success/10 px-0.5 text-success decoration-[1.5px] underline-offset-[3px]">
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
            <div className="font-semibold">{c.usuario_nombre}</div>
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
