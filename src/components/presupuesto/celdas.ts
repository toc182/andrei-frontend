// Piezas compartidas de las casillas del presupuesto. Van aparte de
// NumberCell.tsx porque un archivo que exporta un componente no puede exportar
// tambien constantes sin romper el refresco en caliente de Vite.

/** Texto -> numero. Vacio o basura = null, que en el modelo es "casilla vacia":
 *  no multiplica. Se toleran las comas de miles que salen al pegar de Excel. */
export const parseNumero = (raw: string): number | null => {
  const t = raw.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Alto y borde de una casilla editable dentro de las tablas del presupuesto. */
export const cellInputClass =
  'h-7 rounded-sm border-border bg-card px-2 py-0 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0';
