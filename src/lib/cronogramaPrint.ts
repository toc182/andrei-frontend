// cronogramaPrint.ts — print/PDF page builder for the cronograma. Port of the standalone
// Gantto print pipeline (ganttoweb/app.js: pdfColumns / computePdfLayout / buildPdfPages /
// exportPDF), MS-Project style: table text at a FIXED physical size (pt→mm); the timeline
// COMPRESSES to fit `pagesWide` page-columns; rows paginate automatically. Every page is a
// millimeter-viewBox <svg> string; the chart band is a nested px-space
// <svg preserveAspectRatio="none"> so only shapes scale, never text.
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

// ---- constants (gantto parity) ----

export const PRINT_PAPERS: Record<string, [number, number]> = {
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  a4: [210, 297],
  a3: [297, 420],
  tabloid: [279.4, 431.8],
};
export const PRINT_FONTS = { normal: 9, grande: 11, extra: 13 } as const;
const PT_MM = 0.3528; // 1 pt in mm
const MIN_PT = 6; // shrink floor
const MIN_TL_MM = 20; // minimum timeline width per page-column
const PXD = 26; // px per day in the print chart's px space (day-zoom density; physical size is mm)
const ROW_PX = 30; // uniform print row slot — print ignores on-screen wrapped-row heights

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
  logoLeft: string | null; // data URL, ready to embed
  logoRight: string | null;
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

// ---- pure layout (gantto computePdfLayout, parameterized: no module-global state) ----
// NOTE (gantto gotcha #2): destructure EVERY option you use — never reference `opts.x`
// piecemeal in new code paths without adding it here first.

export function computePrintLayout(opts: PrintOptions, rowCount: number, totalDays: number) {
  const { Wmm, Hmm, marginMM, fontKey, shrinkToFit, visibleCols, logoLeft, logoRight, title, subtitle } = opts;
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

  // Title fit: shrink toward body size, then word-wrap to ≤3 centered lines.
  const logoW = logoLeft || logoRight ? Math.min(28, pwMM * 0.16) : 0;
  const titleAvail = pwMM - 2 * (logoW + 4);
  const wmm = (s: string, fpt: number) => s.length * fpt * PT_MM * 0.6;
  const titleStr = (title || '').trim() || ' ';
  let tf = L.fontPt * 1.7;
  while (tf > L.fontPt * 1.05 && wmm(titleStr, tf) > titleAvail) tf -= 0.5;
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
  const subMM = subtitle ? L.fontPt * PT_MM * 1.3 : 0;
  const docHeaderH = Math.max(L.docHeaderH, titleLines.length * titleLineMM + subMM + 3);
  const rowsPerPage = Math.max(1, Math.floor((phMM - docHeaderH - L.docFooterH - L.headerBand) / L.rowH));
  const pagesTall = Math.max(1, Math.ceil(rowCount / rowsPerPage));
  const L2 = { ...L, docHeaderH, rowsPerPage, pagesTall, titleFontMM: tf * PT_MM, titleLines, logoW };

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

// ---- full-chart redraw in px space (VISUAL TWIN of GanttChart.tsx bars/arrows) ----
// Weekend shading + vertical gridlines deliberately dropped (paper stays clean);
// horizontal row lines + today line kept. No milestone date labels (dates are columns).

export function buildChartSvg(data: PrintData): string {
  const { rows, schedule, critical, violations, baselineBars, todayStr, rangeStart, totalDays } = data;
  const xOf = (date: string) => calDays(rangeStart, date) * PXD;
  const yOf = (i: number) => i * ROW_PX;
  const W = totalDays * PXD;
  const H = rows.length * ROW_PX;
  const yIdx = new Map<string, number>();
  rows.forEach((r, i) => yIdx.set(String(r.task.id), i));
  let out = '';

  for (let i = 0; i < rows.length; i++) {
    out += `<line x1="0" y1="${yOf(i + 1)}" x2="${W}" y2="${yOf(i + 1)}" stroke="${COL.rowline}" stroke-width="0.5"/>`;
  }

  rows.forEach((r, i) => {
    const t = r.task;
    const sc = schedule[String(t.id)];
    if (!sc) return;
    const y = yOf(i);
    const x = xOf(sc.s);
    const w = Math.max((calDays(sc.s, sc.f) + 1) * PXD, 2);
    const isCrit = critical?.has(String(t.id)) ?? false;

    if (baselineBars && baselineBars[String(t.id)]) {
      const b = baselineBars[String(t.id)];
      const gx = xOf(b.s);
      const gw = Math.max((calDays(b.s, b.f) + 1) * PXD, 2);
      out += `<rect x="${gx}" y="${y + 24}" width="${gw}" height="4" rx="2" fill="${COL.ghost}" opacity="0.6"/>`;
    }

    if (t.type === 'group') {
      const gy = y + 9;
      out += `<rect x="${x}" y="${gy}" width="${w}" height="6" fill="${COL.group}"/>`;
      out += `<path d="M${x},${gy} l0,12 l6,-6 z" fill="${COL.group}"/>`;
      out += `<path d="M${x + w},${gy} l0,12 l-6,-6 z" fill="${COL.group}"/>`;
    } else if (t.type === 'milestone') {
      const cx = x + PXD / 2;
      const cy = y + ROW_PX / 2;
      const viol = violations.has(String(t.id));
      const fill = viol ? COL.violation : isCrit ? COL.critical : t.milestoneType === 'fixed' ? COL.msFixed : COL.msCalc;
      out += `<path d="M${cx},${cy - 7} L${cx + 7},${cy} L${cx},${cy + 7} L${cx - 7},${cy} z" fill="${fill}"/>`;
    } else {
      const fill = isCrit ? COL.critical : t.color || COL.bar;
      const pct = Math.max(0, Math.min(100, t.percentComplete || 0));
      out += `<rect x="${x}" y="${y + 8}" width="${w}" height="14" rx="3" fill="${fill}"/>`;
      if (pct > 0) out += `<rect x="${x}" y="${y + 8}" width="${(w * pct) / 100}" height="14" rx="3" fill="rgba(0,0,0,0.30)"/>`;
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
      const sx = exFromStart ? xOf(pm.s) : xOf(pm.f) + PXD;
      const sy = yOf(pi) + ROW_PX / 2;
      const enX = enAtFinish ? xOf(tm.f) + PXD : xOf(tm.s);
      const enY = yOf(ti) + ROW_PX / 2;
      const wrap = 18; // must exceed arrowhead length ~11px (gantto HANDOFF)
      let d: string;
      if (p.type === 'FS') {
        const dropX = Math.max(sx, enX + 8);
        const landY = yOf(ti) + (ti > pi ? 8 : ROW_PX - 8);
        d = `M${sx},${sy} H${dropX} V${landY}`;
      } else if (p.type === 'SF') {
        const leftX = Math.max(1, sx - 6);
        const laneY = yOf(ti);
        d = `M${sx},${sy} H${leftX} V${laneY} H${enX + wrap} V${enY} H${enX}`;
      } else {
        const turnX = enAtFinish ? Math.max(sx, enX) + wrap : Math.max(1, Math.min(sx, enX) - wrap);
        d = `M${sx},${sy} H${turnX} V${enY} H${enX}`;
      }
      out += `<path d="${d}" fill="none" stroke="${COL.dep}" stroke-width="1.6" opacity="0.85" marker-end="url(#parr)"/>`;
    }
  });

  const end = parseDate(rangeStart);
  end.setDate(end.getDate() + totalDays);
  if (todayStr >= rangeStart && todayStr <= fmtDate(end)) {
    const tx = xOf(todayStr) + PXD / 2;
    out += `<line x1="${tx}" y1="0" x2="${tx}" y2="${H}" stroke="${COL.today}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  return out;
}

// ---- page assembly (gantto buildPdfPages) ----

export function buildPrintPages(opts: PrintOptions, data: PrintData): { pages: string[]; layout: PrintLayout } {
  const layout = computePrintLayout(opts, data.rows.length, data.totalDays);
  if (layout.errTableTooWide) return { pages: [], layout };
  const {
    cols, tableW, fontMM, fontPt, rowH, titleH, axisH, headerBand, docHeaderH, docFooterH,
    rowsPerPage, pagesTall, pagesWide, mmPerPx, colWindows, emMM, padMM, pwMM, phMM,
    titleFontMM, titleLines, logoW,
  } = layout;
  const totalPages = pagesTall * pagesWide;
  const colByKey = Object.fromEntries(cols.map((c) => [c.key, c]));
  const chart = buildChartSvg(data);
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
  const f2 = (n: number) => n.toFixed(2);

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
      if (opts.logoLeft) svg += `<image href="${opts.logoLeft}" x="2" y="1.5" width="${f2(logoW)}" height="${f2(docHeaderH - 3)}" preserveAspectRatio="xMidYMid meet"/>`;
      if (opts.logoRight) svg += `<image href="${opts.logoRight}" x="${f2(pwMM - 2 - logoW)}" y="1.5" width="${f2(logoW)}" height="${f2(docHeaderH - 3)}" preserveAspectRatio="xMidYMid meet"/>`;
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
        `viewBox="${f2(colStartPx)} ${rowStart * ROW_PX} ${f2(colPx)} ${bandRows * ROW_PX}" preserveAspectRatio="none">${chartP}</svg>`;

      svg += '</g></svg>';
      pages.push(svg);
    }
  }
  return { pages, layout };
}

// ---- print window (the ONLY DOM-touching function; not covered by the spec script) ----

/**
 * Open a print window sized exactly to the paper; each page is a break-after:page block
 * rendered 1:1 in mm. The user saves as PDF from the preview — Scale must stay at the
 * default 100% ("Predeterminada"), NOT "Ajustar a página". Returns false if the popup
 * was blocked (caller shows the notice).
 */
export function openPrintWindow(
  pages: string[],
  opts: { Wmm: number; Hmm: number; marginMM: number; docTitle: string },
): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  const pw = opts.Wmm - 2 * opts.marginMM;
  const ph = opts.Hmm - 2 * opts.marginMM;
  const blocks = pages
    .map((s, i) => `<div class="pg"${i < pages.length - 1 ? ' style="break-after:page"' : ''}>${s}</div>`)
    .join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.docTitle)}</title>
<style>
@page { size: ${opts.Wmm}mm ${opts.Hmm}mm; margin: ${opts.marginMM}mm; }
html, body { margin: 0; padding: 0; }
.pg { width: ${pw}mm; height: ${ph}mm; overflow: hidden; }
.pg svg { display: block; width: ${pw}mm; height: ${ph}mm; }
</style></head><body>${blocks}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
  return true;
}
