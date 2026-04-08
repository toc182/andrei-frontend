// Pagination controls for the solicitudes list.
// Lifted out of SolicitudesPagoGeneral.tsx during the refactor of issue #26.
//
// Currently only used in the global view. The project view's pagination
// feature is tracked in issue #32.

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SolicitudesPaginationProps {
  totalItems: number;
  showingFrom: number;
  showingTo: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function SolicitudesPagination({
  totalItems,
  showingFrom,
  showingTo,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: SolicitudesPaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {totalItems === 0
            ? 'Sin resultados'
            : `Mostrando ${showingFrom}–${showingTo} de ${totalItems}`}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(parseInt(v, 10))}
        >
          <SelectTrigger className="h-8 w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">por página</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          aria-label="Primera página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2 min-w-[80px] text-center">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
