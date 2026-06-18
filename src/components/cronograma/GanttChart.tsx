// GanttChart — SVG port of the standalone Gantto renderChart (ganttoweb/app.js), incl. the
// finalized dependency-arrow routing (FS drop-into-start, SS left-wrap, FF right-wrap, SF
// down-first lane). Read-only render driven by the engine-computed schedule. Drag/selection
// are layered on by the workspace in later milestones.
//
// Colors are raw hex inside SVG presentation attributes (a canvas-like context, mirroring the
// standalone tool) — the design-system "no raw hex" rule targets Tailwind utility classes.

import { useMemo } from 'react';
import { parseDate, fmtDate, calDays, type ScheduleEntry } from '@/lib/cronogramaEngine';
import type { GanttRow } from '@/lib/cronogramaModel';

export type Zoom = 'day' | 'week' | 'month' | 'quarter';

interface GanttChartProps {
  rows: GanttRow[];
  schedule: Record<string, ScheduleEntry>;
  startDate: string;
  workWeek: number;
  holidays: string[];
  zoom: Zoom;
  critical?: Set<string>;
  violations?: Set<string>;
  baselineBars?: Record<string, { s: string; f: string }> | null;
  todayStr: string;
}

const ROW_H = 30;
const HEADER_H = 30;
const PXD: Record<Zoom, number> = { day: 26, week: 11, month: 4.2, quarter: 1.6 };

const COL = {
  bar: '#4a90d9',
  group: '#3d4654',
  msFixed: '#1c1f24',
  msCalc: '#7a8494',
  dep: '#2b3140',
  today: '#e0312f',
  critical: '#d0021b',
  violation: '#d0021b',
  gridline: 'rgba(120,130,150,0.18)',
  weekend: 'rgba(120,130,150,0.10)',
  ghost: '#8a93a3',
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function GanttChart({
  rows,
  schedule,
  startDate,
  workWeek,
  holidays,
  zoom,
  critical,
  violations,
  baselineBars,
  todayStr,
}: GanttChartProps) {
  const pxd = PXD[zoom];
  const holSet = useMemo(() => new Set(holidays || []), [holidays]);

  const { rangeStart, totalDays } = useMemo(() => {
    let min = startDate;
    let max = startDate;
    for (const r of rows) {
      const sc = schedule[String(r.task.id)];
      if (!sc) continue;
      if (sc.s < min) min = sc.s;
      if (sc.f > max) max = sc.f;
    }
    // pad a few days each side
    const start = fmtDate(new Date(parseDate(min).getTime() - 3 * 86400000));
    const days = Math.max(calDays(start, max) + 8, 30);
    return { rangeStart: start, totalDays: days };
  }, [rows, schedule, startDate]);

  const W = Math.ceil(totalDays * pxd);
  const H = HEADER_H + rows.length * ROW_H;
  const xOf = (date: string) => calDays(rangeStart, date) * pxd;
  const yOf = (i: number) => HEADER_H + i * ROW_H;
  const yIdx = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(String(r.task.id), i));
    return m;
  }, [rows]);

  // ----- background: weekend/holiday shading (day/week) + monthly gridlines + month labels -----
  const bg: React.ReactNode[] = [];
  const monthLabels: React.ReactNode[] = [];
  {
    const d = parseDate(rangeStart);
    for (let i = 0; i < totalDays; i++) {
      const dow = d.getDay();
      const ds = fmtDate(d);
      if ((zoom === 'day' || zoom === 'week') && (dow === 0 || (workWeek < 6 && dow === 6) || holSet.has(ds))) {
        bg.push(<rect key={`wk${i}`} x={i * pxd} y={HEADER_H} width={pxd} height={H - HEADER_H} fill={COL.weekend} />);
      }
      if (d.getDate() === 1) {
        const x = i * pxd;
        bg.push(<line key={`gl${i}`} x1={x} y1={HEADER_H} x2={x} y2={H} stroke={COL.gridline} />);
        monthLabels.push(
          <text key={`ml${i}`} x={x + 3} y={HEADER_H - 10} fontSize={11} fill="#6b7280">
            {MONTHS[d.getMonth()]}
            {d.getMonth() === 0 ? ` ${d.getFullYear()}` : ''}
          </text>,
        );
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // ----- row separators -----
  const rowLines = rows.map((_, i) => (
    <line key={`rl${i}`} x1={0} y1={yOf(i + 1)} x2={W} y2={yOf(i + 1)} stroke={COL.gridline} strokeWidth={0.5} />
  ));

  // ----- bars -----
  const bars: React.ReactNode[] = [];
  rows.forEach((r, i) => {
    const t = r.task;
    const sc = schedule[String(t.id)];
    if (!sc) return;
    const y = yOf(i);
    const x = xOf(sc.s);
    const w = Math.max((calDays(sc.s, sc.f) + 1) * pxd, 2);
    const isCrit = critical?.has(String(t.id));

    // baseline ghost
    if (baselineBars && baselineBars[String(t.id)]) {
      const b = baselineBars[String(t.id)];
      const gx = xOf(b.s);
      const gw = Math.max((calDays(b.s, b.f) + 1) * pxd, 2);
      bars.push(
        <rect key={`bl${i}`} x={gx} y={y + 24} width={gw} height={4} rx={2} fill={COL.ghost} opacity={0.6} />,
      );
    }

    if (t.type === 'group') {
      const gy = y + 9;
      bars.push(
        <g key={`g${i}`}>
          <rect x={x} y={gy} width={w} height={6} fill={COL.group} />
          <path d={`M${x},${gy} l0,12 l6,-6 z`} fill={COL.group} />
          <path d={`M${x + w},${gy} l0,12 l-6,-6 z`} fill={COL.group} />
        </g>,
      );
    } else if (t.type === 'milestone') {
      const cx = x + (zoom === 'day' ? pxd / 2 : 0);
      const cy = y + ROW_H / 2;
      const viol = violations?.has(String(t.id));
      const fill = viol ? COL.violation : t.milestoneType === 'fixed' ? COL.msFixed : COL.msCalc;
      bars.push(
        <path
          key={`m${i}`}
          d={`M${cx},${cy - 7} L${cx + 7},${cy} L${cx},${cy + 7} L${cx - 7},${cy} z`}
          fill={fill}
          stroke={isCrit ? COL.critical : undefined}
          strokeWidth={isCrit ? 2 : undefined}
        />,
      );
    } else {
      const fill = t.color || COL.bar;
      const pct = Math.max(0, Math.min(100, t.percentComplete || 0));
      const by = y + 8;
      bars.push(
        <g key={`t${i}`}>
          <rect x={x} y={by} width={w} height={14} rx={3} fill={fill} stroke={isCrit ? COL.critical : undefined} strokeWidth={isCrit ? 2 : undefined} />
          {pct > 0 && <rect x={x} y={by} width={(w * pct) / 100} height={14} rx={3} fill="rgba(0,0,0,0.30)" />}
        </g>,
      );
    }
  });

  // ----- dependency arrows (drawn AFTER bars; finalized routing) -----
  const arrows: React.ReactNode[] = [];
  if (zoom !== 'quarter') {
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
        const sx = exFromStart ? xOf(pm.s) : xOf(pm.f) + pxd;
        const sy = yOf(pi) + ROW_H / 2;
        const enX = enAtFinish ? xOf(tm.f) + pxd : xOf(tm.s);
        const enY = yOf(ti) + ROW_H / 2;
        const wrap = 18;
        let d: string;
        if (p.type === 'FS') {
          const dropX = Math.max(sx, enX + 8);
          const landY = yOf(ti) + (ti > pi ? 8 : ROW_H - 8);
          d = `M${sx},${sy} H${dropX} V${landY}`;
        } else if (p.type === 'SF') {
          const leftX = Math.max(1, sx - 6);
          const laneY = yOf(ti);
          d = `M${sx},${sy} H${leftX} V${laneY} H${enX + wrap} V${enY} H${enX}`;
        } else {
          const turnX = enAtFinish ? Math.max(sx, enX) + wrap : Math.max(1, Math.min(sx, enX) - wrap);
          d = `M${sx},${sy} H${turnX} V${enY} H${enX}`;
        }
        arrows.push(
          <path key={`a${p.taskId}-${t.id}`} d={d} fill="none" stroke={COL.dep} strokeWidth={1.6} opacity={0.85} markerEnd="url(#crono-arr)" />,
        );
      }
    });
  }

  // ----- today line -----
  const today =
    todayStr >= rangeStart && todayStr <= fmtDate(new Date(parseDate(rangeStart).getTime() + totalDays * 86400000)) ? (
      <line x1={xOf(todayStr) + (zoom === 'day' ? pxd / 2 : 0)} y1={0} x2={xOf(todayStr) + (zoom === 'day' ? pxd / 2 : 0)} y2={H} stroke={COL.today} strokeWidth={1.5} strokeDasharray="4 3" />
    ) : null;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <marker id="crono-arr" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={COL.dep} />
        </marker>
      </defs>
      {bg}
      {monthLabels}
      {rowLines}
      {bars}
      {arrows}
      {today}
    </svg>
  );
}
