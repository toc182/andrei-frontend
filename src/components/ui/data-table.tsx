/**
 * DataTable - Componente genérico de tabla
 *
 * Basado en Table de shadcn/ui con soporte para:
 * - Columnas configurables
 * - Loading state
 * - Empty state
 * - Row click
 * - Acciones por fila
 */

import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface DataTableColumn<T> {
  /** Identificador único de la columna */
  id: string
  /** Texto del header */
  header: string
  /** Función para renderizar la celda */
  cell: (row: T) => ReactNode
  /** Clase CSS opcional para el header */
  headerClassName?: string
  /** Clase CSS opcional para las celdas */
  cellClassName?: string
}

export interface DataTableProps<T> {
  /** Definición de columnas */
  columns: DataTableColumn<T>[]
  /** Datos a mostrar */
  data: T[]
  /** Función para obtener key única de cada fila */
  rowKey: (row: T) => string | number
  /** Estado de carga */
  loading?: boolean
  /** Mensaje cuando no hay datos */
  emptyMessage?: string
  /** Mensaje mientras carga */
  loadingMessage?: string
  /** Handler al hacer click en una fila */
  onRowClick?: (row: T) => void
  /** Clase CSS para el contenedor */
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  loadingMessage = 'Cargando...',
  onRowClick,
  className,
}: DataTableProps<T>) {
  // Loading state centrado
  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    )
  }

  return (
    <div className={`rounded-md border ${className || ''}`}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} className={column.headerClassName}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={rowKey(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.cellClassName}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default DataTable
