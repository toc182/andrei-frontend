// src/lib/outline.ts — the tree ops shared by every outline editor.
//
// State = flat rows in document order with an explicit `depth`. Everything here
// touches ONLY depth, tipo and tempId, so it is independent of what a row holds
// (an item + precio in the desglose, a código + costo in the presupuesto).
// Extracted from desgloseModel, where this logic was first written and proven;
// the naming and the invariants are unchanged.
//
// The depth invariant every op preserves: depth ≤ prevDepth + 1, and a row that
// is a structural parent is always a 'grupo'.
//
// Gated by scripts/desglose.spec.ts (the desglose editor rides on these) and
// scripts/presupuesto-hoja.spec.ts.

export interface OutlineRow {
  tempId: number;
  depth: number;
  tipo: 'grupo' | 'item';
}

/** UUID estable para una fila nueva. Round-trips con el backend para que la
 *  identidad de la fila sobreviva al guardado wholesale. */
export const newRowUid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Next free tempId. Always positive (allocated from 1 upward), so reserved
 *  negative keys — GRAND_TOTAL_KEY and friends — can never collide with a row. */
export const nextTempId = (rows: OutlineRow[]): number =>
  rows.reduce((m, r) => Math.max(m, r.tempId), 0) + 1;

/** True when rows[i] is a grupo that owns at least one child (the next row is
 *  deeper). A grupo WITHOUT children is a "sección de una línea": it carries its
 *  own montos like an item. Depth order guarantees a child, if any, is the
 *  immediately following row. */
export const hasChildren = (rows: OutlineRow[], i: number): boolean =>
  i + 1 < rows.length && rows[i + 1].depth > rows[i].depth;

/** A row can indent when the result stays ≤ prevDepth+1 (i.e. its depth is
 *  currently ≤ the previous row's). The new parent may be an 'item' — the
 *  VIEW then promotes it to 'grupo' (clearing its montos behind an
 *  AlertDialog confirm, since that loses data). */
export const indentLegal = (rows: OutlineRow[], i: number): boolean =>
  i > 0 && rows[i].depth <= rows[i - 1].depth;

export const outdentLegal = (rows: OutlineRow[], i: number): boolean => rows[i].depth > 0;

/** Exclusive end index of the subtree rooted at rows[i]: the row itself plus
 *  every following row with depth > rows[i].depth. */
export function subtreeEnd(rows: OutlineRow[], i: number): number {
  const depth = rows[i].depth;
  let j = i + 1;
  while (j < rows.length && rows[j].depth > depth) j++;
  return j;
}

/** New rows array with [i, j) shifted by delta depth. Internal — every public
 *  op validates legality BEFORE calling this. */
const shiftDepth = <T extends OutlineRow>(rows: T[], i: number, j: number, delta: number): T[] =>
  rows.map((r, idx) => (idx >= i && idx < j ? ({ ...r, depth: r.depth + delta } as T) : r));

/** Index of the row that would become rows[i]'s structural parent after an
 *  indent — its nearest PRECEDING sibling at the same depth — or -1 when the
 *  indent is illegal. The parent candidate may be an 'item'; the view must
 *  promote it to 'grupo' first (indentRows refuses otherwise). */
export function indentParentIndex(rows: OutlineRow[], i: number): number {
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
export function indentRows<T extends OutlineRow>(rows: T[], i: number): T[] {
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
export function outdentRows<T extends OutlineRow>(rows: T[], i: number): T[] {
  if (!outdentLegal(rows, i)) return rows;
  const j = subtreeEnd(rows, i);
  if (rows[i].tipo === 'item' && j < rows.length && rows[j].depth === rows[i].depth) return rows;
  return shiftDepth(rows, i, j, -1);
}

/** Removes rows[i] and its whole subtree. Followers keep a legal tree without
 *  depth edits: rows[subtreeEnd] has depth ≤ rows[i].depth ≤ prevDepth+1, so
 *  the depth invariant holds across the splice. */
export function deleteSubtree<T extends OutlineRow>(rows: T[], i: number): T[] {
  return [...rows.slice(0, i), ...rows.slice(subtreeEnd(rows, i))];
}

/** Inserts one blank row directly after rows[i]. Depth follows the anchor:
 *  after an 'item' the new row is a SIBLING (same depth); after a 'grupo' it
 *  becomes that group's FIRST CHILD (depth+1) — the "insertar dentro del grupo"
 *  semantics of the hover ＋. The caller supplies `make`, which receives the
 *  allocated tempId and the resolved depth and returns the blank row of its own
 *  shape. Returns the SAME reference when i is out of range.
 *
 *  The result always satisfies the depth invariant: the new depth is ≤
 *  anchor.depth+1, and the row that follows already had depth ≤ anchor.depth+1,
 *  so neither step jumps depth by more than 1. */
export function insertRowAfter<T extends OutlineRow>(
  rows: T[],
  i: number,
  make: (tempId: number, depth: number) => T,
): T[] {
  if (i < 0 || i >= rows.length) return rows;
  const anchor = rows[i];
  const depth = anchor.tipo === 'grupo' ? anchor.depth + 1 : anchor.depth;
  return [...rows.slice(0, i + 1), make(nextTempId(rows), depth), ...rows.slice(i + 1)];
}

/** Same legality as moveSubtree — an adjacent sibling subtree exists in the
 *  given direction — WITHOUT allocating a new array. */
export function canMoveSubtree(rows: OutlineRow[], i: number, dir: -1 | 1): boolean {
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
export function moveSubtree<T extends OutlineRow>(rows: T[], i: number, dir: -1 | 1): T[] {
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

/** Document order -> the parentTempId each row must carry on the wire.
 *
 *  Items never write a stack slot, so the slot just below a row can be a hole;
 *  the real parent is the nearest DEFINED grupo slot strictly below its depth.
 *  Only truly-root rows get null. */
export function parentTempIds(rows: OutlineRow[]): (number | null)[] {
  const stack: (number | undefined)[] = []; // tempId of the current grupo ancestor per depth
  return rows.map((r) => {
    stack.length = r.depth;
    let parentTempId: number | null = null;
    for (let d = r.depth - 1; d >= 0; d--) {
      const anc = stack[d];
      if (anc != null) { parentTempId = anc; break; }
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
    return parentTempId;
  });
}
