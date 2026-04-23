// Shared list view for solicitudes de pago — desktop table + mobile cards.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// The only difference between the two pages is whether the "Proyecto" column
// is rendered, controlled by the `showProyectoColumn` prop.

import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shell/states';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2 } from 'lucide-react';
import { SortableHeader } from '@/components/SortableHeader';
import type {
  SortState,
  SortDirection,
  ColumnFilters,
} from '@/components/sortableHeaderUtils';
import { AprobadoresAvatars } from './AprobadoresAvatars';
import { EstadoBadge } from './EstadoBadge';
import type { SolicitudPago } from '../types';
import { formatMoney } from '../../../utils/formatters';

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface SolicitudesTableProps {
  solicitudes: SolicitudPago[];
  showProyectoColumn: boolean;
  sortState: SortState;
  onSortChange: (column: string, direction: SortDirection | null) => void;
  columnFilters: ColumnFilters;
  onFilterChange: (column: string, values: string[]) => void;
  uniqueProveedores: string[];
  uniqueProyectos: string[];
  uniqueEstados: string[];
  onRowClick: (sol: SolicitudPago) => void;
}

export function SolicitudesTable({
  solicitudes,
  showProyectoColumn,
  sortState,
  onSortChange,
  columnFilters,
  onFilterChange,
  uniqueProveedores,
  uniqueProyectos,
  uniqueEstados,
  onRowClick,
}: SolicitudesTableProps) {
  return (
    <>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {solicitudes.length === 0 ? (
          <EmptyState
            title="No hay solicitudes de pago"
            description="No se encontraron solicitudes con los filtros actuales"
          />
        ) : (
          solicitudes.map((sol) => (
            <Card
              key={sol.id}
              className={`hover:bg-muted/50 ${sol.es_mi_turno ? 'bg-warning/[0.04]' : ''}`}
            >
              <CardContent className="pt-4">
                <div
                  className="cursor-pointer"
                  onClick={() => onRowClick(sol)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold flex items-center gap-1">
                        {sol.numero}
                        {sol.revisada && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        )}
                        {sol.urgente && (
                          <span className="text-error font-bold ml-1">!</span>
                        )}
                      </div>
                      {showProyectoColumn && sol.proyecto_nombre && (
                        <div className="text-xs text-muted-foreground">
                          {sol.proyecto_nombre}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {sol.proveedor}
                      </div>
                    </div>
                    <div className="space-y-1 flex flex-col items-end">
                      {sol.estado === 'pendiente' ? (
                        sol.aprobadores_estado?.length ? (
                          <AprobadoresAvatars
                            aprobadores={sol.aprobadores_estado}
                          />
                        ) : null
                      ) : (
                        <EstadoBadge estado={sol.estado} />
                      )}
                      {sol.pinellas_paga && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 w-fit ${sol.reembolso_registrado ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30'}`}
                        >
                          Reembolso
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold mb-1">
                    {formatMoney(sol.monto_total)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(sol.fecha)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    columnKey="numero"
                    label="Numero"
                    type="numeric"
                    sortState={sortState}
                    onSortChange={onSortChange}
                  />
                  <TableHead className="w-6 px-0"></TableHead>
                  {showProyectoColumn && (
                    <SortableHeader
                      columnKey="proyecto_nombre"
                      label="Proyecto"
                      type="discrete"
                      sortState={sortState}
                      onSortChange={onSortChange}
                      uniqueValues={uniqueProyectos}
                      activeFilters={
                        columnFilters.proyecto_nombre ?? uniqueProyectos
                      }
                      onFilterChange={onFilterChange}
                    />
                  )}
                  <SortableHeader
                    columnKey="fecha"
                    label="Fecha"
                    type="numeric"
                    sortState={sortState}
                    onSortChange={onSortChange}
                  />
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
                    columnKey="monto_total"
                    label="Monto Total"
                    type="numeric"
                    sortState={sortState}
                    onSortChange={onSortChange}
                    align="right"
                  />
                  <SortableHeader
                    columnKey="estado"
                    label="Estado"
                    type="discrete"
                    sortState={sortState}
                    onSortChange={onSortChange}
                    uniqueValues={uniqueEstados}
                    activeFilters={columnFilters.estado ?? uniqueEstados}
                    onFilterChange={onFilterChange}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showProyectoColumn ? 7 : 6}
                      className="p-0"
                    >
                      <EmptyState
                        title="No hay solicitudes de pago"
                        description="No se encontraron solicitudes con los filtros actuales"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  solicitudes.map((sol) => (
                    <TableRow
                      key={sol.id}
                      className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 ${sol.es_mi_turno ? 'bg-warning/[0.04]' : ''}`}
                      onClick={() => onRowClick(sol)}
                    >
                      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                        <span className="flex items-center gap-1">
                          {sol.numero}
                          {sol.revisada && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-0 text-center">
                        {sol.urgente && (
                          <span className="text-error font-bold">!</span>
                        )}
                      </TableCell>
                      {showProyectoColumn && (
                        <TableCell>{sol.proyecto_nombre || '-'}</TableCell>
                      )}
                      <TableCell>{formatDate(sol.fecha)}</TableCell>
                      <TableCell>{sol.proveedor}</TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums text-slate-700">
                        {formatMoney(sol.monto_total)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {sol.estado === 'pendiente' ? (
                            sol.aprobadores_estado?.length ? (
                              <AprobadoresAvatars
                                aprobadores={sol.aprobadores_estado}
                              />
                            ) : null
                          ) : (
                            <EstadoBadge estado={sol.estado} />
                          )}
                          {sol.pinellas_paga && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 w-fit ${sol.reembolso_registrado ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30'}`}
                            >
                              Reembolso
                            </Badge>
                          )}
                        </div>
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
