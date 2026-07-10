// CronogramaWorkspace — editor/viewer for one cronograma. Used by the standalone route
// (cronogramaId) and the per-project tab (projectId + embedded). Holds an editable
// {config, tasks} model, recomputes the schedule live with the shared engine, and persists
// via the backend (which re-validates and rejects cycles).
//
// Interaction model is a faithful port of gantto (app.js): inline table editing, drag/resize
// bars, group collapse/expand, undo/redo (the `commit` wrapper snapshots before every change),
// and a keyboard map (arrows, Tab/Shift+Tab, Enter, n, e, Delete, Esc, Cmd/Ctrl+Z). New rows
// get temporary NEGATIVE ids; the backend swaps them for serials on save (idMap).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState } from '@/components/shell/states';
import { Alert } from '@/components/shell/Alert';
import { AppDialog } from '@/components/shell/AppDialog';
import { DatePicker } from '@/components/shell/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Plus,
  ClipboardPaste,
  CalendarRange,
  Save,
  Undo2,
  Redo2,
  Trash2,
  ChevronsDownUp,
  ChevronsUpDown,
  ZoomIn,
  ZoomOut,
  IndentIncrease,
  IndentDecrease,
  Route,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  computeSchedule,
  computeRollup,
  checkViolations,
  computeCritical,
  hasCycle,
  nextWorkDay,
  type TaskId,
  type EngineTask,
} from '@/lib/cronogramaEngine';
import { buildRows, fullOrderRowNumbers, parsePredecessors } from '@/lib/cronogramaModel';
import { opAddTask, opDeleteSubtree, opIndent, opOutdent, opDuplicate, opInsertPasteBatch, hasChildren, childrenOf, countWorkDays } from '@/lib/cronogramaTaskOps';
import type { ResolvedPasteRow } from '@/lib/cronogramaPaste';
import { ROW_H, rowTopsFrom } from '@/lib/cronogramaGeometry';
import { GanttChart, type Zoom } from '@/components/cronograma/GanttChart';
import { CronogramaWbsTable, type EditField } from '@/components/cronograma/CronogramaWbsTable';
import { CronogramaTaskDialog } from '@/components/cronograma/CronogramaTaskDialog';
import { CronogramaPasteDialog } from '@/components/cronograma/CronogramaPasteDialog';
import { PrintDialog } from '@/components/cronograma/PrintDialog';
import {
  getCronograma,
  listCronogramas,
  createCronograma,
  saveCronograma,
  exportCronograma,
  CronogramaConflictError,
  type CronogramaConfig,
  type CronogramaListItem,
  type AjustesImpresion,
} from '@/lib/cronogramaApi';

interface Props {
  cronogramaId?: number;
  projectId?: number;
  embedded?: boolean;
  onNavigate?: (view: string) => void;
}

type Snapshot = { config: CronogramaConfig; tasks: EngineTask[] };

function mapToObj<V>(m: Map<TaskId, V>): Record<string, V> {
  const o: Record<string, V> = {};
  for (const [k, v] of m) o[String(k)] = v;
  return o;
}

function descendantsOf(id: TaskId, tasks: EngineTask[]): Set<TaskId> {
  const out = new Set<TaskId>();
  const walk = (pid: TaskId) => {
    for (const t of tasks) {
      if (t.parentId === pid && !out.has(t.id)) {
        out.add(t.id);
        walk(t.id);
      }
    }
  };
  walk(id);
  return out;
}

const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDMY(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS_S[m - 1]} ${String(y).slice(2)}`;
}

// The level sets the bottom tier of the time header (and therefore the column granularity).
const ZOOMS: { key: Zoom; label: string }[] = [
  { key: 'year', label: 'Año' },
  { key: 'month', label: 'Mes' },
  { key: 'day', label: 'Día' },
];

// Width slider range: multiplies the chart's px/day. These are deliberately generous — nothing
// breaks below the floor (bars just clamp to ~2px and day labels drop off), so the floor exists
// only to keep the thumb usable. Widen them freely if you want more room.
const SCALE_MIN = 0.2;
const SCALE_MAX = 2.5;
const SCALE_STEP = 0.05;

function loadScale(id: number | null): number {
  if (id == null) return 1;
  try {
    const raw = localStorage.getItem(`crono.scale.${id}`);
    if (raw != null) {
      const n = parseFloat(raw);
      if (!Number.isNaN(n)) return Math.min(SCALE_MAX, Math.max(SCALE_MIN, n));
    }
  } catch {
    /* ignore */
  }
  return 1;
}

// ---- autosave ----
const AUTOSAVE_DELAY = 2000; // quiet-period debounce before an autosave fires
const AUTOSAVE_MAX_WAIT = 30000; // ceiling so a long continuous session still saves
const AUTOSAVE_RETRY_MS = [2000, 5000, 15000]; // backoff after a transient (non-conflict) auto-save failure

type IdMap = Record<string, number>;
type Draft = { config: CronogramaConfig; tasks: EngineTask[]; baseUpdatedAt?: string };

function loadAutosave(id: number | null): boolean {
  if (id == null) return false;
  try {
    return localStorage.getItem(`crono.autosave.${id}`) === '1';
  } catch {
    return false;
  }
}

function remapId(id: TaskId, idMap: IdMap): TaskId {
  return idMap[String(id)] ?? id;
}

// Defensive: baseline.bars is keyed by task id. It never holds negative temp ids in this codebase
// (baseline is server-authored), but remap it for correctness if it ever does.
function remapConfigBaseline(config: CronogramaConfig, idMap: IdMap): CronogramaConfig {
  const bl = config.baseline as { bars?: Record<string, unknown> } | null | undefined;
  if (!bl || typeof bl !== 'object' || !bl.bars) return config;
  const bars: Record<string, unknown> = {};
  for (const k of Object.keys(bl.bars)) {
    const mapped = idMap[k];
    bars[mapped != null ? String(mapped) : k] = bl.bars[k];
  }
  return { ...config, baseline: { ...bl, bars } };
}

// Rewrite every id-bearing field through the backend idMap (negative temp ids -> real serials).
// Used to keep undo/redo history valid across a save instead of wiping it, and to remap the live
// model when the user kept editing during an in-flight save.
function remapTasks(tasks: EngineTask[], idMap: IdMap): EngineTask[] {
  return tasks.map((t) => ({
    ...t,
    id: remapId(t.id, idMap),
    parentId: t.parentId == null ? t.parentId : remapId(t.parentId, idMap),
    predecessors: (t.predecessors || []).map((p) => ({ ...p, taskId: remapId(p.taskId, idMap) })),
  }));
}

function remapSnapshot(snap: Snapshot, idMap: IdMap): Snapshot {
  if (!idMap || Object.keys(idMap).length === 0) return snap;
  return { config: remapConfigBaseline(snap.config, idMap), tasks: remapTasks(snap.tasks, idMap) };
}

// Most-negative temp id present in a task list, minus one — used after a draft restore so newly
// added rows can't collide with restored negatives.
function nextTempIdBelow(tasks: EngineTask[]): number {
  let min = -1;
  for (const t of tasks) if (typeof t.id === 'number' && t.id < min) min = t.id;
  return min - 1;
}

const ADD_TYPES: { type: EngineTask['type']; label: string; name: string }[] = [
  { type: 'task', label: 'Tarea', name: 'Nueva tarea' },
  { type: 'group', label: 'Grupo', name: 'Nuevo grupo' },
  { type: 'milestone', label: 'Hito', name: 'Nuevo hito' },
];

export default function CronogramaWorkspace({ cronogramaId, projectId }: Props) {
  const [activeId, setActiveId] = useState<number | null>(cronogramaId ?? null);
  const [projectList, setProjectList] = useState<CronogramaListItem[] | null>(null);

  const [config, setConfig] = useState<CronogramaConfig | null>(null);
  const [tasks, setTasks] = useState<EngineTask[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>('month');
  const [showCritical, setShowCritical] = useState(false); // ruta crítica highlight (gantto default: off)
  // toolbar width slider: multiplies the chart's px/day, persisted per-cronograma in localStorage
  const [scale, setScale] = useState(() => loadScale(cronogramaId ?? null));
  const [selectedId, setSelectedId] = useState<TaskId | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TaskId>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);

  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  const [editingId, setEditingId] = useState<TaskId | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TaskId | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [scrollToId, setScrollToId] = useState<TaskId | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{ id: TaskId; field: EditField } | null>(null);
  const tempId = useRef(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- autosave state ----
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => loadAutosave(cronogramaId ?? null));
  const [interacting, setInteracting] = useState({ table: false, chart: false });
  const [draftAvailable, setDraftAvailable] = useState<Draft | null>(null);
  const [retrying, setRetrying] = useState(false);
  const anyInteracting = interacting.table || interacting.chart;

  // Refs read inside async saves / event listeners without stale closures.
  const activeIdRef = useRef(activeId);
  const tasksRef = useRef(tasks);
  const configRef = useRef(config);
  const dirtyRef = useRef(dirty);
  const cycleRef = useRef(false);
  const editGenRef = useRef(0); // bumps on every edit; guards stale-response merges
  const loadGenRef = useRef(0); // bumps on every (re)load; discards saves that resolve afterward
  const inFlightRef = useRef(false); // a save is traveling to the server
  const firstDirtyAtRef = useRef<number | null>(null); // when the current dirty streak began (max-wait ceiling)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const autosaveEnabledRef = useRef(autosaveEnabled);
  activeIdRef.current = activeId;
  tasksRef.current = tasks;
  configRef.current = config;
  dirtyRef.current = dirty;
  autosaveEnabledRef.current = autosaveEnabled;

  const setTableInteracting = useCallback((v: boolean) => {
    setInteracting((s) => (s.table === v ? s : { ...s, table: v }));
  }, []);
  const setChartInteracting = useCallback((v: boolean) => {
    setInteracting((s) => (s.chart === v ? s : { ...s, chart: v }));
  }, []);

  // Create-attached-cronograma dialog (project tab).
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState(new Date().toISOString().slice(0, 10));
  const [newWW, setNewWW] = useState(5);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // ---- transient banner ----
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 3500);
    return () => clearTimeout(id);
  }, [banner]);

  // ---- load ----
  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    loadGenRef.current += 1; // any save still in flight from a prior load is now stale
    editGenRef.current += 1;
    firstDirtyAtRef.current = null;
    retryAttemptRef.current = 0;
    try {
      const d = await getCronograma(id);
      setConfig(d.project);
      setTasks(d.tasks);
      setDirty(false);
      setSelectedId(null);
      setCollapsed(new Set());
      setUndoStack([]);
      setRedoStack([]);
      setRetrying(false);
      // Recoverable local draft? Only offer it if it was based on the SAME server version that is
      // still current — otherwise the save already landed (or another writer advanced it) and the
      // draft's temp ids are stale, so drop it.
      try {
        const raw = localStorage.getItem(`crono.draft.${id}`);
        if (raw) {
          const draft = JSON.parse(raw) as Draft;
          if (draft.baseUpdatedAt && d.project.updatedAt && draft.baseUpdatedAt === d.project.updatedAt) {
            setDraftAvailable(draft);
          } else {
            localStorage.removeItem(`crono.draft.${id}`);
            setDraftAvailable(null);
          }
        } else {
          setDraftAvailable(null);
        }
      } catch {
        setDraftAvailable(null);
      }
    } catch {
      setError('No se pudo cargar el cronograma.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- local draft (crash/offline safety net) helpers ----
  const clearDraft = useCallback((id: number) => {
    try {
      localStorage.removeItem(`crono.draft.${id}`);
    } catch {
      /* ignore */
    }
  }, []);
  const writeDraft = useCallback((id: number, cfg: CronogramaConfig, tks: EngineTask[]) => {
    try {
      const draft: Draft = { config: cfg, tasks: tks, baseUpdatedAt: cfg.updatedAt };
      localStorage.setItem(`crono.draft.${id}`, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (activeId != null) load(activeId);
    return () => {
      // Switching cronogramas: flush the OUTGOING one's draft (refs still hold its data) and cancel
      // any pending retry so it can't fire against the wrong cronograma.
      if (dirtyRef.current && activeId != null && configRef.current) {
        writeDraft(activeId, configRef.current, tasksRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [activeId, load, writeDraft]);

  // ---- autosave toggle: load per-cronograma, default off ----
  useEffect(() => {
    setAutosaveEnabled(loadAutosave(activeId));
  }, [activeId]);
  const toggleAutosave = useCallback((v: boolean) => {
    setAutosaveEnabled(v);
    const id = activeIdRef.current;
    if (id != null) {
      try {
        localStorage.setItem(`crono.autosave.${id}`, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  }, []);

  // ---- width slider: load on cronograma switch, persist on change (per-cronograma) ----
  useEffect(() => {
    setScale(loadScale(activeId));
  }, [activeId]);
  useEffect(() => {
    if (activeId == null) return;
    try {
      localStorage.setItem(`crono.scale.${activeId}`, String(scale));
    } catch {
      /* ignore */
    }
  }, [scale, activeId]);

  // Project-tab mode: list this project's cronogramas; auto-open if exactly one.
  useEffect(() => {
    if (cronogramaId != null || projectId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listCronogramas(projectId);
        if (cancelled) return;
        setProjectList(items);
        if (items.length === 1) setActiveId(items[0].id);
      } catch {
        if (!cancelled) setError('No se pudo cargar la lista de cronogramas del proyecto.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cronogramaId, projectId]);

  // ---- live recompute ----
  const computed = useMemo(() => {
    if (!config) return null;
    const proj = { startDate: config.startDate, workWeek: String(config.workWeek), holidays: config.holidays };
    const sched = computeSchedule(tasks, proj);
    return {
      schedule: mapToObj(sched),
      rollup: mapToObj(computeRollup(tasks)),
      violations: new Set([...checkViolations(tasks, sched)].map(String)),
      critical: new Set([...computeCritical(tasks, proj, sched)].map(String)),
      cycle: hasCycle(tasks),
    };
  }, [tasks, config]);
  cycleRef.current = computed?.cycle ?? false;

  // Single dirty choke point: bump the edit generation (so an in-flight save can detect that the
  // model changed under it) and mark unsaved. Every edit path routes through here via commit/undo/redo.
  const markDirty = useCallback(() => {
    editGenRef.current += 1;
    setDirty(true);
  }, []);

  const rows = useMemo(() => buildRows(tasks, collapsed), [tasks, collapsed]);
  const fullRowNum = useMemo(() => fullOrderRowNumbers(tasks), [tasks]);

  // ---- variable row heights (table measures, chart consumes) ----
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  // Re-seed to a complete uniform array whenever the visible-row count changes (collapse/add/
  // delete), so the chart always has a full array and never flashes a 0/NaN row before the
  // table's first measurement lands.
  useEffect(() => {
    // Only the COUNT matters here; the guard makes a same-length update a no-op (returns prev).
    setRowHeights((prev) => (prev.length === rows.length ? prev : rows.map(() => ROW_H)));
  }, [rows]);
  const heightsForChart = rowHeights.length === rows.length ? rowHeights : null;
  const rowTops = useMemo(
    () => rowTopsFrom(heightsForChart ?? rows.map(() => ROW_H)),
    [heightsForChart, rows],
  );
  const labelOf = useCallback(
    (id: TaskId) => {
      const t = tasks.find((x) => x.id === id);
      return t ? `${fullRowNum.get(id) ?? '?'} ${t.name}` : String(id);
    },
    [tasks, fullRowNum],
  );

  // Scroll a freshly-inserted row (e.g. the first of a pasted batch) into view once the rows settle.
  useEffect(() => {
    if (scrollToId == null) return;
    const idx = rows.findIndex((r) => r.task.id === scrollToId);
    if (idx >= 0 && scrollRef.current && rowTops[idx] != null) {
      scrollRef.current.scrollTop = Math.max(0, rowTops[idx] - 40);
    }
    setScrollToId(null);
  }, [scrollToId, rows, rowTops]);

  // ---- undo/commit core ----
  const commit = useCallback(
    (mutate: (draft: EngineTask[]) => void) => {
      if (!config) return;
      setUndoStack((s) => [...s, { config: structuredClone(config), tasks: structuredClone(tasks) }].slice(-100));
      setRedoStack([]);
      const draft = structuredClone(tasks);
      mutate(draft);
      setTasks(draft);
      markDirty();
    },
    [config, tasks, markDirty],
  );

  const undo = useCallback(() => {
    if (!undoStack.length || !config) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { config: structuredClone(config), tasks: structuredClone(tasks) }]);
    setUndoStack((s) => s.slice(0, -1));
    // updatedAt is a server version stamp, not user content — never let an undo revert it, or the
    // next save sends a stale baseUpdatedAt and self-409s. Keep the live stamp.
    setConfig((live) => ({ ...prev.config, updatedAt: live?.updatedAt }));
    setTasks(prev.tasks);
    // A batch paste can be undone: if the selection pointed at a now-removed row, clear it so a
    // dangling id can't break labelOf/buildRows.
    setSelectedId((cur) => (cur != null && !prev.tasks.some((t) => t.id === cur) ? null : cur));
    markDirty();
  }, [undoStack, config, tasks, markDirty]);

  const redo = useCallback(() => {
    if (!redoStack.length || !config) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((s) => [...s, { config: structuredClone(config), tasks: structuredClone(tasks) }]);
    setRedoStack((r) => r.slice(0, -1));
    setConfig((live) => ({ ...next.config, updatedAt: live?.updatedAt })); // keep the live version stamp (see undo)
    setTasks(next.tasks);
    markDirty();
  }, [redoStack, config, tasks, markDirty]);

  // ---- collapse ----
  const toggleCollapse = useCallback((id: TaskId) => {
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(
    () => setCollapsed(new Set(tasks.filter((t) => t.type === 'group').map((t) => t.id))),
    [tasks],
  );

  // ---- selection nav ----
  const moveSelection = useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const idx = rows.findIndex((r) => r.task.id === selectedId);
      const next = idx === -1 ? (delta > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, idx + delta));
      setSelectedId(rows[next].task.id);
    },
    [rows, selectedId],
  );

  // ---- inline edits ----
  const onRename = useCallback(
    (id: TaskId, value: string) => {
      const v = value.trim();
      const t = tasks.find((x) => x.id === id);
      if (!t || !v || v === t.name) return;
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (d) d.name = v;
      });
    },
    [tasks, commit],
  );

  const onEditDuration = useCallback(
    (id: TaskId, value: number) => {
      const dur = Math.max(1, Math.round(value || 1));
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (d) d.duration = dur;
      });
    },
    [commit],
  );

  const onEditPercent = useCallback(
    (id: TaskId, value: number) => {
      const p = Math.max(0, Math.min(100, Math.round(value || 0)));
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (d) d.percentComplete = p;
      });
    },
    [commit],
  );

  const onEditPredecessors = useCallback(
    (id: TaskId, raw: string) => {
      const preds = parsePredecessors(raw, id, tasks, fullRowNum);
      if (preds === null) {
        setBanner('Predecesoras inválidas. Formato: "4FS+2, 7SS" (números de fila).');
        return;
      }
      const candidate = tasks.map((x) => (x.id === id ? { ...x, predecessors: preds } : x));
      if (hasCycle(candidate)) {
        setBanner('Esas predecesoras crearían un ciclo de dependencias.');
        return;
      }
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (d) d.predecessors = preds;
      });
    },
    [tasks, fullRowNum, commit],
  );

  // ---- drag commit (from the chart) ----
  const onCommitTask = useCallback(
    (id: TaskId, patch: { manualDate?: string | null; duration?: number }) => {
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (!d) return;
        if (patch.manualDate !== undefined) d.manualDate = patch.manualDate;
        if (patch.duration !== undefined) d.duration = patch.duration;
      });
    },
    [commit],
  );

  // ---- inline date edits (MS-Project style; no engine change — uses manualDate + duration) ----
  const onEditStart = useCallback(
    (id: TaskId, dateYMD: string) => {
      if (!config) return;
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (d) d.manualDate = dateYMD; // "no comenzar antes de" constraint
      });
      // Did a predecessor push the start later than the requested date? (keep the link, just warn)
      const candidate = tasks.map((x) => (x.id === id ? { ...x, manualDate: dateYMD } : x));
      const proj = { startDate: config.startDate, workWeek: String(config.workWeek), holidays: config.holidays };
      const got = computeSchedule(candidate, proj).get(id);
      const floor = nextWorkDay(dateYMD, config.workWeek, new Set(config.holidays || []));
      if (got && got.s > floor) {
        setBanner(`El inicio quedó en ${fmtDMY(got.s)}: una predecesora no permite empezar el ${fmtDMY(dateYMD)}.`);
      }
    },
    [config, tasks, commit],
  );

  const onEditFin = useCallback(
    (id: TaskId, dateYMD: string) => {
      if (!config || !computed) return;
      const s = computed.schedule[String(id)]?.s;
      if (!s) return;
      const fin = dateYMD < s ? s : dateYMD;
      const dur = countWorkDays(s, fin, config.workWeek, new Set(config.holidays || []));
      commit((draft) => {
        const d = draft.find((x) => x.id === id);
        if (d) d.duration = dur;
      });
    },
    [config, computed, commit],
  );

  // ---- task ops (id-parameterized so both keyboard and the row context menu reuse them) ----
  const addAfter = useCallback(
    (afterId: TaskId | null, type: EngineTask['type']) => {
      const meta = ADD_TYPES.find((a) => a.type === type)!;
      const after = afterId != null ? tasks.find((t) => t.id === afterId) : null;
      const parentId: TaskId | null = after ? (after.type === 'group' ? after.id : after.parentId ?? null) : null;
      let newId: TaskId | null = null;
      commit((draft) => {
        newId = opAddTask(type, meta.name, afterId, draft, () => tempId.current--);
      });
      if (parentId != null) {
        setCollapsed((c) => {
          if (!c.has(parentId)) return c;
          const n = new Set(c);
          n.delete(parentId);
          return n;
        });
      }
      if (newId != null) {
        setSelectedId(newId);
        setPendingEdit({ id: newId, field: 'name' });
      }
    },
    [tasks, commit],
  );
  const addAfterSelection = useCallback(
    (type: EngineTask['type']) => addAfter(selectedId ?? null, type),
    [addAfter, selectedId],
  );

  // Bulk paste: the whole batch is ONE commit (one undo, one autosave). After it lands, expand the
  // FULL ancestor chain of the first inserted row (unlike addAfter, which only expands the direct
  // parent), select + scroll to it, and banner the count.
  const onPasteRows = useCallback(
    (resolved: ResolvedPasteRow[]) => {
      if (!config || !resolved.length) return;
      const proj = { startDate: config.startDate, workWeek: String(config.workWeek), holidays: config.holidays };
      let ids: TaskId[] = [];
      const ancestors: TaskId[] = [];
      commit((draft) => {
        ids = opInsertPasteBatch(resolved, { afterId: selectedId ?? null }, proj, draft, () => tempId.current--);
        if (ids.length) {
          let cur = draft.find((t) => t.id === ids[0])?.parentId ?? null;
          while (cur != null) {
            ancestors.push(cur);
            cur = draft.find((t) => t.id === cur)?.parentId ?? null;
          }
        }
      });
      if (!ids.length) return;
      setCollapsed((c) => {
        if (!c.size) return c;
        const next = new Set(c);
        for (const a of ancestors) next.delete(a);
        return next;
      });
      setSelectedId(ids[0]);
      setScrollToId(ids[0]);
      setBanner(`${ids.length} fila${ids.length === 1 ? '' : 's'} insertada${ids.length === 1 ? '' : 's'}`);
    },
    [config, selectedId, commit],
  );

  const indentTask = useCallback(
    (id: TaskId) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      const sibs = childrenOf(t.parentId ?? null, tasks);
      if (sibs.findIndex((s) => s.id === id) <= 0) {
        setBanner('No se puede indentar: es la primera fila de su nivel (no hay una fila encima para anidarla).');
        return;
      }
      commit((draft) => opIndent(id, draft));
    },
    [tasks, commit],
  );
  const outdentTask = useCallback(
    (id: TaskId) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      if (t.parentId == null) {
        setBanner('No se puede desindentar: ya está en el nivel superior.');
        return;
      }
      commit((draft) => opOutdent(id, draft));
    },
    [tasks, commit],
  );
  const duplicateTask = useCallback(
    (id: TaskId) => {
      let newId: TaskId | null = null;
      commit((draft) => {
        newId = opDuplicate(id, draft, () => tempId.current--);
      });
      if (newId != null) setSelectedId(newId);
    },
    [commit],
  );

  const doDelete = useCallback(
    (id: TaskId) => {
      const removed = descendantsOf(id, tasks);
      removed.add(id);
      const idx = rows.findIndex((r) => r.task.id === id);
      const cand = rows[idx + 1]?.task.id ?? rows[idx - 1]?.task.id ?? null;
      const nextSel = cand != null && !removed.has(cand) ? cand : null;
      commit((draft) => opDeleteSubtree(id, draft));
      setSelectedId(nextSel);
      setDeleteConfirm(null);
      if (editingId != null && removed.has(editingId)) setEditingId(null);
    },
    [tasks, rows, commit, editingId],
  );

  const requestDelete = useCallback(
    (id?: TaskId) => {
      const target = id ?? selectedId;
      if (target == null) return;
      const t = tasks.find((x) => x.id === target);
      if (!t) return;
      if (hasChildren(t.id, tasks)) setDeleteConfirm(t.id);
      else doDelete(t.id);
    },
    [selectedId, tasks, doDelete],
  );

  // ---- dialog save ----
  const applyDialogSave = useCallback(
    (updated: EngineTask) => {
      commit((draft) => {
        const i = draft.findIndex((x) => x.id === updated.id);
        if (i >= 0) draft[i] = updated;
      });
      setSelectedId(updated.id);
      setEditingId(null);
    },
    [commit],
  );

  // ---- keyboard (gantto's global map, guarded; scoped to this mounted view) ----
  const handleKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  handleKeyRef.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
    const dlgOpen = editingId != null || createOpen || deleteConfirm != null || pasteOpen;
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault(); // block the browser's save dialog
      if (inField && el && typeof el.blur === 'function') el.blur(); // commit the open cell first
      // performSave reads from refs; defer a tick so the blur's commit lands before we read tasks.
      setTimeout(() => void performSaveRef.current('manual'), 0);
      return;
    }

    if (mod && e.key.toLowerCase() === 'z') {
      if (dlgOpen || inField) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (dlgOpen || inField) return;

    const selTask = selectedId != null ? tasks.find((t) => t.id === selectedId) : null;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1);
        break;
      case 'ArrowLeft':
        if (selTask?.type === 'group' && !collapsed.has(selTask.id)) toggleCollapse(selTask.id);
        break;
      case 'ArrowRight':
        if (selTask?.type === 'group' && collapsed.has(selTask.id)) toggleCollapse(selTask.id);
        break;
      case 'Enter':
        if (selectedId != null) {
          e.preventDefault();
          setPendingEdit({ id: selectedId, field: 'name' });
        }
        break;
      case 'Tab':
        if (selectedId != null) {
          e.preventDefault();
          if (e.shiftKey) outdentTask(selectedId);
          else indentTask(selectedId);
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (selectedId != null) {
          e.preventDefault();
          requestDelete();
        }
        break;
      case 'Escape':
        setSelectedId(null);
        break;
      case 'n':
      case 'N':
        if (!mod) {
          e.preventDefault();
          addAfterSelection('task');
        }
        break;
      case 'e':
      case 'E':
        if (selectedId != null) {
          e.preventDefault();
          setEditingId(selectedId);
        }
        break;
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKeyRef.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ---- save (shared by the Guardar button, Ctrl/Cmd+S, and autosave) ----
  const performSave = useCallback(
    async (reason: 'manual' | 'auto') => {
      const cfg = configRef.current;
      const id = activeIdRef.current;
      if (!cfg || id == null) return;
      if (inFlightRef.current) return; // never overlap saves
      if (cycleRef.current) {
        if (reason === 'manual') setSaveErr('No se puede guardar: hay un ciclo de dependencias.');
        return;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setRetrying(false);

      const genAtSend = editGenRef.current;
      const loadGenAtSend = loadGenRef.current;
      const activeIdAtSend = id;
      inFlightRef.current = true;
      setSaving(true);
      setSaveErr(null);
      try {
        const res = await saveCronograma(activeIdAtSend, {
          project: {
            name: cfg.name,
            proyectoId: cfg.proyectoId,
            startDate: cfg.startDate,
            workWeek: cfg.workWeek,
            holidays: cfg.holidays,
            baseline: cfg.baseline,
          },
          tasks: tasksRef.current,
          baseUpdatedAt: cfg.updatedAt,
        });
        // Switched cronograma or reloaded while in flight → the response is stale; discard it.
        if (activeIdRef.current !== activeIdAtSend || loadGenRef.current !== loadGenAtSend) return;

        const idMap: IdMap = res.idMap || {};
        const concurrentEdit = genAtSend !== editGenRef.current;

        // Remap selection / collapse / undo-redo regardless of branch (keeps history valid).
        setSelectedId((prev) => (prev == null ? prev : remapId(prev, idMap)));
        setCollapsed((c) => new Set([...c].map((x) => remapId(x, idMap))));
        setUndoStack((s) => s.map((snap) => remapSnapshot(snap, idMap)));
        setRedoStack((s) => s.map((snap) => remapSnapshot(snap, idMap)));

        if (!concurrentEdit) {
          // No edits during the await: adopt the server's authoritative copy.
          setConfig(res.project);
          setTasks(res.tasks);
          setPendingEdit((p) => (p == null ? p : { ...p, id: remapId(p.id, idMap) }));
          setDirty(false);
          retryAttemptRef.current = 0;
          clearDraft(activeIdAtSend);
        } else {
          // The user edited during the await: keep the LIVE (newer) model — only remap the temp ids
          // the server just assigned, and advance the version stamp so the follow-up save preconditions
          // correctly. dirty stays true; the autosave effect re-arms for a follow-up save.
          const newUpdatedAt = res.project?.updatedAt;
          setConfig((c) => {
            if (!c) return c;
            const remapped = remapConfigBaseline(c, idMap);
            return newUpdatedAt ? { ...remapped, updatedAt: newUpdatedAt } : remapped;
          });
          setTasks((live) => remapTasks(live, idMap));
          setPendingEdit((p) => (p == null ? p : { ...p, id: remapId(p.id, idMap) }));
          // Keep the crash-safety draft in sync with the new server stamp + serial ids NOW, not on
          // the 500ms debounce — otherwise a hard crash in that window leaves a stale-stamped draft
          // that reload would discard, losing the during-await edits. Refs still hold the pre-remap
          // live model inside this async callback, so remap them the same way the setState above will.
          const cfgNow = configRef.current;
          if (cfgNow && newUpdatedAt) {
            writeDraft(
              activeIdAtSend,
              { ...remapConfigBaseline(cfgNow, idMap), updatedAt: newUpdatedAt },
              remapTasks(tasksRef.current, idMap),
            );
          }
        }
      } catch (e) {
        if (activeIdRef.current !== activeIdAtSend || loadGenRef.current !== loadGenAtSend) return;
        if (e instanceof CronogramaConflictError) {
          // Another tab/device saved first. Stop autosave and tell the user to reload.
          setAutosaveEnabled(false);
          setSaveErr(e.message);
        } else if (reason === 'auto') {
          // Transient (network / cold start): keep dirty + the draft, retry with backoff.
          const attempt = Math.min(retryAttemptRef.current, AUTOSAVE_RETRY_MS.length - 1);
          retryAttemptRef.current = attempt + 1;
          setRetrying(true);
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            setRetrying(false);
            if (autosaveEnabledRef.current) void performSaveRef.current('auto');
          }, AUTOSAVE_RETRY_MS[attempt]);
        } else {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setSaveErr(msg || 'No se pudo guardar.');
        }
      } finally {
        inFlightRef.current = false;
        setSaving(false);
      }
    },
    [clearDraft, writeDraft],
  );
  const performSaveRef = useRef(performSave);
  performSaveRef.current = performSave;

  // ---- draft restore / discard ----
  const restoreDraft = useCallback(() => {
    if (!draftAvailable) return;
    const d = draftAvailable;
    setConfig(d.config);
    setTasks(d.tasks);
    tempId.current = nextTempIdBelow(d.tasks); // avoid colliding with restored temp ids
    editGenRef.current += 1;
    setDirty(true);
    setSelectedId(null);
    setUndoStack([]);
    setRedoStack([]);
    setDraftAvailable(null);
  }, [draftAvailable]);
  const discardDraft = useCallback(() => {
    if (activeIdRef.current != null) clearDraft(activeIdRef.current);
    setDraftAvailable(null);
  }, [clearDraft]);

  // ---- autosave engine ----
  // Track the start of the current unsaved streak for the max-wait ceiling.
  useEffect(() => {
    if (dirty) {
      if (firstDirtyAtRef.current == null) firstDirtyAtRef.current = Date.now();
    } else {
      firstDirtyAtRef.current = null;
    }
  }, [dirty]);

  // Debounced autosave: fires ~2s after the user pauses, only when idle (no cell edit, drag, column
  // resize, menu, or dialog) and there's no cycle; a 30s ceiling forces a save in a long busy session.
  const cycle = computed?.cycle ?? false;
  useEffect(() => {
    if (!autosaveEnabled || !dirty || saving || cycle) return;
    if (anyInteracting || editingId != null || createOpen || deleteConfirm != null || pasteOpen) return;
    const elapsed = firstDirtyAtRef.current != null ? Date.now() - firstDirtyAtRef.current : 0;
    const delay = Math.max(0, Math.min(AUTOSAVE_DELAY, AUTOSAVE_MAX_WAIT - elapsed));
    const t = setTimeout(() => void performSaveRef.current('auto'), delay);
    return () => clearTimeout(t);
  }, [autosaveEnabled, dirty, saving, cycle, anyInteracting, editingId, createOpen, deleteConfirm, pasteOpen, tasks]);

  // Debounced local draft of unsaved work (crash/offline safety net).
  useEffect(() => {
    if (activeId == null || !dirty || !config) return;
    const t = setTimeout(() => writeDraft(activeId, config, tasks), 500);
    return () => clearTimeout(t);
  }, [activeId, dirty, config, tasks, writeDraft]);

  // Flush the draft when the tab is hidden, and warn before unloading with unsaved work.
  useEffect(() => {
    const flush = () => {
      const id = activeIdRef.current;
      if (dirtyRef.current && id != null && configRef.current) {
        writeDraft(id, configRef.current, tasksRef.current);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      flush();
      e.preventDefault();
      e.returnValue = '';
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [writeDraft]);

  // ---- create-for-project ----
  const handleCreateForProject = async () => {
    if (!newName.trim()) {
      setCreateErr('El nombre es obligatorio.');
      return;
    }
    setCreating(true);
    setCreateErr(null);
    try {
      const id = await createCronograma({
        name: newName.trim(),
        startDate: newStart,
        workWeek: newWW,
        holidays: [],
        proyectoId: projectId ?? null,
      });
      setCreateOpen(false);
      setNewName('');
      setActiveId(id);
    } catch {
      setCreateErr('No se pudo crear el cronograma.');
    } finally {
      setCreating(false);
    }
  };

  const createDialog = (
    <AppDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      size="simple"
      title="Nuevo cronograma"
      description="Se vinculará a este proyecto."
      footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button onClick={handleCreateForProject} disabled={creating}>
            Crear
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {createErr && <p className="text-sm text-error">{createErr}</p>}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre</label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cronograma maestro" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Fecha de inicio</label>
          <DatePicker value={newStart} onChange={setNewStart} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Semana laboral</label>
          <div className="flex w-fit overflow-hidden rounded-md border border-border">
            {[5, 6, 7].map((w) => (
              <button
                key={w}
                onClick={() => setNewWW(w)}
                className={cn('px-3 py-1.5 text-sm', newWW === w ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50')}
              >
                {w} días
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppDialog>
  );

  // ---- project-tab: no cronograma selected yet ----
  if (cronogramaId == null && projectId != null && activeId == null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cronograma">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo cronograma
          </Button>
        </PageHeader>
        {error ? (
          <ErrorState description={error} onRetry={() => projectId && setProjectList(null)} />
        ) : projectList == null ? (
          <Skeleton className="h-40 w-full" />
        ) : projectList.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Sin cronogramas" description="Este proyecto aún no tiene un cronograma." />
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {projectList.map((c) => (
              <button
                key={c.id}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                onClick={() => setActiveId(c.id)}
              >
                <span className="font-medium">{c.nombre}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{c.taskCount} tareas</span>
              </button>
            ))}
          </div>
        )}
        {createDialog}
      </div>
    );
  }

  if (loading) return <Skeleton className="h-[60vh] w-full" />;
  if (error) return <ErrorState description={error} onRetry={() => activeId && load(activeId)} />;
  if (!config || !computed) return <EmptyState icon={CalendarRange} title="Cronograma no encontrado" />;

  const editingTask = editingId != null ? tasks.find((t) => t.id === editingId) ?? null : null;

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      <PageHeader title={config.name} subtitle={config.proyectoId ? undefined : 'Cronograma independiente'}>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground" title="Guardar automáticamente unos segundos después de cada cambio">
            <Switch checked={autosaveEnabled} onCheckedChange={toggleAutosave} />
            Auto-guardar
          </label>
          {autosaveEnabled && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {saving ? 'Guardando…' : retrying ? 'Reintentando…' : dirty ? 'Sin guardar' : 'Guardado'}
            </span>
          )}
          <Button size="sm" onClick={() => void performSave('manual')} disabled={!dirty || computed.cycle || saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir…
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="Más opciones de exportación">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCronograma(config.id, `${config.name}.gantto.json`)}>
                <Download className="mr-2 h-4 w-4" /> Exportar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      {/* editing + view controls (own row, below the title) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 overflow-hidden rounded-md border border-border bg-card">
          {ZOOMS.map((z) => (
            <button
              key={z.key}
              onClick={() => setZoom(z.key)}
              className={cn('flex items-center px-3 text-sm', zoom === z.key ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50')}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* width slider: stretches/compresses the timeline within the current level */}
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-2" title="Ancho del cronograma">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            className="w-28"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={SCALE_STEP}
            value={[scale]}
            onValueChange={([v]) => setScale(v)}
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ADD_TYPES.map((a) => (
              <DropdownMenuItem key={a.type} onSelect={() => addAfterSelection(a.type)}>
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" onClick={() => setPasteOpen(true)}>
          <ClipboardPaste className="mr-2 h-4 w-4" /> Pegar filas
        </Button>

        <Button
          size="icon"
          variant="outline"
          onClick={() => selectedId != null && indentTask(selectedId)}
          disabled={selectedId == null}
          title="Indentar (Tab)"
        >
          <IndentIncrease className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => selectedId != null && outdentTask(selectedId)}
          disabled={selectedId == null}
          title="Desindentar (Shift+Tab)"
        >
          <IndentDecrease className="h-4 w-4" />
        </Button>

        <Button size="icon" variant="outline" onClick={() => undo()} disabled={!undoStack.length} title="Deshacer (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => redo()} disabled={!redoStack.length} title="Rehacer (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => requestDelete()}
          disabled={selectedId == null}
          title="Eliminar (Supr)"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={collapseAll} title="Contraer todo">
          <ChevronsDownUp className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={expandAll} title="Expandir todo">
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={showCritical ? 'default' : 'outline'}
          onClick={() => setShowCritical((v) => !v)}
          title="Ruta crítica"
          aria-pressed={showCritical}
        >
          <Route className="h-4 w-4" />
        </Button>
      </div>

      {computed.cycle && (
        <Alert
          variant="error"
          title="Ciclo de dependencias"
          description="Hay una dependencia circular; corrígela para poder calcular fechas y guardar."
        />
      )}
      {banner && <Alert variant="warning" title="Aviso" description={banner} />}
      {saveErr && <Alert variant="error" title="No se pudo guardar" description={saveErr} />}
      {draftAvailable && (
        <Alert
          variant="info"
          title="Hay cambios sin guardar de una sesión anterior"
          description="Se encontró una copia local de este cronograma con cambios que no se guardaron. ¿Restaurarlos?"
          actions={
            <>
              <Button size="sm" onClick={restoreDraft}>
                Restaurar
              </Button>
              <Button size="sm" variant="outline" onClick={discardDraft}>
                Descartar
              </Button>
            </>
          }
        />
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Cronograma vacío"
          description="Agrega la primera tarea para empezar."
          action={
            <Button size="sm" onClick={() => addAfterSelection('task')}>
              <Plus className="mr-2 h-4 w-4" /> Agregar tarea
            </Button>
          }
        />
      ) : (
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          <div className="flex w-max">
          <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card">
            <CronogramaWbsTable
              rows={rows}
              schedule={computed.schedule}
              rollup={computed.rollup}
              rowNum={fullRowNum}
              collapsed={collapsed}
              selectedId={selectedId}
              violations={computed.violations}
              storageKey={activeId != null ? String(activeId) : undefined}
              onRowHeightsChange={setRowHeights}
              onInteractingChange={setTableInteracting}
              onSelect={setSelectedId}
              onToggleCollapse={toggleCollapse}
              onOpenDialog={setEditingId}
              onRename={onRename}
              onEditDuration={onEditDuration}
              onEditPercent={onEditPercent}
              onEditPredecessors={onEditPredecessors}
              onEditStart={onEditStart}
              onEditFin={onEditFin}
              onAddBelow={addAfter}
              onIndent={indentTask}
              onOutdent={outdentTask}
              onDuplicate={duplicateTask}
              onDelete={(id) => requestDelete(id)}
              pendingEdit={pendingEdit}
              onPendingEditConsumed={() => setPendingEdit(null)}
            />
          </div>
          <div className="shrink-0">
            <GanttChart
              rows={rows}
              schedule={computed.schedule}
              startDate={config.startDate}
              holidays={config.holidays}
              zoom={zoom}
              scale={scale}
              critical={showCritical ? computed.critical : undefined}
              violations={computed.violations}
              baselineBars={(config.baseline as { bars?: Record<string, { s: string; f: string }> } | null)?.bars ?? null}
              todayStr={new Date().toISOString().slice(0, 10)}
              selectedId={selectedId}
              workWeek={config.workWeek}
              onSelect={setSelectedId}
              onCommitTask={onCommitTask}
              onInteractingChange={setChartInteracting}
              rowTops={rowTops}
              rowHeights={heightsForChart ?? undefined}
            />
          </div>
          </div>
        </div>
      )}

      <CronogramaTaskDialog
        open={editingId != null}
        onOpenChange={(o) => !o && setEditingId(null)}
        task={editingTask}
        allTasks={tasks}
        labelOf={labelOf}
        onSave={applyDialogSave}
        onDelete={(id) => {
          setEditingId(null);
          requestDelete(id);
        }}
      />

      <CronogramaPasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        tasks={tasks}
        proj={{ startDate: config.startDate, workWeek: String(config.workWeek), holidays: config.holidays }}
        afterId={selectedId}
        onInsert={onPasteRows}
      />

      <AppDialog
        open={deleteConfirm != null}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
        size="confirm"
        title="Eliminar subárbol"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm != null && doDelete(deleteConfirm)}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm">Esta tarea tiene sub-tareas. ¿Eliminar la tarea y todo su subárbol?</p>
      </AppDialog>

      <PrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        config={config}
        rows={rows}
        computed={computed}
        showCritical={showCritical}
        fullRowNum={fullRowNum}
        onSavedAjustes={(aj: AjustesImpresion) =>
          setConfig((c) => (c ? { ...c, ajustesImpresion: aj } : c))
        }
      />
    </div>
  );
}
