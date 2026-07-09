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
