// WBS table — left pane of the cronograma workspace. Faithful port of gantto's renderTable +
// inline editing (app.js), plus three ERP-side additions agreed with the user:
//   - inline Inicio/Fin editing via a compact calendar popover (tasks only), MS-Project style.
//   - a right-click context menu on rows (add / indent / duplicate / delete).
//   - RESIZABLE columns + WRAPPING names => variable row height.
//
// Variable row height contract (see cronogramaGeometry.ts): cells are TOP-aligned so the first
// line sits in the same fixed 30px band as the Gantt bar; long names wrap DOWNWARD and the row
// grows. This component is the single source of truth for row heights: one ResizeObserver
// measures the rendered rows (rAF-batched, integer, equality-gated, suppressed during a column
// drag) and publishes the array up via onRowHeightsChange; the chart consumes it. A single-line
// row measures exactly ROW_H, so the chart stays pixel-identical to gantto.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { ScheduleEntry, TaskId } from '@/lib/cronogramaEngine';
import type { GanttRow } from '@/lib/cronogramaModel';
import { formatPredecessors } from '@/lib/cronogramaModel';
import { ROW_H, HEADER_H } from '@/lib/cronogramaGeometry';
import { cn } from '@/lib/utils';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export type EditField = 'name' | 'dur' | 'pct' | 'pred' | 'inicio' | 'fin';

// Column order is fixed; widths are resizable (the last, Pred, included). Mins keep header
// labels on one line and stop the table breaking its own layout.
const COLS = [
  { key: 'num', label: '#', align: 'text-right' as const },
  { key: 'name', label: 'Nombre', align: 'text-left' as const },
  { key: 'dur', label: 'Días', align: 'text-right' as const },
  { key: 'inicio', label: 'Inicio', align: 'text-center' as const },
  { key: 'fin', label: 'Fin', align: 'text-center' as const },
  { key: 'pct', label: '%', align: 'text-center' as const },
  { key: 'pred', label: 'Pred', align: 'text-left' as const },
];
const DEFAULT_WIDTHS = [44, 220, 48, 84, 84, 44, 110];
const MIN_WIDTHS = [32, 120, 36, 64, 64, 34, 56];

interface Props {
  rows: GanttRow[];
  schedule: Record<string, ScheduleEntry>;
  rollup: Record<string, number>;
  rowNum: Map<TaskId, number>;
  collapsed: Set<TaskId>;
  selectedId?: TaskId | null;
  violations?: Set<string>;
  storageKey?: string; // persists column widths per cronograma
  onSelect: (id: TaskId) => void;
  onToggleCollapse: (id: TaskId) => void;
  onOpenDialog: (id: TaskId) => void;
  onRename: (id: TaskId, value: string) => void;
  onEditDuration: (id: TaskId, value: number) => void;
  onEditPercent: (id: TaskId, value: number) => void;
  onEditPredecessors: (id: TaskId, raw: string) => void;
  onEditStart: (id: TaskId, dateYMD: string) => void;
  onEditFin: (id: TaskId, dateYMD: string) => void;
  onAddBelow: (id: TaskId, type: 'task' | 'group' | 'milestone') => void;
  onIndent: (id: TaskId) => void;
  onOutdent: (id: TaskId) => void;
  onDuplicate: (id: TaskId) => void;
  onDelete: (id: TaskId) => void;
  onRowHeightsChange?: (heights: number[]) => void;
  // Fires true while ANY in-table interaction is active (cell edit, context menu, column resize),
  // false when all are clear — so the parent can defer autosave until the user is idle.
  onInteractingChange?: (active: boolean) => void;
  pendingEdit?: { id: TaskId; field: EditField } | null;
  onPendingEditConsumed?: () => void;
}

function fmtHuman(d: string | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}
function ymdToDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function loadWidths(storageKey?: string): number[] {
  if (storageKey) {
    try {
      const raw = localStorage.getItem(`crono.cols.${storageKey}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === COLS.length && arr.every((n) => typeof n === 'number')) {
          return arr.map((w, i) => Math.max(MIN_WIDTHS[i], w));
        }
      }
    } catch {
      /* ignore */
    }
  }
  return [...DEFAULT_WIDTHS];
}

const ADD_ITEMS: { type: 'task' | 'group' | 'milestone'; label: string }[] = [
  { type: 'task', label: 'Agregar tarea' },
  { type: 'group', label: 'Agregar grupo' },
  { type: 'milestone', label: 'Agregar hito' },
];

export function CronogramaWbsTable({
  rows,
  schedule,
  rollup,
  rowNum,
  collapsed,
  selectedId,
  violations,
  storageKey,
  onSelect,
  onToggleCollapse,
  onOpenDialog,
  onRename,
  onEditDuration,
  onEditPercent,
  onEditPredecessors,
  onEditStart,
  onEditFin,
  onAddBelow,
  onIndent,
  onOutdent,
  onDuplicate,
  onDelete,
  onRowHeightsChange,
  onInteractingChange,
  pendingEdit,
  onPendingEditConsumed,
}: Props) {
  const [editing, setEditing] = useState<{ id: TaskId; field: EditField } | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; id: TaskId } | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(() => loadWidths(storageKey));
  const [resizing, setResizing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const gridTemplate = colWidths.map((w) => `${w}px`).join(' ');
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // ----- column widths: load on cronograma switch, persist on change -----
  useEffect(() => {
    setColWidths(loadWidths(storageKey));
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`crono.cols.${storageKey}`, JSON.stringify(colWidths));
    } catch {
      /* ignore */
    }
  }, [colWidths, storageKey]);

  // ----- row-height measurement (single source of truth) -----
  const bodyRef = useRef<HTMLDivElement>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastPublished = useRef<number[]>([]);
  const resizingRef = useRef(false);
  resizingRef.current = resizing;

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (resizingRef.current) return; // wrap is settled only at column-drag end
      const body = bodyRef.current;
      if (!body) return;
      const els = Array.from(body.querySelectorAll<HTMLElement>('[data-crono-row]'));
      const next = els.map((el) => Math.max(ROW_H, Math.round(el.offsetHeight)));
      const prev = lastPublished.current;
      let same = prev.length === next.length;
      if (same) for (let i = 0; i < next.length; i++) if (prev[i] !== next[i]) { same = false; break; }
      if (!same) {
        lastPublished.current = next;
        onRowHeightsChange?.(next);
      }
    });
  }, [onRowHeightsChange]);

  useEffect(() => {
    const ro = new ResizeObserver(() => scheduleMeasure());
    roRef.current = ro;
    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleMeasure]);

  // (Re)observe the current row elements whenever rows or column widths change.
  useLayoutEffect(() => {
    const ro = roRef.current;
    const body = bodyRef.current;
    if (!ro || !body) return;
    ro.disconnect();
    body.querySelectorAll<HTMLElement>('[data-crono-row]').forEach((el) => ro.observe(el));
    scheduleMeasure();
  }, [rows, colWidths, scheduleMeasure]);

  const startColResize = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[index];
    resizingRef.current = true;
    setResizing(true);
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(MIN_WIDTHS[index], startW + (ev.clientX - startX));
      setColWidths((prev) => {
        const n = [...prev];
        n[index] = w;
        return n;
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizingRef.current = false;
      setResizing(false);
      scheduleMeasure();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ----- inline text editing -----
  const beginEdit = (id: TaskId, field: EditField, initial: string) => {
    setEditing({ id, field });
    setDraft(initial);
  };

  useEffect(() => {
    if (!pendingEdit) return;
    const r = rows.find((x) => x.task.id === pendingEdit.id);
    if (!r) return;
    const t = r.task;
    const init =
      pendingEdit.field === 'dur'
        ? String(t.duration ?? 0)
        : pendingEdit.field === 'pct'
          ? String(t.percentComplete ?? 0)
          : pendingEdit.field === 'pred'
            ? formatPredecessors(t, rowNum)
            : t.name;
    beginEdit(pendingEdit.id, pendingEdit.field, init);
    onPendingEditConsumed?.();
  }, [pendingEdit, rows, rowNum, onPendingEditConsumed]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  // Publish "interacting" to the parent. `interacting` is a boolean, so this effect fires only on
  // transitions (start/end), never on every keystroke or column-drag pixel. Covers the date-cell
  // calendar/popover paths too (they all flow through setEditing(null)).
  const interacting = editing != null || menu != null || resizing;
  useEffect(() => {
    onInteractingChange?.(interacting);
  }, [interacting, onInteractingChange]);
  useEffect(() => () => onInteractingChange?.(false), [onInteractingChange]);

  const commitEdit = () => {
    if (!editing) return;
    const { id, field } = editing;
    if (field === 'name') onRename(id, draft);
    else if (field === 'dur') onEditDuration(id, parseInt(draft, 10) || 0);
    else if (field === 'pct') onEditPercent(id, parseInt(draft, 10) || 0);
    else if (field === 'pred') onEditPredecessors(id, draft);
    setEditing(null);
  };

  const renderInput = () => (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commitEdit();
        else if (e.key === 'Escape') setEditing(null);
      }}
      onBlur={commitEdit}
      onClick={(e) => e.stopPropagation()}
      className="h-[20px] w-full rounded border border-input bg-background px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
    />
  );

  // Compact inline calendar for the Inicio / Fin cells (tasks only). Anchored to an inner
  // fixed-height span so the calendar stays put even when the sibling Nombre cell wraps tall.
  const dateCell = (t: GanttRow['task'], field: 'inicio' | 'fin', value: string | undefined, display: string) => {
    const open = editing?.id === t.id && editing.field === field;
    return (
      <div
        className="px-2 py-[5px] text-center text-xs tabular-nums"
        onDoubleClick={(e) => {
          e.stopPropagation();
          beginEdit(t.id, field, value ?? '');
        }}
      >
        <Popover open={open} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <PopoverAnchor asChild>
            <span className="inline-block min-h-[18px] align-top">{display}</span>
          </PopoverAnchor>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={ymdToDate(value)}
              defaultMonth={ymdToDate(value)}
              onSelect={(d) => {
                if (d) (field === 'inicio' ? onEditStart : onEditFin)(t.id, dateToYmd(d));
                setEditing(null);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <div className="relative select-none text-sm" style={{ width: totalWidth }}>
      {/* header */}
      <div
        className="sticky top-0 z-20 grid items-center border-b border-border bg-slate-200 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate, height: HEADER_H }}
      >
        {COLS.map((c, i) => (
          <div
            key={c.key}
            className={cn(
              'relative flex h-full items-center overflow-hidden whitespace-nowrap px-2',
              i < COLS.length - 1 && 'border-r border-border',
              c.align === 'text-right' ? 'justify-end' : c.align === 'text-center' ? 'justify-center' : 'justify-start',
            )}
          >
            {c.label}
            <div
              className="absolute right-0 top-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize hover:bg-accent"
              onMouseDown={(e) => startColResize(e, i)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      {/* rows */}
      <div ref={bodyRef}>
        {rows.map((r) => {
          const t = r.task;
          const sc = schedule[String(t.id)];
          const isGroup = t.type === 'group';
          const isMs = t.type === 'milestone';
          const isTask = t.type === 'task';
          const pct = isGroup ? rollup[String(t.id)] ?? 0 : t.percentComplete ?? 0;
          const violated = violations?.has(String(t.id));
          const editHere = (f: EditField) => editing?.id === t.id && editing.field === f;

          return (
            <div
              key={String(t.id)}
              data-crono-row=""
              className={cn(
                'grid cursor-default items-start border-b border-slate-100 hover:bg-slate-50',
                selectedId === t.id && 'bg-slate-100',
              )}
              style={{ gridTemplateColumns: gridTemplate, minHeight: ROW_H }}
              onClick={() => onSelect(t.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onSelect(t.id);
                setMenu({ x: e.clientX, y: e.clientY, id: t.id });
              }}
            >
              <div className="px-2 py-[5px] text-right tabular-nums text-muted-foreground">{rowNum.get(t.id)}</div>

              {/* name: disclosure + icon + label (wraps); rename input when editing */}
              <div className="flex min-w-0 items-start gap-1 px-2 py-[5px]" style={{ paddingLeft: 6 + r.depth * 16 }}>
                {isGroup ? (
                  <button
                    className="mt-[1px] flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCollapse(t.id);
                    }}
                    title={collapsed.has(t.id) ? 'Expandir' : 'Contraer'}
                  >
                    {collapsed.has(t.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                {isMs && <span className="mt-[1px] shrink-0 text-[10px] leading-none text-foreground">◆</span>}
                {editHere('name') ? (
                  renderInput()
                ) : (
                  <span
                    className={cn(
                      'min-w-0 break-words [overflow-wrap:anywhere]',
                      isGroup && 'font-semibold',
                      isMs && 'italic',
                      violated && 'text-error',
                    )}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      beginEdit(t.id, 'name', t.name);
                    }}
                  >
                    {t.name}
                  </span>
                )}
              </div>

              {/* duration */}
              <div
                className="px-2 py-[5px] text-right tabular-nums"
                onDoubleClick={(e) => {
                  if (!isTask) return;
                  e.stopPropagation();
                  beginEdit(t.id, 'dur', String(t.duration ?? 0));
                }}
              >
                {editHere('dur') ? renderInput() : isTask ? t.duration : ''}
              </div>

              {/* inicio */}
              {isTask ? (
                dateCell(t, 'inicio', sc?.s, fmtHuman(sc?.s))
              ) : (
                <div
                  className="px-2 py-[5px] text-center text-xs tabular-nums"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenDialog(t.id);
                  }}
                >
                  {fmtHuman(sc?.s)}
                </div>
              )}

              {/* fin */}
              {isTask ? (
                dateCell(t, 'fin', sc?.f, fmtHuman(sc?.f))
              ) : (
                <div
                  className="px-2 py-[5px] text-center text-xs tabular-nums"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenDialog(t.id);
                  }}
                >
                  {isMs ? '' : fmtHuman(sc?.f)}
                </div>
              )}

              {/* percent */}
              <div
                className="px-2 py-[5px] text-right tabular-nums"
                onDoubleClick={(e) => {
                  if (!isTask) return;
                  e.stopPropagation();
                  beginEdit(t.id, 'pct', String(t.percentComplete ?? 0));
                }}
              >
                {editHere('pct') ? renderInput() : isMs ? '' : `${pct}%`}
              </div>

              {/* predecessors (single-line, truncated) */}
              <div
                className="min-w-0 px-2 py-[5px] text-xs tabular-nums text-muted-foreground"
                onDoubleClick={(e) => {
                  if (isGroup) return;
                  e.stopPropagation();
                  beginEdit(t.id, 'pred', formatPredecessors(t, rowNum));
                }}
              >
                {editHere('pred') ? renderInput() : isGroup ? '' : <span className="block truncate">{formatPredecessors(t, rowNum)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* right-click context menu */}
      {menu && (
        <div
          className="fixed z-50 min-w-[170px] rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {ADD_ITEMS.map((it) => (
            <button
              key={it.type}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent"
              onClick={() => {
                onAddBelow(menu.id, it.type);
                setMenu(null);
              }}
            >
              {it.label}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => { onIndent(menu.id); setMenu(null); }}>
            Indentar
          </button>
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => { onOutdent(menu.id); setMenu(null); }}>
            Desindentar
          </button>
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => { onDuplicate(menu.id); setMenu(null); }}>
            Duplicar
          </button>
          <div className="my-1 border-t border-border" />
          <button className="block w-full rounded px-2 py-1.5 text-left text-error hover:bg-accent" onClick={() => { onDelete(menu.id); setMenu(null); }}>
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
