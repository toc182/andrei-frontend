/**
 * Las maneras de escribir un número, una fecha o una factura en la sección Pagos.
 *
 * Viven aparte de las pastillas porque un archivo que exporta componentes Y
 * funciones rompe el refresco en caliente de Vite —y porque estas las usa
 * medio módulo, no solo lo que se dibuja.
 */
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

/**
 * dd/mm/aaaa, leída en UTC.
 *
 * Una fecha de la base llega como «2026-08-18» y en Panamá (UTC-5) el Date
 * nativo la enseñaría como el 17. Aquí no.
 */
export function fechaCorta(valor: string | null): string {
  if (!valor) return '—';
  const d = new Date(`${valor.slice(0, 10)}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Cómo se nombra una factura; las recepciones de antes del 05/10 no tienen número. */
export function nombreFactura(f: Pick<Entrega, 'numero_factura' | 'fecha'>): string {
  return f.numero_factura ? `Factura ${f.numero_factura}` : `Recepción del ${fechaCorta(f.fecha)}`;
}
