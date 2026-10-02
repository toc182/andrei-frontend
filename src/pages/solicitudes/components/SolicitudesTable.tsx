// Shared list view for solicitudes de pago — desktop table + mobile cards.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// The only difference between the two pages is whether the "Proyecto" column
// is rendered, controlled by the `showProyectoColumn` prop.

import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, TableSkeleton } from '@/components/shell/states';
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
import { ApprovalPillBar } from '@/components/shell/ApprovalPillBar';
import { EstadoBadge } from './EstadoBadge';
import { MensajeIconPopover } from './MensajeIconPopover';
import type { SolicitudPago } from '../types';
import { formatMoney } from '../../../utils/formatters';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { cn } from '@/lib/utils';

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
  uniqueCategorias: string[];
  onRowClick: (sol: SolicitudPago) => void;
  onMarkMensajeRead: (id: number) => void;
  /** Todavía no ha llegado nada: va el esqueleto, no «No hay solicitudes», que
   *  asomaba un instante en cada primera carga como si no hubiera ninguna. */
  cargando?: boolean;
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
  uniqueCategorias,
  onRowClick,
  onMarkMensajeRead,
  cargando = false,
}: SolicitudesTableProps) {
  const lenta = useCargaLenta(cargando);

  return (
    <>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {cargando ? null : solicitudes.length === 0 ? (
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
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <span>{sol.proveedor}</span>
                        {sol.mensaje && (
                          <MensajeIconPopover
                            mensaje={sol.mensaje}
                            autorNombre={sol.mensaje_autor_nombre ?? null}
                            leido={!!sol.mensaje_leido}
                            solicitudId={sol.id}
                            onMarkRead={onMarkMensajeRead}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 flex flex-col items-end">
                      {sol.estado === 'pendiente' ? (
                        sol.aprobadores_estado?.length ? (
                          <ApprovalPillBar
                            aprobadores={sol.aprobadores_estado}
                          />
                        ) : null
                      ) : (
                        <EstadoBadge estado={sol.estado} />
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold mb-1">
                    {formatMoney(sol.monto_total)}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span>{formatDate(sol.fecha)}</span>
                    {sol.categoria_nombre && (
                      <>
                        <span>·</span>
                        <span>{sol.categoria_nombre}</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table */}
      {/* Mientras carga, la tabla entera guarda su sitio sin verse las primeras
          0.3 s (useCargaLenta): esconder solo las filas dejaba asomar sus rayas. */}
      <div className={cn('hidden md:block', cargando && !lenta && 'invisible')}>
        <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
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
                    columnKey="categoria_nombre"
                    label="Categoría"
                    type="discrete"
                    sortState={sortState}
                    onSortChange={onSortChange}
                    uniqueValues={uniqueCategorias}
                    activeFilters={
                      columnFilters.categoria_nombre ?? uniqueCategorias
                    }
                    onFilterChange={onFilterChange}
                    emptyLabel="Sin categoría"
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
              {cargando ? (
                <TableSkeleton rows={6} columns={showProyectoColumn ? 8 : 7} />
              ) : (
                <TableBody>
                  {solicitudes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={showProyectoColumn ? 8 : 7}
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
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <span>{sol.proveedor}</span>
                            {sol.mensaje && (
                              <MensajeIconPopover
                                mensaje={sol.mensaje}
                                autorNombre={sol.mensaje_autor_nombre ?? null}
                                leido={!!sol.mensaje_leido}
                                solicitudId={sol.id}
                                onMarkRead={onMarkMensajeRead}
                              />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          {sol.categoria_nombre || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums text-slate-700">
                          {formatMoney(sol.monto_total)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {sol.estado === 'pendiente' ? (
                              sol.aprobadores_estado?.length ? (
                                <ApprovalPillBar
                                  aprobadores={sol.aprobadores_estado}
                                />
                              ) : null
                            ) : (
                              <EstadoBadge estado={sol.estado} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              )}
            </Table>
        </Card>
      </div>
    </>
  );
}
