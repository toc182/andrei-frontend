// Items table + totals block shown inside SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor. Renders the item rows (if any) followed by the subtotal,
// every ajuste, and the final total.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '../../../../utils/formatters';
import type {
  SolicitudPago,
  SolicitudItem,
  SolicitudAjuste,
} from '../../types';

interface SolicitudItemsAndTotalsProps {
  solicitud: SolicitudPago;
  items: SolicitudItem[];
  ajustes: SolicitudAjuste[];
}

export function SolicitudItemsAndTotals({
  solicitud,
  items,
  ajustes,
}: SolicitudItemsAndTotalsProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Detalle</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">P.Unit</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.descripcion}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.cantidad} {item.unidad}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(item.precio_unitario)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(item.precio_total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="p-4 space-y-2 text-sm border-t">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal:</span>
          <span>{formatMoney(solicitud.subtotal)}</span>
        </div>
        {ajustes.map((ajuste) => (
          <div key={ajuste.id} className="flex justify-between">
            <span className="text-muted-foreground">{ajuste.descripcion}:</span>
            <span
              className={ajuste.tipo === 'descuento' ? 'text-error' : ''}
            >
              {ajuste.tipo === 'descuento' ? '-' : ''}
              {formatMoney(ajuste.monto)}
            </span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>TOTAL:</span>
          <span>{formatMoney(solicitud.monto_total)}</span>
        </div>
      </div>
    </div>
  );
}
