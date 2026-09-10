// src/lib/presupuestoHoja.ts — modelo puro de la hoja de presupuesto.
//
// Un mismo modelo sirve a las dos maneras de armar, porque la aritmetica es la
// misma; lo que cambia es cuanto se puede tocar:
//
//   'desglose' — los renglones, las cantidades y los precios vienen copiados
//     del desglose y NO se editan. Lo unico que se escribe es el costo
//     unitario, y al guardar viaja solo el diff (costosCambiados).
//
//   'cero' — la hoja nace vacia y se escribe entera: filas, grupos, jerarquia.
//     Al guardar viaja completa (toWireRenglones). No hay precio, porque no hay
//     desglose de donde sacarlo.
//
// El estado son filas planas en orden de documento con `depth` explicito, y las
// operaciones de arbol salen de lib/outline, compartidas con el desglose. Los
// totales se derivan aqui y nunca se guardan.
//
// Con red en scripts/presupuesto-hoja.spec.ts.

import {
  deleteSubtree, hasChildren, indentRows, insertRowAfter, moveSubtree,
  newRowUid, outdentRows, parentTempIds,
} from './outline';
import type { PresupuestoRenglon, PresupuestoRenglonInput } from './presupuestoApi';

export {
  canMoveSubtree as puedeMover, indentLegal as puedeIndentar, indentParentIndex,
  outdentLegal as puedeDesindentar, subtreeEnd,
} from './outline';

/** Fila plana en orden de documento, con la profundidad ya resuelta.
 *
 *  `tempId` es el id del servidor en las filas que vinieron cargadas, y uno
 *  fresco (por encima de todos los existentes) en las que se agregan en la
 *  pantalla. Por eso identifica la fila en los dos casos y es la clave de los
 *  totales y de la jerarquia al guardar. */
export interface HojaRow {
  tempId: number;
  /** UUID estable; se conserva al cargar y se reenvia al guardar. */
  rowUid?: string;
  depth: number;
  tipo: 'grupo' | 'item';
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  /** Lo que se COBRA. Solo lo traen las hojas armadas desde el desglose. */
  precioUnitario: number | null;
  /** Lo que CUESTA. */
  costoUnitario: number | null;
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
      out.push({
        tempId: r.id,
        rowUid: r.rowUid,
        depth,
        tipo: r.tipo,
        codigo: r.codigo,
        descripcion: r.descripcion,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precioUnitario: r.precioUnitario,
        costoUnitario: r.costoUnitario,
      });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** True cuando rows[i] manda sobre al menos una fila (la siguiente es mas
 *  profunda). Un grupo SIN hijos es una "seccion de una linea" y lleva sus
 *  propios montos — misma regla que el desglose. */
export const tieneHijos = (rows: HojaRow[], i: number): boolean => hasChildren(rows, i);

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

/** Costo y precio acumulados por tempId; los grupos suman su rama.
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
    if (!totales.has(r.tempId)) totales.set(r.tempId, { costo: 0, precio: 0 });
    if (c || p) {
      costo += c;
      precio += p;
      const propio = totales.get(r.tempId)!;
      totales.set(r.tempId, { costo: propio.costo + c, precio: propio.precio + p });
      for (const anc of stack) {
        if (anc == null) continue;
        const t = totales.get(anc) ?? { costo: 0, precio: 0 };
        totales.set(anc, { costo: t.costo + c, precio: t.precio + p });
      }
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
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

// ---------------------------------------------------------------------------
// Guardar la hoja armada desde el desglose: solo el diff de costos
// ---------------------------------------------------------------------------

/** Los costos que cambiaron respecto a lo cargado: es lo unico que viaja al
 *  guardar. Compara contra el documento original para no mandar la hoja entera. */
export function costosCambiados(
  original: PresupuestoRenglon[],
  actual: HojaRow[],
): { id: number; costoUnitario: number | null }[] {
  const antes = new Map(original.map((r) => [r.id, r.costoUnitario]));
  return actual
    .filter((r) => antes.get(r.tempId) !== r.costoUnitario)
    .map((r) => ({ id: r.tempId, costoUnitario: r.costoUnitario }));
}

// ---------------------------------------------------------------------------
// Editar y guardar la hoja armada desde cero
// ---------------------------------------------------------------------------

/** Una fila vacia. El rowUid se genera aqui: la fila lo lleva desde que nace y
 *  lo conserva a traves del borra-y-reinserta del servidor. */
export const filaEnBlanco = (
  tempId: number,
  depth: number,
  tipo: 'grupo' | 'item',
): HojaRow => ({
  tempId, rowUid: newRowUid(), depth, tipo,
  codigo: '', descripcion: '', unidad: null, cantidad: null,
  precioUnitario: null, costoUnitario: null,
});

/** La fila con la que nace una hoja vacia: una sola, para tener donde escribir
 *  sin pedirle al usuario que adivine el primer paso. */
export const filaInicial = (): HojaRow[] => [filaEnBlanco(1, 0, 'item')];

/** Inserta una fila en blanco justo despues de rows[i] — hermana despues de un
 *  item, primera hija despues de un grupo. */
export const insertarFila = (rows: HojaRow[], i: number, tipo: 'grupo' | 'item'): HojaRow[] =>
  insertRowAfter(rows, i, (tempId, depth) => filaEnBlanco(tempId, depth, tipo));

/** Agrega una fila al final de la hoja, o la primera si esta vacia. Es lo que
 *  hacen «Agregar fila» y «Agregar grupo» cuando no hay ninguna seleccionada. */
export function agregarAlFinal(rows: HojaRow[], tipo: 'grupo' | 'item'): HojaRow[] {
  if (rows.length === 0) return [filaEnBlanco(1, 0, tipo)];
  return insertarFila(rows, rows.length - 1, tipo);
}

/** +1 de profundidad para rows[i] y su rama. Devuelve el MISMO arreglo cuando
 *  no se puede, o cuando el padre que le tocaria no es un grupo: la pantalla
 *  promueve primero y despues llama. */
export const indentar = (rows: HojaRow[], i: number): HojaRow[] => indentRows(rows, i);

/** -1 de profundidad para rows[i] y su rama. */
export const desindentar = (rows: HojaRow[], i: number): HojaRow[] => outdentRows(rows, i);

/** Borra rows[i] con toda su rama. */
export const borrarFila = (rows: HojaRow[], i: number): HojaRow[] => deleteSubtree(rows, i);

/** Intercambia la rama de rows[i] con la rama hermana de al lado. */
export const moverFila = (rows: HojaRow[], i: number, dir: -1 | 1): HojaRow[] =>
  moveSubtree(rows, i, dir);

/** Orden de documento -> filas de cable con su padre resuelto.
 *
 *  Un contenedor no manda montos: su total sube desde abajo, y guardarlos
 *  ademas los contaria dos veces. El servidor aplica la misma regla, pero se
 *  manda ya limpio para que lo que se ve y lo que se guarda coincidan. */
export function toWireRenglones(rows: HojaRow[]): PresupuestoRenglonInput[] {
  const padres = parentTempIds(rows);
  return rows.map((r, i) => {
    const contenedor = esContenedor(rows, i);
    return {
      tempId: r.tempId,
      rowUid: r.rowUid,
      parentTempId: padres[i],
      tipo: r.tipo,
      codigo: r.codigo,
      descripcion: r.descripcion,
      unidad: contenedor ? null : r.unidad,
      cantidad: contenedor ? null : r.cantidad,
      costoUnitario: contenedor ? null : r.costoUnitario,
    };
  });
}

/** Si la hoja difiere de lo cargado. Enciende el boton de guardar sin pedirle a
 *  la pantalla que rastree cada tecla. */
export function hojaCambiada(original: PresupuestoRenglon[], actual: HojaRow[]): boolean {
  const antes = JSON.stringify(toWireRenglones(toHojaRows(original)));
  return antes !== JSON.stringify(toWireRenglones(actual));
}
