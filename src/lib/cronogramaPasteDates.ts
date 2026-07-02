// Date parsing for the cronograma bulk-paste dialog. The product owner pastes presupuesto rows
// from Excel where Inicio/Fin are locale-formatted (Panama defaults to dd/mm/aaaa), so a column
// can hold "15/03/2026", "2026-03-15", "15 mar 2026", or a mix. Two hard requirements drive this
// module (build-spec guarantee "Honest dates"):
//
//   1. Validity is decided on the INTEGER tokens BEFORE ever calling `new Date(y, m-1, d)`. JS
//      Date silently rolls over 31/02 -> Mar 3 and 13/01 -> next-Jan; we reject those at the token
//      level so a bad cell BLOCKS its row instead of scheduling a wrong date. Output is built with
//      `fmtDate` (zero-padded), never toISOString (which shifts by timezone).
//   2. Ambiguous numeric order (dd/mm vs mm/dd) is resolved per COLUMN, not per cell, so one
//      "25/03" in the column pins the whole column to dd/mm. Precedence: ISO > named month >
//      an unambiguous `day > 12` component > the user's selector. A data-driven order that
//      contradicts the selector is reported as a conflict for the dialog to block on.

import { fmtDate } from './cronogramaEngine';

/** User-chosen order for numeric dates whose components are all <= 12 (genuinely ambiguous). */
export type DateOrder = 'dmy' | 'mdy';

/** Per-cell outcome. `blank` distinguishes "no date given" (allowed) from "invalid" (blocks row). */
export type DateResult =
  | { ok: true; value: string } // "YYYY-MM-DD"
  | { ok: false; reason: string; blank?: boolean };

export interface DateColumnResult {
  results: DateResult[]; // one per input cell, same order
  resolvedOrder: DateOrder; // the order actually used for ambiguous numeric cells
  inference: 'iso' | 'named-month' | 'day-gt-12' | 'selector'; // what decided the order
  conflict: string | null; // data-driven order contradicts the selector (dialog blocks on this)
}

// Spanish first (incl. the "set"/"sep"/"setiembre" September variants the spec calls out), then
// English abbreviations so an English export still parses. Keys are lowercased, dot-stripped.
const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, set: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
};

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Map a 2-digit year into a sane century (00–69 -> 2000s, 70–99 -> 1900s). Pass-through otherwise. */
function pivotYear(y: number): number {
  if (y >= 100) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

// Validate integers, THEN format — never let new Date roll a bad triple over.
function validate(y: number, m: number, d: number): DateResult {
  if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false, reason: `mes inválido (${m})` };
  if (!Number.isInteger(y) || y < 1900 || y > 2999) return { ok: false, reason: `año fuera de rango (${y})` };
  const dim = daysInMonth(y, m);
  if (!Number.isInteger(d) || d < 1 || d > dim) return { ok: false, reason: `día inválido (${d}) para ${m}/${y}` };
  return { ok: true, value: fmtDate(new Date(y, m - 1, d)) };
}

type Classified =
  | { kind: 'blank' }
  | { kind: 'serial' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'iso'; y: number; m: number; d: number }
  | { kind: 'named'; year: number; month: number; day: number }
  | { kind: 'numeric'; a: number; b: number; year: number }; // a,b = first two components (order TBD)

const SERIAL = 'parece un número de serie de Excel; pega la fecha como texto (dd/mm/aaaa)';

/** Classify a raw cell without committing to a dd/mm vs mm/dd order (that is a column decision). */
function classify(raw: string): Classified {
  const s = raw.trim();
  if (!s) return { kind: 'blank' };
  // Bare all-digit run of 5+ = Excel serial (e.g. 45678). Reject with a hint; don't guess an epoch.
  if (/^\d{5,}$/.test(s)) return { kind: 'serial' };

  const hasLetters = /[a-zA-Záéíóúñ]/i.test(s);
  if (hasLetters) {
    const tokens = s
      .toLowerCase()
      .split(/[\s/.-]+/)
      .map((t) => t.replace(/\.$/, ''))
      .filter(Boolean);
    const mi = tokens.findIndex((t) => t in MONTHS);
    if (mi === -1) return { kind: 'invalid', reason: 'mes no reconocido' };
    const month = MONTHS[tokens[mi]];
    const others = tokens.filter((_, i) => i !== mi);
    const nums = others.filter((t) => /^\d+$/.test(t));
    if (nums.length !== 2) return { kind: 'invalid', reason: 'fecha con nombre de mes incompleta' };
    // Year = a 4-digit or >31 token; otherwise the last numeric token. Day = the other.
    let year = nums.find((t) => t.length >= 4 || Number(t) > 31);
    if (year === undefined) year = nums[nums.length - 1];
    const day = nums.find((t) => t !== year) ?? nums[0];
    return { kind: 'named', year: pivotYear(Number(year)), month, day: Number(day) };
  }

  const parts = s.split(/[/.-]/).filter(Boolean);
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) {
    return { kind: 'invalid', reason: 'formato de fecha no reconocido' };
  }
  const [g0, g1, g2] = parts;
  if (g0.length === 4) {
    return { kind: 'iso', y: Number(g0), m: Number(g1), d: Number(g2) };
  }
  // Year is the last group (4-digit, or a pivoted 2-digit); first two components stay ambiguous.
  const year = pivotYear(Number(g2));
  return { kind: 'numeric', a: Number(g0), b: Number(g1), year };
}

function resolve(c: Classified, order: DateOrder): DateResult {
  switch (c.kind) {
    case 'blank':
      return { ok: false, reason: '(sin fecha)', blank: true };
    case 'serial':
      return { ok: false, reason: SERIAL };
    case 'invalid':
      return { ok: false, reason: c.reason };
    case 'iso':
      return validate(c.y, c.m, c.d);
    case 'named':
      return validate(c.year, c.month, c.day);
    case 'numeric': {
      const d = order === 'dmy' ? c.a : c.b;
      const m = order === 'dmy' ? c.b : c.a;
      return validate(c.year, m, d);
    }
  }
}

const label = (o: DateOrder) => (o === 'dmy' ? 'dd/mm/aaaa' : 'mm/dd/aaaa');

/** Parse a single cell with a known order — exposed for fixture tests. */
export function parseSingleDate(raw: string, order: DateOrder): DateResult {
  return resolve(classify(raw), order);
}

/**
 * Parse a whole date column. Resolves dd/mm vs mm/dd ONCE for the column from the strongest
 * available signal, then applies it to every ambiguous cell. Reports a `conflict` when the data
 * clearly implies an order other than the one the user selected.
 */
export function parseDateColumn(cells: string[], selector: DateOrder): DateColumnResult {
  const classified = cells.map(classify);

  let dmyVotes = 0;
  let mdyVotes = 0;
  for (const c of classified) {
    if (c.kind !== 'numeric') continue;
    if (c.a > 12 && c.b <= 12) dmyVotes++;
    else if (c.b > 12 && c.a <= 12) mdyVotes++;
    // a>12 && b>12 is impossible in either order — left to fail token validation.
  }

  let resolvedOrder: DateOrder = selector;
  let inference: DateColumnResult['inference'] = 'selector';
  let conflict: string | null = null;

  if (dmyVotes > 0 && mdyVotes > 0) {
    // The column contradicts itself; keep the selector and surface it.
    conflict = 'La columna mezcla fechas dd/mm y mm/dd; revisa el formato de origen.';
  } else if (dmyVotes > 0) {
    resolvedOrder = 'dmy';
    inference = 'day-gt-12';
  } else if (mdyVotes > 0) {
    resolvedOrder = 'mdy';
    inference = 'day-gt-12';
  } else if (!classified.some((c) => c.kind === 'numeric')) {
    // No ambiguous numeric cells at all: order is moot, note the self-describing source.
    inference = classified.some((c) => c.kind === 'iso')
      ? 'iso'
      : classified.some((c) => c.kind === 'named')
        ? 'named-month'
        : 'selector';
  }

  if (inference === 'day-gt-12' && resolvedOrder !== selector) {
    conflict = `Las fechas parecen estar en formato ${label(resolvedOrder)}, pero seleccionaste ${label(selector)}.`;
  }

  return { results: classified.map((c) => resolve(c, resolvedOrder)), resolvedOrder, inference, conflict };
}
