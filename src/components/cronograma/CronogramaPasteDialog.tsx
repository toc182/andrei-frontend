// "Pegar filas…" dialog — paste a presupuesto range from Excel and insert many cronograma rows at
// once. Reads only; nothing is written until Insertar, and the workspace turns the whole batch into
// ONE commit (one undo, one autosave). Flow: Textarea -> per-column role mapping (auto-guessed from
// a header row) -> date-format + hierarchy-mode selectors -> a live, debounced preview built by
// running the REAL insert (previewPasteBatch) on a throwaway clone, so what you see is exactly what
// Insertar will do. Every fallback surfaces as a per-row badge and an aggregate counter; blocked
// rows are never inserted implicitly — the user fixes them, marks Ignorar, or ticks the opt-in.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { EmptyState } from '@/components/shell/states';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeSchedule, type EngineProject, type EngineTask, type TaskId } from '@/lib/cronogramaEngine';
import { parseTsv } from '@/lib/cronogramaPasteTsv';
import type { DateOrder } from '@/lib/cronogramaPasteDates';
import type { HierMode } from '@/lib/cronogramaPasteHierarchy';
import { MAX_PASTE_ROWS, parsePaste, type IssueLevel, type PasteMapping, type ResolvedPasteRow } from '@/lib/cronogramaPaste';
import { previewPasteBatch } from '@/lib/cronogramaTaskOps';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: EngineTask[]; // live tree, cloned for the preview + used for placement
  proj: EngineProject;
  afterId: TaskId | null; // current selection -> where the batch lands
  onInsert: (rows: ResolvedPasteRow[]) => void; // workspace commits the batch
}

type Role = 'name' | 'dias' | 'inicio' | 'fin' | 'nivel' | 'ignore';

const ROLE_LABELS: Record<Role, string> = {
  name: 'Nombre',
  dias: 'Días',
  inicio: 'Inicio',
  fin: 'Fin',
  nivel: 'Nivel',
  ignore: 'Ignorar',
};

const MODE_LABELS: Record<'auto' | HierMode, string> = {
  auto: 'Automático',
  nivel: 'Columna Nivel',
  wbs: 'Numeración WBS',
  'empty-cols': 'Columnas en blanco',
  whitespace: 'Sangría',
  flat: 'Plano (sin niveles)',
};

const PREVIEW_CAP = 200;
const orderLabel = (o: DateOrder) => (o === 'dmy' ? 'dd/mm/aaaa' : 'mm/dd/aaaa');

function guessRole(header: string): Role {
  const h = header.toLowerCase().trim();
  if (/nombre|descrip|tarea|activ|concepto|partida|rubro|it[eé]m/.test(h)) return 'name';
  if (/d[ií]as|duraci|\bdur\b/.test(h)) return 'dias';
  if (/inicio|comien|start|desde/.test(h)) return 'inicio';
  if (/\bfin\b|t[eé]rmino|end|hasta/.test(h)) return 'fin';
  if (/nivel|wbs|level/.test(h)) return 'nivel';
  return 'ignore';
}

function autoGuessRoles(grid: string[][], headerRow: boolean): Role[] {
  const numCols = grid[0]?.length ?? 0;
  let roles: Role[] = headerRow && grid[0] ? grid[0].map(guessRole) : Array(numCols).fill('ignore');
  // Enforce uniqueness (first column claiming a role wins; the rest fall back to Ignorar).
  const seen = new Set<Role>();
  roles = roles.map((r) => {
    if (r === 'ignore') return r;
    if (seen.has(r)) return 'ignore';
    seen.add(r);
    return r;
  });
  if (numCols > 0 && !roles.includes('name')) roles[0] = 'name';
  return roles;
}

function deriveMapping(roles: Role[]): PasteMapping {
  const at = (r: Role) => {
    const i = roles.indexOf(r);
    return i >= 0 ? i : null;
  };
  return { name: at('name'), dias: at('dias'), inicio: at('inicio'), fin: at('fin'), nivel: at('nivel') };
}

function nextTempBelow(tasks: EngineTask[]): number {
  let min = -1;
  for (const t of tasks) if (typeof t.id === 'number' && t.id < min) min = t.id;
  return min - 1;
}

const BADGE_CLASS: Record<IssueLevel | 'ok', string> = {
  blocking: 'bg-error/10 text-error border-error/30',
  warn: 'bg-warning/10 text-warning border-warning/30',
  info: 'bg-info/10 text-info border-info/30',
  ok: 'bg-success/10 text-success border-success/30',
};
const BADGE_TEXT: Record<IssueLevel | 'ok', string> = { blocking: 'Error', warn: 'Aviso', info: 'Nota', ok: 'OK' };

function worstLevel(row: ResolvedPasteRow): IssueLevel | 'ok' {
  if (row.issues.some((i) => i.level === 'blocking')) return 'blocking';
  if (row.issues.some((i) => i.level === 'warn')) return 'warn';
  if (row.issues.some((i) => i.level === 'info')) return 'info';
  return 'ok';
}

export function CronogramaPasteDialog({ open, onOpenChange, tasks, proj, afterId, onInsert }: Props) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [headerRow, setHeaderRow] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dateFormat, setDateFormat] = useState<DateOrder>('dmy');
  const [modeSel, setModeSel] = useState<'auto' | HierMode>('auto');
  const [ignore, setIgnore] = useState<Set<number>>(new Set());
  const [optIn, setOptIn] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset everything when the dialog closes so it always reopens fresh.
  useEffect(() => {
    if (!open) {
      setText('');
      setDebounced('');
      setIgnore(new Set());
      setOptIn(false);
      setModeSel('auto');
    } else {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  // ~150ms debounce on typing before the (potentially heavy) reparse + trial schedule.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 150);
    return () => clearTimeout(t);
  }, [text]);

  const grid = useMemo(() => parseTsv(debounced), [debounced]);
  const numCols = grid[0]?.length ?? 0;

  // Auto-map columns whenever the paste shape or the header toggle changes (user edits persist until
  // the next paste). Clearing ignore/opt-in here keeps a stale omission from surviving a re-map.
  useEffect(() => {
    setRoles(autoGuessRoles(grid, headerRow));
    setIgnore(new Set());
    setOptIn(false);
  }, [grid, headerRow]);

  const mapping = useMemo(() => deriveMapping(roles), [roles]);
  const mode = modeSel === 'auto' ? undefined : modeSel;

  // Memoized parse + trial insert on a clone. Running the REAL previewPasteBatch guarantees the
  // preview and the committed insert are the same code path (orders, promotion, Fin->duration).
  const preview = useMemo(() => {
    if (!debounced.trim()) return null;
    const parsed = parsePaste(debounced, { mapping, headerRow, dateFormat, mode });
    const included = parsed.rows.filter((r) => !r.blocked && !ignore.has(r.sourceRow));
    const clone: EngineTask[] = structuredClone(tasks);
    let n = nextTempBelow(clone);
    const report = previewPasteBatch(included, { afterId }, proj, clone, () => n--);
    const schedule = computeSchedule(clone, proj);
    const cloneById = new Map(clone.map((t) => [t.id, t]));
    const metaBySource = new Map(report.meta.map((m) => [m.sourceRow, m]));
    const collapsed = new Set(report.collapsed);
    return { parsed, included, report, schedule, cloneById, metaBySource, collapsed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, JSON.stringify(mapping), headerRow, dateFormat, mode, [...ignore].join(','), tasks, JSON.stringify(proj), afterId]);

  const parsed = preview?.parsed ?? null;
  const conflictCol = parsed?.dateInicio?.conflict ? parsed.dateInicio : parsed?.dateFin?.conflict ? parsed.dateFin : null;
  const conflict = conflictCol?.conflict ?? null;
  const blocked = parsed?.counters.blocked ?? 0;
  const includedCount = preview?.included.length ?? 0;
  const totalRows = parsed?.rows.length ?? 0;

  const canInsert = !!preview && includedCount > 0 && !conflict && (blocked === 0 || optIn);

  const handleInsert = () => {
    if (!preview || !canInsert) return;
    onInsert(preview.included);
    onOpenChange(false);
  };

  const toggleIgnore = (sourceRow: number) =>
    setIgnore((prev) => {
      const next = new Set(prev);
      if (next.has(sourceRow)) next.delete(sourceRow);
      else next.add(sourceRow);
      return next;
    });

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="complex"
      title="Pegar filas"
      description="Pega un rango de Excel (Nombre, Días, Inicio, Fin, Nivel). Nada se inserta hasta confirmar."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleInsert} disabled={!canInsert}>
            <ClipboardPaste className="mr-2 h-4 w-4" />
            {includedCount > 0 ? `Insertar ${includedCount} fila${includedCount === 1 ? '' : 's'}` : 'Insertar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Pega aquí…\nExcavación\t5\t15/03/2026\nCimientos\t8'}
          className="min-h-28 font-mono text-xs"
        />

        {/* Options row: header toggle, date format, hierarchy mode */}
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={headerRow} onCheckedChange={setHeaderRow} />
            Primera fila es encabezado
          </label>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Formato de fecha</label>
            <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as DateOrder)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dmy">dd/mm/aaaa</SelectItem>
                <SelectItem value="mdy">mm/dd/aaaa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Niveles</label>
            <Select value={modeSel} onValueChange={(v) => setModeSel(v as 'auto' | HierMode)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABELS) as ('auto' | HierMode)[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Per-column role mapping */}
        {numCols > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Columnas</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: numCols }, (_, j) => (
                <div key={j} className="w-[150px] rounded-md border border-border bg-card p-2">
                  <p className="mb-1 truncate text-xs text-muted-foreground" title={headerRow ? grid[0]?.[j] : `Columna ${j + 1}`}>
                    {headerRow && grid[0]?.[j]?.trim() ? grid[0][j] : `Columna ${j + 1}`}
                  </p>
                  <Select
                    value={roles[j] ?? 'ignore'}
                    onValueChange={(v) =>
                      setRoles((prev) =>
                        prev.map((r, i) => (i === j ? (v as Role) : v !== 'ignore' && r === (v as Role) ? 'ignore' : r)),
                      )
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detected-mode rationale + low-confidence warning */}
        {parsed && (
          <p className="text-sm text-muted-foreground">
            {parsed.detection.rationale}
            {modeSel !== 'auto' && ' (modo forzado)'}
          </p>
        )}
        {parsed?.detection.lowConfidence && (
          <Alert
            variant="warning"
            title="Baja confianza en la jerarquía"
            description="Los niveles detectados podrían no ser correctos. Revísalos o cambia el modo de niveles."
          />
        )}

        {/* Date-format conflict: block insert until the user aligns the selector (one click). */}
        {conflict && conflictCol && (
          <Alert
            variant="warning"
            title="Formato de fecha en conflicto"
            description={conflict}
            actions={
              <Button size="sm" onClick={() => setDateFormat(conflictCol.resolvedOrder)}>
                Usar {orderLabel(conflictCol.resolvedOrder)}
              </Button>
            }
          />
        )}

        {/* Row-cap notice */}
        {parsed?.truncated && (
          <Alert
            variant="warning"
            title="Demasiadas filas"
            description={`Se pegaron ${parsed.counters.totalPasted} filas; solo se procesan las primeras ${totalRows} (máx. ${MAX_PASTE_ROWS}).`}
          />
        )}

        {/* Preview */}
        {!preview ? (
          <EmptyState icon={ClipboardPaste} title="Vista previa" description="Pega filas arriba para ver cómo quedarán." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                    <TableHead className="w-8 px-3 py-2.5" />
                    <TableHead className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</TableHead>
                    <TableHead className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</TableHead>
                    <TableHead className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inicio</TableHead>
                    <TableHead className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fin</TableHead>
                    <TableHead className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Días</TableHead>
                    <TableHead className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed!.rows.slice(0, PREVIEW_CAP).map((row) => {
                    const excluded = row.blocked || ignore.has(row.sourceRow);
                    const meta = preview.metaBySource.get(row.sourceRow);
                    const sched = meta ? preview.schedule.get(meta.id) : null;
                    const task = meta ? preview.cloneById.get(meta.id) : null;
                    const lvl = worstLevel(row);
                    const collapsed = meta ? preview.collapsed.has(meta.id) : false;
                    const computedStart = sched?.s ?? null;
                    const startDiffers = !!(row.manualDate && computedStart && computedStart !== row.manualDate && !meta?.promotedToGroup);
                    return (
                      <TableRow key={row.sourceRow} className={cn('border-b border-slate-100 last:border-0', excluded && 'opacity-50')}>
                        <TableCell className="px-3 py-2">
                          <Checkbox
                            checked={ignore.has(row.sourceRow)}
                            onCheckedChange={() => toggleIgnore(row.sourceRow)}
                            disabled={row.blocked}
                            aria-label="Ignorar fila"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge variant="outline" className={BADGE_CLASS[lvl]}>
                            {BADGE_TEXT[lvl]}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <span className="block truncate" style={{ paddingLeft: row.depth * 16 }} title={row.name}>
                            {meta?.promotedToGroup ? <span className="font-semibold">{row.name}</span> : row.name || <span className="text-muted-foreground">(sin nombre)</span>}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2 tabular-nums">
                          {meta?.promotedToGroup && row.manualDate ? (
                            <span className="text-muted-foreground line-through" title="La fecha del grupo se movió a su primera tarea">
                              {row.manualDate}
                            </span>
                          ) : startDiffers ? (
                            <span className="text-info" title={`Fecha indicada ${row.manualDate} es un mínimo; el motor calcula ${computedStart}`}>
                              {computedStart}
                            </span>
                          ) : (
                            computedStart ?? row.manualDate ?? <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className={cn('px-3 py-2 tabular-nums', collapsed && 'text-warning')}>
                          {sched?.f ?? row.fin ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums" title={row.durationSource}>
                          {meta && task?.type !== 'group' ? task?.duration ?? row.duration : '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                          {row.issues.map((i) => i.message).join(' · ')}
                          {collapsed && ' · Fin antes del inicio: duración 1'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalRows > PREVIEW_CAP && (
              <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                +{totalRows - PREVIEW_CAP} filas más (no mostradas)
              </div>
            )}
            {/* Aggregate counters */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">{totalRows} fila{totalRows === 1 ? '' : 's'}</span>
              <span className="tabular-nums text-success">{includedCount} a insertar</span>
              {blocked > 0 && <span className="tabular-nums text-error">{blocked} con error</span>}
              {parsed!.counters.assumedDefault > 0 && <span className="tabular-nums">{parsed!.counters.assumedDefault} duración asumida (5)</span>}
              {parsed!.counters.diasWinsOverFin > 0 && <span className="tabular-nums">{parsed!.counters.diasWinsOverFin} Días sobre Fin</span>}
              {parsed!.counters.depthClamped > 0 && <span className="tabular-nums">{parsed!.counters.depthClamped} nivel ajustado</span>}
            </div>
          </Card>
        )}

        {/* Opt-in to insert despite blocked rows */}
        {blocked > 0 && (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox checked={optIn} onCheckedChange={(v) => setOptIn(v === true)} className="mt-0.5" />
            <span>
              Insertar {includedCount} de {totalRows} (omitir {blocked} con {blocked === 1 ? 'error' : 'errores'})
            </span>
          </label>
        )}
      </div>
    </AppDialog>
  );
}
