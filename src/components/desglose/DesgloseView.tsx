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
import {
  Plus, ClipboardPaste, Loader2, Pencil, Settings, Download, Printer,
  IndentIncrease, IndentDecrease, ChevronUp, ChevronDown, Trash2, Undo2, Redo2, X, Info,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert } from '@/components/shell/Alert';
import { SectionHeader } from '@/components/shell/SectionHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import {
  computeTotals, toWireItems, indentLegal, subtreeEnd, indentRows, indentParentIndex,
  outdentRows, deleteSubtree, moveSubtree, insertRowAfter, hasChildren,
  newRowUid, GRAND_TOTAL_KEY, type DesgloseRow,
} from '@/lib/desgloseModel';
import {
  getDesglose, saveDesglose, getDesgloseById, saveDesgloseById, wireToRows,
  eliminarDesgloseCuenta, DesgloseConflictError, type DesgloseMeta,
} from '@/lib/desgloseApi';
import { exportDesgloseExcel } from '@/lib/desgloseExcel';
import { DesglosePrintDialog } from './DesglosePrintDialog';
import { DesglosePasteDialog } from './DesglosePasteDialog';
import { DesgloseTableRow } from './DesgloseTableRow';
import { FIELD_ORDER, isFieldEditable, type DesgloseField } from './desgloseFields';
import { parseMoney } from '@/lib/desglosePaste';

interface DesgloseViewProps {
  proyectoId: number;
  /** Nombre del proyecto — título por defecto al exportar/imprimir. */
  proyectoNombre?: string;
  /** Desglose concreto a editar (pestaña Cuentas). Sin esto se carga y guarda
   *  el desglose OFICIAL del proyecto — el comportamiento de Información, que
   *  no cambia. */
  desgloseId?: number;
  /** Cuántas cuentas usan este desglose; si > 0, no se puede borrar. */
  usoCount?: number;
  /** Encabezado de la sección; por defecto el de Información. */
  titulo?: string;
  /** Volver al listado. Se dibuja como el botón de flecha de CuentaDetailPage:
   *  icono al lado izquierdo del título, no un botón de texto. */
  onBack?: () => void;
}

/** Per-row enablement + subtotal, precomputed in ONE O(N) pass below. Mirrors
 *  the legality of the desgloseModel ops, which stay authoritative — an op
 *  invoked with a stale flag still returns the array unchanged. The toolbar
 *  reads these for the selected row; the rows themselves only need `total`. */
interface DesgloseRowFlags {
  canIndent: boolean;
  /** Indenting re-parents under an 'item': the view asks to promote it first. */
  needsPromote: boolean;
  canOutdent: boolean;
  canUp: boolean;
  canDown: boolean;
  total: number;
}

interface LoadError {
  message: string;
  /** 403 — permission denied; no retry button (retrying cannot succeed). */
  forbidden: boolean;
}

const HEADER_CELL = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export function DesgloseView({
  proyectoId, proyectoNombre, desgloseId, usoCount = 0, titulo = 'Desglose del Proyecto', onBack,
}: DesgloseViewProps) {
  const [rows, setRows] = useState<DesgloseRow[]>([]);
  const [meta, setMeta] = useState<DesgloseMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<LoadError | null>(null);
  // The desglose opens read-only; cells only become inputs once the user
  // deliberately enters edit mode, and leaving it always goes through Guardar
  // or Cancelar (which restores `baselineRef`).
  const [editing, setEditing] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  // Row selection drives every structural op (the toolbar acts on it) and, per
  // the agreed insert semantics, will decide where new rows land. `open` is the
  // single cell being typed into anywhere in the table — while it is null, the
  // grid owns the keyboard and Tab means indent.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [open, setOpen] = useState<{ index: number; field: DesgloseField } | null>(null);
  const [dirty, setDirty] = useState(false);
  // ITBMS rate kept as a STRING for input ergonomics (typing "7." mustn't
  // collapse); null = sin ITBMS. The numeric value used for calc/save/dirty is
  // derived below. It is NOT part of the row undo history — Ctrl+Z steps the
  // tree only — but it does count toward "unsaved changes".
  const [itbmsRate, setItbmsRate] = useState<string | null>(null);
  // Undo/redo history. Snapshots are just references — rows are immutable (every
  // op returns a new array), so nothing is cloned. `past` grows as you edit,
  // `future` fills as you undo. Every mutation goes through commitRows().
  const [past, setPast] = useState<DesgloseRow[][]>([]);
  const [future, setFuture] = useState<DesgloseRow[][]>([]);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [indentConfirm, setIndentConfirm] = useState<{ index: number; parentIndex: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ index: number; count: number } | null>(null);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

  // Latest-rows ref: the row callbacks below must be identity-stable for
  // React.memo yet always operate on the CURRENT rows — a stale closure could
  // resurrect deleted rows or move the wrong subtree.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const gridRef = useRef<HTMLDivElement>(null);

  // Last server-known rows — what Cancelar restores. Written on load and on
  // every successful save, never on a local edit.
  const baselineRef = useRef<DesgloseRow[]>([]);
  // Last server-known ITBMS rate (number | null), the ITBMS half of the baseline.
  const baselineItbmsRef = useRef<number | null>(null);

  // Derived ITBMS: null = sin ITBMS; otherwise the parsed rate clamped to
  // [0, 100] (empty/garbage → 0, a valid 0% tax). itbmsDirty layers onto the
  // rows `dirty` flag so a rate change alone still counts as unsaved.
  const itbmsTasa = itbmsRate == null
    ? null
    : Math.min(Math.max(parseFloat(itbmsRate.replace(',', '.')) || 0, 0), 100);
  const itbmsDirty = itbmsTasa !== baselineItbmsRef.current;
  const anyDirty = dirty || itbmsDirty;

  // ----- history: THE single mutation choke point -----
  const resetHistory = useCallback(() => { setPast([]); setFuture([]); }, []);

  /** Every edit routes through here: push the current rows onto the undo stack,
   *  drop any redo future, install `next`, mark dirty. No-ops when `next` is the
   *  same reference — model ops signal illegality that way, and a no-op must not
   *  land a phantom entry on the stack. */
  const commitRows = useCallback((next: DesgloseRow[]) => {
    const cur = rowsRef.current;
    if (next === cur) return;
    setPast((p) => [...p, cur]);
    setFuture([]);
    setRows(next);
    setDirty(true);
  }, []);

  // ----- load (with stale-response guard: only the newest request may land) -----
  const fetchSeq = useRef(0);
  const fetchDesglose = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setErr(null);
    try {
      const doc = desgloseId != null
        ? await getDesgloseById(proyectoId, desgloseId)
        : await getDesglose(proyectoId);
      if (seq !== fetchSeq.current) return; // a newer fetch owns the state now
      const fresh = doc ? wireToRows(doc.items) : [];
      baselineRef.current = fresh;
      const itbms = doc?.desglose.itbmsTasa ?? null;
      baselineItbmsRef.current = itbms;
      setItbmsRate(itbms == null ? null : String(itbms));
      setRows(fresh);
      setMeta(doc ? doc.desglose : null);
      setDirty(false);
      resetHistory(); // loaded state is a fresh baseline — nothing to undo into
      setLoading(false);
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      const status = (e as { response?: { status?: number } }).response?.status;
      setErr(status === 403
        ? { message: 'No tienes permiso para ver el desglose.', forbidden: true }
        : { message: 'No se pudo cargar el desglose.', forbidden: false });
      setLoading(false);
    }
  }, [proyectoId, desgloseId, resetHistory]);

  useEffect(() => {
    fetchDesglose();
  }, [fetchDesglose]);

  // Leaving edit mode drops the selection and any open cell — the read view has
  // neither, and a stale index would point into a reverted array after Cancelar.
  useEffect(() => {
    if (!editing) {
      setSelectedIndex(null);
      setOpen(null);
    }
  }, [editing]);

  // ----- native unload guard -----
  // Switching to the Datos tab no longer loses edits (the panel stays mounted),
  // so this only has to cover closing or reloading the page.
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue for the native prompt
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

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

  /** Apply a model op; ops signal illegality by returning the SAME reference.
   *  `keepId` re-finds that row afterwards: outdent and move reorder the array,
   *  so a selection held as an index would silently point at a different row. */
  const applyOp = useCallback((next: DesgloseRow[], keepId?: number) => {
    if (next === rowsRef.current) return;
    commitRows(next);
    if (keepId !== undefined) {
      const idx = next.findIndex((r) => r.tempId === keepId);
      setSelectedIndex(idx >= 0 ? idx : null);
    }
  }, [commitRows]);

  const updateRow = useCallback((i: number, patch: Partial<DesgloseRow>) => {
    const cur = rowsRef.current;
    commitRows(cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }, [commitRows]);

  const indent = useCallback((i: number) => {
    const current = rowsRef.current;
    const k = indentParentIndex(current, i);
    if (k < 0) return;
    if (current[k].tipo === 'item') {
      setIndentConfirm({ index: i, parentIndex: k });
      return;
    }
    applyOp(indentRows(current, i), current[i].tempId);
  }, [applyOp]);

  const outdent = useCallback((i: number) => {
    const current = rowsRef.current;
    applyOp(outdentRows(current, i), current[i].tempId);
  }, [applyOp]);

  const moveUp = useCallback((i: number) => {
    const current = rowsRef.current;
    applyOp(moveSubtree(current, i, -1), current[i].tempId);
  }, [applyOp]);

  const moveDown = useCallback((i: number) => {
    const current = rowsRef.current;
    applyOp(moveSubtree(current, i, 1), current[i].tempId);
  }, [applyOp]);

  const requestDelete = useCallback((i: number) => {
    const current = rowsRef.current;
    const count = subtreeEnd(current, i) - i - 1;
    if (count > 0) {
      setDeleteConfirm({ index: i, count });
      return;
    }
    applyOp(deleteSubtree(current, i));
    setSelectedIndex(null); // the selected row no longer exists
  }, [applyOp]);

  /** Insert a blank row below row i (the hover ＋). insertRowAfter places it at
   *  the right depth; the new row is always at i+1, so select it and open its
   *  Descripción so the user can type immediately. */
  const insertRow = useCallback((i: number, tipo: 'item' | 'grupo') => {
    const next = insertRowAfter(rowsRef.current, i, tipo);
    if (next === rowsRef.current) return;
    commitRows(next);
    setSelectedIndex(i + 1);
    setOpen({ index: i + 1, field: 'descripcion' });
  }, [commitRows]);

  // ----- cell editing (exactly one cell open at a time) -----

  /** Focus follows the interaction: the grid container holds it while a row is
   *  merely selected (so it receives the keys), the open cell's input takes it
   *  while typing, and closing a cell hands it back — otherwise the arrows go
   *  dead the moment you press Enter. */
  const focusGrid = useCallback(() => gridRef.current?.focus({ preventScroll: true }), []);

  const selectRow = useCallback((i: number) => {
    setSelectedIndex(i);
    focusGrid();
  }, [focusGrid]);

  const openCell = useCallback((i: number, field: DesgloseField) => {
    setSelectedIndex(i);
    setOpen({ index: i, field });
  }, []);

  const cancelEdit = useCallback(() => {
    setOpen(null);
    focusGrid();
  }, [focusGrid]);

  /** Commit a cell's raw draft. Numerics go through parseMoney so typed values
   *  behave exactly like pasted ones ("1,234.56", "B/. 5"); empty or
   *  unparseable commits null. */
  const commitCell = useCallback((i: number, field: DesgloseField, raw: string) => {
    const row = rowsRef.current[i];
    if (row) {
      if (field === 'cantidad' || field === 'precioUnitario') {
        const value = parseMoney(raw);
        if (value !== row[field]) updateRow(i, { [field]: value });
      } else if (field === 'unidad') {
        const value = raw || null;
        if (value !== row.unidad) updateRow(i, { unidad: value });
      } else if (raw !== row[field]) {
        updateRow(i, { [field]: raw });
      }
    }
    setOpen(null);
    focusGrid();
  }, [updateRow, focusGrid]);

  /** Tab out of an open cell: commit, then open the next editable cell,
   *  wrapping across rows like a spreadsheet. Skips a grupo's montos, which
   *  are derived and never typed. */
  const tabCell = useCallback((i: number, field: DesgloseField, raw: string, dir: 1 | -1) => {
    commitCell(i, field, raw);
    const current = rowsRef.current;
    let ri = i;
    let fi = FIELD_ORDER.indexOf(field) + dir;
    // Terminates: every row has at least `item` editable, and ri walks off the
    // ends of the array, where we simply close.
    for (;;) {
      if (fi >= FIELD_ORDER.length) { ri += 1; fi = 0; }
      else if (fi < 0) { ri -= 1; fi = FIELD_ORDER.length - 1; }
      if (ri < 0 || ri >= current.length) return; // commitCell already closed it
      const priced = current[ri].tipo === 'grupo' && !hasChildren(current, ri);
      if (isFieldEditable(current[ri], FIELD_ORDER[fi], priced)) {
        setSelectedIndex(ri);
        setOpen({ index: ri, field: FIELD_ORDER[fi] });
        return;
      }
      fi += dir;
    }
  }, [commitCell]);

  // ----- dialog-confirmed mutations -----
  const confirmIndent = () => {
    if (!indentConfirm) return;
    const { index, parentIndex } = indentConfirm;
    // Promote the would-be parent to grupo (clears its montos), then indent.
    const promoted = rowsRef.current.map((r, idx) =>
      (idx === parentIndex ? { ...r, tipo: 'grupo' as const, cantidad: null, precioUnitario: null } : r));
    commitRows(indentRows(promoted, index));
    setIndentConfirm(null);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    commitRows(deleteSubtree(rowsRef.current, deleteConfirm.index));
    setDeleteConfirm(null);
    setSelectedIndex(null); // the selected row no longer exists
  };

  // A dialog owns the keyboard while it is up — the grid must not also act on
  // Escape/Delete underneath it.
  const dialogOpen = pasteOpen || printOpen || cancelConfirmOpen || reloadConfirmOpen
    || indentConfirm !== null || deleteConfirm !== null;

  // ----- export -----
  /** Exports whatever is on screen (unsaved edits included — what you see is
   *  what lands in the archivo). Errors surface in the same Alert strip as
   *  save errors; success needs no message, the download IS the feedback. */
  const handleExport = async () => {
    setExportErr(null);
    setExporting(true);
    try {
      await exportDesgloseExcel({
        rows: rowsRef.current,
        itbmsTasa,
        title: proyectoNombre || `Proyecto ${proyectoId}`,
      });
    } catch (e) {
      console.error('Error exportando desglose a Excel:', e);
      setExportErr('No se pudo exportar a Excel; intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  /** Grid keyboard, scoped to the table container — never a window listener:
   *  this panel stays mounted while the Datos tab is showing, so a global
   *  handler would let Delete quietly remove a row nobody can see. */
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (!editing || open || dialogOpen) return;
    // Undo/redo first, and independent of selection — Ctrl+Z with nothing
    // selected still steps history. (When a cell is open the `open` guard above
    // has already bailed, so Ctrl+Z there is the browser's text undo.)
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (selectedIndex === null) return;
    const current = rowsRef.current;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(Math.min(current.length - 1, selectedIndex + 1));
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) outdent(selectedIndex);
        else indent(selectedIndex);
        break;
      case 'Enter':
        e.preventDefault();
        openCell(selectedIndex, 'descripcion');
        break;
      // Supr only — NEVER Backspace. In a grid you type into, Backspace is a
      // text key; wiring it to "delete the row" makes an ordinary correction
      // destroy work.
      case 'Delete':
        e.preventDefault();
        requestDelete(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedIndex(null);
        break;
    }
  };

  // ----- toolbar actions -----
  const addRow = (tipo: 'item' | 'grupo') => {
    const cur = rowsRef.current;
    const nextId = Math.max(0, ...cur.map((r) => r.tempId)) + 1;
    commitRows([...cur, {
      tempId: nextId, rowUid: newRowUid(), depth: 0, tipo, item: '', descripcion: '', unidad: null, cantidad: null, precioUnitario: null,
    }]);
  };

  const handlePasteConfirm = (pasted: DesgloseRow[]) => {
    const cur = rowsRef.current;
    const base = Math.max(0, ...cur.map((r) => r.tempId));
    commitRows([...cur, ...pasted.map((r, idx) => ({ ...r, tempId: base + idx + 1 }))]);
  };

  const handleSave = async () => {
    const saved = rows; // snapshot — edits made during the in-flight PUT must survive
    const savedItbms = itbmsTasa; // same snapshot discipline for the rate
    setBusy(true);
    setSaveErr(null);
    try {
      const doc = desgloseId != null
        ? await saveDesgloseById(proyectoId, desgloseId, meta?.updatedAt ?? null, toWireItems(saved), savedItbms)
        : await saveDesglose(proyectoId, meta?.updatedAt ?? null, toWireItems(saved), savedItbms);
      // ALWAYS take the fresh meta: the new concurrency stamp is what makes
      // the NEXT save valid even when we keep locally-edited rows below.
      setMeta(doc.desglose);
      setConflictMsg(null);
      const editedMidFlight = rowsRef.current !== saved;
      const fresh = wireToRows(doc.items);
      baselineRef.current = fresh;
      // The saved rate is the new ITBMS baseline; adopt it unless the user
      // changed the field mid-flight (then their value stands and stays dirty).
      baselineItbmsRef.current = doc.desglose.itbmsTasa;
      if (itbmsTasa === savedItbms) {
        setItbmsRate(doc.desglose.itbmsTasa == null ? null : String(doc.desglose.itbmsTasa));
      }
      // Replace rows with the authoritative response only if the user did NOT
      // edit while the request was in flight; otherwise keep their edits and
      // stay dirty.
      setRows((prev) => (prev === saved ? fresh : prev));
      setDirty(editedMidFlight);
      // The save is a new baseline — you cannot undo across it into stale server
      // state, so the history starts over from here.
      resetHistory();
      // A clean save returns to the read view; edits that landed mid-flight are
      // still unsaved, so editing continues.
      if (!editedMidFlight && itbmsTasa === savedItbms) setEditing(false);
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

  // ----- leaving edit mode -----
  const requestCancel = () => {
    if (anyDirty) {
      setCancelConfirmOpen(true);
      return;
    }
    setEditing(false);
  };

  const confirmCancel = () => {
    setRows(baselineRef.current); // discard every local edit since the last save
    setItbmsRate(baselineItbmsRef.current == null ? null : String(baselineItbmsRef.current));
    setDirty(false);
    resetHistory();
    setSaveErr(null);
    setConflictMsg(null);
    setEditing(false);
    setCancelConfirmOpen(false);
  };

  // ----- undo / redo -----
  // Plain closures (not memoized): they read the current `past`/`future` at
  // render and are only wired to toolbar buttons + the grid key handler, never
  // to a memoized row. Each restores a snapshot, drops the open cell, and clamps
  // the selection to the restored length. dirty tracks whether the restored rows
  // ARE the baseline reference — undoing all the way back re-enables nothing.
  const restore = (arr: DesgloseRow[]) => {
    setRows(arr);
    setDirty(arr !== baselineRef.current);
    setOpen(null);
    setSelectedIndex((si) => (si === null || arr.length === 0 ? null : Math.min(si, arr.length - 1)));
  };
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const undo = () => {
    if (!canUndo) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([rowsRef.current, ...future]);
    restore(prev);
  };
  const redo = () => {
    if (!canRedo) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, rowsRef.current]);
    restore(next);
  };

  /** Encabezado de la sección. Al abrir un desglose desde su listado lleva la
   *  flecha de retorno SUELTA a la izquierda del título (elegida sobre mock,
   *  2026-07-21): sin recuadro y con el mismo realce al pasar el mouse que el
   *  engranaje. SectionHeader trae su propio mb-4, que se anula aquí para que la
   *  flecha quede centrada con el texto y no 8px más abajo. */
  const HeaderRow = ({ titleAction }: { titleAction?: React.ReactNode }) => (
    <div className="mb-4 flex items-center gap-2">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Volver al listado"
          title="Volver al listado"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="h-[18px] w-[18px]" />
        </Button>
      )}
      <div className="min-w-0 flex-1 [&>div]:mb-0">
        <SectionHeader title={titulo} titleAction={titleAction} />
      </div>
    </div>
  );

  // The heading holds the gear and NOTHING else, in both modes. SectionHeader
  // centers its row, so anything whose height changes between read and edit
  // (a size="sm" button, or even dropping the gear) re-centers the title and
  // visibly moves it. Every mode-dependent control lives in the toolbar below.
  // Eliminar el desglose completo (solo desgloses de Cuentas; el oficial no).
  const [showDeleteDesglose, setShowDeleteDesglose] = useState(false);
  const [deletingDesglose, setDeletingDesglose] = useState(false);
  const [deleteDesgloseError, setDeleteDesgloseError] = useState('');
  const canDelete = desgloseId != null;
  const enUso = usoCount > 0;

  const handleDeleteDesglose = async () => {
    if (desgloseId == null) return;
    setDeletingDesglose(true);
    setDeleteDesgloseError('');
    try {
      await eliminarDesgloseCuenta(proyectoId, desgloseId);
      setShowDeleteDesglose(false);
      onBack?.();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setDeleteDesgloseError(err.response?.data?.message || 'No se pudo eliminar el desglose');
    } finally {
      setDeletingDesglose(false);
    }
  };

  const gearMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Opciones"
          aria-label="Opciones"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setEditing(true)} disabled={editing}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        {/* Ambos actúan sobre lo que está en pantalla (ediciones sin guardar
            incluidas) y no tienen sentido sin filas. */}
        <DropdownMenuItem onClick={handleExport} disabled={rows.length === 0 || exporting}>
          <Download className="mr-2 h-4 w-4" /> Exportar a Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPrintOpen(true)} disabled={rows.length === 0}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            {enUso ? (
              <>
                <DropdownMenuItem disabled className="text-muted-foreground">
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar desglose
                </DropdownMenuItem>
                <div className="flex items-start gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    No se puede borrar: {usoCount} {usoCount === 1 ? 'cuenta usa' : 'cuentas usan'} este desglose.
                  </span>
                </div>
              </>
            ) : (
              <DropdownMenuItem
                onClick={() => setShowDeleteDesglose(true)}
                className="text-error focus:text-error"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar desglose
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Auto table layout: every column sizes to its widest content (Excel-style
  // fit), EXCEPT Descripción, which gets w-full so it greedily takes all slack
  // and the others collapse to their content. The opened-cell <input> is width-
  // neutralised (size=1 + min-w-0 in DesgloseTableRow), so clicking a cell no
  // longer inflates its column. whitespace-nowrap keeps the header labels from
  // wrapping and reinforces content-fit on the short columns.
  const headerRow = (
    <TableHeader>
      <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
        <TableHead className={cn(HEADER_CELL, 'whitespace-nowrap rounded-tl-xl')}>Item</TableHead>
        <TableHead className={cn(HEADER_CELL, 'w-full')}>Descripción</TableHead>
        <TableHead className={cn(HEADER_CELL, 'whitespace-nowrap')}>Unidad</TableHead>
        <TableHead className={cn(HEADER_CELL, 'whitespace-nowrap text-right')}>Cantidad</TableHead>
        <TableHead className={cn(HEADER_CELL, 'whitespace-nowrap text-right')}>P.U.</TableHead>
        <TableHead className={cn(HEADER_CELL, 'whitespace-nowrap text-right rounded-tr-xl')}>Total</TableHead>
      </TableRow>
    </TableHeader>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <HeaderRow />
        <Card className="overflow-hidden p-0">
          <Table>
            {headerRow}
            <TableSkeleton rows={5} columns={6} />
          </Table>
        </Card>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-4">
        <HeaderRow />
        <Card className="overflow-hidden p-0">
          <ErrorState title={err.message} onRetry={err.forbidden ? undefined : fetchDesglose} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderRow titleAction={gearMenu} />

      {conflictMsg && (
        <Alert
          variant="error"
          title="Conflicto al guardar"
          description={conflictMsg}
          actions={<Button size="sm" variant="outline" onClick={() => setReloadConfirmOpen(true)}>Recargar</Button>}
        />
      )}
      {saveErr && <Alert variant="error" title={saveErr} />}
      {exportErr && <Alert variant="error" title={exportErr} />}

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addRow('item')}>
            <Plus className="mr-2 h-4 w-4" /> Agregar fila
          </Button>
          <Button variant="outline" size="sm" onClick={() => addRow('grupo')}>
            <Plus className="mr-2 h-4 w-4" /> Agregar grupo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste className="mr-2 h-4 w-4" /> Pegar desde Excel
          </Button>

          {/* Structural ops act on the selected row. Enablement comes straight
              from the flags already computed for it; the model ops stay
              authoritative and no-op on a stale flag. */}
          <div className="ml-2 flex items-center gap-1 border-l border-border pl-3">
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => selectedIndex !== null && outdent(selectedIndex)}
              disabled={selectedIndex === null || !rowFlags[selectedIndex]?.canOutdent}
              title="Desindentar (Shift+Tab)"
            >
              <IndentDecrease className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => selectedIndex !== null && indent(selectedIndex)}
              disabled={selectedIndex === null || !rowFlags[selectedIndex]?.canIndent}
              title={selectedIndex !== null && rowFlags[selectedIndex]?.needsPromote
                ? 'Indentar (Tab) — convierte la fila anterior en grupo'
                : 'Indentar (Tab)'}
            >
              <IndentIncrease className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => selectedIndex !== null && moveUp(selectedIndex)}
              disabled={selectedIndex === null || !rowFlags[selectedIndex]?.canUp}
              title="Subir"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => selectedIndex !== null && moveDown(selectedIndex)}
              disabled={selectedIndex === null || !rowFlags[selectedIndex]?.canDown}
              title="Bajar"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={() => selectedIndex !== null && requestDelete(selectedIndex)}
              disabled={selectedIndex === null}
              title="Eliminar (Supr)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Undo/redo act on the whole document, so they sit apart from the
              selection-scoped ops above. */}
          <div className="ml-2 flex items-center gap-1 border-l border-border pl-3">
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={undo}
              disabled={!canUndo}
              title="Deshacer (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              onClick={redo}
              disabled={!canRedo}
              title="Rehacer (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {anyDirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
            <Button variant="outline" size="sm" onClick={requestCancel} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!anyDirty || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      )}

      {/* No overflow-hidden: the hover ＋ straddles the table's left edge and
          must be free to poke past it. Corners are rounded on the header cells
          and the footer instead of by clipping. */}
      <Card className="p-0">
        {rows.length === 0 ? (
          <EmptyState
            title="Este proyecto aún no tiene desglose"
            description="Agrega filas manualmente o pega un rango copiado de Excel."
            action={
              // An empty desglose can only be filled by editing it — these
              // enter edit mode and perform the action in one click.
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => { setEditing(true); addRow('item'); }}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar filas
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(true); setPasteOpen(true); }}>
                  <ClipboardPaste className="mr-2 h-4 w-4" /> Pegar desde Excel
                </Button>
              </div>
            }
          />
        ) : (
          // tabIndex makes the grid focusable so it can own the keyboard while a
          // row is selected; clicking a row focuses it. No overflow clip here
          // either — overflow-x:auto would force the vertical axis to clip and
          // eat the hover ＋ that straddles the row's bottom-left.
          <div
            ref={gridRef}
            tabIndex={-1}
            onKeyDown={onGridKeyDown}
            className="outline-none"
          >
            <Table>
              {headerRow}
              <TableBody>
                {rows.map((r, i) => (
                  <DesgloseTableRow
                    key={r.tempId}
                    row={r}
                    index={i}
                    total={rowFlags[i].total}
                    pricedSection={r.tipo === 'grupo' && !hasChildren(rows, i)}
                    editable={editing}
                    selected={editing && selectedIndex === i}
                    openField={open?.index === i ? open.field : null}
                    onSelect={selectRow}
                    onOpen={openCell}
                    onCommit={commitCell}
                    onCancelEdit={cancelEdit}
                    onTab={tabCell}
                    onInsert={insertRow}
                    onDelete={requestDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-end justify-end rounded-b-xl border-t border-border px-4 py-3 text-sm">
          {/* Totals + ITBMS. When there is no ITBMS the block is just the total
              (plus a "+ Agregar ITBMS" in edit mode); once added, it stacks
              Subtotal / ITBMS / Total. The rate is a saved field of the desglose. */}
          <div className="flex min-w-[260px] flex-col gap-1.5 tabular-nums">
            {itbmsTasa != null && (
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatMoney(grandTotal)}</span>
              </div>
            )}

            {itbmsTasa != null ? (
              <div className="flex items-center justify-between gap-6">
                <span className="flex items-center gap-2 text-muted-foreground">
                  ITBMS
                  {editing ? (
                    <>
                      <Input
                        value={itbmsRate ?? ''}
                        onChange={(e) => setItbmsRate(e.target.value)}
                        inputMode="decimal"
                        aria-label="Tasa de ITBMS en porcentaje"
                        className="h-6 w-14 px-2 text-right tabular-nums"
                      />
                      <span>%</span>
                      <button
                        type="button"
                        onClick={() => setItbmsRate(null)}
                        title="Quitar ITBMS"
                        aria-label="Quitar ITBMS"
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <span>({itbmsTasa}%)</span>
                  )}
                </span>
                <span className="font-medium">{formatMoney(grandTotal * itbmsTasa / 100)}</span>
              </div>
            ) : editing ? (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setItbmsRate('7')}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar ITBMS
                </Button>
              </div>
            ) : null}

            <div className={cn(
              'flex items-center justify-between gap-6',
              // The divider only makes sense with a Subtotal + ITBMS above it;
              // without ITBMS the Total is the sole line, so no stray rule.
              itbmsTasa != null && 'border-t border-border pt-1.5',
            )}>
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-bold text-foreground">
                {formatMoney(grandTotal + (itbmsTasa != null ? grandTotal * itbmsTasa / 100 : 0))}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <DesglosePasteDialog open={pasteOpen} onOpenChange={setPasteOpen} onConfirm={handlePasteConfirm} />

      <DesglosePrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        rows={rows}
        itbmsTasa={itbmsTasa}
        proyectoNombre={proyectoNombre}
      />

      <AlertDialog open={showDeleteDesglose} onOpenChange={(o) => { if (!o) { setShowDeleteDesglose(false); setDeleteDesgloseError(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este desglose?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará “{titulo}” y sus filas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteDesgloseError && <p className="text-sm text-error">{deleteDesgloseError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDesglose}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteDesglose(); }}
              disabled={deletingDesglose}
              className="bg-error text-white hover:bg-error/90"
            >
              {deletingDesglose && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Se perderán los cambios sin guardar y el desglose volverá a como estaba.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmCancel}
            >
              Descartar
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
