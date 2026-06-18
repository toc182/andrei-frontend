// CronogramasIndexPage — top-level "Cronogramas" page: lists all cronogramas (project-attached
// and standalone), create a new one, import a {project, tasks} JSON, open or delete one.

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import { AppDialog } from '@/components/shell/AppDialog';
import { DatePicker } from '@/components/shell/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Upload, Trash2, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listCronogramas,
  createCronograma,
  importCronograma,
  deleteCronograma,
  type CronogramaListItem,
} from '@/lib/cronogramaApi';
import type { EngineTask } from '@/lib/cronogramaEngine';

interface Props {
  onNavigate: (view: string) => void;
}

const WORK_WEEKS: { v: number; label: string }[] = [
  { v: 5, label: '5 días' },
  { v: 6, label: '6 días' },
  { v: 7, label: '7 días' },
];

export default function CronogramasIndexPage({ onNavigate }: Props) {
  const [items, setItems] = useState<CronogramaListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [workWeek, setWorkWeek] = useState(5);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CronogramaListItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listCronogramas());
    } catch {
      setError('No se pudieron cargar los cronogramas.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const id = await createCronograma({ name: name.trim(), startDate, workWeek, holidays: [] });
      setCreateOpen(false);
      setName('');
      onNavigate(`cronograma-${id}`);
    } catch {
      setFormError('No se pudo crear el cronograma.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { project?: { startDate?: string; workWeek?: number | string; holidays?: string[]; name?: string }; tasks?: EngineTask[] };
      if (!parsed.project?.startDate || !Array.isArray(parsed.tasks)) {
        setError('El archivo no tiene el formato { project, tasks } esperado.');
        return;
      }
      const id = await importCronograma({
        project: parsed.project as { startDate: string; workWeek?: number | string; holidays?: string[]; name?: string },
        tasks: parsed.tasks,
        nombre: parsed.project.name || file.name.replace(/\.json$/i, ''),
      });
      onNavigate(`cronograma-${id}`);
    } catch {
      setError('No se pudo importar el archivo (JSON inválido o ciclo de dependencias).');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteCronograma(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Cronogramas" subtitle="Cronogramas de proyectos e independientes">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Importar JSON
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo cronograma
        </Button>
      </PageHeader>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyecto</TableHead>
              <TableHead className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tareas</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inicio</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          {items == null && !error ? (
            <TableSkeleton rows={5} columns={5} />
          ) : (
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <ErrorState description={error} onRetry={load} />
                  </TableCell>
                </TableRow>
              ) : items && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      icon={CalendarRange}
                      title="Sin cronogramas"
                      description="Crea uno nuevo o importa un archivo JSON para empezar."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                items?.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer border-b border-slate-100"
                    onClick={() => onNavigate(`cronograma-${c.id}`)}
                  >
                    <TableCell className="px-4 py-2.5 font-medium">{c.nombre}</TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {c.proyectoNombre || <span className="italic">Independiente</span>}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right tabular-nums">{c.taskCount}</TableCell>
                    <TableCell className="px-4 py-2.5 tabular-nums">{c.fechaInicio}</TableCell>
                    <TableCell className="px-2 py-2.5 text-right">
                      <button
                        className="rounded p-1.5 text-muted-foreground hover:bg-slate-50 hover:text-error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          )}
        </Table>
      </Card>

      {/* create dialog */}
      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        size="simple"
        title="Nuevo cronograma"
        description="Cronograma independiente (puedes vincularlo a un proyecto más adelante)."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={busy}>
              Crear
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <p className="text-sm text-error">{formError}</p>}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cronograma maestro" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha de inicio</label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Semana laboral</label>
            <div className="flex overflow-hidden rounded-md border border-border">
              {WORK_WEEKS.map((w) => (
                <button
                  key={w.v}
                  onClick={() => setWorkWeek(w.v)}
                  className={cn('px-3 py-1.5 text-sm', workWeek === w.v ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50')}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </AppDialog>

      {/* delete confirm */}
      <AppDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        size="confirm"
        title="Eliminar cronograma"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm">
          ¿Eliminar <strong>{deleteTarget?.nombre}</strong>? Esta acción se puede revertir reactivando el registro.
        </p>
      </AppDialog>
    </div>
  );
}
