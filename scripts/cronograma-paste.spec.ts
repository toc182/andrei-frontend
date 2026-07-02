// Golden-fixture gate for the cronograma bulk-paste feature. Pure modules only — no React runner
// exists in this repo, so this tsx script is the correctness contract for parseTsv / date parsing /
// hierarchy / the orchestrator / opInsertPasteBatch, mirroring scripts (backend) cronograma-parity.
//
//   cd andrei-frontend && npx tsx scripts/cronograma-paste.spec.ts
//
// Covers the build-spec fixture list: TSV quoting/embedded-newline/ragged/trailing-tab; every
// invalid date blocked at the token level; dd/mm vs mm/dd resolution; ISO + named month; Excel
// serial rejection; 2-digit-year pivot; selector/inference conflict; unparseable Fin blocks the
// row (never duration 1); names-only -> flat dur 5; blank / header-only -> empty; a 3-level chain
// preserved in exact source order with contiguous non-duplicate orders; group promotion pushing the
// parent Inicio to its first child; paste into a pre-existing cyclic tree (inversion skipped, no
// crash); never emits a milestone; and the one-undo / one-markDirty commit contract.

import { parseTsv } from '../src/lib/cronogramaPasteTsv';
import { parseSingleDate, parseDateColumn } from '../src/lib/cronogramaPasteDates';
import { parsePaste, type PasteMapping } from '../src/lib/cronogramaPaste';
import { opInsertPasteBatch, previewPasteBatch, childrenOf } from '../src/lib/cronogramaTaskOps';
import { buildRows } from '../src/lib/cronogramaModel';
import type { EngineProject, EngineTask, TaskId } from '../src/lib/cronogramaEngine';

let passed = 0;
let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL  ${label}`);
  }
}
function eq(got: unknown, want: unknown, label: string) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  ok(g === w, `${label} — got ${g}, want ${w}`);
}

const PROJ: EngineProject = { startDate: '2026-01-05', workWeek: '5', holidays: [] }; // 2026-01-05 = Monday
const map = (m: Partial<PasteMapping>): PasteMapping => ({ name: null, dias: null, inicio: null, fin: null, nivel: null, ...m });
function minter() {
  let n = -1;
  return () => n--;
}
const included = (text: string, opts: Parameters<typeof parsePaste>[1]) => parsePaste(text, opts).rows.filter((r) => !r.blocked);

// ---- 1. TSV four-state machine ----------------------------------------------
eq(parseTsv('Tubo 3" pipe\t5'), [['Tubo 3" pipe', '5']], 'tsv: mid-cell quote is literal');
eq(parseTsv('"line1\nline2"\t5\nB\t6'), [['line1\nline2', '5'], ['B', '6']], 'tsv: embedded newline in quoted cell');
eq(parseTsv('A\tB\tC\nD\nE\tF'), [['A', 'B', 'C'], ['D', '', ''], ['E', 'F', '']], 'tsv: ragged rows padded to max cols');
eq(parseTsv('A\tB\t\nC\tD\t'), [['A', 'B', ''], ['C', 'D', '']], 'tsv: trailing tab yields an empty cell');
eq(parseTsv('"a,b"\t"c""d"'), [['a,b', 'c"d']], 'tsv: quoted comma + escaped quote');
eq(parseTsv(''), [], 'tsv: blank -> no rows');
eq(parseTsv('A\tB\n'), [['A', 'B']], 'tsv: trailing newline drops the empty row');

// ---- 2. Dates: token-level validation blocks invalid dates ------------------
for (const bad of ['31/02/2026', '31/04/2026', '00/01/2026', '29/02/2025', '00/00/2026']) {
  ok(parseSingleDate(bad, 'dmy').ok === false, `date blocked (dmy): ${bad}`);
}
ok(parseSingleDate('13/01/2026', 'mdy').ok === false, 'date blocked: month 13 under mm/dd');
eq((parseSingleDate('13/01/2026', 'dmy') as { value: string }).value, '2026-01-13', 'date valid: 13/01 is Jan 13 under dd/mm');

// valid, incl. ISO and named month (set/sep = September)
eq((parseSingleDate('15/03/2026', 'dmy') as { value: string }).value, '2026-03-15', 'date: dd/mm/aaaa');
eq((parseSingleDate('2026-03-15', 'dmy') as { value: string }).value, '2026-03-15', 'date: ISO');
eq((parseSingleDate('29/02/2024', 'dmy') as { value: string }).value, '2024-02-29', 'date: leap-year Feb 29 valid');
eq((parseSingleDate('5 set 2026', 'dmy') as { value: string }).value, '2026-09-05', 'date: named month "set"');
eq((parseSingleDate('5 sep 2026', 'dmy') as { value: string }).value, '2026-09-05', 'date: named month "sep"');
eq((parseSingleDate('15 mar 2026', 'dmy') as { value: string }).value, '2026-03-15', 'date: named month "mar"');

// Excel serial rejected with a hint; 2-digit year pivot
ok(parseSingleDate('45678', 'dmy').ok === false, 'date: Excel serial rejected');
eq((parseSingleDate('01/06/26', 'dmy') as { value: string }).value, '2026-06-01', 'date: 2-digit year -> 2026');
eq((parseSingleDate('01/06/85', 'dmy') as { value: string }).value, '1985-06-01', 'date: 2-digit year -> 1985');

// ---- 3. Column-scoped dd/mm vs mm/dd resolution + conflict ------------------
{
  const col = parseDateColumn(['25/03/2026', '04/05/2026'], 'mdy');
  eq(col.resolvedOrder, 'dmy', 'date column: day>12 forces dd/mm over the mm/dd selector');
  ok(col.conflict !== null, 'date column: selector/inference conflict reported (dialog blocks)');
  eq((col.results[1] as { value: string }).value, '2026-05-04', 'date column: ambiguous cell follows the resolved order');
}
{
  const col = parseDateColumn(['03/04/2026', '05/06/2026'], 'dmy');
  eq(col.conflict, null, 'date column: all-<=12 uses selector with no conflict');
}

// ---- 4. Orchestrator: names-only -> flat tasks, duration 5 ------------------
{
  const rows = parsePaste('Excavación\nCimientos\nColumnas', { mapping: map({ name: 0 }), headerRow: false, dateFormat: 'dmy' });
  eq(rows.rows.length, 3, 'names-only: 3 rows');
  eq(rows.detection.mode, 'flat', 'names-only: flat hierarchy');
  ok(rows.rows.every((r) => r.depth === 0 && r.durationSource === 'assumed-default' && r.duration === 5), 'names-only: depth 0, assumed default 5');
  const tasks: EngineTask[] = [];
  opInsertPasteBatch(rows.rows, { afterId: null }, PROJ, tasks, minter());
  ok(tasks.length === 3 && tasks.every((t) => t.type === 'task' && t.duration === 5 && (t.parentId ?? null) === null), 'names-only: inserts 3 flat tasks dur 5');
}

// ---- 5. Blank / header-only -> no rows -------------------------------------
eq(parsePaste('', { mapping: map({ name: 0 }), headerRow: false, dateFormat: 'dmy' }).rows.length, 0, 'blank -> no rows');
eq(parsePaste('Nombre\tDías\n', { mapping: map({ name: 0, dias: 1 }), headerRow: true, dateFormat: 'dmy' }).rows.length, 0, 'header-only -> no rows');

// ---- 6. Unparseable Fin BLOCKS the row (never silently duration 1) ----------
{
  const r = parsePaste('Tarea\t05/01/2026\tno-es-fecha', { mapping: map({ name: 0, inicio: 1, fin: 2 }), headerRow: false, dateFormat: 'dmy' });
  ok(r.rows[0].blocked === true, 'bad Fin: row blocked');
  ok(r.rows[0].issues.some((i) => i.level === 'blocking' && i.code === 'bad-fin'), 'bad Fin: blocking issue present');
}

// ---- 7. Fin-derived duration (positive) + Fin<start collapse ----------------
{
  // Inicio Mon 2026-01-05, Fin Fri 2026-01-09 -> 5 inclusive work days.
  const r = included('Losa\t05/01/2026\t09/01/2026', { mapping: map({ name: 0, inicio: 1, fin: 2 }), headerRow: false, dateFormat: 'dmy' });
  const tasks: EngineTask[] = [];
  opInsertPasteBatch(r, { afterId: null }, PROJ, tasks, minter());
  eq(tasks[0].duration, 5, 'fin-derived: Mon..Fri inclusive = 5 work days');
}
{
  // Fin before the computed start collapses to duration 1 and is flagged.
  const r = included('Losa\t09/01/2026\t05/01/2026', { mapping: map({ name: 0, inicio: 1, fin: 2 }), headerRow: false, dateFormat: 'dmy' });
  const tasks: EngineTask[] = [];
  const rep = previewPasteBatch(r, { afterId: null }, PROJ, tasks, minter());
  eq(tasks[0].duration, 1, 'fin<start: duration collapses to 1');
  ok(rep.collapsed.length === 1, 'fin<start: collapse flagged');
}

// ---- 8. Three-level chain: exact source order, contiguous, distinct orders --
{
  const text = 'Nombre\tNivel\nFase 1\t1\nDiseño\t2\nPlanos\t3\nEstructura\t2\nFase 2\t1\nDetalle\t2';
  const r = included(text, { mapping: map({ name: 0, nivel: 1 }), headerRow: true, dateFormat: 'dmy' });
  const tasks: EngineTask[] = [];
  opInsertPasteBatch(r, { afterId: null }, PROJ, tasks, minter());
  const names = buildRows(tasks).map((row) => row.task.name);
  eq(names, ['Fase 1', 'Diseño', 'Planos', 'Estructura', 'Fase 2', 'Detalle'], '3-level: buildRows preserves exact source order');
  const depths = buildRows(tasks).map((row) => row.depth);
  eq(depths, [0, 1, 2, 1, 0, 1], '3-level: depths match source');
  // Contiguous, distinct integer orders within every parent.
  let contiguous = true;
  const parents: (TaskId | null)[] = [null, ...tasks.map((t) => t.id)];
  for (const p of parents) {
    const kids = childrenOf(p, tasks);
    kids.forEach((k, i) => {
      if (k.order !== i) contiguous = false;
    });
  }
  ok(contiguous, '3-level: orders are contiguous 0..n and distinct within each parent');
  // Leaves are tasks; parents are groups; nothing is a milestone.
  const byName = (n: string) => tasks.find((t) => t.name === n)!;
  ok(byName('Fase 1').type === 'group' && byName('Diseño').type === 'group' && byName('Fase 2').type === 'group', '3-level: parents promoted to group');
  ok(byName('Planos').type === 'task' && byName('Estructura').type === 'task' && byName('Detalle').type === 'task', '3-level: leaves stay tasks');
  ok(tasks.every((t) => t.type !== 'milestone'), 'paste never emits a milestone');
}

// ---- 9. Group promotion pushes the parent Inicio down to the first child ----
{
  const text = 'Nombre\tInicio\tNivel\nFase 1\t15/03/2026\t1\nTarea A\t\t2\nTarea B\t20/03/2026\t2';
  const r = included(text, { mapping: map({ name: 0, inicio: 1, nivel: 2 }), headerRow: true, dateFormat: 'dmy' });
  const tasks: EngineTask[] = [];
  opInsertPasteBatch(r, { afterId: null }, PROJ, tasks, minter());
  const fase = tasks.find((t) => t.name === 'Fase 1')!;
  const a = tasks.find((t) => t.name === 'Tarea A')!;
  const b = tasks.find((t) => t.name === 'Tarea B')!;
  ok(fase.type === 'group' && fase.manualDate == null, 'promotion: parent becomes a group with no manualDate');
  eq(a.manualDate, '2026-03-15', "promotion: parent's Inicio pushed to first child that lacked one");
  eq(b.manualDate, '2026-03-20', 'promotion: a child with its own Inicio is untouched');
}

// ---- 10. Paste into a PRE-EXISTING cyclic tree: inversion skipped, no crash -
{
  const cyclic: EngineTask[] = [
    { id: 1, parentId: null, type: 'task', name: 'A', duration: 5, predecessors: [{ taskId: 2, type: 'FS', lag: 0 }], order: 0 },
    { id: 2, parentId: null, type: 'task', name: 'B', duration: 5, predecessors: [{ taskId: 1, type: 'FS', lag: 0 }], order: 1 },
  ];
  const r = included('Nueva\t05/01/2026\t09/01/2026', { mapping: map({ name: 0, inicio: 1, fin: 2 }), headerRow: false, dateFormat: 'dmy' });
  let threw = false;
  let rep: ReturnType<typeof previewPasteBatch> | null = null;
  try {
    rep = previewPasteBatch(r, { afterId: null }, PROJ, cyclic, minter());
  } catch {
    threw = true;
  }
  ok(!threw, 'cyclic paste: no crash');
  ok(rep !== null && rep.skippedCycle === true, 'cyclic paste: Fin->duration inversion skipped');
  const nueva = cyclic.find((t) => t.name === 'Nueva')!;
  eq(nueva.duration, 5, 'cyclic paste: fin-derived leaf keeps provisional duration (not 1)');
}

// ---- 11. Commit contract: ONE undo snapshot + ONE markDirty ----------------
{
  const text = 'Nombre\tNivel\nFase 1\t1\nSub\t2';
  const r = included(text, { mapping: map({ name: 0, nivel: 1 }), headerRow: true, dateFormat: 'dmy' });
  const live: EngineTask[] = [];
  const undoStack: EngineTask[][] = [];
  let markDirtyCount = 0;
  // Replica of the workspace commit(): snapshot once, mutate once, mark dirty once.
  const commit = (mutate: (draft: EngineTask[]) => void) => {
    undoStack.push(JSON.parse(JSON.stringify(live)));
    mutate(live);
    markDirtyCount++;
  };
  commit((draft) => {
    opInsertPasteBatch(r, { afterId: null }, PROJ, draft, minter());
  });
  eq(undoStack.length, 1, 'commit: exactly one undo snapshot for the whole batch');
  eq(markDirtyCount, 1, 'commit: exactly one markDirty for the whole batch');
  ok(live.length === 2, 'commit: batch inserted');
}

console.log(`\n${passed}/${passed + failed} paste fixtures passed`);
process.exit(failed ? 1 : 0);
