// src/lib/desgloseModel.ts — pure editor model for the desglose tree.
// State = flat rows in document order with explicit depth (cronogramaPaste
// precedent); totals and the parent-indexed wire shape are derived. Gated by
// scripts/desglose.spec.ts (npx tsx scripts/desglose.spec.ts).
//
// The tree ops themselves (indent, outdent, move, delete, subtree) live in
// lib/outline.ts, shared with the presupuesto sheet: they touch only depth and
// tipo, so there is one implementation and one set of invariants. What stays
// HERE is what a desglose row actually holds — item, unidad, cantidad, precio —
// and how it totals.

import {
  deleteSubtree as deleteSubtreeRows,
  hasChildren,
  indentRows as indentOutlineRows,
  insertRowAfter as insertOutlineRowAfter,
  moveSubtree as moveSubtreeRows,
  newRowUid,
  outdentRows as outdentOutlineRows,
  parentTempIds,
} from './outline';

export {
  canMoveSubtree, hasChildren, indentLegal, indentParentIndex, newRowUid,
  outdentLegal, subtreeEnd,
} from './outline';

/** PUT wire row (owned HERE — desgloseApi re-exports it, never redeclares). */
export interface DesgloseItemInput {
  tempId: number;
  rowUid?: string; // UUID estable de fila; se reenvía para conservar identidad. Ausente = fila nueva
  parentTempId: number | null;
  tipo: 'grupo' | 'item';
  item: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  orden: number;
}

export interface DesgloseRow {
  tempId: number;
  rowUid?: string; // UUID estable; se conserva al cargar y se reenvía al guardar
  depth: number;
  tipo: 'grupo' | 'item';
  item: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
}

/** cantidad × precio when both are present, else 0 — the raw "own" value of a
 *  row, independent of type. */
const montoValue = (r: DesgloseRow): number =>
  r.cantidad != null && r.precioUnitario != null ? r.cantidad * r.precioUnitario : 0;

/** rowTotal is the value a row contributes on its own: an item, or a childless
 *  section, is worth cantidad × precio; a section WITH children contributes
 *  nothing itself (its total is the sum bubbling up from below). */
export const rowTotal = (rows: DesgloseRow[], i: number): number =>
  rows[i].tipo === 'item' || !hasChildren(rows, i) ? montoValue(rows[i]) : 0;

/** Reserved Map key for the grand total in computeTotals. tempIds are always
 *  positive (allocated from 1 upward), so -1 can never collide with a row. */
export const GRAND_TOTAL_KEY = -1;

/** Totals per tempId; groups accumulate their subtree, a childless section owns
 *  cantidad×precio. GRAND_TOTAL_KEY (-1) = grand total. */
export function computeTotals(rows: DesgloseRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  let grand = 0;
  // ancestor stack of group tempIds by depth; every own-value bubbles up the
  // stack. Items never occupy a slot, so the stack can be sparse — skip holes.
  const stack: (number | undefined)[] = [];
  rows.forEach((r, i) => {
    stack.length = r.depth;
    const t = rowTotal(rows, i);
    if (t) {
      grand += t;
      for (const anc of stack) if (anc != null) totals.set(anc, (totals.get(anc) ?? 0) + t);
      totals.set(r.tempId, (totals.get(r.tempId) ?? 0) + t);
    } else if (!totals.has(r.tempId)) {
      totals.set(r.tempId, 0);
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
  });
  totals.set(GRAND_TOTAL_KEY, grand);
  return totals;
}

/** Document order -> parent-indexed wire rows (parents always precede children). */
export function toWireItems(rows: DesgloseRow[]): DesgloseItemInput[] {
  const parents = parentTempIds(rows);
  return rows.map((r, i) => ({
    tempId: r.tempId,
    rowUid: r.rowUid,
    parentTempId: parents[i],
    tipo: r.tipo,
    item: r.item,
    descripcion: r.descripcion,
    unidad: r.unidad,
    cantidad: r.cantidad,
    precioUnitario: r.precioUnitario,
    orden: i,
  }));
}

/** +1 depth for rows[i] and its whole subtree, nesting it under its previous
 *  sibling. Returns the SAME reference when illegal, or when the new structural
 *  parent is not a 'grupo' — the view owns the promote-to-grupo confirmation. */
export const indentRows = (rows: DesgloseRow[], i: number): DesgloseRow[] =>
  indentOutlineRows(rows, i);

/** -1 depth for rows[i] and its whole subtree. Returns the SAME reference when
 *  illegal. */
export const outdentRows = (rows: DesgloseRow[], i: number): DesgloseRow[] =>
  outdentOutlineRows(rows, i);

/** Removes rows[i] and its whole subtree. */
export const deleteSubtree = (rows: DesgloseRow[], i: number): DesgloseRow[] =>
  deleteSubtreeRows(rows, i);

/** Inserts one blank row directly after rows[i] — a sibling after an 'item', a
 *  first child after a 'grupo'. */
export const insertRowAfter = (
  rows: DesgloseRow[],
  i: number,
  tipo: 'grupo' | 'item',
): DesgloseRow[] =>
  insertOutlineRowAfter(rows, i, (tempId, depth) => ({
    tempId, rowUid: newRowUid(), depth, tipo,
    item: '', descripcion: '', unidad: null, cantidad: null, precioUnitario: null,
  }));

/** Moves the subtree rooted at rows[i] to swap places with the adjacent sibling
 *  subtree in the given direction. Depths never change. */
export const moveSubtree = (rows: DesgloseRow[], i: number, dir: -1 | 1): DesgloseRow[] =>
  moveSubtreeRows(rows, i, dir);
