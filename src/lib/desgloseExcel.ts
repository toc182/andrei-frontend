// desgloseExcel.ts — "Exportar" del desglose: builds a real .xlsx in the browser
// and triggers the download. exceljs (~1 MB) is imported DYNAMICALLY so the app
// bundle never pays for it — the cost lands on the click that exports.
//
// Visual parity with the screen table: sections carry the blue depth bands
// (light-theme --color-grupo-* from index.css), bold descriptions, indent by
// depth, container sections leave unidad/cantidad/P.U. blank and show their
// derived total dimmed, and the sheet ends with Subtotal / ITBMS / Total.

import { computeTotals, hasChildren, GRAND_TOTAL_KEY, type DesgloseRow } from './desgloseModel';

// index.css light-theme band ramp as ARGB, darkest at depth 0 (clamped past it).
const GRUPO_ARGB = ['FFB7C6E0', 'FFCFDAEC', 'FFE3EAF5', 'FFF0F4FB'];
const HEADER_ARGB = 'FFE2E8F0'; // slate-200, the on-screen header band
const DIM_ARGB = 'FF6B7280'; // muted-foreground for derived totals
const MONEY_FMT = '"B/." #,##0.00';

const sanitizeFileName = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Desglose';

export async function exportDesgloseExcel(args: {
  rows: DesgloseRow[];
  itbmsTasa: number | null;
  /** Nombre del proyecto — hoja y nombre del archivo. */
  title: string;
}): Promise<void> {
  const { rows, itbmsTasa, title } = args;
  // exceljs is CJS; depending on how the bundler surfaces it, the classes hang
  // off the module itself or off .default — accept either.
  type ExcelJSModule = typeof import('exceljs');
  const mod = (await import('exceljs')) as ExcelJSModule & { default?: ExcelJSModule };
  const ExcelJS = mod.Workbook ? mod : mod.default!;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Desglose', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Item', key: 'item', width: 12 },
    { header: 'Descripción', key: 'descripcion', width: 60 },
    { header: 'Unidad', key: 'unidad', width: 10 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'P.U.', key: 'pu', width: 14 },
    { header: 'Total', key: 'total', width: 16 },
  ];

  // Alignment mirrors the printed table (Ivan 2026-07-20): Item/Unidad/Cantidad
  // centered (content + header), P.U./Total right-aligned amounts with centered
  // headers, Descripción left.
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    cell.border = { bottom: { style: 'thin' } };
    cell.alignment = { horizontal: 'center' };
  });
  header.getCell('descripcion').alignment = { horizontal: 'left' };

  const totals = computeTotals(rows);
  rows.forEach((r, i) => {
    const container = r.tipo === 'grupo' && hasChildren(rows, i);
    const showVals = !container; // item o sección de una línea
    const excelRow = ws.addRow({
      item: r.item,
      descripcion: r.descripcion,
      unidad: showVals ? r.unidad ?? '' : '',
      cantidad: showVals && r.cantidad != null ? r.cantidad : '',
      pu: showVals && r.precioUnitario != null ? r.precioUnitario : '',
      total: totals.get(r.tempId) ?? 0,
    });
    excelRow.getCell('descripcion').alignment = { indent: r.depth, wrapText: true, vertical: 'top' };
    excelRow.getCell('item').alignment = { horizontal: 'center' };
    excelRow.getCell('unidad').alignment = { horizontal: 'center' };
    excelRow.getCell('cantidad').alignment = { horizontal: 'center' };
    excelRow.getCell('pu').numFmt = MONEY_FMT;
    excelRow.getCell('total').numFmt = MONEY_FMT;
    if (r.tipo === 'grupo') {
      const argb = GRUPO_ARGB[Math.min(r.depth, GRUPO_ARGB.length - 1)];
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      });
      excelRow.getCell('descripcion').font = { bold: true };
      if (container) excelRow.getCell('total').font = { color: { argb: DIM_ARGB } };
      else excelRow.getCell('total').font = { bold: true };
    }
  });

  // Bloque de totales, alineado bajo P.U. / Total (misma forma que el pie en pantalla).
  const grand = totals.get(GRAND_TOTAL_KEY) ?? 0;
  const totalLine = (label: string, value: number, bold: boolean) => {
    const excelRow = ws.addRow({ pu: label, total: value });
    excelRow.getCell('pu').font = bold ? { bold: true } : { color: { argb: DIM_ARGB } };
    excelRow.getCell('total').numFmt = MONEY_FMT;
    if (bold) {
      excelRow.getCell('total').font = { bold: true };
      excelRow.getCell('pu').border = { top: { style: 'thin' } };
      excelRow.getCell('total').border = { top: { style: 'thin' } };
    }
    return excelRow;
  };
  ws.addRow({});
  if (itbmsTasa != null) {
    totalLine('Subtotal', grand, false);
    totalLine(`ITBMS (${itbmsTasa}%)`, grand * itbmsTasa / 100, false);
    totalLine('Total', grand + grand * itbmsTasa / 100, true);
  } else {
    totalLine('Total', grand, true);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Desglose - ${sanitizeFileName(title)}.xlsx`;
  a.click();
  // Revoke on the next tick — revoking synchronously can cancel the download in
  // some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
