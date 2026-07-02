// Orchestrator for the cronograma bulk-paste dialog. Turns raw clipboard text into resolved rows
// (name, depth, dates, duration, per-row issues) and then into candidate EngineTask[] ready to
// merge into the live tree for a live preview. Pure — imports only the engine types + the three
// paste sub-modules, never the workspace, so it stays trivially testable by the tsx golden script.
//
// Split of responsibility (build-spec guarantee "No silent row loss"):
//   - parsePaste           : text -> ResolvedPasteRow[] + detection + schedule-INDEPENDENT issues.
//   - buildPasteCandidate  : resolved rows -> candidate EngineTask[] (parentId, orders, group
//                            promotion, date push-down). Fin->duration inversion is deferred to
//                            cronogramaTaskOps (it needs the schedule) and shared with the commit
//                            path, so the preview and the real insert are the same code.
//
// Every fallback (blank Inicio, assumed default 5, Días-wins-over-Fin, group-promotion date drop,
// depth clamp, row-cap truncation) emits a per-row flag AND bumps an aggregate counter.

import type { EngineTask, TaskId } from './cronogramaEngine';
import { parseTsv } from './cronogramaPasteTsv';
import { parseDateColumn, type DateOrder, type DateResult, type DateColumnResult } from './cronogramaPasteDates';
import { analyzeHierarchy, parseDias, type HierMode, type ModeDetection } from './cronogramaPasteHierarchy';

/** Hard ceiling per paste; anything past it is dropped with a visible message (never silently). */
export const MAX_PASTE_ROWS = 1000;

export type IssueLevel = 'blocking' | 'warn' | 'info';
export interface PasteIssue {
  level: IssueLevel;
  code: string;
  message: string;
}

export type DurationSource = 'explicit' | 'derived-from-fin' | 'assumed-default';

/** Column role -> column index (null = not mapped). Name defaults to column 0 when unmapped. */
export interface PasteMapping {
  name: number | null;
  dias: number | null;
  inicio: number | null;
  fin: number | null;
  nivel: number | null;
}

export interface ParsePasteOptions {
  mapping: PasteMapping;
  headerRow: boolean;
  dateFormat: DateOrder;
  mode?: HierMode; // override the detected hierarchy mode
}

export interface ResolvedPasteRow {
  sourceRow: number; // 1-based index into the pasted DATA rows (names the row in "omitir X")
  name: string;
  depth: number; // normalized WBS depth
  manualDate: string | null; // resolved Inicio, or null
  fin: string | null; // resolved Fin, or null
  duration: number; // provisional duration (final Fin-derived value comes post-schedule)
  durationSource: DurationSource;
  manualDateResult: DateResult | null;
  finResult: DateResult | null;
  issues: PasteIssue[];
  blocked: boolean; // has at least one blocking issue
}

export interface PasteCounters {
  totalPasted: number; // data rows before the cap
  included: number; // data rows after the cap
  blocked: number;
  assumedDefault: number;
  diasWinsOverFin: number;
  badDate: number;
  depthClamped: number;
  emptyName: number;
}

export interface ParsePasteResult {
  rows: ResolvedPasteRow[];
  detection: ModeDetection;
  dateInicio: DateColumnResult | null;
  dateFin: DateColumnResult | null;
  counters: PasteCounters;
  truncated: boolean;
}

function emptyCounters(): PasteCounters {
  return {
    totalPasted: 0,
    included: 0,
    blocked: 0,
    assumedDefault: 0,
    diasWinsOverFin: 0,
    badDate: 0,
    depthClamped: 0,
    emptyName: 0,
  };
}

// Early-return narrowing (reliable under this repo's strictNullChecks:false) — a non-blank invalid
// mapped date becomes a blocking issue; blank/ok/absent -> no issue.
function badDateIssue(res: DateResult | null, kind: 'inicio' | 'fin'): PasteIssue | null {
  if (!res || res.ok) return null;
  // strictNullChecks:false won't narrow a boolean-discriminated union to its failure member; pin it.
  const fail = res as Extract<DateResult, { ok: false }>;
  if (fail.blank) return null;
  const label = kind === 'inicio' ? 'Inicio' : 'Fin';
  return { level: 'blocking', code: `bad-${kind}`, message: `${label} inválido: ${fail.reason}` };
}

const FLAT_DETECTION: ModeDetection = {
  mode: 'flat',
  confidence: 1,
  lowConfidence: false,
  levelCount: 0,
  groupCount: 0,
  rationale: 'Sin filas para analizar.',
};

/** Parse pasted text into resolved rows + everything the dialog needs to render the preview. */
export function parsePaste(text: string, opts: ParsePasteOptions): ParsePasteResult {
  const { mapping, headerRow, dateFormat, mode } = opts;
  const grid = parseTsv(text);
  const body = headerRow ? grid.slice(1) : grid;
  const totalPasted = body.length;
  const truncated = body.length > MAX_PASTE_ROWS;
  const dataGrid = truncated ? body.slice(0, MAX_PASTE_ROWS) : body;

  if (dataGrid.length === 0) {
    return {
      rows: [],
      detection: FLAT_DETECTION,
      dateInicio: null,
      dateFin: null,
      counters: { ...emptyCounters(), totalPasted, included: 0 },
      truncated,
    };
  }

  const nameCol = mapping.name ?? 0;
  const { nivel, inicio, fin, dias } = mapping;

  const hier = analyzeHierarchy(dataGrid, nameCol, nivel, mode);
  const dateInicio = inicio != null ? parseDateColumn(dataGrid.map((r) => r[inicio] ?? ''), dateFormat) : null;
  const dateFin = fin != null ? parseDateColumn(dataGrid.map((r) => r[fin] ?? ''), dateFormat) : null;

  const counters = { ...emptyCounters(), totalPasted, included: dataGrid.length };
  const rows: ResolvedPasteRow[] = dataGrid.map((r, i) => {
    const issues: PasteIssue[] = [];

    const nameBlock = hier.blocking.get(i);
    if (nameBlock) {
      issues.push({ level: 'blocking', code: 'empty-name', message: nameBlock });
      counters.emptyName++;
    }
    if (hier.clamped.has(i)) {
      issues.push({ level: 'warn', code: 'depth-clamp', message: 'Nivel ajustado: no puede saltar más de un nivel.' });
      counters.depthClamped++;
    }

    const iniRes = dateInicio ? dateInicio.results[i] : null;
    const manualDate = iniRes && iniRes.ok ? iniRes.value : null;
    const iniBad = badDateIssue(iniRes, 'inicio');
    if (iniBad) {
      issues.push(iniBad);
      counters.badDate++;
    }

    const finRes = dateFin ? dateFin.results[i] : null;
    const fin_ = finRes && finRes.ok ? finRes.value : null;
    const finBad = badDateIssue(finRes, 'fin');
    if (finBad) {
      issues.push(finBad);
      counters.badDate++;
    }

    const explicitDias = dias != null ? parseDias(r[dias] ?? '') : null;
    let duration = 5;
    let durationSource: DurationSource;
    if (explicitDias != null) {
      durationSource = 'explicit';
      duration = explicitDias;
      if (fin_ != null) {
        issues.push({ level: 'warn', code: 'dias-wins', message: `Se usó Días (${explicitDias}); se ignoró Fin.` });
        counters.diasWinsOverFin++;
      }
    } else if (fin_ != null) {
      durationSource = 'derived-from-fin'; // real value computed after the trial schedule
    } else {
      durationSource = 'assumed-default';
      issues.push({ level: 'info', code: 'assumed-default', message: 'Duración asumida (5 días).' });
      counters.assumedDefault++;
    }

    const blocked = issues.some((x) => x.level === 'blocking');
    if (blocked) counters.blocked++;

    return {
      sourceRow: i + 1,
      name: hier.names[i],
      depth: hier.depths[i],
      manualDate,
      fin: fin_,
      duration,
      durationSource,
      manualDateResult: iniRes,
      finResult: finRes,
      issues,
      blocked,
    };
  });

  return { rows, detection: hier.detection, dateInicio, dateFin, counters, truncated };
}

// ---- candidate construction -------------------------------------------------

export interface PasteCandidateMeta {
  sourceRow: number;
  id: TaskId;
  depth: number;
  promotedToGroup: boolean;
  datePushedDown: boolean; // the promoted node's Inicio moved onto its first child
  finDerived: boolean;
}

export interface PasteCandidate {
  tasks: EngineTask[]; // the new rows, NOT yet merged into the live tree
  ids: TaskId[]; // minted ids in document order (parallel to the input rows)
  finToInvert: Map<TaskId, string>; // leaf id -> Fin; duration inverted after the schedule runs
  touchedParents: (TaskId | null)[]; // parents needing a normalizeOrders after merge
  meta: PasteCandidateMeta[];
}

export interface PastePlacement {
  afterId: TaskId | null;
}

function childOrdersOf(existing: EngineTask[], parent: TaskId | null): number[] {
  return existing
    .filter((t) => (t.parentId ?? null) === parent)
    .map((t) => t.order ?? 0)
    .sort((a, b) => a - b);
}

function newTask(id: TaskId, parentId: TaskId | null, name: string, duration: number, manualDate: string | null, order: number): EngineTask {
  return {
    id,
    parentId,
    type: 'task',
    milestoneType: null,
    name,
    duration,
    manualDate,
    percentComplete: 0,
    color: null,
    notes: null,
    predecessors: [],
    order,
  };
}

/**
 * Build candidate EngineTask[] from resolved rows (already filtered to the rows to insert).
 * Wires parentId via a depth stack, gives batch siblings strictly-increasing fractional orders so
 * document order survives normalizeOrders, promotes any row that gains a child to a group (and
 * pushes that row's Inicio down to its first child), and records which leaves need Fin->duration.
 * Does NOT mutate `existing`; the caller merges `tasks` and runs the shared schedule pass.
 */
export function buildPasteCandidate(
  rows: ResolvedPasteRow[],
  existing: EngineTask[],
  placement: PastePlacement,
  mint: () => TaskId,
): PasteCandidate {
  const after = placement.afterId != null ? existing.find((t) => t.id === placement.afterId) : null;
  let rootParent: TaskId | null;
  let rootBaseOrder: number;
  if (after && after.type === 'group') {
    rootParent = after.id; // insert INSIDE the group, after its current children
    const orders = childOrdersOf(existing, after.id);
    rootBaseOrder = orders.length ? orders[orders.length - 1] : -1;
  } else if (after) {
    rootParent = after.parentId ?? null; // insert right AFTER the selected leaf, among its siblings
    rootBaseOrder = after.order ?? 0;
  } else {
    rootParent = null; // append at the end of the root list
    const orders = childOrdersOf(existing, null);
    rootBaseOrder = orders.length ? orders[orders.length - 1] : -1;
  }

  const tasks: EngineTask[] = [];
  const ids: TaskId[] = [];
  const meta: PasteCandidateMeta[] = [];
  const byId = new Map<TaskId, EngineTask>();
  const stack: { id: TaskId; depth: number }[] = [];

  // Pass 1: create rows + parentId via the depth stack (document order preserved).
  rows.forEach((r) => {
    while (stack.length && stack[stack.length - 1].depth >= r.depth) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : rootParent;
    const id = mint();
    const t = newTask(id, parentId, r.name, r.duration, r.manualDate, 0);
    tasks.push(t);
    ids.push(id);
    byId.set(id, t);
    meta.push({ sourceRow: r.sourceRow, id, depth: r.depth, promotedToGroup: false, datePushedDown: false, finDerived: r.durationSource === 'derived-from-fin' });
    stack.push({ id, depth: r.depth });
  });

  // Pass 2: orders. Batch children of a NEW parent number sequentially (they own that parent);
  // batch roots slot AFTER the placement point with fractional keys so an existing sibling list is
  // interleaved correctly, then a single normalizeOrders per parent flattens back to integers.
  const childrenByParent = new Map<TaskId | null, EngineTask[]>();
  for (const t of tasks) {
    const k = (t.parentId ?? null) as TaskId | null;
    if (!childrenByParent.has(k)) childrenByParent.set(k, []);
    childrenByParent.get(k)!.push(t);
  }
  const newParentIds = new Set<TaskId>(tasks.filter((t) => childrenByParent.has(t.id)).map((t) => t.id));
  for (const [parent, kids] of childrenByParent) {
    if (parent === rootParent) {
      const n = kids.length;
      kids.forEach((t, k) => (t.order = rootBaseOrder + (k + 1) / (n + 1)));
    } else {
      kids.forEach((t, k) => (t.order = k)); // new parent -> its only children, plain 0..n
    }
  }

  // Pass 3: promote any row that gained a child to a group; push its Inicio down to the first child.
  const finToInvert = new Map<TaskId, string>();
  rows.forEach((r, idx) => {
    const id = ids[idx];
    const t = byId.get(id)!;
    const kids = childrenByParent.get(id);
    if (kids && kids.length) {
      const first = [...kids].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (t.manualDate && !first.manualDate) {
        first.manualDate = t.manualDate;
        meta[idx].datePushedDown = true;
      }
      t.type = 'group';
      t.duration = 0;
      t.percentComplete = 0;
      t.manualDate = null;
      t.milestoneType = null;
      t.predecessors = [];
      meta[idx].promotedToGroup = true;
    } else if (r.durationSource === 'derived-from-fin' && r.fin) {
      finToInvert.set(id, r.fin); // only leaves get Fin->duration inversion
    }
  });

  const touchedParents: (TaskId | null)[] = [rootParent, ...newParentIds];
  return { tasks, ids, finToInvert, touchedParents, meta };
}
