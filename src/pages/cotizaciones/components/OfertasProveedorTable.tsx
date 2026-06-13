// Tab "Por proveedor": one row per supplier offer (flattened across all
// cotizaciones). Supplier is a column, so quotes can be scanned/filtered
// by proveedor. Mobile cards + desktop table-in-card.

import { Paperclip } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shell';
import { SortableHeader } from '@/components/SortableHeader';
import type {
  SortState,
  SortDirection,
  ColumnFilters,
} from '@/components/sortableHeaderUtils';
import type { CotizacionOfertaFlat } from '@/types/api';
import { formatMoney } from '@/utils/formatters';
import { formatFecha, proyectoLabel } from '../shared';
import { TipoBadge } from './TipoBadge';

interface Props {
  rows: CotizacionOfertaFlat[];
  sortState: SortState;
  onSortChange: (column: string, direction: SortDirection | null) => void;
  columnFilters: ColumnFilters;
  onFilterChange: (column: string, values: string[]) => void;
  uniqueProveedores: string[];
  uniqueTipos: string[];
  uniqueProyectos: string[];
  onRowClick: (row: CotizacionOfertaFlat) => void;
}

function ArchivosCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-navy">
      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
      {count}
    </span>
  );
}

export function OfertasProveedorTable({
  rows,
  sortState,
  onSortChange,
  columnFilters,
  onFilterChange,
  uniqueProveedores,
  uniqueTipos,
  uniqueProyectos,
  onRowClick,
}: Props) {
  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <EmptyState
            title="Aún no hay ofertas de proveedores"
            description="No se encontraron ofertas con los filtros actuales"
          />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="hover:bg-muted/50">
              <CardContent className="pt-4">
                <div className="cursor-pointer" onClick={() => onRowClick(row)}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="font-semibold">{row.proveedor}</span>
                    <span className="font-medium tabular-nums text-slate-700">
                      {formatMoney(row.monto)}
                    </span>
                  </div>
                  <div className="text-sm text-foreground">{row.descripcion}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>{proyectoLabel(row.proyecto_nombre, row.ambito)}</span>
                    <span>{formatFecha(row.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <SortableHeader
                  columnKey="proveedor"
                  label="Proveedor"
                  type="discrete"
                  sortState={sortState}
                  onSortChange={onSortChange}
                  uniqueValues={uniqueProveedores}
                  activeFilters={columnFilters.proveedor ?? uniqueProveedores}
                  onFilterChange={onFilterChange}
                />
                <SortableHeader
                  columnKey="descripcion"
                  label="Qué se cotizó"
                  type="numeric"
                  sortState={sortState}
                  onSortChange={onSortChange}
                />
                <SortableHeader
                  columnKey="tipo_label"
                  label="Tipo"
                  type="discrete"
                  sortState={sortState}
                  onSortChange={onSortChange}
                  uniqueValues={uniqueTipos}
                  activeFilters={columnFilters.tipo_label ?? uniqueTipos}
                  onFilterChange={onFilterChange}
                />
                <SortableHeader
                  columnKey="monto_num"
                  label="Precio"
                  type="numeric"
                  sortState={sortState}
                  onSortChange={onSortChange}
                  align="right"
                />
                <SortableHeader
                  columnKey="proyecto"
                  label="Proyecto"
                  type="discrete"
                  sortState={sortState}
                  onSortChange={onSortChange}
                  uniqueValues={uniqueProyectos}
                  activeFilters={columnFilters.proyecto ?? uniqueProyectos}
                  onFilterChange={onFilterChange}
                />
                <SortableHeader
                  columnKey="fecha"
                  label="Fecha"
                  type="numeric"
                  sortState={sortState}
                  onSortChange={onSortChange}
                />
                <TableHead className="px-4 py-2 text-center">Archivos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      title="Aún no hay ofertas de proveedores"
                      description="No se encontraron ofertas con los filtros actuales"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                    onClick={() => onRowClick(row)}
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {row.proveedor}
                    </TableCell>
                    <TableCell className="px-4 py-3">{row.descripcion}</TableCell>
                    <TableCell className="px-4 py-3">
                      <TipoBadge tipo={row.tipo} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium tabular-nums text-slate-700">
                      {formatMoney(row.monto)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {proyectoLabel(row.proyecto_nombre, row.ambito)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatFecha(row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <ArchivosCount count={row.archivos_count} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
