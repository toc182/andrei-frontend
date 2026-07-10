// Golden gate for the cronograma print module (pure functions only — no DOM).
// Mirrors scripts/cronograma-paste.spec.ts.  cd andrei-frontend && npx tsx scripts/cronograma-print.spec.ts
//
// Layout expectations derive from gantto's HANDOFF-verified examples (A4 landscape /
// 10mm / normal ≈ 29 rows/page; Σ colPx === chartPx across pages-wide windows).

import {
  PRINT_PAPERS,
  printColumns,
  computePrintLayout,
  printTimeSegments,
  buildPrintPages,
  type PrintOptions,
  type PrintData,
} from '../src/lib/cronogramaPrint';
import type { GanttRow } from '../src/lib/cronogramaModel';
import type { EngineTask, TaskId } from '../src/lib/cronogramaEngine';

let passed = 0;
let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${label}`); }
}

const baseOpts = (over: Partial<PrintOptions> = {}): PrintOptions => ({
  Wmm: 297, Hmm: 210, marginMM: 10, fontKey: 'normal',
  pagesWide: 1, maxTall: 0, shrinkToFit: true,
  visibleCols: ['dur', 'inicio', 'fin', 'pct', 'pred'],
  title: 'Test', subtitle: '', logoLeft: null, logoRight: null,
  ...over,
});

// ---- printColumns ----
{
  const all = printColumns(9, ['dur', 'inicio', 'fin', 'pct', 'pred']);
  ok(all.cols.length === 7, 'printColumns: 7 columnas con todo visible');
  const slim = printColumns(9, []);
  ok(slim.cols.length === 2 && slim.cols[0].key === 'num' && slim.cols[1].key === 'name',
    'printColumns: # y Nombre siempre presentes');
  ok(slim.tableW < all.tableW, 'printColumns: ocultar columnas encoge la tabla');
}

// ---- computePrintLayout ----
{
  const L = computePrintLayout(baseOpts(), 80, 365);
  ok(!L.errTableTooWide, 'layout A4: cabe a lo ancho');
  ok(L.rowsPerPage >= 28 && L.rowsPerPage <= 34, `layout A4: rowsPerPage≈29 (got ${L.rowsPerPage})`);
  ok(L.pagesTall === Math.ceil(80 / L.rowsPerPage), 'layout A4: pagesTall consistente');
  ok(L.colWindows.length === 1 && Math.abs(L.colWindows[0].colPx - L.chartPx) < 0.01,
    'layout A4: 1 página de ancho cubre todo el chart');
}
{
  const L = computePrintLayout(baseOpts({ pagesWide: 3 }), 80, 365);
  const sum = L.colWindows.reduce((s, w) => s + w.colPx, 0);
  ok(L.colWindows.length === 3 && Math.abs(sum - L.chartPx) < 0.01, 'layout: Σ colPx === chartPx (3 anchos)');
}
{
  const L = computePrintLayout(baseOpts({ maxTall: 2 }), 200, 365);
  ok(L.fontPt >= 6, 'shrink: nunca baja de 6pt');
  ok(L.pagesTall <= 2 || L.warn != null, 'shrink: cumple maxTall o avisa');
}
{
  const L = computePrintLayout(baseOpts({ maxTall: 1, shrinkToFit: false }), 200, 365);
  ok(L.fontPt === 9 && L.warn != null && L.warn.includes('conserva la letra'),
    'sin shrink: conserva letra y avisa');
}
{
  const L = computePrintLayout(baseOpts({ Wmm: 100, Hmm: 80 }), 10, 60);
  ok(L.errTableTooWide === true, 'papel diminuto: errTableTooWide');
  const r = buildPrintPages(baseOpts({ Wmm: 100, Hmm: 80 }), fixtureData(10, 60));
  ok(r.pages.length === 0, 'papel diminuto: buildPrintPages devuelve []');
}
{
  const long = 'Rehabilitación integral de la línea de conducción y tanques de almacenamiento del acueducto rural de la comunidad';
  const L = computePrintLayout(baseOpts({ title: long }), 20, 120);
  ok(L.titleLines.length >= 1 && L.titleLines.length <= 3, 'título largo: envuelve a ≤3 líneas');
}

// ---- golden mm (pin PT_MM and the column/row factors against hand-computed values) ----
{
  ok(PRINT_PAPERS.a4[0] === 210 && PRINT_PAPERS.a4[1] === 297 && PRINT_PAPERS.legal[1] === 355.6,
    'papers: dimensiones mm');
  const L = computePrintLayout(baseOpts(), 80, 365);
  ok(Math.abs(L.rowH - 5.39784) < 0.001, `golden: rowH 9pt = 5.398mm (got ${L.rowH})`);
  ok(Math.abs(L.tableW - 155.076768) < 0.01, `golden: tableW completo = 155.08mm (got ${L.tableW})`);
}

// ---- printTimeSegments ----
{
  const { seg1, seg2 } = printTimeSegments('2025-12-29', 40); // lunes; 1-ene cae en el índice 3
  ok(seg1[0].label === 'dic 2025', `segments: primer mes 'dic 2025' (got ${seg1[0].label})`);
  ok(seg1[1].label === 'ene 2026' && Math.abs(seg1[1].x - 3 * 26) < 0.01, 'segments: enero arranca en x=78');
  ok(seg2.length === 40 && seg2[0].label === '29', 'segments: un segmento fino por día');
}

// ---- fixture for page-building tests ----
function task(over: Partial<EngineTask> & { id: TaskId }): EngineTask {
  return {
    parentId: null, type: 'task', milestoneType: null, name: 'Tarea', duration: 10,
    manualDate: null, percentComplete: 0, color: null, notes: null, predecessors: [], order: 0,
    ...over,
  } as EngineTask;
}
function fixtureData(rowCount: number, totalDays: number): PrintData {
  const g = task({ id: 1, type: 'group', name: 'Grupo A' });
  const t1 = task({ id: 2, parentId: 1, name: 'Excavación con un nombre suficientemente largo para truncarse en la columna Nombre del PDF impreso', percentComplete: 50, order: 1 });
  const t2 = task({ id: 3, parentId: 1, name: 'Relleno', order: 2, predecessors: [{ taskId: 2, type: 'FS', lag: 0 }] });
  const m = task({ id: 4, parentId: 1, type: 'milestone', milestoneType: 'fixed', name: 'Hito', duration: 0, order: 3 });
  const rows: GanttRow[] = [
    { task: g, depth: 0, wbs: '1' },
    { task: t1, depth: 1, wbs: '1.1' },
    { task: t2, depth: 1, wbs: '1.2' },
    { task: m, depth: 1, wbs: '1.3' },
  ];
  while (rows.length < rowCount) rows.push({ task: task({ id: 100 + rows.length, name: `Extra ${rows.length}`, order: rows.length }), depth: 0, wbs: String(rows.length) });
  // SS hacia una fila inferior ejercita el codo (wrap) de las flechas en mm
  if (rows.length > 4) rows[4].task.predecessors = [{ taskId: 2, type: 'SS', lag: 0 }];
  const schedule: PrintData['schedule'] = {
    '1': { s: '2026-01-05', f: '2026-01-30' },
    '2': { s: '2026-01-05', f: '2026-01-16' },
    '3': { s: '2026-01-19', f: '2026-01-30' },
    '4': { s: '2026-01-30', f: '2026-01-30' },
  };
  for (const r of rows) if (!schedule[String(r.task.id)]) schedule[String(r.task.id)] = { s: '2026-01-05', f: '2026-01-09' };
  const rowNum = new Map<TaskId, number>();
  rows.forEach((r, i) => rowNum.set(r.task.id, i + 1));
  return {
    rows, schedule,
    rollup: { '1': 25 },
    critical: new Set(['3']),
    violations: new Set<string>(),
    baselineBars: { '2': { s: '2026-01-05', f: '2026-01-14' } },
    cycle: false,
    todayStr: '2026-01-20',
    rangeStart: '2025-12-29',
    totalDays,
    rowNum,
  };
}

// ---- buildPrintPages ----
{
  const data = fixtureData(40, 60);
  const { pages, layout } = buildPrintPages(baseOpts({ pagesWide: 2, title: 'Proyecto <Bonyic> & Co' }), data);
  ok(pages.length === layout.pagesTall * layout.pagesWide, 'pages: cantidad = alto × ancho');
  ok(pages[0].includes('Pág 1 de'), 'pages: pie con numeración');
  ok(pages[0].includes('Proyecto &lt;Bonyic&gt; &amp; Co'), 'pages: título escapado');
  ok(!pages.join('').includes('rgba(120,130,150,0.10)'), 'pages: sin sombreado de fin de semana');
  ok(pages[0].includes('marker-end="url(#parr0_0)"'), 'pages: marker de flecha con id por página');
  ok(pages[1].includes('id="parr0_1"'), 'pages: ids de marker no colisionan entre páginas');
  ok(pages[0].includes(`fill="${'#d0021b'}"`), 'pages: barra crítica roja presente');
  ok(pages[0].includes(`fill="${'#8a93a3'}"`), 'pages: ghost de baseline presente');
  ok(pages[0].includes('…'), 'pages: nombre largo truncado con …');
  ok(pages[0].includes('◆ Hito') || pages[0].includes('◆ '), 'pages: hito con rombo en la tabla');
  ok(pages[0].includes('stroke-dasharray="1.2 0.9"'), 'pages: línea de hoy presente');
}
{
  // critical=null (toggle apagado) → sin rojo en barras (la violación seguiría roja, no hay aquí)
  const data = { ...fixtureData(6, 60), critical: null };
  const { pages } = buildPrintPages(baseOpts(), data);
  ok(!pages.join('').includes('#d0021b'), 'pages: sin ruta crítica cuando el toggle está apagado');
}
{
  // cycle → fechas '—' en Inicio y Fin vacío
  const data = { ...fixtureData(6, 60), cycle: true };
  const { pages } = buildPrintPages(baseOpts(), data);
  ok(pages[0].includes('—'), 'pages: ciclo muestra — en fechas');
}
{
  const { pages } = buildPrintPages(baseOpts(), fixtureData(10, 60));
  ok(pages[0].includes('viewBox="0 0 277.00 190.00"'), 'golden: página A4 apaisada 277×190mm');
  ok(pages[0].includes('width="277.00mm" height="190.00mm"'), 'golden: tamaño físico exacto en mm');
}

// ---- golden mm del chart (fix distorsión: el chart se emite en mm, ventana anidada 1:1) ----
// Valores calculados a mano para fixtureData(10, 60) en A4 apaisado 10mm / 9pt / 1 ancho:
// timelineW = 277 − 155.076768 = 121.923232mm; dayMM = 121.923232/60 = 2.03205387mm;
// rowH = 5.39784mm; k = rowH/30 = 0.179928 (mm por px de proporción de fila en pantalla).
{
  const { pages } = buildPrintPages(baseOpts(), fixtureData(10, 60));
  ok(pages[0].includes('viewBox="0.00 0.00 121.92 53.98"'), 'golden mm: ventana del chart 1:1 (sin escala anisotrópica)');
  ok(pages[0].includes('width="121.92" height="53.98"'), 'golden mm: tamaño físico del chart = viewBox');
  ok(pages[0].includes('M66.04,17.63 L67.30,18.89 L66.04,20.15 L64.78,18.89 z'), 'golden mm: rombo de hito uniforme (±1.26mm)');
  ok(pages[0].includes('l0,2.16 l1.08,-1.08 z'), 'golden mm: triángulo de corchete de grupo uniforme');
  ok(pages[0].includes('d="M38.61,8.10 H44.07 V12.24"'), 'golden mm: flecha FS aterriza en el borde de la barra');
  ok(pages[0].includes('d="M14.22,8.10 H11.02 V24.29 H14.22"'), 'golden mm: flecha SS con codo fijo de 3.2mm');
  ok(pages[0].includes('stroke-width="0.3" opacity="0.85" marker-end='), 'golden mm: trazo de flecha fijo 0.3mm');
  ok(pages[0].includes('x="14.22" y="6.84" width="24.38" height="2.52" rx="0.54"'), 'golden mm: barra de 12 días en mm');
  ok(pages[0].includes('x1="45.72"') && pages[0].includes('stroke-dasharray="1.2 0.9"'), 'golden mm: línea de hoy en mm');
}
{
  const { pages } = buildPrintPages(baseOpts({ logoLeft: '"><script>x</script>' }), fixtureData(6, 60));
  ok(!pages[0].includes('<script>'), 'seguridad: logo sin esquema data:image/ se descarta');
}
{
  const d = fixtureData(6, 60);
  d.rows[1].task.color = '"/><script>x</script>';
  const { pages } = buildPrintPages(baseOpts(), d);
  ok(!pages.join('').includes('<script>'), 'seguridad: color inválido cae al color por defecto');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
