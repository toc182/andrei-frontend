// cronogramaPrint.ts — print/PDF page builder for the cronograma. Port of the standalone
// Gantto print pipeline (ganttoweb/app.js: pdfColumns / computePdfLayout / buildPdfPages /
// exportPDF), MS-Project style: table text at a FIXED physical size (pt→mm); the timeline
// COMPRESSES to fit `pagesWide` page-columns; rows paginate automatically. Every page is a
// millimeter-viewBox <svg> string; the chart band is a nested mm-space <svg> that WINDOWS
// (1:1 crop, never a scale) the full-schedule chart per page. The chart itself is emitted
// directly in mm (see buildChartSvg) so shapes keep their physical size at any compression.
//
// DEVIATION from gantto: gantto sliced the live #chartSvg innerHTML with regexes (its
// HANDOFF gotcha #1 — a real bug source). This module REDRAWS bars/brackets/diamonds/
// arrows/ghosts/today from the same rows+schedule GanttChart renders from.
// >>> GanttChart.tsx is this file's VISUAL TWIN: any visual change to bars or arrow
// >>> routing there must be mirrored in buildChartSvg() here, and vice versa.
//
// Everything except openPrintWindow() is pure (no DOM) — gated by
// scripts/cronograma-print.spec.ts (npx tsx scripts/cronograma-print.spec.ts).
//
// Colors are raw hex inside SVG presentation attributes (canvas-like context, mirroring
// GanttChart) — the design-system "no raw hex" rule targets Tailwind utility classes.

import { parseDate, fmtDate, calDays, type ScheduleEntry, type TaskId } from './cronogramaEngine';
import { formatPredecessors, type GanttRow } from './cronogramaModel';
import { ROW_H as ROW_PX } from './cronogramaGeometry';

// ---- constants (gantto parity) ----

export const PRINT_PAPERS: Record<string, [number, number]> = {
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  a4: [210, 297],
  a3: [297, 420],
  tabloid: [279.4, 431.8],
};
export const PRINT_FONTS = { normal: 9, grande: 11, extra: 13 } as const;
export const PT_MM = 0.3528; // 1 pt in mm (shared with desglosePrint.ts)
const MIN_PT = 6; // shrink floor
const MIN_TL_MM = 20; // minimum timeline width per page-column
const PXD = 26; // px per day in the print chart's px space (day-zoom density; physical size is mm)
// ROW_PX (imported as ROW_H alias): uniform print row slot — print ignores on-screen
// wrapped-row heights.
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/; // task.color is server-persisted free text — never trust it into SVG

// Fixed physical sizes for chart marks (mm). Row-proportional shapes (bars, brackets,
// diamonds) scale with rowH via k = rowH/ROW_PX; the sizes below are the
// compression-independent ones that the old px→mm scaling used to crush.
const MIN_BAR_MM = 0.6; // a 1-day task stays a visible tick even at extreme compression
export const MAX_LOGOS_PER_SIDE = 3;
const LOGO_GAP_MM = 2; // gap between logos in a side's header row
// wrap must exceed the arrowhead: markerWidth 7 × stroke 0.3 ≈ 2.1mm (gantto HANDOFF, now in mm)
const ARROW_MM = { stroke: 0.3, wrap: 3.2, drop: 1.4, back: 1.1, edge: 0.2 };
const TODAY_MM = { stroke: 0.35, dash: '1.2 0.9' };

const COL = {
  bar: '#4a90d9',
  group: '#3d4654',
  msFixed: '#1c1f24',
  msCalc: '#7a8494',
  dep: '#2b3140',
  today: '#e0312f',
  critical: '#d0021b',
  violation: '#d0021b',
  rowline: 'rgba(120,130,150,0.18)',
  ghost: '#8a93a3',
  text: '#1c1f24',
  textDim: '#6b7280',
  frame: '#888888',
  axisTick: 'rgba(120,130,150,0.4)',
  headerLine: '#d9dde3',
  colGrid: 'rgba(120,130,150,0.28)',
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ---- types ----

export interface PrintOptions {
  Wmm: number;
  Hmm: number;
  marginMM: number;
  fontKey: keyof typeof PRINT_FONTS;
  pagesWide: number;
  maxTall: number; // 0 = auto
  shrinkToFit: boolean;
  visibleCols: string[]; // subset of dur|inicio|fin|pct|pred
  title: string;
  subtitle: string;
  logosLeft: string[]; // data URLs, ready to embed; up to MAX_LOGOS_PER_SIDE each side
  logosRight: string[];
}

export interface PrintData {
  rows: GanttRow[];
  schedule: Record<string, ScheduleEntry>;
  rollup: Record<string, number>;
  critical: Set<string> | null; // null = ruta crítica toggle off
  violations: Set<string>;
  baselineBars: Record<string, { s: string; f: string }> | null;
  cycle: boolean;
  todayStr: string;
  rangeStart: string;
  totalDays: number;
  rowNum: Map<TaskId, number>; // full-order row numbers (# column + Pred display)
}

export interface PrintColumn {
  key: string;
  char: number;
  center?: boolean;
  label: string;
  w: number;
  x: number;
}

export interface ColWindow {
  colStartPx: number;
  colPx: number;
  colWmm: number;
}

// ---- column geometry (gantto pdfColumns) ----

export function printColumns(fontPt: number, visible: string[]) {
  const fontMM = fontPt * PT_MM;
  const emMM = fontMM * 0.62;
  const padMM = fontMM * 0.6;
  const all: Array<Omit<PrintColumn, 'w' | 'x'>> = [
    { key: 'num', char: 4, center: true, label: '#' },
    { key: 'name', char: 30, label: 'Nombre' },
    { key: 'dur', char: 5, center: true, label: 'Días' },
    { key: 'inicio', char: 9, center: true, label: 'Inicio' },
    { key: 'fin', char: 9, center: true, label: 'Fin' },
    { key: 'pct', char: 4, center: true, label: '%' },
    { key: 'pred', char: 11, label: 'Pred' },
  ];
  const keep = new Set(['num', 'name', ...visible]);
  const cols: PrintColumn[] = all.filter((c) => keep.has(c.key)).map((c) => ({ ...c, w: 0, x: 0 }));
  let cx = 0;
  for (const c of cols) {
    c.w = c.char * emMM + padMM;
    c.x = cx;
    cx += c.w;
  }
  return { cols, tableW: cx, emMM, padMM, fontMM };
}

// ---- document header fit (shared with desglosePrint.ts) ----
// Title fit: shrink toward body size, then word-wrap to ≤3 centered lines.
// Each side's logos share one header row; with 2-3 per side each logo narrows so the
// widest strip never claims more than ~⅓ of the page (the centered title gets the rest).

export function fitPrintHeader(args: {
  pwMM: number;
  fontPt: number;
  title: string;
  subtitle: string;
  nLogosLeft: number;
  nLogosRight: number;
  minDocHeaderH: number;
}): { titleFontMM: number; titleLines: string[]; logoW: number; docHeaderH: number } {
  const { pwMM, fontPt, title, subtitle, minDocHeaderH } = args;
  const nLogos = Math.max(
    Math.min(args.nLogosLeft, MAX_LOGOS_PER_SIDE),
    Math.min(args.nLogosRight, MAX_LOGOS_PER_SIDE),
  );
  const logoW = nLogos > 0
    ? Math.min(28, pwMM * 0.16, (pwMM * 0.34 - LOGO_GAP_MM * (nLogos - 1)) / nLogos)
    : 0;
  const logoStripW = nLogos > 0 ? nLogos * logoW + LOGO_GAP_MM * (nLogos - 1) : 0;
  const titleAvail = pwMM - 2 * (logoStripW + 4);
  const wmm = (s: string, fpt: number) => s.length * fpt * PT_MM * 0.6;
  const titleStr = (title || '').trim() || ' ';
  let tf = fontPt * 1.7;
  while (tf > fontPt * 1.05 && wmm(titleStr, tf) > titleAvail) tf -= 0.5;
  let titleLines: string[];
  if (wmm(titleStr, tf) <= titleAvail) {
    titleLines = [titleStr];
  } else {
    titleLines = [];
    let line = '';
    for (const w of titleStr.split(/\s+/)) {
      const test = line ? line + ' ' + w : w;
      if (line && wmm(test, tf) > titleAvail) {
        titleLines.push(line);
        line = w;
      } else line = test;
    }
    if (line) titleLines.push(line);
    if (titleLines.length > 3) {
      titleLines = titleLines.slice(0, 3);
      titleLines[2] += '…';
    }
  }
  const titleLineMM = tf * PT_MM * 1.2;
  const subMM = subtitle ? fontPt * PT_MM * 1.3 : 0;
  const docHeaderH = Math.max(minDocHeaderH, titleLines.length * titleLineMM + subMM + 3);
  return { titleFontMM: tf * PT_MM, titleLines, logoW, docHeaderH };
}

// ---- pure layout (gantto computePdfLayout, parameterized: no module-global state) ----
// NOTE (gantto gotcha #2): destructure EVERY option you use — never reference `opts.x`
// piecemeal in new code paths without adding it here first.

export function computePrintLayout(opts: PrintOptions, rowCount: number, totalDays: number) {
  const { Wmm, Hmm, marginMM, fontKey, shrinkToFit, visibleCols, logosLeft, logosRight, title, subtitle } = opts;
  const pwMM = Wmm - 2 * marginMM;
  const phMM = Hmm - 2 * marginMM;
  const pagesWide = Math.max(1, Math.min(12, Math.round(opts.pagesWide || 1)));
  const maxTall = Math.max(0, Math.round(opts.maxTall || 0));

  const derive = (fp: number) => {
    const fontMM = fp * PT_MM;
    const rowH = Math.max(fp * PT_MM * 1.7, fontMM * 1.4);
    const titleH = fp * PT_MM * 0.6; // small top padding of the axis band
    const axisH = (fp + fp * 0.85) * PT_MM * 1.6;
    const headerBand = titleH + axisH; // axis + column headers, repeated per page
    const docHeaderH = fp * PT_MM * 4.4; // document header (logos + title + subtitle)
    const docFooterH = fp * PT_MM * 2.2; // footer (Pág X de Y)
    const rowsPerPage = Math.max(1, Math.floor((phMM - docHeaderH - docFooterH - headerBand) / rowH));
    const pagesTall = Math.max(1, Math.ceil(rowCount / rowsPerPage));
    return { fontPt: fp, rowH, titleH, axisH, headerBand, docHeaderH, docFooterH, rowsPerPage, pagesTall, ...printColumns(fp, visibleCols) };
  };

  let L = derive(PRINT_FONTS[fontKey] ?? PRINT_FONTS.normal);
  let warn: string | null = null;
  if (maxTall > 0 && L.pagesTall > maxTall) {
    if (shrinkToFit) {
      let fp = L.fontPt;
      while (L.pagesTall > maxTall && fp > MIN_PT) {
        fp = Math.max(MIN_PT, fp - 0.5);
        L = derive(fp);
      }
      if (L.pagesTall > maxTall) warn = `No cabe en ${maxTall} pág. de alto ni con la letra mínima; usa ${L.pagesTall}.`;
    } else {
      warn = `Se necesitan ${L.pagesTall} pág. de alto (pediste máx. ${maxTall}); se conserva la letra.`;
    }
  }

  const hdr = fitPrintHeader({
    pwMM, fontPt: L.fontPt, title, subtitle,
    nLogosLeft: logosLeft.length, nLogosRight: logosRight.length,
    minDocHeaderH: L.docHeaderH,
  });
  const docHeaderH = hdr.docHeaderH;
  const rowsPerPage = Math.max(1, Math.floor((phMM - docHeaderH - L.docFooterH - L.headerBand) / L.rowH));
  const pagesTall = Math.max(1, Math.ceil(rowCount / rowsPerPage));
  const L2 = { ...L, docHeaderH, rowsPerPage, pagesTall, titleFontMM: hdr.titleFontMM, titleLines: hdr.titleLines, logoW: hdr.logoW };

  const timelineW = pwMM - L2.tableW; // mm available for the chart on every page
  const chartPx = Math.ceil(totalDays * PXD);
  if (timelineW <= MIN_TL_MM) {
    return {
      ...L2, pwMM, phMM, pagesWide, maxTall, chartPx, timelineW, warn,
      errTableTooWide: true as const, mmPerPx: 0, colWindows: [] as ColWindow[],
    };
  }
  const pxPerCol = chartPx / pagesWide;
  const mmPerPx = timelineW / pxPerCol;
  const colWindows: ColWindow[] = [];
  for (let c = 0; c < pagesWide; c++) {
    const colStartPx = c * pxPerCol;
    const colPx = c === pagesWide - 1 ? chartPx - colStartPx : pxPerCol;
    colWindows.push({ colStartPx, colPx, colWmm: colPx * mmPerPx });
  }
  return {
    ...L2, pwMM, phMM, pagesWide, maxTall, chartPx, timelineW, warn,
    errTableTooWide: false as const, mmPerPx, colWindows,
  };
}

export type PrintLayout = ReturnType<typeof computePrintLayout>;

// ---- time axis segments, always at day-zoom semantics (print is zoom-independent) ----

export interface TimeSeg {
  x: number;
  w: number;
  label: string;
}

export function printTimeSegments(rangeStart: string, totalDays: number): { seg1: TimeSeg[]; seg2: TimeSeg[] } {
  const d = parseDate(rangeStart);
  const seg1: TimeSeg[] = [];
  const seg2: TimeSeg[] = [];
  let cur1: TimeSeg | null = null;
  const close = (arr: TimeSeg[], seg: TimeSeg | null, endX: number) => {
    if (seg) {
      seg.w = endX - seg.x;
      arr.push(seg);
    }
  };
  for (let i = 0; i < totalDays; i++) {
    const x = i * PXD;
    if (d.getDate() === 1 || i === 0) {
      close(seg1, cur1, x);
      cur1 = { x, w: 0, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
    }
    seg2.push({ x, w: PXD, label: String(d.getDate()) });
    d.setDate(d.getDate() + 1);
  }
  close(seg1, cur1, totalDays * PXD);
  return { seg1, seg2 };
}

// ---- helpers ----

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** gantto fmtHuman: "16 mar 26" (same format the WBS table shows on screen). */
function fmtHuman(s: string | undefined): string {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** mm formatter — 0.01mm precision keeps SVG strings compact and the golden spec stable. */
const f2 = (n: number) => n.toFixed(2);

// ---- full-chart redraw in mm space (VISUAL TWIN of GanttChart.tsx bars/arrows) ----
// The chart is emitted DIRECTLY in mm — the page's units — so the per-page window in
// buildPrintPages is a uniform 1:1 crop, never a scale. Dates map via dayMM; heights that
// are fractions of the 30px screen row map via k = rowH/ROW_PX (bars, brackets, diamonds
// keep the screen's proportions); physically-fixed sizes (arrow strokes/elbows, minimum
// bar width, today line) come from the *_MM constants. Anything else distorts: the old
// px-space chart under preserveAspectRatio="none" had a ~14× horizontal/vertical scale
// mismatch that crushed diamonds, elbows and stroke pens.
//
// Weekend shading + vertical gridlines deliberately dropped (paper stays clean); horizontal
// row lines come from the table grid in buildPrintPages (they span the full page width).
// No milestone date labels (dates are columns).

export interface ChartScale {
  dayMM: number; // printed width of one day (PXD × mmPerPx)
  rowH: number; // printed row height (layout.rowH)
}

export function buildChartSvg(data: PrintData, scale: ChartScale): string {
  const { rows, schedule, critical, violations, baselineBars, todayStr, rangeStart, totalDays } = data;
  const { dayMM, rowH } = scale;
  const k = rowH / ROW_PX; // mm per screen-px for row-proportional heights
  const xOf = (date: string) => calDays(rangeStart, date) * dayMM;
  const yOf = (i: number) => i * rowH;
  const H = rows.length * rowH;
  const yIdx = new Map<string, number>();
  rows.forEach((r, i) => yIdx.set(String(r.task.id), i));
  let out = '';

  rows.forEach((r, i) => {
    const t = r.task;
    const sc = schedule[String(t.id)];
    if (!sc) return;
    const y = yOf(i);
    const x = xOf(sc.s);
    const w = Math.max((calDays(sc.s, sc.f) + 1) * dayMM, MIN_BAR_MM);
    const isCrit = critical?.has(String(t.id)) ?? false;

    if (baselineBars && baselineBars[String(t.id)]) {
      const b = baselineBars[String(t.id)];
      const gx = xOf(b.s);
      const gw = Math.max((calDays(b.s, b.f) + 1) * dayMM, MIN_BAR_MM);
      out += `<rect x="${f2(gx)}" y="${f2(y + 24 * k)}" width="${f2(gw)}" height="${f2(4 * k)}" rx="${f2(2 * k)}" fill="${COL.ghost}" opacity="0.6"/>`;
    }

    if (t.type === 'group') {
      const gy = y + 9 * k;
      out += `<rect x="${f2(x)}" y="${f2(gy)}" width="${f2(w)}" height="${f2(6 * k)}" fill="${COL.group}"/>`;
      out += `<path d="M${f2(x)},${f2(gy)} l0,${f2(12 * k)} l${f2(6 * k)},${f2(-6 * k)} z" fill="${COL.group}"/>`;
      out += `<path d="M${f2(x + w)},${f2(gy)} l0,${f2(12 * k)} l${f2(-6 * k)},${f2(-6 * k)} z" fill="${COL.group}"/>`;
    } else if (t.type === 'milestone') {
      const cx = x + dayMM / 2;
      const cy = y + rowH / 2;
      const h = 7 * k;
      const viol = violations.has(String(t.id));
      const fill = viol ? COL.violation : isCrit ? COL.critical : t.milestoneType === 'fixed' ? COL.msFixed : COL.msCalc;
      out += `<path d="M${f2(cx)},${f2(cy - h)} L${f2(cx + h)},${f2(cy)} L${f2(cx)},${f2(cy + h)} L${f2(cx - h)},${f2(cy)} z" fill="${fill}"/>`;
    } else {
      const fill = isCrit ? COL.critical : t.color && HEX_COLOR.test(t.color) ? t.color : COL.bar;
      const pct = Math.max(0, Math.min(100, t.percentComplete || 0));
      out += `<rect x="${f2(x)}" y="${f2(y + 8 * k)}" width="${f2(w)}" height="${f2(14 * k)}" rx="${f2(3 * k)}" fill="${fill}"/>`;
      if (pct > 0) out += `<rect x="${f2(x)}" y="${f2(y + 8 * k)}" width="${f2((w * pct) / 100)}" height="${f2(14 * k)}" rx="${f2(3 * k)}" fill="rgba(0,0,0,0.30)"/>`;
    }
  });

  // dependency arrows AFTER bars (arrowheads must not be painted over)
  rows.forEach((r) => {
    const t = r.task;
    if (t.type === 'group') return;
    const ti = yIdx.get(String(t.id));
    const tm = schedule[String(t.id)];
    if (ti == null || !tm) return;
    for (const p of t.predecessors || []) {
      const pi = yIdx.get(String(p.taskId));
      const pm = schedule[String(p.taskId)];
      if (pi == null || !pm) continue;
      const exFromStart = p.type === 'SS' || p.type === 'SF';
      const enAtFinish = p.type === 'FF' || p.type === 'SF';
      const sx = exFromStart ? xOf(pm.s) : xOf(pm.f) + dayMM;
      const sy = yOf(pi) + rowH / 2;
      const enX = enAtFinish ? xOf(tm.f) + dayMM : xOf(tm.s);
      const enY = yOf(ti) + rowH / 2;
      const wrap = ARROW_MM.wrap;
      let d: string;
      if (p.type === 'FS') {
        const dropX = Math.max(sx, enX + ARROW_MM.drop);
        const landY = yOf(ti) + (ti > pi ? 8 * k : rowH - 8 * k);
        d = `M${f2(sx)},${f2(sy)} H${f2(dropX)} V${f2(landY)}`;
      } else if (p.type === 'SF') {
        const leftX = Math.max(ARROW_MM.edge, sx - ARROW_MM.back);
        const laneY = yOf(ti);
        d = `M${f2(sx)},${f2(sy)} H${f2(leftX)} V${f2(laneY)} H${f2(enX + wrap)} V${f2(enY)} H${f2(enX)}`;
      } else {
        const turnX = enAtFinish ? Math.max(sx, enX) + wrap : Math.max(ARROW_MM.edge, Math.min(sx, enX) - wrap);
        d = `M${f2(sx)},${f2(sy)} H${f2(turnX)} V${f2(enY)} H${f2(enX)}`;
      }
      out += `<path d="${d}" fill="none" stroke="${COL.dep}" stroke-width="${ARROW_MM.stroke}" opacity="0.85" marker-end="url(#parr)"/>`;
    }
  });

  const end = parseDate(rangeStart);
  end.setDate(end.getDate() + totalDays);
  if (todayStr >= rangeStart && todayStr <= fmtDate(end)) {
    const tx = xOf(todayStr) + dayMM / 2;
    out += `<line x1="${f2(tx)}" y1="0" x2="${f2(tx)}" y2="${f2(H)}" stroke="${COL.today}" stroke-width="${TODAY_MM.stroke}" stroke-dasharray="${TODAY_MM.dash}"/>`;
  }
  return out;
}

// ---- page assembly (gantto buildPdfPages) ----

export function buildPrintPages(opts: PrintOptions, data: PrintData): { pages: string[]; layout: PrintLayout } {
  // Logos are attacker-influenceable (persisted server-side, shared across users): require
  // the data:image/ scheme and escape — they land inside a same-origin popup document.
  const safeLogos = (arr: string[]) =>
    arr
      .map((s) => (s && s.startsWith('data:image/') ? esc(s) : null))
      .filter((s): s is string => s != null)
      .slice(0, MAX_LOGOS_PER_SIDE);
  const logosL = safeLogos(opts.logosLeft);
  const logosR = safeLogos(opts.logosRight);
  const layout = computePrintLayout(opts, data.rows.length, data.totalDays);
  if (layout.errTableTooWide) return { pages: [], layout };
  const {
    cols, tableW, fontMM, fontPt, rowH, titleH, axisH, headerBand, docHeaderH, docFooterH,
    rowsPerPage, pagesTall, pagesWide, mmPerPx, colWindows, emMM, padMM, pwMM, phMM,
    titleFontMM, titleLines, logoW,
  } = layout;
  const totalPages = pagesTall * pagesWide;
  const colByKey = Object.fromEntries(cols.map((c) => [c.key, c]));
  const chart = buildChartSvg(data, { dayMM: PXD * mmPerPx, rowH });
  const { seg1, seg2 } = printTimeSegments(data.rangeStart, data.totalDays);

  // Label only months WITH bar activity (skip empty lead/tail padding months).
  const activeIv: Array<[number, number]> = [];
  for (const { task: t } of data.rows) {
    if (t.type === 'group') continue;
    const sc = data.schedule[String(t.id)];
    if (!sc) continue;
    activeIv.push([calDays(data.rangeStart, sc.s) * PXD, (calDays(data.rangeStart, sc.f) + 1) * PXD]);
  }
  const monthHasActivity = (segX: number, segW: number) => activeIv.some(([a, b]) => a < segX + segW && b > segX);

  const fAxis1 = fontPt * PT_MM;
  const fAxis2 = fontPt * 0.85 * PT_MM;
  const fColHdr = fontPt * 0.9 * PT_MM;
  const indentMM = fontMM * 0.9;

  const truncMM = (s: string, widthMM: number, indentUsed = 0) => {
    const maxChars = Math.max(1, Math.floor((widthMM - padMM - indentUsed) / emMM));
    return s.length > maxChars ? s.slice(0, Math.max(1, maxChars - 1)) + '…' : s;
  };
  const cw = (key: string) => (colByKey[key] ? colByKey[key].w : 0);
  const cellMM = (key: string, txt: string, o: { y: number; indent?: number; bold?: boolean; fill?: string }) => {
    const c = colByKey[key];
    if (!c || txt == null || txt === '') return '';
    let x: number;
    let anchor = '';
    if (c.center) {
      x = c.x + c.w / 2;
      anchor = ' text-anchor="middle"';
    } else {
      x = c.x + padMM / 2 + (o.indent || 0);
    }
    return `<text x="${f2(x)}" y="${f2(o.y)}" font-size="${f2(fontMM)}" fill="${o.fill || COL.text}"${anchor}${o.bold ? ' font-weight="600"' : ''}>${esc(txt)}</text>`;
  };

  const pages: string[] = [];
  for (let band = 0; band < pagesTall; band++) {
    const rowStart = band * rowsPerPage;
    const rowEnd = Math.min(data.rows.length, rowStart + rowsPerPage);
    const bandRows = rowEnd - rowStart;

    for (let col = 0; col < pagesWide; col++) {
      const { colStartPx, colPx, colWmm } = colWindows[col];
      const toMM = (px: number) => (px - colStartPx) * mmPerPx;
      const tag = `${band}_${col}`;
      // marker ids must be unique per inline <svg> on the same printed document
      const chartP = chart.replace(/url\(#parr\)/g, `url(#parr${tag})`);

      let svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(pwMM)} ${f2(phMM)}" ` +
        `width="${f2(pwMM)}mm" height="${f2(phMM)}mm" font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">` +
        `<defs><marker id="parr${tag}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto">` +
        `<path d="M0,0 L8,4 L0,8 z" fill="${COL.dep}"/></marker></defs>`;
      svg += `<rect width="${f2(pwMM)}" height="${f2(phMM)}" fill="#ffffff"/>`;

      // document frame
      svg += `<rect x="0.5" y="0.5" width="${f2(pwMM - 1)}" height="${f2(phMM - 1)}" fill="none" stroke="${COL.frame}" stroke-width="0.4"/>`;
      // header: optional logos + CENTERED title/subtitle
      logosL.forEach((l, j) => {
        svg += `<image href="${l}" x="${f2(2 + j * (logoW + LOGO_GAP_MM))}" y="1.5" width="${f2(logoW)}" height="${f2(docHeaderH - 3)}" preserveAspectRatio="xMidYMid meet"/>`;
      });
      logosR.forEach((l, j) => {
        svg += `<image href="${l}" x="${f2(pwMM - 2 - logoW - j * (logoW + LOGO_GAP_MM))}" y="1.5" width="${f2(logoW)}" height="${f2(docHeaderH - 3)}" preserveAspectRatio="xMidYMid meet"/>`;
      });
      const titleLineMM = titleFontMM * 1.2;
      const subMM = opts.subtitle ? fontMM * 1.3 : 0;
      const blockH = titleLines.length * titleLineMM + subMM;
      let ty = Math.max(titleFontMM, (docHeaderH - blockH) / 2 + titleFontMM * 0.9);
      let lastTy = ty;
      for (const ln of titleLines) {
        svg += `<text x="${f2(pwMM / 2)}" y="${f2(ty)}" font-size="${f2(titleFontMM)}" font-weight="700" fill="${COL.text}" text-anchor="middle">${esc(ln)}</text>`;
        lastTy = ty;
        ty += titleLineMM;
      }
      if (opts.subtitle) svg += `<text x="${f2(pwMM / 2)}" y="${f2(lastTy + fontMM * 1.15)}" font-size="${f2(fontMM)}" fill="${COL.textDim}" text-anchor="middle">${esc(opts.subtitle)}</text>`;
      svg += `<line x1="0.5" y1="${f2(docHeaderH)}" x2="${f2(pwMM - 0.5)}" y2="${f2(docHeaderH)}" stroke="${COL.frame}" stroke-width="0.4"/>`;
      // footer
      svg += `<line x1="0.5" y1="${f2(phMM - docFooterH)}" x2="${f2(pwMM - 0.5)}" y2="${f2(phMM - docFooterH)}" stroke="${COL.frame}" stroke-width="0.4"/>`;
      svg += `<text x="${f2(pwMM - 3)}" y="${f2(phMM - docFooterH * 0.32)}" font-size="${f2(fColHdr)}" fill="${COL.textDim}" text-anchor="end">Pág ${band * pagesWide + col + 1} de ${totalPages}</text>`;
      // content shifted under the document header
      svg += `<g transform="translate(0,${f2(docHeaderH)})">`;

      // time axis for THIS column window
      let axis = '';
      const seg2win = seg2.filter((s) => !(s.x + s.w <= colStartPx || s.x >= colStartPx + colPx));
      const fineNeededMM = 2.4 * fAxis2 * 0.62;
      const fineFits = seg2win.length > 0 && seg2win.filter((s) => s.w * mmPerPx >= fineNeededMM).length / seg2win.length >= 0.9;
      const monthsOnly = !fineFits;
      let lastRight = -Infinity;
      let lastYear: string | null = null;
      for (const s of seg1) {
        if (s.x + s.w <= colStartPx || s.x >= colStartPx + colPx) continue;
        if (!monthHasActivity(s.x, s.w)) continue;
        const lx = Math.max(0, toMM(s.x));
        const parts = s.label.split(' ');
        const year = parts.length > 1 ? parts.slice(1).join(' ') : null;
        const labelW = parts[0].length * fAxis1 * 0.5;
        if (lx < lastRight) continue;
        axis +=
          `<line x1="${f2(lx)}" y1="${f2(titleH)}" x2="${f2(lx)}" y2="${f2(titleH + axisH * 0.55)}" stroke="${COL.axisTick}" stroke-width="0.3"/>` +
          `<text x="${f2(lx + 0.5)}" y="${f2(titleH + fAxis1 * 1.05)}" font-size="${f2(fAxis1)}" font-weight="600" fill="${COL.textDim}">${esc(parts[0])}</text>`;
        if (monthsOnly && year && year !== lastYear) {
          axis += `<text x="${f2(lx + 0.5)}" y="${f2(titleH + axisH - fAxis2 * 0.4)}" font-size="${f2(fAxis2)}" fill="#9aa3b0">${esc(year)}</text>`;
        }
        lastRight = lx + labelW + 0.4;
        if (year) lastYear = year;
      }
      if (fineFits) {
        for (const s of seg2win) {
          if (s.w * mmPerPx < fineNeededMM) continue;
          const lx = toMM(s.x);
          if (lx < 0) continue;
          axis += `<text x="${f2(lx + padMM * 0.3)}" y="${f2(titleH + axisH - fAxis2 * 0.5)}" font-size="${f2(fAxis2)}" fill="${COL.textDim}">${esc(s.label)}</text>`;
        }
      }
      svg += `<g transform="translate(${f2(tableW)},0)">${axis}</g>`;

      // column headers + separator
      for (const c of cols) {
        let hx: number;
        let hAnchor = '';
        if (c.center) {
          hx = c.x + c.w / 2;
          hAnchor = ' text-anchor="middle"';
        } else {
          hx = c.x + padMM / 2;
        }
        svg += `<text x="${f2(hx)}" y="${f2(headerBand - fColHdr * 0.5)}" font-size="${f2(fColHdr)}" font-weight="600" fill="${COL.textDim}"${hAnchor}>${esc(c.label)}</text>`;
      }
      svg += `<line x1="0" y1="${f2(headerBand)}" x2="${f2(pwMM)}" y2="${f2(headerBand)}" stroke="${COL.headerLine}" stroke-width="0.3"/>`;

      // table rows for this band
      for (let i = rowStart; i < rowEnd; i++) {
        const { task: t, depth } = data.rows[i];
        const y = headerBand + (i - rowStart) * rowH + rowH * 0.7;
        const sc = data.schedule[String(t.id)];
        const isGroup = t.type === 'group';
        const pct = isGroup ? (data.rollup[String(t.id)] ?? 0) : t.percentComplete || 0;
        const nm = (t.type === 'milestone' ? '◆ ' : '') + t.name;
        const indentUsed = depth * indentMM;
        const viol = data.violations.has(String(t.id));
        svg += cellMM('num', String(data.rowNum.get(t.id) ?? ''), { y, fill: COL.textDim });
        svg += cellMM('name', truncMM(nm, cw('name'), indentUsed), { y, indent: indentUsed, bold: isGroup, fill: viol ? COL.violation : COL.text });
        svg += cellMM('dur', t.type === 'task' ? String(t.duration || 0) : '', { y, fill: COL.textDim });
        svg += cellMM('inicio', data.cycle ? '—' : fmtHuman(sc?.s), { y });
        svg += cellMM('fin', data.cycle || t.type === 'milestone' ? '' : fmtHuman(sc?.f), { y });
        svg += cellMM('pct', t.type === 'milestone' ? '' : pct + '%', { y, fill: COL.textDim });
        svg += cellMM('pred', isGroup ? '' : truncMM(formatPredecessors(t, data.rowNum), cw('pred')), { y, fill: COL.textDim });
        svg += `<line x1="0" y1="${f2(headerBand + (i - rowStart + 1) * rowH)}" x2="${f2(pwMM)}" y2="${f2(headerBand + (i - rowStart + 1) * rowH)}" stroke="${COL.rowline}" stroke-width="0.2"/>`;
      }

      // vertical column separators + table|chart divider + windowed chart
      const tableBottom = headerBand + bandRows * rowH;
      for (const c of cols) {
        if (c.x > 0) svg += `<line x1="${f2(c.x)}" y1="${f2(titleH)}" x2="${f2(c.x)}" y2="${f2(tableBottom)}" stroke="${COL.colGrid}" stroke-width="0.2"/>`;
      }
      svg += `<line x1="${f2(tableW)}" y1="0" x2="${f2(tableW)}" y2="${f2(tableBottom)}" stroke="${COL.headerLine}" stroke-width="0.3"/>`;
      svg +=
        `<svg x="${f2(tableW)}" y="${f2(headerBand)}" width="${f2(colWmm)}" height="${f2(bandRows * rowH)}" ` +
        `viewBox="${f2(colStartPx * mmPerPx)} ${f2(rowStart * rowH)} ${f2(colPx * mmPerPx)} ${f2(bandRows * rowH)}">${chartP}</svg>`;

      svg += '</g></svg>';
      pages.push(svg);
    }
  }
  return { pages, layout };
}

// ---- print document + window ----

/**
 * The print document as a string (pure — gated by the print specs).
 *
 * Each page block is sized in **percentages of the real page box**, never in fixed
 * mm. A fixed `height: <printable>mm` is a knife edge: any printer whose usable area
 * is a hair shorter than the CSS promises (hardware margins are normal) makes every
 * block overflow, and Chrome emits a BLANK page after each real one — reported live
 * on the desglose (andrei-backend#67) and reproduced headlessly at 2 pages → 4.
 * With percentages the block always equals whatever the printer actually grants, and
 * the SVG's own viewBox letterboxes the content to fit (1:1 when the area is exactly
 * as promised, scaled down a hair when it isn't) instead of spilling.
 *
 * The user saves as PDF from the preview — Scale must stay at the default 100%
 * ("Predeterminada"), NOT "Ajustar a página".
 */
export function buildPrintDocument(
  pages: string[],
  opts: { Wmm: number; Hmm: number; marginMM: number; docTitle: string },
): string {
  const blocks = pages
    .map((s, i) => `<div class="pg"${i < pages.length - 1 ? ' style="break-after:page"' : ''}>${s}</div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>${esc(opts.docTitle)}</title>
<style>
@page { size: ${opts.Wmm}mm ${opts.Hmm}mm; margin: ${opts.marginMM}mm; }
html, body { margin: 0; padding: 0; height: 100%; }
.pg { width: 100%; height: 100%; overflow: hidden; }
.pg svg { display: block; width: 100%; height: 100%; }
</style></head><body>${blocks}</body></html>`;
}

/**
 * Open a print window sized exactly to the paper, one break-after:page block per
 * page. Returns false if the popup was blocked (caller shows the notice).
 * The ONLY DOM-touching function here; its document comes from buildPrintDocument.
 */
export function openPrintWindow(
  pages: string[],
  opts: { Wmm: number; Hmm: number; marginMM: number; docTitle: string },
): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildPrintDocument(pages, opts));
  win.document.close();
  win.focus();
  // Print after the document (incl. data-URL logo decode) has loaded; the plain timeout is
  // a fallback in case 'load' fired before the listener attached.
  let fired = false;
  const fire = () => { if (!fired) { fired = true; win.print(); } };
  win.addEventListener('load', () => setTimeout(fire, 50));
  setTimeout(fire, 800);
  return true;
}
