// Column metadata for the desglose grid, shared by the row (which renders and
// opens cells) and the view (which decides where Tab goes next). Kept out of the
// component files so both can import it without breaking fast refresh.

import type { DesgloseRow } from '@/lib/desgloseModel';

export type DesgloseField = 'item' | 'descripcion' | 'unidad' | 'cantidad' | 'precioUnitario';

/** Left-to-right tab order of the editable cells. Total is derived, so it is
 *  not in here — you cannot type into it. */
export const FIELD_ORDER: DesgloseField[] = ['item', 'descripcion', 'unidad', 'cantidad', 'precioUnitario'];

export const NUMERIC_FIELDS: DesgloseField[] = ['cantidad', 'precioUnitario'];

/** The "value" columns (unit + montos). A container section (grupo WITH
 *  children) has none — its numbers come from its children. A childless section
 *  ("de una línea") owns them like an item does. */
export const VALUE_FIELDS: DesgloseField[] = ['unidad', 'cantidad', 'precioUnitario'];

/** Mirrors the column widths the backend enforces. */
export const MAX_LEN: Partial<Record<DesgloseField, number>> = { item: 60, unidad: 30 };

/** Whether a cell can be typed into. Item code + descripción always; the value
 *  columns only when the row owns values — an item, or a childless section
 *  (`pricedSection`). A container section leaves them blank. */
export const isFieldEditable = (row: DesgloseRow, field: DesgloseField, pricedSection: boolean) =>
  !(row.tipo === 'grupo' && !pricedSection && VALUE_FIELDS.includes(field));

/** The raw text a cell starts editing from — NOT the formatted display value
 *  (you type "1500", you don't type "B/. 1,500.00"). */
export const editValue = (row: DesgloseRow, field: DesgloseField): string => {
  const v = row[field];
  return v === null || v === undefined ? '' : String(v);
};
