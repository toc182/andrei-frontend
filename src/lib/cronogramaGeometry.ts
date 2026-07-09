// Shared render-input math for the cronograma, used by BOTH the on-screen WBS table + Gantt
// chart AND the print renderer: row geometry (30px slots) and the chart date range.
//
// The gantto 30px row layout is encoded ONCE here. Bars, group brackets, milestone diamonds,
// the % overlay, the baseline ghost and every dependency-arrow endpoint are pinned to a FIXED
// 30px slot at the TOP of each row (constant offsets from the row's top, see GanttChart) — they
// never scale with a row's measured height. When a table cell wraps, the row grows DOWNWARD below
// that slot. So a single-line row is pixel-identical to gantto and only wrapped rows are taller,
// with the bar staying where the eye expects it.

import { parseDate, fmtDate, calDays, type ScheduleEntry } from './cronogramaEngine';

export const ROW_H = 30; // default + minimum row height, AND the fixed bar-slot height
// Shared height of the time-axis header band, used by BOTH the WBS table header and the Gantt
// chart header so row 0 starts at the same y in both panes. Sized to hold up to three stacked
// tiers (year ▸ month ▸ day); coarser zoom levels subdivide the same band into fewer tiers.
export const HEADER_H = 48;

/**
 * Prefix-sum of row tops, starting at HEADER_H. `heights[i]` is row i's measured height.
 * Returns length heights.length + 1 — the final entry is the bottom of the last row (total
 * content height), used for the last row separator and the SVG height.
 */
export function rowTopsFrom(heights: number[]): number[] {
  const tops: number[] = [];
  let acc = HEADER_H;
  for (let i = 0; i < heights.length; i++) {
    tops.push(acc);
    acc += heights[i] || ROW_H;
  }
  tops.push(acc);
  return tops;
}

/**
 * Chart date range shared by the on-screen Gantt AND the print renderer (port of
 * gantto computeRange, app.js): min/max over the FULL schedule (so the axis doesn't
 * shrink when groups collapse), fold today in, start 7 days before min backed up to
 * a Monday (week columns line up), extend 21 days past max. Extracted from
 * GanttChart so screen and print can never drift.
 */
export function computeChartRange(
  schedule: Record<string, ScheduleEntry>,
  startDate: string,
  todayStr: string,
): { rangeStart: string; totalDays: number } {
  let min = startDate;
  let max = startDate;
  for (const sc of Object.values(schedule)) {
    if (sc.s < min) min = sc.s;
    if (sc.f > max) max = sc.f;
  }
  if (todayStr < min) min = todayStr;
  if (todayStr > max) max = todayStr;
  const d = parseDate(min);
  d.setDate(d.getDate() - 7);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  const start = fmtDate(d);
  const end = parseDate(max);
  end.setDate(end.getDate() + 21);
  const days = calDays(start, fmtDate(end)) + 1;
  return { rangeStart: start, totalDays: days };
}
