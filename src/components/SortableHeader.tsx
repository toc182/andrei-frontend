import { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface ColumnFilters {
  [columnKey: string]: string[];
}

interface SortableHeaderProps {
  columnKey: string;
  label: string;
  type: 'discrete' | 'numeric';
  sortState: SortState;
  onSortChange: (column: string, direction: SortDirection) => void;
  uniqueValues?: string[];
  activeFilters?: string[];
  onFilterChange?: (column: string, values: string[]) => void;
  className?: string;
  align?: 'left' | 'right';
}

const ESTADO_ORDER: Record<string, number> = {
  pendiente: 0,
  aprobada: 1,
  pagada: 2,
  facturada: 3,
  devolucion: 4,
};

function SortableHeader({
  columnKey,
  label,
  type,
  sortState,
  onSortChange,
  uniqueValues = [],
  activeFilters,
  onFilterChange,
  className = '',
  align = 'left',
}: SortableHeaderProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isActive = sortState.column === columnKey;
  const direction = isActive ? sortState.direction : null;
  const hasActiveFilter = activeFilters !== undefined && activeFilters.length < uniqueValues.length;

  const cycleSort = () => {
    if (!isActive || direction === null) {
      onSortChange(columnKey, 'asc');
    } else if (direction === 'asc') {
      onSortChange(columnKey, 'desc');
    } else {
      onSortChange(columnKey, null);
    }
  };

  const handleSortButton = (dir: SortDirection) => {
    onSortChange(columnKey, dir);
  };

  const handleFilterToggle = (value: string, checked: boolean) => {
    if (!onFilterChange || !activeFilters) return;
    if (checked) {
      onFilterChange(columnKey, [...activeFilters, value]);
    } else {
      onFilterChange(columnKey, activeFilters.filter((v) => v !== value));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onFilterChange) return;
    onFilterChange(columnKey, checked ? [...uniqueValues] : []);
  };

  const SortArrow = () => {
    if (!isActive || direction === null) return null;
    return direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
    );
  };

  // Numeric/Date columns: direct click, no popover
  if (type === 'numeric') {
    return (
      <TableHead
        className={`cursor-pointer select-none group ${isActive ? 'bg-blue-50/50' : ''} ${className}`}
        onClick={cycleSort}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          <span className={`${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} transition-opacity`}>
            {isActive && direction ? (
              <SortArrow />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </span>
        </div>
      </TableHead>
    );
  }

  // Discrete columns: popover with sort + filter
  return (
    <TableHead className={`p-0 ${isActive ? 'bg-blue-50/50' : ''} ${className}`}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={`flex items-center gap-1 cursor-pointer select-none group px-4 py-2 ${align === 'right' ? 'justify-end' : ''}`}
          >
            {label}
            <span className={`${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} transition-opacity`}>
              {isActive && direction ? (
                <SortArrow />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </span>
            {hasActiveFilter && (
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-3" align="start">
          {/* Sort buttons */}
          <div className="flex gap-1 mb-3">
            <Button
              variant={direction === 'asc' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => handleSortButton('asc')}
            >
              <ArrowUp className="h-3 w-3 mr-1" />
              Asc
            </Button>
            <Button
              variant={direction === 'desc' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => handleSortButton('desc')}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              Desc
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handleSortButton(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Filter checkboxes */}
          {uniqueValues.length > 0 && onFilterChange && activeFilters && (
            <>
              <div className="border-t my-2" />
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Filtrar</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={activeFilters.length === uniqueValues.length}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                  <span className="text-sm font-medium">Todos</span>
                </label>
                <div className="border-t my-1" />
                {uniqueValues.map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={activeFilters.includes(value)}
                      onCheckedChange={(checked) => handleFilterToggle(value, !!checked)}
                    />
                    <span className="text-sm">{value || '(vacío)'}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </TableHead>
  );
}

// Sort comparator helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSortComparator(
  sortState: SortState,
): ((a: Record<string, any>, b: Record<string, any>) => number) | null {
  if (!sortState.column || !sortState.direction) return null;

  const { column, direction } = sortState;
  const multiplier = direction === 'asc' ? 1 : -1;

  return (a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    // Estado: use lifecycle order
    if (column === 'estado') {
      const aOrder = ESTADO_ORDER[aVal as string] ?? 99;
      const bOrder = ESTADO_ORDER[bVal as string] ?? 99;
      return (aOrder - bOrder) * multiplier;
    }

    // Numeric
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier;
    }

    // Date strings (YYYY-MM-DD or ISO)
    if (column === 'fecha' || column === 'updated_at') {
      return (new Date(aVal as string).getTime() - new Date(bVal as string).getTime()) * multiplier;
    }

    // String comparison
    const aStr = (aVal as string || '').toLowerCase();
    const bStr = (bVal as string || '').toLowerCase();
    return aStr.localeCompare(bStr) * multiplier;
  };
}

// Filter helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyColumnFilters<T extends Record<string, any>>(
  items: T[],
  columnFilters: ColumnFilters,
): T[] {
  return items.filter((item) => {
    for (const [column, allowedValues] of Object.entries(columnFilters)) {
      const val = String(item[column] ?? '');
      if (!allowedValues.includes(val)) return false;
    }
    return true;
  });
}

export { SortableHeader, getSortComparator, applyColumnFilters };
export type { SortState, SortDirection, ColumnFilters };
