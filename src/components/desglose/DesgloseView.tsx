// DesgloseView — the price-breakdown tree editor rendered inside the
// Información tab (Desglose section). Flow: getDesglose -> wireToRows -> flat
// editor rows -> edit locally -> toWireItems -> saveDesglose on Guardar.
// Nothing touches the server on edits or paste — only Guardar writes.
//
// Architecture: ALL tree mutations (indent/outdent/move/delete) are pure,
// spec-gated ops in desgloseModel.ts that signal illegality by returning the
// SAME array reference. This component keeps only state + dialog
// orchestration: per-row enablement is precomputed in one O(N) pass and
// passed to memoized DesgloseTableRow rows, and every row callback is
// identity-stable (useCallback over a latest-rows ref) so editing one cell
// never re-renders the others.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  computeTotals, toWireItems, indentLegal, subtreeEnd, indentRows, indentParentIndex,
  outdentRows, deleteSubtree, moveSubtree, GRAND_TOTAL_KEY, type DesgloseRow,
} from '@/lib/desgloseModel';
import {
  getDesglose, saveDesglose, wireToRows, DesgloseConflictError, type DesgloseMeta,
} from '@/lib/desgloseApi';
import { DesglosePasteDialog } from './DesglosePasteDialog';
import { DesgloseTableRow, type DesgloseRowFlags } from './DesgloseTableRow';

interface DesgloseViewProps {
  proyectoId: number;
  /** Reports dirty-state transitions (and false on unmount) so the parent can
   *  guard its internal navigation against losing unsaved changes. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface LoadError {
  message: string;
  /** 403 — permission denied; no retry button (retrying cannot succeed). */
  forbidden: boolean;
}

const HEADER_CELL = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export function DesgloseView({ proyectoId, onDirtyChange }: DesgloseViewProps) {
  const [rows, setRows] = useState<DesgloseRow[]>([]);
  const [meta, setMeta] = useState<DesgloseMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<LoadError | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [indentConfirm, setIndentConfirm] = useState<{ index: number; parentIndex: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ index: number; count: number } | null>(null);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

  // Latest-rows ref: the row callbacks below must be identity-stable for
  // React.memo yet always operate on the CURRENT rows — a stale closure could
  // resurrect deleted rows or move the wrong subtree.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // ----- load (with stale-response guard: only the newest request may land) -----
  const fetchSeq = useRef(0);
  const fetchDesglose = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setErr(null);
    try {
      const doc = await getDesglose(proyectoId);
      if (seq !== fetchSeq.current) return; // a newer fetch owns the state now
      setRows(doc ? wireToRows(doc.items) : []);
      setMeta(doc ? doc.desglose : null);
      setDirty(false);
      setLoading(false);
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      const status = (e as { response?: { status?: number } }).response?.status;
      setErr(status === 403
        ? { message: 'No tienes permiso para ver el desglose.', forbidden: true }
        : { message: 'No se pudo cargar el desglose.', forbidden: false });
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    fetchDesglose();
  }, [fetchDesglose]);

  // ----- dirty reporting + native unload guard -----
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue for the native prompt
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ----- per-row flags: ONE O(N) pass (totals + sibling/indent/outdent legality) -----
  const { rowFlags, grandTotal } = useMemo(() => {
    const totals = computeTotals(rows);
    const rowFlags: DesgloseRowFlags[] = rows.map((r) => ({
      canIndent: false,
      needsPromote: false,
      canOutdent: false,
      canUp: false,
      canDown: false,
      total: totals.get(r.tempId) ?? 0,
    }));
    // last[d] = index of the most recent row at depth d still in the current
    // parent chain, i.e. the previous SIBLING of the next row at depth d
    // (truncating on shallower rows keeps entries from crossing parents).
    // One forward pass yields prev/next-sibling existence (canUp/canDown —
    // same legality as canMoveSubtree) and the indent target; outdent
    // legality derives from canDown afterwards. Mirrors the desgloseModel
    // ops, which stay authoritative on click.
    const last: (number | undefined)[] = [];
    rows.forEach((r, i) => {
      const d = r.depth;
      last.length = d + 1; // entries deeper than d belong to a closed subtree
      const prevSibling = last[d];
      if (prevSibling !== undefined) {
        rowFlags[i].canUp = true;
        rowFlags[prevSibling].canDown = true;
        if (indentLegal(rows, i)) {
          rowFlags[i].canIndent = true;
          rowFlags[i].needsPromote = rows[prevSibling].tipo === 'item';
        }
      }
      last[d] = i;
    });
    rows.forEach((r, i) => {
      // outdentRows legality: an 'item' may not leave when its next sibling
      // would become its child; a 'grupo' adopts followers legally.
      rowFlags[i].canOutdent = r.depth > 0 && (r.tipo === 'grupo' || !rowFlags[i].canDown);
    });
    return { rowFlags, grandTotal: totals.get(GRAND_TOTAL_KEY) ?? 0 };
  }, [rows]);

  // ----- stable row callbacks (identity never changes; read rowsRef at call time) -----

  /** Apply a model op; ops signal illegality by returning the SAME reference. */
  const applyOp = useCallback((next: DesgloseRow[]) => {
    if (next !== rowsRef.current) {
      setRows(next);
      setDirty(true);
    }
  }, []);

  const updateRow = useCallback((i: number, patch: Partial<DesgloseRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  }, []);

  const indent = useCallback((i: number) => {
    const current = rowsRef.current;
    const k = indentParentIndex(current, i);
    if (k < 0) return;
    if (current[k].tipo === 'item') {
      setIndentConfirm({ index: i, parentIndex: k });
      return;
    }
    applyOp(indentRows(current, i));
  }, [applyOp]);

  const outdent = useCallback((i: number) => applyOp(outdentRows(rowsRef.current, i)), [applyOp]);
  const moveUp = useCallback((i: number) => applyOp(moveSubtree(rowsRef.current, i, -1)), [applyOp]);
  const moveDown = useCallback((i: number) => applyOp(moveSubtree(rowsRef.current, i, 1)), [applyOp]);

  const requestDelete = useCallback((i: number) => {
    const current = rowsRef.current;
    const count = subtreeEnd(current, i) - i - 1;
    if (count > 0) {
      setDeleteConfirm({ index: i, count });
      return;
    }
    applyOp(deleteSubtree(current, i));
  }, [applyOp]);

  // ----- dialog-confirmed mutations -----
  const confirmIndent = () => {
    if (!indentConfirm) return;
    const { index, parentIndex } = indentConfirm;
    // Promote the would-be parent to grupo (clears its montos), then indent.
    const promoted = rowsRef.current.map((r, idx) =>
      (idx === parentIndex ? { ...r, tipo: 'grupo' as const, cantidad: null, precioUnitario: null } : r));
    setRows(indentRows(promoted, index));
    setDirty(true);
    setIndentConfirm(null);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    setRows(deleteSubtree(rowsRef.current, deleteConfirm.index));
    setDirty(true);
    setDeleteConfirm(null);
  };

  // ----- toolbar actions -----
  const addRow = (tipo: 'item' | 'grupo') => {
    const nextId = Math.max(0, ...rows.map((r) => r.tempId)) + 1;
    setRows([...rows, {
      tempId: nextId, depth: 0, tipo, item: '', descripcion: '', unidad: null, cantidad: null, precioUnitario: null,
    }]);
    setDirty(true);
  };

  const handlePasteConfirm = (pasted: DesgloseRow[]) => {
    const base = Math.max(0, ...rows.map((r) => r.tempId));
    setRows([...rows, ...pasted.map((r, idx) => ({ ...r, tempId: base + idx + 1 }))]);
    setDirty(true);
  };

  const handleSave = async () => {
    const saved = rows; // snapshot — edits made during the in-flight PUT must survive
    setBusy(true);
    setSaveErr(null);
    try {
      const doc = await saveDesglose(proyectoId, meta?.updatedAt ?? null, toWireItems(saved));
      // ALWAYS take the fresh meta: the new concurrency stamp is what makes
      // the NEXT save valid even when we keep locally-edited rows below.
      setMeta(doc.desglose);
      setConflictMsg(null);
      const editedMidFlight = rowsRef.current !== saved;
      // Replace rows with the authoritative response only if the user did NOT
      // edit while the request was in flight; otherwise keep their edits and
      // stay dirty.
      setRows((prev) => (prev === saved ? wireToRows(doc.items) : prev));
      setDirty(editedMidFlight);
    } catch (e) {
      if (e instanceof DesgloseConflictError) setConflictMsg(e.message);
      else {
        // Backend 400s carry actionable messages (e.g. "Máximo 5000 filas").
        const serverMsg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
        setSaveErr(serverMsg || 'No se pudo guardar; intenta de nuevo.');
      }
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
        <ErrorState title={err.message} onRetry={err.forbidden ? undefined : fetchDesglose} />
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
                    row={r}
                    index={i}
                    flags={rowFlags[i]}
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
            Total: {formatMoney(grandTotal)}
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
