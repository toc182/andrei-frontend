// src/lib/desglosePaste.ts — clipboard TSV -> DesgloseRow[] for the paste
// preview. Pure; reuses the cronograma TSV splitter. Column order is fixed
// (Ivan): item, descripción, unidad, cantidad, PU, [total]. Two hierarchy
// modes, chosen in the preview dialog:
//   codigos: depth via longest-known-proper-prefix of the item code, so
//            "1.1" nests under a REAL "1" row; "1.01" without a "1" row
//            stays flat (segment split on dots; trailing digit-runs split
//            off letter prefixes: A1.1 -> [A,1,1]).
//   plano:   everything at depth 0.
// A row with no cantidad AND no PU is a grupo. Totals are recomputed; a
// pasted total that disagrees sets totalMismatch (preview badge, computed
// value wins — Ivan's rounding decision).
// A final normalization pass makes the preview satisfy the editor-model
// invariant (depth ≤ prevDepth+1; a structural parent is always a 'grupo'),
// so what the user previews is exactly what saves — children of an 'item'
// are demoted to siblings, never silently flattened later.

import { parseTsv } from './cronogramaPasteTsv';
import { newRowUid, type DesgloseRow } from './desgloseModel';

export type DesglosePasteMode = 'codigos' | 'plano';

export interface DesglosePasteRow extends DesgloseRow {
  totalMismatch: boolean;
}
export interface DesglosePasteResult {
  rows: DesglosePasteRow[];
  mode: DesglosePasteMode;
  skippedHeader: boolean;
}

/** "1,200.50", "$12.75", "B/. 5", "1.234.567", "(1,200.50)" -> number|null. */
export function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  // Accounting negatives: "(1,200.50)" -> -1200.50.
  let negative = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) { negative = true; s = paren[1]; }
  // Strip currency tokens BEFORE the character-class strip so "B/." doesn't
  // leave a stray dot behind that corrupts the separator heuristics.
  s = s.replace(/B\/\.?/gi, '').replace(/\$/g, '');
  s = s.replace(/[^0-9.,-]/g, '').trim();
  if (!s) return null;
  // If both separators appear, the LAST one is the decimal point.
  const lastComma = s.lastIndexOf(','); const lastDot = s.lastIndexOf('.');
  let norm = s;
  if (lastComma > -1 && lastDot > -1) {
    norm = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // lone comma: decimal if followed by 1-2 digits, else thousands
    norm = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot > -1 && s.indexOf('.') !== lastDot) {
    // multiple dots, no comma: dots are thousands separators ("1.234.567")
    norm = s.replace(/\./g, '');
  }
  // Reject malformed remainders outright instead of trusting parseFloat's
  // lenient prefix-parse ("12.3,4" must be null, not 12.3).
  if (!/^-?\d*(\.\d*)?$/.test(norm) || !/\d/.test(norm)) return null;
  const n = parseFloat(norm);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** "A1.1" -> ["A","1","1"]; "1.2.3" -> ["1","2","3"]; "1.01" -> ["1","01"]. */
export function codeSegments(code: string): string[] {
  return code
    .split(/[.-]/)
    .flatMap((part) => part.match(/^([A-Za-z]+)(\d+)$/)?.slice(1) ?? (part ? [part] : []));
}

const isProperPrefix = (parent: string[], child: string[]): boolean =>
  parent.length < child.length && parent.every((s, i) => s === child[i]);

const HEADER_RE = /^(item|ítem|no\.?|código)$/i;

export function parseDesglosePaste(text: string, mode: DesglosePasteMode): DesglosePasteResult {
  const grid = parseTsv(text);
  let skippedHeader = false;
  let dataRows = grid;
  if (grid.length && HEADER_RE.test((grid[0][0] ?? '').trim())) {
    dataRows = grid.slice(1);
    skippedHeader = true;
  }
  const out: DesglosePasteRow[] = [];
  // stack of {segs, depth} for codigos mode — longest known proper prefix wins
  const codeStack: { segs: string[]; depth: number }[] = [];
  let tempId = 1;
  for (const cells of dataRows) {
    if (cells.every((c) => !c.trim())) continue; // fully blank line — EVERY cell empty
    const [c0 = '', c1 = '', c2 = '', c3 = '', c4 = '', c5 = ''] = cells.map((c) => c.trim());
    const cantidad = parseMoney(c3);
    const precioUnitario = parseMoney(c4);
    const pastedTotal = parseMoney(c5);
    const tipo: 'grupo' | 'item' = cantidad == null && precioUnitario == null ? 'grupo' : 'item';
    let depth = 0;
    if (mode === 'codigos' && c0) {
      const segs = codeSegments(c0);
      while (codeStack.length && !isProperPrefix(codeStack[codeStack.length - 1].segs, segs)) codeStack.pop();
      depth = codeStack.length ? codeStack[codeStack.length - 1].depth + 1 : 0;
      codeStack.push({ segs, depth });
    }
    const computed = tipo === 'item' && cantidad != null && precioUnitario != null ? cantidad * precioUnitario : null;
    out.push({
      tempId: tempId++,
      rowUid: newRowUid(),
      depth,
      tipo,
      item: c0,
      descripcion: c1,
      unidad: c2 || null,
      cantidad: tipo === 'grupo' ? null : cantidad,
      precioUnitario: tipo === 'grupo' ? null : precioUnitario,
      totalMismatch: computed != null && pastedTotal != null && Math.abs(computed - pastedTotal) > 0.005,
    });
  }
  // Final normalization: the preview must already satisfy the editor-model
  // invariant end to end. (i) clamp depth to ≤ prevDepth+1; (ii) a row whose
  // structural parent (nearest preceding row at depth-1, after clamping) is
  // tipo 'item' is demoted to that parent's depth — a sibling — iterating
  // until the parent is a grupo or the row reaches the root. Money is never
  // touched; nothing gets silently flattened at save time.
  const lastTipoAtDepth: ('grupo' | 'item')[] = [];
  let prevDepth = -1;
  for (const r of out) {
    let d = Math.min(r.depth, prevDepth + 1);
    while (d > 0 && lastTipoAtDepth[d - 1] !== 'grupo') d--;
    r.depth = d;
    lastTipoAtDepth[d] = r.tipo;
    prevDepth = d;
  }
  return { rows: out, mode, skippedHeader };
}
