// DesgloseTableRow — one memoized row of the desglose table.
//
// The row renders the SAME plain-text cells whether or not the desglose is in
// edit mode: entering edit mode must not reflow the table, it only makes rows
// selectable and cells openable. At most ONE cell in the whole table is open at
// a time (DesgloseView owns that), and only that cell is an <Input> — which is
// what keeps Tab free to mean "indent" while a row is merely selected.
//
// Receives its OWN row + its precomputed subtotal — never the whole rows array
// — so a keystroke re-renders only this row. The memo comparator at the bottom
// is what enforces that, and every callback from DesgloseView is
// identity-stable, so the comparator can compare them by reference.

import { memo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import type { DesgloseRow } from '@/lib/desgloseModel';
import { padClass, grupoBgClass } from './desglosePad';
import {
  MAX_LEN, NUMERIC_FIELDS, editValue, isFieldEditable, type DesgloseField,
} from './desgloseFields';

interface EditableCellProps {
  initial: string;
  numeric: boolean;
  maxLength?: number;
  onCommit: (raw: string) => void;
  onCancel: () => void;
  onTab: (raw: string, dir: 1 | -1) => void;
}

function EditableCell({ initial, numeric, maxLength, onCommit, onCancel, onTab }: EditableCellProps) {
  // Edits a raw STRING draft and only parses on commit — parsing per keystroke
  // made "3.5" impossible to type (the intermediate "3." collapsed).
  const [draft, setDraft] = useState(initial);
  // One-shot latch: Escape closes the cell, and a blur racing the unmount must
  // not then commit the draft the user just abandoned.
  const done = useRef(false);
  const once = (fn: () => void) => {
    if (done.current) return;
    done.current = true;
    fn();
  };

  return (
    <Input
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      inputMode={numeric ? 'decimal' : undefined}
      maxLength={maxLength}
      // size=1 + min-w-0 drop the <input>'s ~20-char default intrinsic width to
      // nothing, so it contributes zero to the column's content width and just
      // fills whatever the cell already is. Without this, auto layout would size
      // the column to the input and the column would jump wide when opened.
      size={1}
      // Must occupy EXACTLY the box the text occupied — h-5/leading-5/text-sm
      // is TableCell's own line box — or opening a cell grows the row. The
      // focus ring is a box-shadow, so it signals "editable" without taking
      // any space. text-sm is forced because shadcn's Input is text-base on
      // mobile, which would be 24px and reintroduce the vertical jump.
      className={cn(
        'h-5 w-full min-w-0 rounded-sm border-0 bg-transparent p-0 text-sm leading-5 shadow-none',
        'focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0',
        numeric && 'text-right tabular-nums',
      )}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => once(() => onCommit(draft))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          once(() => onCommit(draft));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          once(onCancel);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          once(() => onTab(draft, e.shiftKey ? -1 : 1));
        }
      }}
    />
  );
}

export interface DesgloseTableRowProps {
  row: DesgloseRow;
  index: number;
  /** Precomputed in DesgloseView's single O(N) pass. */
  total: number;
  editable: boolean;
  selected: boolean;
  /** Which cell of THIS row is open, if any. */
  openField: DesgloseField | null;
  onSelect: (i: number) => void;
  onOpen: (i: number, field: DesgloseField) => void;
  onCommit: (i: number, field: DesgloseField, raw: string) => void;
  onCancelEdit: () => void;
  onTab: (i: number, field: DesgloseField, raw: string, dir: 1 | -1) => void;
  onInsert: (i: number, tipo: 'item' | 'grupo') => void;
}

function DesgloseTableRowBase({
  row: r, index, total, editable, selected, openField,
  onSelect, onOpen, onCommit, onCancelEdit, onTab, onInsert,
}: DesgloseTableRowProps) {
  const cell = (field: DesgloseField, display: React.ReactNode, className?: string, extra?: React.ReactNode) => {
    const canEdit = editable && isFieldEditable(r, field);
    return (
      <TableCell
        className={cn('px-4 py-2', canEdit && 'cursor-text', className)}
        // One click types. stopPropagation keeps the row's own onClick from
        // firing and yanking focus back to the grid container; openCell selects
        // the row anyway. Re-clicking the open cell must not re-open it, or the
        // caret you were placing gets select-all'd out from under you.
        onClick={canEdit && openField !== field
          ? (e) => { e.stopPropagation(); onOpen(index, field); }
          : undefined}
      >
        {extra}
        {openField === field ? (
          <EditableCell
            initial={editValue(r, field)}
            numeric={NUMERIC_FIELDS.includes(field)}
            maxLength={MAX_LEN[field]}
            onCommit={(raw) => onCommit(index, field, raw)}
            onCancel={onCancelEdit}
            onTab={(raw, dir) => onTab(index, field, raw, dir)}
          />
        ) : (
          display
        )}
      </TableCell>
    );
  };

  // Hover ＋ in the left margin, its centre on the table's left edge (half in,
  // half out) and straddling the row's bottom border — "insertar debajo". The
  // menu picks Fila or Grupo; both call onInsert, which places the new row per
  // the model's depth rule (sibling after an item, first child after a grupo).
  // Shown on row hover or while its own menu is open. onPointerDown stops the
  // cell/row click handlers from firing underneath it.
  const insertButton = editable ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Insertar debajo"
          aria-label="Insertar fila debajo"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute -left-3 -bottom-3 z-20 hidden h-6 w-6 items-center justify-center rounded-full',
            'border border-primary bg-card text-primary shadow-sm transition-colors',
            'hover:bg-primary hover:text-primary-foreground',
            'group-hover:flex data-[state=open]:flex',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom">
        <DropdownMenuItem onClick={() => onInsert(index, 'item')}>Fila</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInsert(index, 'grupo')}>Grupo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const isGrupo = r.tipo === 'grupo';

  return (
    <TableRow
      className={cn(
        'border-b border-slate-100 last:border-0',
        // Group rows get a depth-shaded blue band; item rows stay on the card so
        // the groups read as bands. Only items take the slate hover — a hover
        // tint on a group would fight its band. Selection (navy) wins over both.
        isGrupo && grupoBgClass(r.depth),
        editable && 'group cursor-default',
        editable && !isGrupo && 'hover:bg-slate-50',
        selected && 'bg-slate-100 hover:bg-slate-100',
      )}
      onClick={editable ? () => onSelect(index) : undefined}
    >
      {/* Short columns get whitespace-nowrap so auto layout sizes them to their
          content and no wider. Descripción alone is left wrappable and is made
          greedy (w-full on its header) so it absorbs all remaining width.
          The item cell is `relative` so it anchors the hover ＋. */}
      {cell('item', r.item, 'relative whitespace-nowrap tabular-nums', insertButton)}
      {cell(
        'descripcion',
        <div className={cn(padClass(r.depth), r.tipo === 'grupo' && 'font-semibold')}>{r.descripcion}</div>,
        'break-words',
      )}
      {cell('unidad', r.unidad ?? '', 'whitespace-nowrap')}
      {cell('cantidad', r.tipo === 'item' ? r.cantidad ?? '-' : '', 'whitespace-nowrap text-right tabular-nums')}
      {cell('precioUnitario', r.tipo === 'item' ? formatMoney(r.precioUnitario) : '', 'whitespace-nowrap text-right tabular-nums')}
      <TableCell
        className={cn('whitespace-nowrap px-4 py-2 text-right tabular-nums', r.tipo === 'grupo' && 'text-muted-foreground')}
      >
        {formatMoney(total)}
      </TableCell>
    </TableRow>
  );
}

export const DesgloseTableRow = memo(DesgloseTableRowBase, (a, b) =>
  a.index === b.index &&
  a.total === b.total &&
  a.editable === b.editable &&
  a.selected === b.selected &&
  a.openField === b.openField &&
  a.row.tempId === b.row.tempId &&
  a.row.depth === b.row.depth &&
  a.row.tipo === b.row.tipo &&
  a.row.item === b.row.item &&
  a.row.descripcion === b.row.descripcion &&
  a.row.unidad === b.row.unidad &&
  a.row.cantidad === b.row.cantidad &&
  a.row.precioUnitario === b.row.precioUnitario &&
  a.onSelect === b.onSelect &&
  a.onOpen === b.onOpen &&
  a.onCommit === b.onCommit &&
  a.onCancelEdit === b.onCancelEdit &&
  a.onTab === b.onTab &&
  a.onInsert === b.onInsert);
