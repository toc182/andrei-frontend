// src/lib/desgloseModel.ts — pure editor model for the desglose tree.
// State = flat rows in document order with explicit depth (cronogramaPaste
// precedent); totals and the parent-indexed wire shape are derived. Gated by
// scripts/desglose.spec.ts (npx tsx scripts/desglose.spec.ts).

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

/** UUID estable para una fila nueva. Round-trips con el backend para que el
 *  avance por fila sobreviva el guardado wholesale del desglose. */
export const newRowUid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** cantidad × precio when both are present, else 0 — the raw "own" value of a
 *  row, independent of type. */
const montoValue = (r: DesgloseRow): number =>
  r.cantidad != null && r.precioUnitario != null ? r.cantidad * r.precioUnitario : 0;

/** True when rows[i] is a grupo that owns at least one child (the next row is
 *  deeper). A grupo WITHOUT children is a "sección de una línea": it carries its
 *  own cantidad/precio like an item. Depth order guarantees a child, if any, is
 *  the immediately following row. */
export const hasChildren = (rows: DesgloseRow[], i: number): boolean =>
  i + 1 < rows.length && rows[i + 1].depth > rows[i].depth;

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
  const stack: (number | undefined)[] = []; // tempId of current grupo ancestor per depth
  return rows.map((r, i) => {
    stack.length = r.depth;
    // Items never write a stack slot, so slot depth-1 can be a hole; the real
    // parent is the nearest DEFINED grupo slot strictly below r.depth. Only
    // truly-root rows emit null.
    let parentTempId: number | null = null;
    for (let d = r.depth - 1; d >= 0; d--) {
      const anc = stack[d];
      if (anc != null) { parentTempId = anc; break; }
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
    return {
      tempId: r.tempId,
      rowUid: r.rowUid,
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

/** Exclusive end index of the subtree rooted at rows[i]: the row itself plus
 *  every following row with depth > rows[i].depth. */
export function subtreeEnd(rows: DesgloseRow[], i: number): number {
  const depth = rows[i].depth;
  let j = i + 1;
  while (j < rows.length && rows[j].depth > depth) j++;
  return j;
}

/** New rows array with [i, j) shifted by delta depth. Internal — every public
 *  op validates legality BEFORE calling this. */
const shiftDepth = (rows: DesgloseRow[], i: number, j: number, delta: number): DesgloseRow[] =>
  rows.map((r, idx) => (idx >= i && idx < j ? { ...r, depth: r.depth + delta } : r));

/** Index of the row that would become rows[i]'s structural parent after an
 *  indent — its nearest PRECEDING sibling at the same depth — or -1 when the
 *  indent is illegal. The parent candidate may be an 'item'; the view must
 *  promote it to 'grupo' first (indentRows refuses otherwise). */
export function indentParentIndex(rows: DesgloseRow[], i: number): number {
  if (!indentLegal(rows, i)) return -1;
  const depth = rows[i].depth;
  let k = i - 1;
  while (k >= 0 && rows[k].depth > depth) k--; // walk past the previous sibling's descendants
  return k >= 0 && rows[k].depth === depth ? k : -1;
}

/** +1 depth for rows[i] and its whole subtree, nesting it under its previous
 *  sibling. Returns the SAME reference when illegal (per indentLegal) or when
 *  the new structural parent is not a 'grupo' — the view owns the
 *  promote-to-grupo confirmation and must promote BEFORE calling this. */
export function indentRows(rows: DesgloseRow[], i: number): DesgloseRow[] {
  const k = indentParentIndex(rows, i);
  if (k < 0 || rows[k].tipo !== 'grupo') return rows;
  return shiftDepth(rows, i, subtreeEnd(rows, i), 1);
}

/** -1 depth for rows[i] and its whole subtree. Returns the SAME reference when
 *  illegal: at depth 0, or when the moved row is an 'item' and a next sibling
 *  exists — that sibling (the first row after the subtree, at the ORIGINAL
 *  depth) would end up structurally parented to a non-grupo. When the moved
 *  row is a 'grupo', the followers legally become its children (MS-Project
 *  adoption semantics). */
export function outdentRows(rows: DesgloseRow[], i: number): DesgloseRow[] {
  if (!outdentLegal(rows, i)) return rows;
  const j = subtreeEnd(rows, i);
  if (rows[i].tipo === 'item' && j < rows.length && rows[j].depth === rows[i].depth) return rows;
  return shiftDepth(rows, i, j, -1);
}

/** Removes rows[i] and its whole subtree. Followers keep a legal tree without
 *  depth edits: rows[subtreeEnd] has depth ≤ rows[i].depth ≤ prevDepth+1, so
 *  the depth invariant holds across the splice. */
export function deleteSubtree(rows: DesgloseRow[], i: number): DesgloseRow[] {
  return [...rows.slice(0, i), ...rows.slice(subtreeEnd(rows, i))];
}

/** Inserts one blank row directly after rows[i]. Depth follows the anchor:
 *  after an 'item' the new row is a SIBLING (same depth); after a 'grupo' it
 *  becomes that group's FIRST CHILD (depth+1) — the "insertar dentro del grupo"
 *  semantics of the hover ＋. tempId is allocated fresh (max+1, always
 *  positive, matching the rest of the editor). Returns the SAME reference when
 *  i is out of range. The result always satisfies the depth invariant: the new
 *  depth is ≤ anchor.depth+1, and the row that follows already had
 *  depth ≤ anchor.depth+1, so neither step jumps depth by more than 1. */
export function insertRowAfter(rows: DesgloseRow[], i: number, tipo: 'grupo' | 'item'): DesgloseRow[] {
  if (i < 0 || i >= rows.length) return rows;
  const anchor = rows[i];
  const depth = anchor.tipo === 'grupo' ? anchor.depth + 1 : anchor.depth;
  const tempId = rows.reduce((m, r) => Math.max(m, r.tempId), 0) + 1;
  const fresh: DesgloseRow = {
    tempId, rowUid: newRowUid(), depth, tipo, item: '', descripcion: '', unidad: null, cantidad: null, precioUnitario: null,
  };
  return [...rows.slice(0, i + 1), fresh, ...rows.slice(i + 1)];
}

/** Same legality as moveSubtree — an adjacent sibling subtree exists in the
 *  given direction — WITHOUT allocating a new array. */
export function canMoveSubtree(rows: DesgloseRow[], i: number, dir: -1 | 1): boolean {
  const depth = rows[i].depth;
  if (dir === -1) {
    let k = i - 1;
    while (k >= 0 && rows[k].depth > depth) k--; // walk past the previous subtree's descendants
    return k >= 0 && rows[k].depth === depth;
  }
  const j = subtreeEnd(rows, i);
  return j < rows.length && rows[j].depth === depth;
}

/** Moves the subtree rooted at rows[i] (the row plus every following row with
 *  depth > rows[i].depth) to swap places with the ADJACENT SIBLING subtree in
 *  the given direction. A sibling is the nearest subtree root at the SAME
 *  depth under the same parent. Returns the SAME array reference when there
 *  is no such sibling (first child moving up, last child moving down, or the
 *  neighbor belongs to a different parent). Depths never change. */
export function moveSubtree(rows: DesgloseRow[], i: number, dir: -1 | 1): DesgloseRow[] {
  if (!canMoveSubtree(rows, i, dir)) return rows;
  const j = subtreeEnd(rows, i);
  if (dir === -1) {
    const depth = rows[i].depth;
    let k = i - 1;
    while (k >= 0 && rows[k].depth > depth) k--; // start of the previous sibling's subtree
    return [...rows.slice(0, k), ...rows.slice(i, j), ...rows.slice(k, i), ...rows.slice(j)];
  }
  const m = subtreeEnd(rows, j); // end of the next sibling's subtree
  return [...rows.slice(0, i), ...rows.slice(j, m), ...rows.slice(i, j), ...rows.slice(m)];
}
