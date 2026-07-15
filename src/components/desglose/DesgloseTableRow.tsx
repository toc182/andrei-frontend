// DesgloseTableRow — one memoized editor row for the desglose table: data
// cells (Item / Descripción / Unidad / Cantidad / P.U. / Total) plus the
// action buttons. Receives its OWN row + precomputed enablement flags — never
// the whole rows array — so a keystroke in one row re-renders only that row;
// the memo comparator at the bottom is what enforces it. All tree mutations
// live in desgloseModel.ts and are orchestrated by DesgloseView; the
// callbacks here are index-based and identity-stable (parent useCallback).

import { memo, useState, type ChangeEvent } from 'react';
import { ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import type { DesgloseRow } from '@/lib/desgloseModel';

// Depth padding for the Descripción cell — literal Tailwind classes (no
// dynamic `pl-${n}` strings), clamped for depths beyond the scale.
const PAD = ['pl-0', 'pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20', 'pl-24', 'pl-28', 'pl-32'];
const padClass = (depth: number) => PAD[Math.min(depth, PAD.length - 1)];

/** Per-row enablement + subtotal, precomputed in ONE O(N) pass by DesgloseView.
 *  Mirrors the legality of the desgloseModel ops, which stay authoritative —
 *  an op invoked with a stale flag still returns the array unchanged. */
export interface DesgloseRowFlags {
  canIndent: boolean;
  /** Indenting re-parents under an 'item': the view asks to promote it first. */
  needsPromote: boolean;
  canOutdent: boolean;
  canUp: boolean;
  canDown: boolean;
  total: number;
}

interface DesgloseTableRowProps {
  row: DesgloseRow;
  index: number;
  flags: DesgloseRowFlags;
  onChange: (i: number, patch: Partial<DesgloseRow>) => void;
  onIndent: (i: number) => void;
  onOutdent: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onDelete: (i: number) => void;
}

type NumericField = 'cantidad' | 'precioUnitario';

function DesgloseTableRowBase({
  row: r, index, flags, onChange, onIndent, onOutdent, onMoveUp, onMoveDown, onDelete,
}: DesgloseTableRowProps) {
  // Numeric cells edit a raw STRING draft while focused and only parse on
  // blur — parsing per keystroke made "3.5" impossible to type (the
  // intermediate "3." collapsed). Comma is accepted as decimal separator;
  // empty or unparseable input commits null.
  const [drafts, setDrafts] = useState<Partial<Record<NumericField, string>>>({});

  const numericProps = (field: NumericField) => ({
    inputMode: 'decimal' as const,
    className: 'h-8 text-right tabular-nums',
    value: drafts[field] ?? r[field] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setDrafts((d) => ({ ...d, [field]: e.target.value })),
    onBlur: () => {
      const raw = drafts[field];
      if (raw === undefined) return; // never touched — nothing to commit
      setDrafts((d) => ({ ...d, [field]: undefined }));
      const n = parseFloat(raw.trim().replace(',', '.'));
      const value = Number.isFinite(n) ? n : null;
      if (value !== r[field]) onChange(index, { [field]: value });
    },
  });

  return (
    <TableRow className="border-b border-slate-100 last:border-0">
      <TableCell className="px-4 py-2">
        <Input value={r.item} onChange={(e) => onChange(index, { item: e.target.value })} className="h-8" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className={padClass(r.depth)}>
          <Input
            value={r.descripcion}
            onChange={(e) => onChange(index, { descripcion: e.target.value })}
            className={cn('h-8', r.tipo === 'grupo' && 'font-semibold')}
          />
        </div>
      </TableCell>
      <TableCell className="px-4 py-2">
        <Input
          value={r.unidad ?? ''}
          onChange={(e) => onChange(index, { unidad: e.target.value || null })}
          className="h-8"
        />
      </TableCell>
      <TableCell className="px-4 py-2 text-right">
        {r.tipo === 'item' && <Input {...numericProps('cantidad')} />}
      </TableCell>
      <TableCell className="px-4 py-2 text-right">
        {r.tipo === 'item' && <Input {...numericProps('precioUnitario')} />}
      </TableCell>
      <TableCell className={cn('px-4 py-2 text-right tabular-nums', r.tipo === 'grupo' && 'text-muted-foreground')}>
        {formatMoney(flags.total)}
      </TableCell>
      <TableCell className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!flags.canOutdent} onClick={() => onOutdent(index)} title="Desindentar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!flags.canIndent} onClick={() => onIndent(index)}
            title={flags.needsPromote ? 'Indentar (convierte la fila anterior en grupo)' : 'Indentar'}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!flags.canUp} onClick={() => onMoveUp(index)} title="Subir"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!flags.canDown} onClick={() => onMoveDown(index)} title="Bajar"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-transparent hover:text-destructive"
            onClick={() => onDelete(index)} title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

const flagsEqual = (a: DesgloseRowFlags, b: DesgloseRowFlags) =>
  a.canIndent === b.canIndent && a.needsPromote === b.needsPromote &&
  a.canOutdent === b.canOutdent && a.canUp === b.canUp &&
  a.canDown === b.canDown && a.total === b.total;

/** Memo: re-render only when THIS row's data object, position, enablement,
 *  subtotal or callbacks change. The flags array is rebuilt per edit, so the
 *  comparator compares flag VALUES, not identity; the callbacks are stable by
 *  construction (parent useCallback over a latest-rows ref), so comparing
 *  their identity is safe and cheap. */
export const DesgloseTableRow = memo(DesgloseTableRowBase, (a, b) =>
  a.row === b.row && a.index === b.index && flagsEqual(a.flags, b.flags) &&
  a.onChange === b.onChange && a.onIndent === b.onIndent && a.onOutdent === b.onOutdent &&
  a.onMoveUp === b.onMoveUp && a.onMoveDown === b.onMoveDown && a.onDelete === b.onDelete);
