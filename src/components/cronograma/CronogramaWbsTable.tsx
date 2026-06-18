// WBS table — the left pane of the cronograma workspace. Pixel-aligned with GanttChart
// (ROW_H=30, HEADER_H=30) so rows line up with the bars. Read-only in this milestone;
// inline editing is layered on later.

import type { ScheduleEntry } from '@/lib/cronogramaEngine';
import type { GanttRow } from '@/lib/cronogramaModel';
import { formatPredecessors, rowNumberMap } from '@/lib/cronogramaModel';
import { cn } from '@/lib/utils';

const ROW_H = 30;
const HEADER_H = 30;

interface Props {
  rows: GanttRow[];
  schedule: Record<string, ScheduleEntry>;
  rollup: Record<string, number>;
  onSelect?: (id: string | number) => void;
  selectedId?: string | number | null;
}

function fmtHuman(d: string | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

export function CronogramaWbsTable({ rows, schedule, rollup, onSelect, selectedId }: Props) {
  const rowNum = rowNumberMap(rows);

  const cols = 'grid items-center';
  const gridTemplate = '44px minmax(0,1fr) 48px 78px 78px 44px 96px';

  return (
    <div className="min-w-[440px] select-none text-sm">
      {/* header */}
      <div
        className={cn(cols, 'border-b border-border bg-slate-200 font-semibold text-[11px] uppercase tracking-wide text-muted-foreground')}
        style={{ gridTemplateColumns: gridTemplate, height: HEADER_H }}
      >
        <div className="px-2 text-right tabular-nums">#</div>
        <div className="px-2">Nombre</div>
        <div className="px-2 text-right tabular-nums">Días</div>
        <div className="px-2 text-center">Inicio</div>
        <div className="px-2 text-center">Fin</div>
        <div className="px-2 text-right tabular-nums">%</div>
        <div className="px-2">Pred</div>
      </div>

      {/* rows */}
      {rows.map((r) => {
        const t = r.task;
        const sc = schedule[String(t.id)];
        const isGroup = t.type === 'group';
        const isMs = t.type === 'milestone';
        const pct = isGroup ? rollup[String(t.id)] ?? 0 : t.percentComplete ?? 0;
        return (
          <div
            key={String(t.id)}
            className={cn(
              cols,
              'border-b border-slate-100 hover:bg-slate-50 cursor-pointer',
              selectedId === t.id && 'bg-slate-100',
            )}
            style={{ gridTemplateColumns: gridTemplate, height: ROW_H }}
            onClick={() => onSelect?.(t.id)}
          >
            <div className="px-2 text-right tabular-nums text-muted-foreground">{r.wbs}</div>
            <div className="truncate px-2" style={{ paddingLeft: 8 + r.depth * 16 }}>
              <span className={cn(isGroup && 'font-semibold', isMs && 'italic')}>{t.name}</span>
            </div>
            <div className="px-2 text-right tabular-nums">{isGroup || isMs ? '' : t.duration}</div>
            <div className="px-2 text-center tabular-nums">{fmtHuman(sc?.s)}</div>
            <div className="px-2 text-center tabular-nums">{fmtHuman(sc?.f)}</div>
            <div className="px-2 text-right tabular-nums">{isMs ? '' : `${pct}%`}</div>
            <div className="truncate px-2 tabular-nums text-muted-foreground">{formatPredecessors(t, rowNum)}</div>
          </div>
        );
      })}
    </div>
  );
}
