// Full table row for the desglose editor — the data cells (Item / Descripción
// / Unidad / Cantidad / P.U. / Total) plus the row-actions cell (indent /
// outdent / move / delete). Split out of DesgloseView.tsx to keep that file
// focused on state and handlers; all tree-mutation logic still lives in the
// parent since it owns `rows` and the AlertDialog state — this component only
// renders and wires clicks through via callbacks.

import { type ChangeEvent } from 'react';
import { ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import { indentLegal, outdentLegal, moveSubtree, type DesgloseRow } from '@/lib/desgloseModel';

// Depth padding for the Descripción cell — literal Tailwind classes (no
// dynamic `pl-${n}` strings), clamped for depths beyond the scale.
const PAD = ['pl-0', 'pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20', 'pl-24', 'pl-28', 'pl-32'];
const padClass = (depth: number) => PAD[Math.min(depth, PAD.length - 1)];

interface DesgloseTableRowProps {
  rows: DesgloseRow[];
  index: number;
  /** Precomputed subtotal for this row's tempId (computeTotals().get(tempId) ?? 0). */
  total: number;
  onChange: (i: number, patch: Partial<DesgloseRow>) => void;
  onIndent: (i: number) => void;
  onOutdent: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onDelete: (i: number) => void;
}

export function DesgloseTableRow({
  rows, index, total, onChange, onIndent, onOutdent, onMoveUp, onMoveDown, onDelete,
}: DesgloseTableRowProps) {
  const r = rows[index];
  const canIndent = indentLegal(rows, index);
  const canOutdent = outdentLegal(rows, index);
  const canMoveUp = moveSubtree(rows, index, -1) !== rows;
  const canMoveDown = moveSubtree(rows, index, 1) !== rows;

  const onNumberChange = (field: 'cantidad' | 'precioUnitario') => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '') { onChange(index, { [field]: null }); return; }
    const n = parseFloat(v);
    onChange(index, { [field]: Number.isNaN(n) ? null : n });
  };

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
        {r.tipo === 'item' && (
          <Input
            inputMode="decimal"
            value={r.cantidad ?? ''}
            onChange={onNumberChange('cantidad')}
            className="h-8 text-right tabular-nums"
          />
        )}
      </TableCell>
      <TableCell className="px-4 py-2 text-right">
        {r.tipo === 'item' && (
          <Input
            inputMode="decimal"
            value={r.precioUnitario ?? ''}
            onChange={onNumberChange('precioUnitario')}
            className="h-8 text-right tabular-nums"
          />
        )}
      </TableCell>
      <TableCell className={cn('px-4 py-2 text-right tabular-nums', r.tipo === 'grupo' && 'text-muted-foreground')}>
        {formatMoney(total)}
      </TableCell>
      <TableCell className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!canOutdent} onClick={() => onOutdent(index)} title="Desindentar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!canIndent} onClick={() => onIndent(index)} title="Indentar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!canMoveUp} onClick={() => onMoveUp(index)} title="Subir"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-transparent hover:text-foreground"
            disabled={!canMoveDown} onClick={() => onMoveDown(index)} title="Bajar"
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
