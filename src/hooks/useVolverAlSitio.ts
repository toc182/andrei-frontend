import { useCallback, useLayoutEffect, useRef } from 'react';

/** La caja que de verdad baja: la del contenido en AppLayout, o la página. */
function cajaConScroll(desde: HTMLElement | null): HTMLElement | null {
  for (let el = desde?.parentElement ?? null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll') return el;
  }
  return document.scrollingElement as HTMLElement | null;
}

/**
 * Para una lista que se tapa con otra pantalla (una orden abierta encima) y se
 * destapa al volver: la lista queda donde estaba bajada, y la pantalla de
 * encima empieza arriba en vez de heredar la altura de la lista.
 *
 *   const { ref, salir } = useVolverAlSitio(ordenAbierta !== null);
 *   <div ref={ref} className={cn(ordenAbierta !== null && 'hidden')}>…lista…</div>
 *   onAbrir={(id) => { salir(); setOrdenAbierta(id); }}
 */
export function useVolverAlSitio(tapada: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const altura = useRef<number | null>(null);

  /** Justo antes de tapar la lista: apunta hasta dónde estaba y sube arriba. */
  const salir = useCallback(() => {
    const caja = cajaConScroll(ref.current);
    altura.current = caja?.scrollTop ?? 0;
    caja?.scrollTo({ top: 0 });
  }, []);

  // Antes de pintar la lista destapada, para que no se vea saltar.
  useLayoutEffect(() => {
    if (tapada || altura.current === null) return;
    cajaConScroll(ref.current)?.scrollTo({ top: altura.current });
    altura.current = null;
  }, [tapada]);

  return { ref, salir };
}
