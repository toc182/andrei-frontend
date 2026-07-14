// src/lib/desgloseModel.ts — pure editor model for the desglose tree.
// State = flat rows in document order with explicit depth (cronogramaPaste
// precedent); totals and the parent-indexed wire shape are derived. Gated by
// scripts/desglose.spec.ts (npx tsx scripts/desglose.spec.ts).

/** PUT wire row (owned HERE — desgloseApi re-exports it, never redeclares). */
export interface DesgloseItemInput {
  tempId: number;
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
  depth: number;
  tipo: 'grupo' | 'item';
  item: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
}

export const rowTotal = (r: DesgloseRow): number =>
  r.tipo === 'item' && r.cantidad != null && r.precioUnitario != null
    ? r.cantidad * r.precioUnitario
    : 0;

/** Totals per tempId; groups accumulate their subtree. Key 0 = grand total. */
export function computeTotals(rows: DesgloseRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  let grand = 0;
  // ancestor stack of group tempIds by depth; every leaf total bubbles up the stack
  const stack: number[] = [];
  for (const r of rows) {
    stack.length = r.depth;
    const t = rowTotal(r);
    if (t) {
      grand += t;
      for (const anc of stack) totals.set(anc, (totals.get(anc) ?? 0) + t);
      totals.set(r.tempId, t);
    } else if (!totals.has(r.tempId)) {
      totals.set(r.tempId, 0);
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
  }
  totals.set(0, grand);
  return totals;
}

/** Document order -> parent-indexed wire rows (parents always precede children). */
export function toWireItems(rows: DesgloseRow[]): DesgloseItemInput[] {
  const stack: number[] = []; // tempId of current ancestor per depth
  return rows.map((r, i) => {
    stack.length = r.depth;
    const parentTempId = r.depth > 0 ? (stack[r.depth - 1] ?? null) : null;
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
    return {
      tempId: r.tempId,
      parentTempId,
      tipo: r.tipo,
      item: r.item,
      descripcion: r.descripcion,
      unidad: r.unidad,
      cantidad: r.cantidad,
      precioUnitario: r.precioUnitario,
      orden: i,
    };
  });
}

/** A row can indent when the result stays ≤ prevDepth+1 (i.e. its depth is
 *  currently ≤ the previous row's). The new parent may be an 'item' — the
 *  VIEW then promotes it to 'grupo' (clearing cantidad/PU behind an
 *  AlertDialog confirm, since that loses data). */
export const indentLegal = (rows: DesgloseRow[], i: number): boolean =>
  i > 0 && rows[i].depth <= rows[i - 1].depth;

export const outdentLegal = (rows: DesgloseRow[], i: number): boolean => rows[i].depth > 0;
