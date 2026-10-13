/**
 * Las maneras de escribir un número o una factura en la sección Pagos. Las fechas
 * se escriben con lib/fechas, como en todo el sistema.
 *
 * Viven aparte de las pastillas porque un archivo que exporta componentes Y
 * funciones rompe el refresco en caliente de Vite —y porque estas las usa
 * medio módulo, no solo lo que se dibuja.
 */
import { fecha } from '@/lib/fechas';
import type { Entrega } from './tiposDetalle';

/**
 * Los días que faltan para una fecha, contados en días de CALENDARIO.
 *
 * A propósito no usa la hora: «vence hoy» tiene que decir hoy a las 8 de la
 * mañana y a las 6 de la tarde. Restando milisegundos, a media tarde diría
 * «hace un día».
 */
export function diasHasta(fechaISO: string): number {
  const hoy = new Date();
  const cero = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const v = new Date(`${fechaISO.slice(0, 10)}T00:00:00Z`);
  return Math.round((v.getTime() - cero) / 86400000);
}

/** Dinero, siempre con sus dos decimales. */
export function plata(valor: string | number): string {
  return `$${Number(valor).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Cómo se nombra una factura; las recepciones de antes del 05/10 no tienen número. */
export function nombreFactura(f: Pick<Entrega, 'numero_factura' | 'fecha'>): string {
  return f.numero_factura ? `Factura ${f.numero_factura}` : `Recepción del ${fecha(f.fecha)}`;
}
