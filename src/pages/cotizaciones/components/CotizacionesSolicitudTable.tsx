// Tab "Por solicitud": one row per cotización (the request). Mobile cards
// + desktop table-in-card, mirroring SolicitudesTable conventions.

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
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
import type { Cotizacion } from '@/types/api';
import { formatFecha, proyectoLabel } from '../shared';
import { TipoBadge } from './TipoBadge';

interface Props {
  rows: Cotizacion[];
  sortState: SortState;
  onSortChange: (column: string, direction: SortDirection | null) => void;
  columnFilters: ColumnFilters;
  onFilterChange: (column: string, values: string[]) => void;
  uniqueTipos: string[];
  uniqueProyectos: string[];
  onRowClick: (row: Cotizacion) => void;
}

export function CotizacionesSolicitudTable({
  rows,
  sortState,
  onSortChange,
  columnFilters,
  onFilterChange,
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
            title="No hay cotizaciones"
            description="No se encontraron cotizaciones con los filtros actuales"
          />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="hover:bg-muted/50">
              <CardContent className="pt-4">
                <div className="cursor-pointer" onClick={() => onRowClick(row)}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="font-semibold">{row.descripcion}</span>
                    <TipoBadge tipo={row.tipo} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {proyectoLabel(row.proyecto_nombre, row.ambito)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatFecha(row.created_at)}
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
                  columnKey="descripcion"
                  label="Descripción"
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      title="No hay cotizaciones"
                      description="No se encontraron cotizaciones con los filtros actuales"
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
                      {row.descripcion}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <TipoBadge tipo={row.tipo} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {proyectoLabel(row.proyecto_nombre, row.ambito)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatFecha(row.created_at)}
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
