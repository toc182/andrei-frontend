// src/lib/ordenPaste.ts — pegar celdas de Excel directo en los renglones de
// una orden de compra, como en una hoja de cálculo (Ivan, 2026-10-07: «yo pongo
// paste desde Excel y se copian todas directamente, no necesito un formulario
// aparte»; así funciona ya la caja menuda).
//
// Puro. Reusa el separador del cronograma (celdas entre comillas, tabs y
// saltos dentro de una celda) y el lector de montos del desglose ("$1,200.50",
// "B/. 5", "1.234,56").
//
// Las columnas son las del formulario: Cant., Unidad, Descripción, P. unit. Lo
// pegado cae desde la cajita donde se pega hacia la derecha y hacia abajo,
// encima de lo que haya, y agrega los renglones que falten. Lo que sobra a la
// derecha (el Total del Excel) se ignora: el formulario lo calcula.

import { parseTsv } from './cronogramaPasteTsv';
import { parseMoney } from './desglosePaste';

export type CampoRenglon = 'cantidad' | 'unidad' | 'descripcion' | 'precio_unitario';

/** El orden de las columnas del formulario, que es el que se copia de Excel. */
export const COLUMNAS_RENGLON: CampoRenglon[] = ['cantidad', 'unidad', 'descripcion', 'precio_unitario'];

export type RenglonTexto = Record<CampoRenglon, string>;

/** Lo que dice una celda de encabezado del formulario o de una cotización. */
const ENCABEZADO =
  /^(cant\.?|cantidad|qty|unidad|und\.?|descripci[oó]n|detalle|p\.?\s*unit\.?|precio(\s+unit(ario|\.)?)?|total)$/i;

const NUMERICO = new Set<CampoRenglon>(['cantidad', 'precio_unitario']);

/** El texto de una celda, como lo guarda la cajita de ese campo. */
function valorDe(campo: CampoRenglon, celda: string): string {
  const t = celda.trim();
  if (NUMERICO.has(campo)) {
    const n = parseMoney(t);
    return n === null ? '' : String(n);
  }
  if (campo === 'unidad') return t || 'unidad';
  // Una descripción en varias líneas dentro de su celda queda en una sola.
  return t.replace(/\s*\n\s*/g, ' ');
}

/**
 * Pega `texto` en los renglones, empezando en el renglón `fila` y en la columna
 * `campo`. Devuelve los renglones nuevos, o null cuando lo pegado es una sola
 * celda de texto: eso lo pega el navegador solo, como siempre.
 */
export function pegarEnRenglones<R extends RenglonTexto>(
  renglones: R[],
  fila: number,
  campo: CampoRenglon,
  texto: string,
  vacio: () => R,
): R[] | null {
  let celdas = parseTsv(texto);
  if (celdas.length === 0) return null;
  const unaCelda = celdas.length === 1 && celdas[0].length === 1;
  // Una sola celda: si es de texto, la pega el navegador; si es un número, se
  // limpia aquí («$38.50» → 38.5).
  if (unaCelda && !NUMERICO.has(campo)) return null;

  // Un encabezado copiado con los datos no es un renglón.
  if (!unaCelda && celdas[0].every((c) => !c.trim() || ENCABEZADO.test(c.trim()))) {
    celdas = celdas.slice(1);
  }

  const desde = COLUMNAS_RENGLON.indexOf(campo);
  const columnas = COLUMNAS_RENGLON.slice(desde);
  // Un renglón que no trae nada en las columnas del formulario (una fila en
  // blanco, el subtotal que solo tiene Total) no se convierte en renglón.
  const filas = celdas.filter((f) => columnas.some((_, k) => (f[k] ?? '').trim() !== ''));

  const nuevos = [...renglones];
  filas.forEach((f, desplazamiento) => {
    const i = fila + desplazamiento;
    while (nuevos.length <= i) nuevos.push(vacio());
    const cambios: Partial<RenglonTexto> = {};
    columnas.forEach((c, k) => {
      if (k < f.length) cambios[c] = valorDe(c, f[k]);
    });
    nuevos[i] = { ...nuevos[i], ...cambios };
  });
  return nuevos;
}
