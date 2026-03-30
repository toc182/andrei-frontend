type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface ColumnFilters {
  [columnKey: string]: string[];
}

const ESTADO_ORDER: Record<string, number> = {
  pendiente: 0,
  aprobada: 1,
  pagada: 2,
  facturada: 3,
  devolucion: 4,
};

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

export { getSortComparator, applyColumnFilters, ESTADO_ORDER };
export type { SortState, SortDirection, ColumnFilters };
