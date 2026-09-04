// src/lib/presupuestoHoja.ts — modelo puro de la hoja armada desde el desglose.
//
// La estructura no se edita: los renglones, las cantidades y los precios vienen
// copiados del desglose del proyecto. Lo unico que cambia es el COSTO unitario.
// Los totales se derivan aqui y nunca se guardan.
//
// Con red en scripts/presupuesto-hoja.spec.ts.

import type { PresupuestoRenglon } from './presupuestoApi';

/** Fila plana en orden de documento, con la profundidad ya resuelta. */
export interface HojaRow extends PresupuestoRenglon {
  depth: number;
}

/** Filas indexadas por padre -> filas planas en orden, con profundidad. */
export function toHojaRows(renglones: PresupuestoRenglon[]): HojaRow[] {
  const byParent = new Map<number | null, PresupuestoRenglon[]>();
  for (const r of renglones) {
    const list = byParent.get(r.parentId) ?? [];
    list.push(r);
    byParent.set(r.parentId, list);
  }
  const out: HojaRow[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const r of (byParent.get(parentId) ?? []).sort((a, b) => a.orden - b.orden)) {
      out.push({ ...r, depth });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** True cuando rows[i] manda sobre al menos una fila (la siguiente es mas
 *  profunda). Un grupo SIN hijos es una "seccion de una linea" y lleva sus
 *  propios montos — misma regla que el desglose, de donde salen estas filas. */
export const tieneHijos = (rows: HojaRow[], i: number): boolean =>
  i + 1 < rows.length && rows[i + 1].depth > rows[i].depth;

/** Un renglon aporta monto propio salvo que sea un contenedor: ahi su total
 *  sube desde abajo y contarlo tambien seria contarlo dos veces. */
export const esContenedor = (rows: HojaRow[], i: number): boolean =>
  rows[i].tipo === 'grupo' && tieneHijos(rows, i);

const montoPropio = (r: HojaRow, unitario: number | null): number =>
  r.cantidad != null && unitario != null ? r.cantidad * unitario : 0;

export const costoPropio = (rows: HojaRow[], i: number): number =>
  esContenedor(rows, i) ? 0 : montoPropio(rows[i], rows[i].costoUnitario);

export const precioPropio = (rows: HojaRow[], i: number): number =>
  esContenedor(rows, i) ? 0 : montoPropio(rows[i], rows[i].precioUnitario);

export const TOTAL_KEY = -1;

export interface TotalesFila {
  costo: number;
  precio: number;
}

/** Costo y precio acumulados por id de renglon; los grupos suman su rama.
 *  TOTAL_KEY (-1) trae el total de la hoja. */
export function computeTotales(rows: HojaRow[]): Map<number, TotalesFila> {
  const totales = new Map<number, TotalesFila>();
  let costo = 0;
  let precio = 0;
  // Pila de ancestros por profundidad. Las filas sueltas no ocupan ranura, asi
  // que la pila puede tener huecos: se saltan.
  const stack: (number | undefined)[] = [];
  rows.forEach((r, i) => {
    stack.length = r.depth;
    const c = costoPropio(rows, i);
    const p = precioPropio(rows, i);
    if (!totales.has(r.id)) totales.set(r.id, { costo: 0, precio: 0 });
    if (c || p) {
      costo += c;
      precio += p;
      const propio = totales.get(r.id)!;
      totales.set(r.id, { costo: propio.costo + c, precio: propio.precio + p });
      for (const anc of stack) {
        if (anc == null) continue;
        const t = totales.get(anc) ?? { costo: 0, precio: 0 };
        totales.set(anc, { costo: t.costo + c, precio: t.precio + p });
      }
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.id;
  });
  totales.set(TOTAL_KEY, { costo, precio });
  return totales;
}

/** Cuantos renglones llevan costo y cuantos faltan. Sirve para avisar que la
 *  hoja va a medias sin tener que leerla entera. */
export function avanceCostos(rows: HojaRow[]): { conCosto: number; sinCosto: number } {
  let conCosto = 0;
  let sinCosto = 0;
  rows.forEach((r, i) => {
    if (esContenedor(rows, i)) return;
    if (r.costoUnitario != null) conCosto++;
    else sinCosto++;
  });
  return { conCosto, sinCosto };
}

/** Los costos que cambiaron respecto a lo cargado: es lo unico que viaja al
 *  guardar. Compara contra el documento original para no mandar la hoja entera. */
export function costosCambiados(
  original: PresupuestoRenglon[],
  actual: HojaRow[],
): { id: number; costoUnitario: number | null }[] {
  const antes = new Map(original.map((r) => [r.id, r.costoUnitario]));
  return actual
    .filter((r) => antes.get(r.id) !== r.costoUnitario)
    .map((r) => ({ id: r.id, costoUnitario: r.costoUnitario }));
}
