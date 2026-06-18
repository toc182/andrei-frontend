// Create/edit a cronograma task: name, type, milestone type, duration, constraint/fixed date,
// % complete, parent (WBS), color, and predecessors (FS/SS/FF/SF + lag). Pure form — the
// workspace owns the task array, applies onSave, and persists.

import { useEffect, useMemo, useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { DatePicker } from '@/components/shell/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  EngineTask,
  TaskId,
  TaskType,
  MilestoneType,
  DepType,
  Predecessor,
} from '@/lib/cronogramaEngine';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: EngineTask | null;
  allTasks: EngineTask[];
  labelOf: (id: TaskId) => string; // "1.2 Nombre"
  onSave: (t: EngineTask) => void;
  onDelete?: (id: TaskId) => void;
}

const TYPES: { v: TaskType; label: string }[] = [
  { v: 'task', label: 'Tarea' },
  { v: 'group', label: 'Grupo' },
  { v: 'milestone', label: 'Hito' },
];
const DEP_TYPES: DepType[] = ['FS', 'SS', 'FF', 'SF'];
const SWATCHES = ['', '#4a90d9', '#0F766E', '#B45309', '#7c3aed', '#0F7B3A', '#B91C1C'];

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

export function CronogramaTaskDialog({ open, onOpenChange, task, allTasks, labelOf, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [milestoneType, setMilestoneType] = useState<MilestoneType>('calculated');
  const [duration, setDuration] = useState(1);
  const [manualDate, setManualDate] = useState('');
  const [percent, setPercent] = useState(0);
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [parentId, setParentId] = useState<string>(''); // select value; '' = root
  const [preds, setPreds] = useState<Predecessor[]>([]);

  useEffect(() => {
    if (!open || !task) return;
    setName(task.name ?? '');
    setType(task.type);
    setMilestoneType(task.milestoneType === 'fixed' ? 'fixed' : 'calculated');
    setDuration(task.duration ?? 1);
    setManualDate(task.manualDate ?? '');
    setPercent(task.percentComplete ?? 0);
    setColor(task.color ?? '');
    setNotes(task.notes ?? '');
    setParentId(task.parentId == null ? '' : String(task.parentId));
    setPreds((task.predecessors ?? []).map((p) => ({ ...p })));
  }, [open, task]);

  // Exclude self + descendants from parent/predecessor pickers (avoids the obvious cycles).
  const forbidden = useMemo(() => {
    if (!task) return new Set<TaskId>();
    const s = descendantsOf(task.id, allTasks);
    s.add(task.id);
    return s;
  }, [task, allTasks]);

  const parentOptions = useMemo(
    () => allTasks.filter((t) => t.type === 'group' && !forbidden.has(t.id)),
    [allTasks, forbidden],
  );
  const predOptions = useMemo(() => allTasks.filter((t) => !forbidden.has(t.id)), [allTasks, forbidden]);

  if (!task) return null;

  const isTask = type === 'task';
  const isMilestone = type === 'milestone';

  const handleSave = () => {
    const origId = task.id;
    const parent: TaskId | null =
      parentId === '' ? null : allTasks.find((t) => String(t.id) === parentId)?.id ?? null;
    onSave({
      ...task,
      id: origId,
      parentId: parent,
      type,
      milestoneType: isMilestone ? milestoneType : null,
      name: name.trim() || 'Sin nombre',
      duration: isTask ? Math.max(0, Math.round(duration)) : 0,
      manualDate: manualDate || null,
      percentComplete: isTask ? Math.max(0, Math.min(100, Math.round(percent))) : 0,
      color: color || null,
      notes: notes || null,
      predecessors: preds.filter((p) => p.taskId !== '' && p.taskId != null),
      order: task.order ?? 0,
    });
    onOpenChange(false);
  };

  const dateLabel = isMilestone
    ? milestoneType === 'fixed'
      ? 'Fecha (fija)'
      : 'Fecha (calculada — no editable)'
    : 'No comenzar antes de (opcional)';

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title={task.id != null && Number(task.id) > 0 ? 'Editar tarea' : 'Nueva tarea'}
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {onDelete && (
              <Button variant="ghost" className="text-error hover:text-error" onClick={() => { onDelete(task.id); onOpenChange(false); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tipo</label>
          <div className="flex overflow-hidden rounded-md border border-border w-fit">
            {TYPES.map((t) => (
              <button
                key={t.v}
                onClick={() => setType(t.v)}
                className={cn('px-3 py-1.5 text-sm', type === t.v ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isMilestone && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de hito</label>
            <div className="flex overflow-hidden rounded-md border border-border w-fit">
              {(['calculated', 'fixed'] as MilestoneType[]).map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMilestoneType(mt)}
                  className={cn('px-3 py-1.5 text-sm', milestoneType === mt ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50')}
                >
                  {mt === 'calculated' ? 'Calculado' : 'Fecha fija'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {isTask && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Duración (días)</label>
              <Input type="number" min={0} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          )}
          {isTask && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">% completado</label>
              <Input type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
            </div>
          )}
        </div>

        {type !== 'group' && !(isMilestone && milestoneType === 'calculated') && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{dateLabel}</label>
            <div className="flex items-center gap-2">
              <DatePicker value={manualDate} onChange={setManualDate} />
              {manualDate && (
                <Button variant="ghost" size="sm" onClick={() => setManualDate('')}>Limpiar</Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Dentro de (grupo padre)</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">(Raíz)</option>
            {parentOptions.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{labelOf(p.id)}</option>
            ))}
          </select>
        </div>

        {!isMilestone && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c || 'none'}
                  onClick={() => setColor(c)}
                  title={c || 'Predeterminado'}
                  className={cn('h-6 w-6 rounded border', color === c ? 'ring-2 ring-ring' : '')}
                  style={{ background: c || 'repeating-linear-gradient(45deg,#fff,#fff 3px,#e2e8f0 3px,#e2e8f0 6px)' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Predecessors */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Predecesoras</label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreds([...preds, { taskId: predOptions[0]?.id ?? '', type: 'FS', lag: 0 }])}
              disabled={predOptions.length === 0}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
          {preds.length === 0 && <p className="text-sm text-muted-foreground">Sin predecesoras.</p>}
          <div className="space-y-2">
            {preds.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={String(p.taskId)}
                  onChange={(e) => {
                    const id = predOptions.find((t) => String(t.id) === e.target.value)?.id;
                    setPreds(preds.map((x, j) => (j === i ? { ...x, taskId: id ?? x.taskId } : x)));
                  }}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {predOptions.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>{labelOf(t.id)}</option>
                  ))}
                </select>
                <select
                  value={p.type}
                  onChange={(e) => setPreds(preds.map((x, j) => (j === i ? { ...x, type: e.target.value as DepType } : x)))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {DEP_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={p.lag}
                  onChange={(e) => setPreds(preds.map((x, j) => (j === i ? { ...x, lag: Number(e.target.value) } : x)))}
                  className="w-20"
                  title="Lag (días hábiles)"
                />
                <Button variant="ghost" size="icon" onClick={() => setPreds(preds.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
