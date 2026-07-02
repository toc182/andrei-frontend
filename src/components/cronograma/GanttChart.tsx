// GanttChart — SVG port of the standalone Gantto renderChart (ganttoweb/app.js), incl. the
// finalized dependency-arrow routing (FS drop-into-start, SS left-wrap, FF right-wrap, SF
// down-first lane) and gantto's drag/resize gesture: drag a task bar to set its "no antes de"
// date, drag the right edge to change duration, drag a fixed milestone to move its date. The
// engine still rules — if predecessors push later, the bar won't retreat.
//
// Colors are raw hex inside SVG presentation attributes (a canvas-like context, mirroring the
// standalone tool) — the design-system "no raw hex" rule targets Tailwind utility classes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDate, fmtDate, calDays, nextWorkDay, isWorkDay, type ScheduleEntry, type TaskId } from '@/lib/cronogramaEngine';
import type { GanttRow } from '@/lib/cronogramaModel';
import { ROW_H, HEADER_H } from '@/lib/cronogramaGeometry';

// The bottom tier of the time header IS the zoom: 'day' shows year▸month▸day, 'month' shows
// year▸month, 'year' shows year only. The body still works in day-pixel space; only `pxd` and
// the header tiers change with the level.
export type Zoom = 'day' | 'month' | 'year';

interface GanttChartProps {
  rows: GanttRow[];
  schedule: Record<string, ScheduleEntry>;
  startDate: string;
  holidays: string[];
  zoom: Zoom;
  scale?: number; // multiplies the per-day pixel width (toolbar slider); 1 = level default
  critical?: Set<string>;
  violations?: Set<string>;
  baselineBars?: Record<string, { s: string; f: string }> | null;
  todayStr: string;
  selectedId?: string | number | null;
  workWeek?: number; // needed for drag commit math (next work day / count work days)
  onSelect?: (id: TaskId) => void;
  onCommitTask?: (id: TaskId, patch: { manualDate?: string | null; duration?: number }) => void;
  // Fires true while a bar drag/resize is in progress, false when it ends — lets the parent defer
  // autosave so an id-remap can't drop an in-flight drag.
  onInteractingChange?: (active: boolean) => void;
  // Variable row heights from the table's measurement. rowTops has length rows.length+1
  // (last entry = total content bottom). When absent, fall back to a uniform ROW_H grid.
  rowTops?: number[];
  rowHeights?: number[];
}

const PXD: Record<Zoom, number> = { day: 26, month: 3.4, year: 0.8 };

// Header chrome (matches the WBS table header strip so the two panes read as one header row).
const HEAD = {
  bg: '#e2e8f0', // slate-200 — same as the table header
  line: '#cbd5e1', // slate-300 — tier + cell separators
  year: '#334155', // slate-700
  month: '#475569', // slate-600
  day: '#64748b', // slate-500
};

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
  rowSelected: '#dbe9fc',
  textDim: '#6b7280',
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// gantto's fmtHuman: "16 mar 26" (used for the milestone date label + drag tooltip).
function fmtHuman(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

function addCalDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

// Inclusive work days between s and f per the project calendar (gantto's countWorkDays).
function countWorkDays(s: string, f: string, ww: number, hol: Set<string>): number {
  let n = 0;
  const d = parseDate(s);
  const end = parseDate(f);
  while (d <= end) {
    if (isWorkDay(d, ww, hol)) n++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, n);
}

export function GanttChart({
  rows,
  schedule,
  startDate,
  holidays,
  zoom,
  scale = 1,
  critical,
  violations,
  baselineBars,
  todayStr,
  selectedId,
  workWeek,
  onSelect,
  onCommitTask,
  onInteractingChange,
  rowTops,
  rowHeights,
}: GanttChartProps) {
  const pxd = PXD[zoom] * scale;
  const holSet = useMemo(() => new Set(holidays || []), [holidays]);

  // ----- drag/resize gesture (gantto's mousedown/move/up on bars) -----
  const [drag, setDrag] = useState<{ id: TaskId; kind: 'move' | 'resize'; days: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const dragRef = useRef<{ id: TaskId; kind: 'move' | 'resize'; startX: number; s: string; f: string } | null>(null);

  const startDrag = (
    e: React.MouseEvent,
    id: TaskId,
    kind: 'move' | 'resize',
    s: string,
    f: string,
  ) => {
    if (!onCommitTask || e.button !== 0) return;
    dragRef.current = { id, kind, startX: e.clientX, s, f };
    setDrag({ id, kind, days: 0 });
    e.preventDefault();
    e.stopPropagation();
  };

  const dragging = drag != null;
  // Publish drag state to the parent (boolean → fires only on start/end, not per mouse-move) so
  // autosave defers during a drag and an id-remap can't strand the gesture.
  useEffect(() => {
    onInteractingChange?.(dragging);
  }, [dragging, onInteractingChange]);
  useEffect(() => () => onInteractingChange?.(false), [onInteractingChange]);

  useEffect(() => {
    if (!dragging) return;
    const ww = workWeek ?? 5;
    const onMove = (e: MouseEvent) => {
      const ref = dragRef.current;
      if (!ref) return;
      const days = Math.round((e.clientX - ref.startX) / pxd);
      setDrag((d) => (d && d.days !== days ? { ...d, days } : d));
      let label: string;
      if (ref.kind === 'move') {
        label = 'Inicio: ' + fmtHuman(nextWorkDay(addCalDays(ref.s, days), ww, holSet));
      } else {
        let nf = addCalDays(ref.f, days);
        if (nf < ref.s) nf = ref.s;
        label = `Duración: ${countWorkDays(ref.s, nf, ww, holSet)}d`;
      }
      setTip({ x: e.clientX, y: e.clientY, label });
    };
    const onUp = (e: MouseEvent) => {
      const ref = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setTip(null);
      if (!ref) return;
      const days = Math.round((e.clientX - ref.startX) / pxd);
      if (days === 0) return; // plain click — selection is handled by the bar's onClick
      if (ref.kind === 'move') {
        onCommitTask?.(ref.id, { manualDate: nextWorkDay(addCalDays(ref.s, days), ww, holSet) });
      } else {
        let nf = addCalDays(ref.f, days);
        if (nf < ref.s) nf = ref.s;
        onCommitTask?.(ref.id, { duration: countWorkDays(ref.s, nf, ww, holSet) });
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging, pxd, workWeek, holSet, onCommitTask]);

  const { rangeStart, totalDays } = useMemo(() => {
    // Port of gantto computeRange (app.js): min/max over the FULL schedule (so the axis
    // doesn't shrink when groups collapse), fold today in, start 7d before min then back
    // up to Monday so week columns line up, and extend 21d past max.
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
  }, [schedule, startDate, todayStr]);

  const W = Math.ceil(totalDays * pxd);
  // Variable row heights (from the table's measurement) when present; uniform ROW_H otherwise.
  // Bars/arrows are pinned to a fixed top slot via CONSTANT offsets from yOf(i) — they never read
  // hOf(i) — so a single-line row (height === ROW_H) is pixel-identical to the old uniform grid.
  const yOf = (i: number) => rowTops?.[i] ?? HEADER_H + i * ROW_H;
  const hOf = (i: number) => rowHeights?.[i] ?? ROW_H;
  const H = rowTops?.[rows.length] ?? HEADER_H + rows.length * ROW_H;
  const xOf = (date: string) => calDays(rangeStart, date) * pxd;
  const yIdx = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(String(r.task.id), i));
    return m;
  }, [rows]);

  // ----- background: weekend/holiday shading (day level) + month/year gridlines -----
  const bg: React.ReactNode[] = [];
  {
    const d = parseDate(rangeStart);
    for (let i = 0; i < totalDays; i++) {
      const dow = d.getDay();
      const ds = fmtDate(d);
      if (zoom === 'day' && (dow === 0 || dow === 6 || holSet.has(ds))) {
        bg.push(<rect key={`wk${i}`} x={i * pxd} y={HEADER_H} width={pxd} height={H - HEADER_H} fill={COL.weekend} />);
      }
      // Gridlines: month starts for day/month levels; year starts (Jan 1) for the year level.
      const atMonth = d.getDate() === 1;
      const atYear = atMonth && d.getMonth() === 0;
      if ((zoom !== 'year' && atMonth) || (zoom === 'year' && atYear)) {
        bg.push(<line key={`gl${i}`} x1={i * pxd} y1={HEADER_H} x2={i * pxd} y2={H} stroke={COL.gridline} />);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // ----- time header tiers (year ▸ month ▸ day), drawn in the top HEADER_H band -----
  // Rendered into its own sticky overlay SVG (see the return) so it stays pinned on vertical
  // scroll; the body SVG below keeps the original coordinate system untouched.
  const headerEls: React.ReactNode[] = [];
  {
    headerEls.push(<rect key="hbg" x={0} y={0} width={W} height={HEADER_H} fill={HEAD.bg} />);
    headerEls.push(<line key="hbot" x1={0} y1={HEADER_H - 0.5} x2={W} y2={HEADER_H - 0.5} stroke={HEAD.line} />);

    const tiers: Array<'year' | 'month' | 'day'> =
      zoom === 'day' ? ['year', 'month', 'day'] : zoom === 'month' ? ['year', 'month'] : ['year'];
    const tierH = HEADER_H / tiers.length;
    const endDate = addCalDays(rangeStart, totalDays); // exclusive right edge → xOf === W

    tiers.forEach((tier, ti) => {
      const yTop = ti * tierH;
      const yMid = yTop + tierH / 2 + 3; // +3 ≈ vertical optical centering for ~10–11px text
      const yBot = yTop + tierH;
      if (ti < tiers.length - 1) {
        headerEls.push(<line key={`ht${ti}`} x1={0} y1={yBot} x2={W} y2={yBot} stroke={HEAD.line} />);
      }

      if (tier === 'day') {
        const d = parseDate(rangeStart);
        for (let i = 0; i < totalDays; i++) {
          const x = i * pxd;
          headerEls.push(<line key={`hd${i}`} x1={x} y1={yTop} x2={x} y2={yBot} stroke={HEAD.line} strokeWidth={0.5} opacity={0.6} />);
          if (pxd >= 16) {
            headerEls.push(
              <text key={`hdt${i}`} x={x + pxd / 2} y={yMid} fontSize={10} textAnchor="middle" fill={HEAD.day}>
                {d.getDate()}
              </text>,
            );
          }
          d.setDate(d.getDate() + 1);
        }
      } else {
        const cur = parseDate(rangeStart);
        const end = parseDate(endDate);
        while (cur < end) {
          const next = new Date(cur);
          if (tier === 'year') next.setFullYear(cur.getFullYear() + 1, 0, 1);
          else next.setMonth(cur.getMonth() + 1, 1);
          const x1 = xOf(fmtDate(cur));
          const x2 = next < end ? xOf(fmtDate(next)) : W;
          if (x1 > 0) headerEls.push(<line key={`h${tier}${x1}`} x1={x1} y1={yTop} x2={x1} y2={yBot} stroke={HEAD.line} />);
          const label =
            tier === 'year'
              ? String(cur.getFullYear())
              : MONTHS[cur.getMonth()] + (cur.getMonth() === 0 ? ` ${String(cur.getFullYear()).slice(2)}` : '');
          if (x2 - x1 >= (tier === 'year' ? 30 : 24)) {
            headerEls.push(
              <text
                key={`h${tier}t${x1}`}
                x={Math.max(x1, 0) + 4}
                y={yMid}
                fontSize={tier === 'year' ? 11 : 10}
                fontWeight={tier === 'year' ? 600 : 400}
                fill={tier === 'year' ? HEAD.year : HEAD.month}
              >
                {label}
              </text>,
            );
          }
          cur.setTime(next.getTime());
        }
      }
    });
  }

  // ----- row separators -----
  const rowLines = rows.map((_, i) => (
    <line key={`rl${i}`} x1={0} y1={yOf(i + 1)} x2={W} y2={yOf(i + 1)} stroke={COL.gridline} strokeWidth={0.5} />
  ));

  // ----- selected-row band (drawn under the bars, like gantto's rowband) -----
  const bands: React.ReactNode[] = [];
  rows.forEach((r, i) => {
    if (selectedId != null && String(r.task.id) === String(selectedId)) {
      bands.push(
        <rect key={`sb${i}`} x={0} y={yOf(i)} width={W} height={hOf(i)} fill={COL.rowSelected} opacity={0.45} />,
      );
    }
  });

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
    const dActive = drag != null && String(drag.id) === String(t.id);
    const dMove = dActive && drag!.kind === 'move' ? drag!.days * pxd : 0;
    const dResize = dActive && drag!.kind === 'resize' ? drag!.days * pxd : 0;

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
        <g key={`g${i}`} onClick={() => onSelect?.(t.id)}>
          <rect x={x} y={gy} width={w} height={6} fill={COL.group} />
          <path d={`M${x},${gy} l0,12 l6,-6 z`} fill={COL.group} />
          <path d={`M${x + w},${gy} l0,12 l-6,-6 z`} fill={COL.group} />
        </g>,
      );
    } else if (t.type === 'milestone') {
      const cx = x + (zoom === 'day' ? pxd / 2 : 0) + dMove;
      const cy = y + ROW_H / 2;
      const viol = violations?.has(String(t.id));
      const fill = viol ? COL.violation : t.milestoneType === 'fixed' ? COL.msFixed : COL.msCalc;
      const draggable = onCommitTask && t.milestoneType === 'fixed';
      bars.push(
        <g key={`m${i}`} onClick={() => onSelect?.(t.id)}>
          <path
            d={`M${cx},${cy - 7} L${cx + 7},${cy} L${cx},${cy + 7} L${cx - 7},${cy} z`}
            fill={fill}
            stroke={isCrit ? COL.critical : undefined}
            strokeWidth={isCrit ? 2 : undefined}
            style={draggable ? { cursor: 'grab' } : undefined}
            onMouseDown={draggable ? (e) => startDrag(e, t.id, 'move', sc.s, sc.f) : undefined}
          />
          {pxd >= 3 && (
            <text x={cx + 11} y={cy + 4} fontSize={10} fill={viol ? COL.violation : COL.textDim}>
              {fmtHuman(sc.s)}
            </text>
          )}
        </g>,
      );
    } else {
      const fill = t.color || COL.bar;
      const pct = Math.max(0, Math.min(100, t.percentComplete || 0));
      const by = y + 8;
      const bx = x + dMove;
      const bw = Math.max(w + dResize, 4);
      bars.push(
        <g key={`t${i}`} onClick={() => onSelect?.(t.id)}>
          <rect
            x={bx}
            y={by}
            width={bw}
            height={14}
            rx={3}
            fill={fill}
            stroke={isCrit ? COL.critical : undefined}
            strokeWidth={isCrit ? 2 : undefined}
            style={onCommitTask ? { cursor: 'grab' } : undefined}
            onMouseDown={onCommitTask ? (e) => startDrag(e, t.id, 'move', sc.s, sc.f) : undefined}
          />
          {pct > 0 && (
            <rect x={bx} y={by} width={(bw * pct) / 100} height={14} rx={3} fill="rgba(0,0,0,0.30)" pointerEvents="none" />
          )}
          {onCommitTask && (
            <rect
              x={bx + bw - 6}
              y={by}
              width={6}
              height={14}
              fill="transparent"
              style={{ cursor: 'ew-resize' }}
              onMouseDown={(e) => startDrag(e, t.id, 'resize', sc.s, sc.f)}
            />
          )}
        </g>,
      );
    }
  });

  // ----- dependency arrows (drawn AFTER bars; finalized routing) -----
  const arrows: React.ReactNode[] = [];
  if (zoom !== 'year') {
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
    <div className="relative" style={{ width: W }}>
      {/* Sticky time header: pinned on vertical scroll, scrolls horizontally with the body.
          It overlays the body's top band (which is pulled up under it via negative margin). */}
      <svg width={W} height={HEADER_H} className="sticky top-0 z-10" style={{ display: 'block' }}>
        {headerEls}
      </svg>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: -HEADER_H }}>
        <defs>
          <marker id="crono-arr" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={COL.dep} />
          </marker>
        </defs>
        {bg}
        {rowLines}
        {bands}
        {bars}
        {arrows}
        {today}
      </svg>
      {tip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md"
          style={{ left: tip.x + 14, top: tip.y - 28 }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}
