// Tab "Costos unitarios": price-history pool of line items pulled from quotes
// (descripción, unidad, precio unitario, proveedor, fecha). Scaffold only —
// no data source wired yet; the table renders empty until the backend exists.

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shell';

export function CostosUnitariosTable() {
  return (
    <>
      {/* Mobile */}
      <div className="md:hidden">
        <EmptyState
          title="Sin costos unitarios"
          description="Aún no hay precios registrados aquí."
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="px-4">Descripción</TableHead>
                <TableHead className="px-4">Unidad</TableHead>
                <TableHead className="px-4 text-right">Precio unitario</TableHead>
                <TableHead className="px-4">Proveedor</TableHead>
                <TableHead className="px-4">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    title="Sin costos unitarios"
                    description="Aún no hay precios registrados aquí."
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
