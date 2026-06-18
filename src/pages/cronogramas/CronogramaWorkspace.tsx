// CronogramaWorkspace — editor/viewer for one cronograma. Used by the standalone route
// (cronogramaId) and the per-project tab (projectId + embedded). Holds an editable
// {config, tasks} model, recomputes the schedule live with the shared engine, and persists
// via the backend (which re-validates and rejects cycles). WBS table + Gantt chart side by side.
//
// Editing supported: add / edit / delete tasks (name, type, duration, dates, %, parent,
// predecessors) + explicit Save. Drag-to-reschedule and undo are later milestones.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState } from '@/components/shell/states';
import { Alert } from '@/components/shell/Alert';
import { AppDialog } from '@/components/shell/AppDialog';
import { DatePicker } from '@/components/shell/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Plus, CalendarRange, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  computeSchedule,
  computeRollup,
  checkViolations,
  computeCritical,
  hasCycle,
  type TaskId,
  type EngineTask,
} from '@/lib/cronogramaEngine';
import { buildRows } from '@/lib/cronogramaModel';
import { GanttChart, type Zoom } from '@/components/cronograma/GanttChart';
import { CronogramaWbsTable } from '@/components/cronograma/CronogramaWbsTable';
import { CronogramaTaskDialog } from '@/components/cronograma/CronogramaTaskDialog';
import {
  getCronograma,
  listCronogramas,
  createCronograma,
  saveCronograma,
  exportCronograma,
  type CronogramaConfig,
  type CronogramaListItem,
} from '@/lib/cronogramaApi';

interface Props {
  cronogramaId?: number;
  projectId?: number;
  embedded?: boolean;
  onNavigate?: (view: string) => void;
}

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

const ZOOMS: { key: Zoom; label: string }[] = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'quarter', label: 'Trimestre' },
];

export default function CronogramaWorkspace({ cronogramaId, projectId, onNavigate }: Props) {
  const [activeId, setActiveId] = useState<number | null>(cronogramaId ?? null);
  const [projectList, setProjectList] = useState<CronogramaListItem[] | null>(null);

  const [config, setConfig] = useState<CronogramaConfig | null>(null);
  const [tasks, setTasks] = useState<EngineTask[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>('week');
  const [selectedId, setSelectedId] = useState<TaskId | null>(null);

  const [editing, setEditing] = useState<EngineTask | null>(null);
  const [editIsNew, setEditIsNew] = useState(false);
  const tempId = useRef(-1);

  // Create-attached-cronograma dialog (project tab).
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState(new Date().toISOString().slice(0, 10));
  const [newWW, setNewWW] = useState(5);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

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

  // Load the active cronograma into editable state.
  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const d = await getCronograma(id);
      setConfig(d.project);
      setTasks(d.tasks);
      setDirty(false);
    } catch {
      setError('No se pudo cargar el cronograma.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeId != null) load(activeId);
  }, [activeId, load]);

  // Live recompute from the in-memory model.
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

  const rows = useMemo(() => buildRows(tasks), [tasks]);
  const labelOf = useCallback(
    (id: TaskId) => {
      const r = rows.find((x) => x.task.id === id);
      return r ? `${r.wbs} ${r.task.name}` : String(id);
    },
    [rows],
  );

  // ----- editing actions -----
  const openEdit = (id: TaskId) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    setSelectedId(id);
    setEditing(t);
    setEditIsNew(false);
  };

  const openAdd = () => {
    const sel = selectedId != null ? tasks.find((t) => t.id === selectedId) : null;
    const parentId: TaskId | null = sel ? (sel.type === 'group' ? sel.id : sel.parentId ?? null) : null;
    const siblings = tasks.filter((t) => (t.parentId ?? null) === (parentId ?? null));
    const order = siblings.length ? Math.max(...siblings.map((t) => t.order ?? 0)) + 1 : 0;
    const fresh: EngineTask = {
      id: tempId.current--,
      parentId,
      type: 'task',
      milestoneType: null,
      name: '',
      duration: 1,
      manualDate: null,
      percentComplete: 0,
      color: null,
      notes: null,
      predecessors: [],
      order,
    };
    setEditing(fresh);
    setEditIsNew(true);
  };

  const applyTaskEdit = (updated: EngineTask) => {
    setTasks((prev) =>
      editIsNew ? [...prev, updated] : prev.map((t) => (t.id === updated.id ? updated : t)),
    );
    setDirty(true);
    setSelectedId(updated.id);
  };

  const deleteTask = (id: TaskId) => {
    const toRemove = descendantsOf(id, tasks);
    toRemove.add(id);
    setTasks((prev) =>
      prev
        .filter((t) => !toRemove.has(t.id))
        .map((t) => ({ ...t, predecessors: (t.predecessors || []).filter((p) => !toRemove.has(p.taskId)) })),
    );
    setDirty(true);
    if (selectedId != null && toRemove.has(selectedId)) setSelectedId(null);
  };

  const handleSave = async () => {
    if (!config || !activeId) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await saveCronograma(activeId, {
        project: {
          name: config.name,
          proyectoId: config.proyectoId,
          startDate: config.startDate,
          workWeek: config.workWeek,
          holidays: config.holidays,
          baseline: config.baseline,
        },
        tasks,
      });
      setConfig(res.project);
      setTasks(res.tasks);
      setDirty(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveErr(msg || 'No se pudo guardar.');
    } finally {
      setSaving(false);
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

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      <PageHeader title={config.name} subtitle={config.proyectoId ? undefined : 'Cronograma independiente'}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            {ZOOMS.map((z) => (
              <button
                key={z.key}
                onClick={() => setZoom(z.key)}
                className={cn('px-3 py-1.5 text-sm', zoom === z.key ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50')}
              >
                {z.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Agregar tarea
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || computed.cycle || saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCronograma(config.id, `${config.name}.gantto.json`)}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          {onNavigate && (
            <Button size="sm" variant="ghost" onClick={() => onNavigate('cronogramas')}>
              Volver
            </Button>
          )}
        </div>
      </PageHeader>

      {computed.cycle && (
        <Alert
          variant="error"
          title="Ciclo de dependencias"
          description="Hay una dependencia circular; corrígela para poder calcular fechas y guardar."
        />
      )}
      {saveErr && <Alert variant="error" title="No se pudo guardar" description={saveErr} />}

      {tasks.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Cronograma vacío"
          description="Agrega la primera tarea para empezar."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Agregar tarea
            </Button>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card">
            <CronogramaWbsTable
              rows={rows}
              schedule={computed.schedule}
              rollup={computed.rollup}
              onSelect={openEdit}
              selectedId={selectedId}
            />
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <GanttChart
              rows={rows}
              schedule={computed.schedule}
              startDate={config.startDate}
              workWeek={config.workWeek}
              holidays={config.holidays}
              zoom={zoom}
              critical={computed.critical}
              violations={computed.violations}
              baselineBars={(config.baseline as { bars?: Record<string, { s: string; f: string }> } | null)?.bars ?? null}
              todayStr={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>
      )}

      <CronogramaTaskDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        task={editing}
        allTasks={tasks}
        labelOf={labelOf}
        onSave={applyTaskEdit}
        onDelete={editIsNew ? undefined : deleteTask}
      />
    </div>
  );
}
