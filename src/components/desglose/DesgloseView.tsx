// DesgloseView — the price-breakdown tree editor rendered inside the
// Información tab (Desglose section). Flow: getDesglose -> wireToRows -> flat
// editor rows -> edit locally -> toWireItems -> saveDesglose on Guardar.
// Nothing touches the server on load edits or paste — only Guardar writes.
// Tree mutations (indent/outdent/move/delete) are pure index-range edits over
// the flat `rows` array; DesgloseTableRow owns only per-row rendering and
// enablement checks, the actual mutation logic lives here since it owns state.

import { useCallback, useEffect, useState } from 'react';
import { Plus, ClipboardPaste, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert } from '@/components/shell/Alert';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import {
  computeTotals, toWireItems, indentLegal, outdentLegal, moveSubtree, GRAND_TOTAL_KEY,
  type DesgloseRow,
} from '@/lib/desgloseModel';
import {
  getDesglose, saveDesglose, wireToRows, DesgloseConflictError, type DesgloseMeta,
} from '@/lib/desgloseApi';
import { DesglosePasteDialog } from './DesglosePasteDialog';
import { DesgloseTableRow } from './DesgloseRowActions';

interface DesgloseViewProps {
  proyectoId: number;
}

/** Exclusive end index of the subtree rooted at rows[i] (row i + every
 *  following row with depth > rows[i].depth). */
function subtreeEnd(rows: DesgloseRow[], i: number): number {
  const depth = rows[i].depth;
  let j = i + 1;
  while (j < rows.length && rows[j].depth > depth) j++;
  return j;
}
function shiftDepth(rows: DesgloseRow[], i: number, j: number, delta: number): DesgloseRow[] {
  return rows.map((r, idx) => (idx >= i && idx < j ? { ...r, depth: r.depth + delta } : r));
}

const HEADER_CELL = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export function DesgloseView({ proyectoId }: DesgloseViewProps) {
  const [rows, setRows] = useState<DesgloseRow[]>([]);
  const [meta, setMeta] = useState<DesgloseMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [indentConfirm, setIndentConfirm] = useState<{ index: number; parentIndex: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ index: number; count: number } | null>(null);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

  const fetchDesglose = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const doc = await getDesglose(proyectoId);
      setRows(doc ? wireToRows(doc.items) : []);
      setMeta(doc ? doc.desglose : null);
      setDirty(false);
    } catch {
      setErr('No se pudo cargar el desglose.');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    fetchDesglose();
  }, [fetchDesglose]);

  const totals = computeTotals(rows);

  const updateRow = (i: number, patch: Partial<DesgloseRow>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = (tipo: 'item' | 'grupo') => {
    const nextId = Math.max(0, ...rows.map((r) => r.tempId)) + 1;
    setRows([...rows, {
      tempId: nextId, depth: 0, tipo, item: '', descripcion: '', unidad: null, cantidad: null, precioUnitario: null,
    }]);
    setDirty(true);
  };

  const indent = (i: number) => {
    if (!indentLegal(rows, i)) return;
    const depth = rows[i].depth;
    let k = i - 1;
    while (k >= 0 && rows[k].depth > depth) k--;
    if (rows[k].tipo === 'item') {
      setIndentConfirm({ index: i, parentIndex: k });
      return;
    }
    setRows(shiftDepth(rows, i, subtreeEnd(rows, i), 1));
    setDirty(true);
  };

  const confirmIndent = () => {
    if (!indentConfirm) return;
    const { index, parentIndex } = indentConfirm;
    const j = subtreeEnd(rows, index);
    const promoted = rows.map((r, idx) =>
      (idx === parentIndex ? { ...r, tipo: 'grupo' as const, cantidad: null, precioUnitario: null } : r));
    setRows(shiftDepth(promoted, index, j, 1));
    setDirty(true);
    setIndentConfirm(null);
  };

  const outdent = (i: number) => {
    if (!outdentLegal(rows, i)) return;
    setRows(shiftDepth(rows, i, subtreeEnd(rows, i), -1));
    setDirty(true);
  };

  const moveUp = (i: number) => {
    const next = moveSubtree(rows, i, -1);
    if (next !== rows) { setRows(next); setDirty(true); }
  };
  const moveDown = (i: number) => {
    const next = moveSubtree(rows, i, 1);
    if (next !== rows) { setRows(next); setDirty(true); }
  };

  const requestDelete = (i: number) => {
    const j = subtreeEnd(rows, i);
    const count = j - i - 1;
    if (count > 0) { setDeleteConfirm({ index: i, count }); return; }
    setRows([...rows.slice(0, i), ...rows.slice(j)]);
    setDirty(true);
  };
  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { index } = deleteConfirm;
    setRows([...rows.slice(0, index), ...rows.slice(subtreeEnd(rows, index))]);
    setDirty(true);
    setDeleteConfirm(null);
  };

  const handlePasteConfirm = (pasted: DesgloseRow[]) => {
    const base = Math.max(0, ...rows.map((r) => r.tempId));
    setRows([...rows, ...pasted.map((r, idx) => ({ ...r, tempId: base + idx + 1 }))]);
    setDirty(true);
  };

  const handleSave = async () => {
    setBusy(true);
    setSaveErr(null);
    try {
      const doc = await saveDesglose(proyectoId, meta?.updatedAt ?? null, toWireItems(rows));
      setRows(wireToRows(doc.items));
      setMeta(doc.desglose);
      setDirty(false);
    } catch (e) {
      if (e instanceof DesgloseConflictError) setConflictMsg(e.message);
      else setSaveErr('No se pudo guardar; intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const confirmReload = () => {
    setReloadConfirmOpen(false);
    setConflictMsg(null);
    setSaveErr(null);
    fetchDesglose();
  };

  const headerRow = (
    <TableHeader>
      <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
        <TableHead className={HEADER_CELL}>Item</TableHead>
        <TableHead className={HEADER_CELL}>Descripción</TableHead>
        <TableHead className={HEADER_CELL}>Unidad</TableHead>
        <TableHead className={cn(HEADER_CELL, 'text-right')}>Cantidad</TableHead>
        <TableHead className={cn(HEADER_CELL, 'text-right')}>P.U.</TableHead>
        <TableHead className={cn(HEADER_CELL, 'text-right')}>Total</TableHead>
        <TableHead className="w-[160px] px-2 py-2.5" />
      </TableRow>
    </TableHeader>
  );

  if (loading) {
    return (
      <Card className="overflow-hidden p-0">
        <Table>
          {headerRow}
          <TableSkeleton rows={5} columns={7} />
        </Table>
      </Card>
    );
  }

  if (err) {
    return (
      <Card className="overflow-hidden p-0">
        <ErrorState title="No se pudo cargar el desglose" description={err} onRetry={fetchDesglose} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {conflictMsg && (
        <Alert
          variant="error"
          title="Conflicto al guardar"
          description={conflictMsg}
          actions={<Button size="sm" variant="outline" onClick={() => setReloadConfirmOpen(true)}>Recargar</Button>}
        />
      )}
      {saveErr && <Alert variant="error" title={saveErr} />}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => addRow('item')}>
              <Plus className="mr-2 h-4 w-4" /> Agregar fila
            </Button>
            <Button variant="outline" size="sm" onClick={() => addRow('grupo')}>
              <Plus className="mr-2 h-4 w-4" /> Agregar grupo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="mr-2 h-4 w-4" /> Pegar desde Excel
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
            <Button size="sm" onClick={handleSave} disabled={!dirty || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Este proyecto aún no tiene desglose"
            description="Agrega filas manualmente o pega un rango copiado de Excel."
            action={
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => addRow('item')}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar filas
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
                  <ClipboardPaste className="mr-2 h-4 w-4" /> Pegar desde Excel
                </Button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              {headerRow}
              <TableBody>
                {rows.map((r, i) => (
                  <DesgloseTableRow
                    key={r.tempId}
                    rows={rows}
                    index={i}
                    total={totals.get(r.tempId) ?? 0}
                    onChange={updateRow}
                    onIndent={indent}
                    onOutdent={outdent}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    onDelete={requestDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>{rows.length} fila{rows.length === 1 ? '' : 's'}</span>
          <span className="font-semibold tabular-nums text-foreground">
            Total: {formatMoney(totals.get(GRAND_TOTAL_KEY) ?? 0)}
          </span>
        </div>
      </Card>

      <DesglosePasteDialog open={pasteOpen} onOpenChange={setPasteOpen} onConfirm={handlePasteConfirm} />

      <AlertDialog open={indentConfirm !== null} onOpenChange={(o) => { if (!o) setIndentConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir en grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              La fila sobre la que quieres indentar es un ítem con cantidad y precio unitario. Para
              anidar bajo ella, se convertirá en grupo y su cantidad y precio unitario se borrarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIndent}>Convertir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar fila?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también sus {deleteConfirm?.count} sub-fila{deleteConfirm?.count === 1 ? '' : 's'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reloadConfirmOpen} onOpenChange={setReloadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios locales?</AlertDialogTitle>
            <AlertDialogDescription>
              Se recargará el desglose desde el servidor y se perderán los cambios sin guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReload}>Recargar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
