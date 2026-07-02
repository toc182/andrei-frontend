// Hierarchy inference for the cronograma bulk-paste dialog. A presupuesto pasted from Excel can
// encode its WBS nesting in several ways; this module picks ONE (overridable in the dialog) and
// turns it into a clean per-row depth. Detection cascade, strongest signal first:
//
//   Nivel column  ("1","2","3")           -> depth = level - 1
//   WBS number    ("1", "1.2", "1.2.3")   -> depth = dotted-segment count - 1
//   leading empty columns (outline paste) -> depth = index of the first non-empty cell
//   leading whitespace in the name        -> depth = leading spaces / detected unit
//   flat                                  -> everything at depth 0
//
// normalizeDepthSequence guarantees a legal tree: shift min -> 0, force row 0 to depth 0, and clamp
// each row to at most prevDepth+1 (you can't jump from depth 0 straight to depth 2). A blocking
// rule protects summary rows: an empty-NAME row that has deeper rows under it is a parent with no
// name — that is flagged as BLOCKING, never silently dropped (dropping it would re-parent its
// descendants onto the wrong summary).

export type HierMode = 'nivel' | 'wbs' | 'empty-cols' | 'whitespace' | 'flat';

export interface ModeDetection {
  mode: HierMode;
  confidence: number; // 0..1 (agreement between the chosen mode and its runner-up)
  lowConfidence: boolean;
  levelCount: number; // number of distinct depth tiers (maxDepth + 1)
  groupCount: number; // rows that end up with at least one child
  rationale: string; // Spanish sentence shown in the dialog
}

export interface HierResult {
  detection: ModeDetection;
  depths: number[]; // normalized depth per row
  names: string[]; // effective (trimmed) name per row for the chosen mode
  clamped: Set<number>; // rows whose raw depth was clamped down to prevDepth+1
  blocking: Map<number, string>; // rowIndex -> reason (empty-name rows)
}

const WBS_PREFIX = /^(\d+(?:\.\d+)*)\b/;

const cell = (grid: string[][], i: number, col: number) => (grid[i]?.[col] ?? '');
const firstNonEmpty = (row: string[]) => row.findIndex((c) => c.trim() !== '');

/** Comma-or-dot decimal -> rounded work-days, floored at 1. Empty/garbage -> null. */
export function parseDias(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.round(n));
}

// ---- per-mode raw depth (NaN where the mode doesn't apply to that row) ----

function nivelRaw(grid: string[][], nivelCol: number): number[] {
  return grid.map((_, i) => {
    const v = cell(grid, i, nivelCol).trim();
    if (/^\d+(\.\d+)+$/.test(v)) return v.split('.').length - 1; // dotted value in the Nivel column
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    return NaN;
  });
}

function wbsRaw(grid: string[][], nameCol: number): number[] {
  return grid.map((_, i) => {
    const m = cell(grid, i, nameCol).trim().match(WBS_PREFIX);
    return m ? m[1].split('.').length - 1 : NaN;
  });
}

function emptyColRaw(grid: string[][]): number[] {
  return grid.map((r) => Math.max(0, firstNonEmpty(r)));
}

function whitespaceRaw(grid: string[][], nameCol: number): { depths: number[]; unit: number } {
  const lead = grid.map((_, i) => {
    const raw = cell(grid, i, nameCol);
    return raw.length - raw.replace(/^ +/, '').length;
  });
  const positives = lead.filter((n) => n > 0);
  const unit = positives.length ? Math.min(...positives) : 1;
  return { depths: lead.map((n) => Math.round(n / unit)), unit };
}

// ---- detection helpers ----

function applicable(raw: number[]): number {
  return raw.filter((d) => !Number.isNaN(d)).length;
}
function distinct(raw: number[]): number {
  return new Set(raw.filter((d) => !Number.isNaN(d))).size;
}

function normalize(raw: number[]): number[] {
  const clean = raw.map((d) => (Number.isNaN(d) ? 0 : d));
  const min = clean.length ? Math.min(...clean) : 0;
  return clean.map((d) => d - min);
}

function disagreementRatio(a: number[], b: number[]): number {
  const na = normalizeSequence(normalize(a)).depths;
  const nb = normalizeSequence(normalize(b)).depths;
  let diff = 0;
  for (let i = 0; i < na.length; i++) if (na[i] !== nb[i]) diff++;
  return na.length ? diff / na.length : 0;
}

/** Shift min->0, force row0=0, clamp each row to prevDepth+1. Returns depths + clamped rows. */
function normalizeSequence(shifted: number[]): { depths: number[]; clamped: Set<number> } {
  const depths: number[] = [];
  const clamped = new Set<number>();
  for (let i = 0; i < shifted.length; i++) {
    if (i === 0) {
      if (shifted[0] !== 0) clamped.add(0);
      depths.push(0);
      continue;
    }
    const ceiling = depths[i - 1] + 1;
    const want = Math.max(0, shifted[i]);
    if (want > ceiling) {
      clamped.add(i);
      depths.push(ceiling);
    } else {
      depths.push(want);
    }
  }
  return { depths, clamped };
}

function effectiveNames(grid: string[][], nameCol: number, mode: HierMode): string[] {
  return grid.map((r, i) => {
    if (mode === 'empty-cols') {
      const idx = firstNonEmpty(r);
      return idx >= 0 ? r[idx].trim() : '';
    }
    return cell(grid, i, nameCol).trim();
  });
}

function rawFor(grid: string[][], nameCol: number, nivelCol: number | null, mode: HierMode): number[] {
  switch (mode) {
    case 'nivel':
      return nivelCol != null ? nivelRaw(grid, nivelCol) : grid.map(() => 0);
    case 'wbs':
      return wbsRaw(grid, nameCol);
    case 'empty-cols':
      return emptyColRaw(grid);
    case 'whitespace':
      return whitespaceRaw(grid, nameCol).depths;
    case 'flat':
      return grid.map(() => 0);
  }
}

function detectMode(grid: string[][], nameCol: number, nivelCol: number | null): HierMode {
  const n = grid.length;
  if (!n) return 'flat';

  if (nivelCol != null) {
    const raw = nivelRaw(grid, nivelCol);
    if (applicable(raw) >= n * 0.5) return 'nivel';
  }
  const wbs = wbsRaw(grid, nameCol);
  if (applicable(wbs) >= n * 0.6 && distinct(wbs) > 1) return 'wbs';

  // Outline paste: names staggered across leading columns (only when the name maps to column 0).
  if (nameCol === 0) {
    const fne = grid.map((r) => firstNonEmpty(r));
    const hasIndent = fne.some((i) => i > 0);
    const hasRoot = fne.some((i) => i === 0);
    if (hasIndent && hasRoot && new Set(fne.filter((i) => i >= 0)).size > 1) return 'empty-cols';
  }

  const { depths: ws } = whitespaceRaw(grid, nameCol);
  if (ws.some((d) => d > 0) && !ws.every((d) => d > 0)) return 'whitespace';

  return 'flat';
}

const RATIONALE: Record<HierMode, string> = {
  nivel: 'Detecté niveles por la columna Nivel',
  wbs: 'Detecté niveles por numeración WBS',
  'empty-cols': 'Detecté niveles por columnas en blanco',
  whitespace: 'Detecté niveles por sangría',
  flat: 'Sin jerarquía detectada — todas las filas al mismo nivel',
};

/**
 * Resolve the hierarchy for a pasted grid. Pass `modeOverride` to force a mode (dialog dropdown);
 * otherwise the cascade decides. Returns normalized depths, effective names, clamp flags, and the
 * blocking map for empty-name rows.
 */
export function analyzeHierarchy(
  grid: string[][],
  nameCol: number,
  nivelCol: number | null,
  modeOverride?: HierMode,
): HierResult {
  const n = grid.length;
  const mode = modeOverride ?? detectMode(grid, nameCol, nivelCol);
  const names = effectiveNames(grid, nameCol, mode);

  const raw = rawFor(grid, nameCol, nivelCol, mode);
  const { depths, clamped } = normalizeSequence(normalize(raw));

  // Confidence: agreement between the chosen mode and the next mode that would apply.
  const others: HierMode[] = (['nivel', 'wbs', 'empty-cols', 'whitespace', 'flat'] as HierMode[]).filter(
    (m) => m !== mode && (m !== 'nivel' || nivelCol != null),
  );
  let bestDisagreement = 0;
  for (const m of others) {
    if (m === 'flat') continue; // flat trivially disagrees with any nested mode; not informative
    const r = disagreementRatio(raw, rawFor(grid, nameCol, nivelCol, m));
    if (r > bestDisagreement) bestDisagreement = r;
  }
  const confidence = mode === 'flat' ? 1 : Math.round((1 - bestDisagreement) * 100) / 100;
  const lowConfidence = mode !== 'flat' && bestDisagreement > 0.25;

  // Blocking: empty-name rows (a nameless task can't exist; a nameless summary re-parents children).
  const blocking = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    if (names[i] !== '') continue;
    const hasChild = i + 1 < n && depths[i + 1] > depths[i];
    blocking.set(i, hasChild ? 'Fila sin nombre con sub-filas debajo (grupo sin nombre).' : 'Fila sin nombre.');
  }

  const levelCount = depths.length ? Math.max(...depths) + 1 : 0;
  const groupCount = depths.filter((d, i) => i + 1 < n && depths[i + 1] > d).length;
  const rationale =
    mode === 'flat'
      ? RATIONALE.flat
      : `${RATIONALE[mode]} — ${levelCount} ${levelCount === 1 ? 'nivel' : 'niveles'}, ${groupCount} ${groupCount === 1 ? 'grupo' : 'grupos'}`;

  return {
    detection: { mode, confidence, lowConfidence, levelCount, groupCount, rationale },
    depths,
    names,
    clamped,
    blocking,
  };
}
