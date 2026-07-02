// Shared row geometry for the cronograma WBS table + Gantt chart.
//
// The gantto 30px row layout is encoded ONCE here. Bars, group brackets, milestone diamonds,
// the % overlay, the baseline ghost and every dependency-arrow endpoint are pinned to a FIXED
// 30px slot at the TOP of each row (constant offsets from the row's top, see GanttChart) — they
// never scale with a row's measured height. When a table cell wraps, the row grows DOWNWARD below
// that slot. So a single-line row is pixel-identical to gantto and only wrapped rows are taller,
// with the bar staying where the eye expects it.

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
