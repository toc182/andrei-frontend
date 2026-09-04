// RepartoCategorias — en qué se ha ido la plata.
//
// Sigue el dibujo que Ivan aprobó: sin flechita, la fila entera es el botón.
// Que se puede pinchar lo dicen el cursor y el fondo al pasar por encima, y así
// la barra gana ese ancho. Abierta, la fila y su detalle comparten fondo y
// quedan como un solo bloque, sin ninguna raya que los ate.
//
// La barra se mide contra la categoría MÁS grande, no contra el total: si se
// midiera contra el total, con diez categorías todas las barras serían hilos.
// El porcentaje de al lado sí es sobre el total, que es la cifra que importa.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '@/utils/dateUtils';
import { EmptyState } from '@/components/shell';
import type { ResumenCategoria, ResumenSolicitud } from '@/lib/costosApi';

/** Cuántos pagos se listan antes de resumir el resto en una línea. */
const DETALLE = 3;

interface Props {
  categorias: ResumenCategoria[];
  /** Fila extra para lo pagado sin categoría; null si no hay. */
  sinClasificar: { monto: number; solicitudes: number } | null;
  solicitudes: ResumenSolicitud[];
  total: number;
}

interface Fila {
  clave: string;
  nombre: string;
  monto: number;
  categoriaId: number | null;
}

export default function RepartoCategorias({ categorias, sinClasificar, solicitudes, total }: Props) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const filas: Fila[] = [
    ...categorias.map((c) => ({
      clave: `c${c.id}`, nombre: c.nombre, monto: c.monto, categoriaId: c.id,
    })),
    ...(sinClasificar && sinClasificar.monto > 0
      ? [{ clave: 'sin', nombre: 'Sin clasificar', monto: sinClasificar.monto, categoriaId: null }]
      : []),
  ].sort((a, b) => b.monto - a.monto);

  if (!filas.length) {
    return (
      <EmptyState
        title="Todavía no hay gasto"
        description="En cuanto se marque una solicitud como pagada, aparece aquí en qué se fue."
      />
    );
  }

  const mayor = Math.max(...filas.map((f) => f.monto), 1);

  return (
    <div className="flex flex-col gap-0.5">
      {filas.map((f) => {
        const abierto = abierta === f.clave;
        const suyas = abierto
          ? solicitudes.filter((s) => s.categoriaId === f.categoriaId)
          : [];
        const primeras = suyas.slice(0, DETALLE);
        const resto = suyas.slice(DETALLE);
        const restoMonto = resto.reduce((s, x) => s + x.monto, 0);

        return (
          <div key={f.clave}>
            <button
              type="button"
              onClick={() => setAbierta(abierto ? null : f.clave)}
              aria-expanded={abierto}
              className={cn(
                'grid w-full grid-cols-[132px_minmax(0,1fr)_96px_40px] items-center gap-2.5 px-2 py-1.5 text-left transition-colors',
                abierto ? 'rounded-t-md bg-navy/[0.06]' : 'rounded-md hover:bg-muted',
              )}
            >
              <span className="truncate text-[13px]">{f.nombre}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-r bg-navy"
                  style={{ width: `${Math.max((f.monto / mayor) * 100, 1)}%` }}
                />
              </span>
              <span className="text-right text-[13px] tabular-nums">{formatMoney(f.monto)}</span>
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {total > 0 ? Math.round((f.monto / total) * 100) : 0}%
              </span>
            </button>

            {abierto && (
              <div className="mb-1.5 rounded-b-md bg-navy/[0.06] px-4 pb-2 pt-0.5">
                <table className="w-full text-xs">
                  <tbody>
                    {primeras.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 last:border-0">
                        <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{formatDate(s.fecha)}</td>
                        <td className="w-full truncate py-1 pr-2">{s.proveedor || 'Sin proveedor'}</td>
                        <td className="whitespace-nowrap py-1 text-right tabular-nums">{formatMoney(s.monto)}</td>
                      </tr>
                    ))}
                    {resto.length > 0 && (
                      <tr>
                        <td className="py-1 pr-2" />
                        <td className="py-1 pr-2 text-muted-foreground">
                          {resto.length === 1 ? '1 pago más' : `${resto.length} pagos más`}
                        </td>
                        <td className="whitespace-nowrap py-1 text-right tabular-nums">
                          {formatMoney(restoMonto)}
                        </td>
                      </tr>
                    )}
                    {suyas.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-1 text-muted-foreground">Sin pagos que mostrar.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
