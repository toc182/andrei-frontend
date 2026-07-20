// desglosePrint.ts — print/PDF page builder for the desglose de precios.
// Follows the cronogramaPrint pipeline (its sibling module): every page is a
// millimeter-viewBox <svg> string; table text at a FIXED physical size (pt→mm);
// rows paginate automatically and the column header repeats on every page. The
// document header (logos + centered title/subtitle) reuses fitPrintHeader from
// cronogramaPrint, and the caller opens the result with its openPrintWindow.
//
// Differences from the cronograma: no chart band and no pages-wide windows —
// the Descripción column absorbs all slack instead (errTableTooWide when even
// that leaves it too narrow), and long descriptions WRAP (≤4 lines, then …)
// rather than truncate, so rows have variable height and pagination packs by
// accumulated height, not a fixed rows-per-page.
//
// Everything here is pure (no DOM) — gated by scripts/desglose-print.spec.ts
// (npx tsx scripts/desglose-print.spec.ts).
//
// Colors are raw hex inside SVG presentation attributes (canvas-like context,
// mirroring cronogramaPrint) — the "no raw hex" rule targets Tailwind classes.

import { PT_MM, PRINT_FONTS, MAX_LOGOS_PER_SIDE, fitPrintHeader } from './cronogramaPrint';
import { computeTotals, hasChildren, GRAND_TOTAL_KEY, type DesgloseRow } from './desgloseModel';

// Print stays on white paper: light-theme band ramp from index.css
// (--color-grupo-0..3), darkest at depth 0. Clamped past the ramp.
const GRUPO_FILL = ['#B7C6E0', '#CFDAEC', '#E3EAF5', '#F0F4FB'];
export const grupoFill = (depth: number) => GRUPO_FILL[Math.min(depth, GRUPO_FILL.length - 1)];

// Diseño "B'v2" (aprobado por Ivan sobre mock, 2026-07-20): la TABLA va
// enmarcada con un borde sutil de esquinas redondeadas — nunca la página
// completa —, sin líneas verticales entre columnas, banda de encabezado un
// paso más oscura que la banda de sección nivel 0 con el texto centrado
// verticalmente, la tabla separada del encabezado del documento, y los
// totales como FILAS de la tabla (todos en negrita) dentro del mismo marco.
const COL = {
  text: '#1c1f24',
  textDim: '#6b7280',
  frame: '#c9cfd8', // subtle table frame
  headFill: '#9cb0d0', // column-header band — darker than --color-grupo-0 #B7C6E0
  headText: '#16233a',
  headBorder: '#8ca0c2',
  hairline: '#d9dde3', // footer rule
  rowline: 'rgba(120,130,150,0.25)',
};

const FRAME_RX = 1.5; // mm — table frame corner radius
const TABLE_GAP_MM = 5; // air between the document header and the table frame

const MIN_DESC_MM = 35; // below this the wrapped Descripción is unreadable
const MAX_DESC_LINES = 4;

// ---- types ----

export interface DesglosePrintOptions {
  Wmm: number;
  Hmm: number;
  marginMM: number;
  fontKey: keyof typeof PRINT_FONTS;
  /** Máx. páginas de alto (0 = auto). Cuando el desglose no cabe, la letra se
   *  encoge en pasos de 0.5pt (nunca bajo MIN_PT); si aun así no cabe, layout.warn
   *  lo dice y se usan las páginas necesarias. */
  maxTall: number;
  title: string;
  subtitle: string;
  /** Fecha de impresión ya formateada ('20 jul 2026'); vacía/ausente = sin pie
   *  de fecha. Viene del caller — el builder es puro y no puede mirar el reloj. */
  fecha?: string;
  logosLeft: string[]; // data URLs, up to MAX_LOGOS_PER_SIDE each side
  logosRight: string[];
}

export interface DesglosePrintData {
  rows: DesgloseRow[];
  itbmsTasa: number | null; // null = sin ITBMS (footer shows only Total)
}

/** One row reduced to the exact strings the page prints (also what the spec pins). */
export interface DesglosePrintRow {
  item: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  pu: string;
  total: string;
  depth: number;
  grupo: boolean;
  /** Grupo WITH children: montos blank, derived total dimmed. */
  container: boolean;
}

// ---- deterministic number formatting (no Intl — golden-spec stable) ----

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** '1,234.56' — always two decimals, thousands grouped. */
export function fmt2(n: number): string {
  const neg = n < 0 ? '-' : '';
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return `${neg}${group(int)}.${dec}`;
}

export const money = (n: number) => `B/. ${fmt2(n)}`;

/** Cantidad: thousands grouped, up to 4 decimals, no trailing zeros ('480', '0.5', '1,234.5'). */
export function fmtCantidad(n: number): string {
  const neg = n < 0 ? '-' : '';
  const [int, dec] = Math.abs(n).toFixed(4).split('.');
  const trimmed = dec.replace(/0+$/, '');
  return `${neg}${group(int)}${trimmed ? '.' + trimmed : ''}`;
}

// ---- rows -> printable cells (screen parity: DesgloseTableRow's showVals rules) ----

export function toPrintRows(rows: DesgloseRow[]): { printRows: DesglosePrintRow[]; grandTotal: number } {
  const totals = computeTotals(rows);
  const printRows = rows.map((r, i) => {
    const container = r.tipo === 'grupo' && hasChildren(rows, i);
    const showVals = !container; // item o sección de una línea
    return {
      item: r.item,
      descripcion: r.descripcion,
      unidad: showVals ? r.unidad ?? '' : '',
      cantidad: showVals && r.cantidad != null ? fmtCantidad(r.cantidad) : '',
      pu: showVals && r.precioUnitario != null ? money(r.precioUnitario) : '',
      total: money(totals.get(r.tempId) ?? 0),
      depth: r.depth,
      grupo: r.tipo === 'grupo',
      container,
    };
  });
  return { printRows, grandTotal: totals.get(GRAND_TOTAL_KEY) ?? 0 };
}

// ---- helpers ----

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const f2 = (n: number) => n.toFixed(2);

/** Greedy word-wrap by estimated char width (em ≈ 0.62·font, the pipeline's
 *  metric). Overlong single words hard-break; past maxLines the tail joins the
 *  last line and truncates with '…'. Always returns ≥1 line. */
export function wrapTextMM(s: string, widthMM: number, fontMM: number, maxLines: number): string[] {
  const maxChars = Math.max(1, Math.floor(widthMM / (fontMM * 0.62)));
  const words: string[] = [];
  for (const w of (s || '').split(/\s+/).filter(Boolean)) {
    for (let p = 0; p < w.length; p += maxChars) words.push(w.slice(p, p + maxChars));
  }
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (line && test.length > maxChars) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].slice(0, Math.max(1, maxChars - 1)) + '…';
    return cut;
  }
  return lines;
}

// ---- layout ----

interface PrintCol {
  key: 'item' | 'desc' | 'unidad' | 'cantidad' | 'pu' | 'total';
  label: string;
  w: number;
  x: number;
  /** Content alignment. Headers center on every column except Descripción. */
  align: 'left' | 'center' | 'right';
}

const MIN_PT = 6; // shrink floor (same as the cronograma's)

export function computeDesglosePrintLayout(opts: DesglosePrintOptions, data: DesglosePrintData) {
  const { Wmm, Hmm, marginMM, fontKey, title, subtitle, logosLeft, logosRight } = opts;
  const pwMM = Wmm - 2 * marginMM;
  const phMM = Hmm - 2 * marginMM;
  const maxTall = Math.max(0, Math.round(opts.maxTall || 0));
  const { printRows, grandTotal } = toPrintRows(data.rows);
  const totalsLines = data.itbmsTasa != null ? 3 : 1;

  // The WHOLE layout is a function of the font size: columns, wraps, row heights
  // and pagination all move together, so the fit-to-pages loop below re-derives
  // everything per step instead of scaling anything.
  const derive = (fontPt: number) => {
    const fontMM = fontPt * PT_MM;
    const emMM = fontMM * 0.62;
    const padMM = fontMM * 0.6;
    const rowLineH = Math.max(fontPt * PT_MM * 1.7, fontMM * 1.4); // first line's slot
    const lineAdvance = fontMM * 1.25; // each extra wrapped line
    const colHeaderH = fontMM * 2.2;
    const docFooterH = fontPt * PT_MM * 2.2;

    // Fixed columns size to their longest content (clamped); Descripción takes the rest.
    const longest = (get: (r: DesglosePrintRow) => string, label: string) =>
      Math.max(label.length, ...printRows.map((r) => get(r).length));
    const chars = {
      item: Math.min(Math.max(longest((r) => r.item, 'Item'), 4), 12),
      unidad: Math.min(Math.max(longest((r) => r.unidad, 'Unidad'), 6), 10),
      cantidad: Math.min(Math.max(longest((r) => r.cantidad, 'Cantidad'), 8), 16),
      pu: Math.min(Math.max(longest((r) => r.pu, 'P.U.'), 8), 18),
      total: Math.min(Math.max(longest((r) => r.total, 'Total'), 8), 18),
    };
    const wOf = (c: number) => c * emMM + padMM;
    const fixedW = wOf(chars.item) + wOf(chars.unidad) + wOf(chars.cantidad) + wOf(chars.pu) + wOf(chars.total);
    const descW = pwMM - fixedW;

    const hdr = fitPrintHeader({
      pwMM, fontPt, title, subtitle,
      nLogosLeft: logosLeft.length, nLogosRight: logosRight.length,
      minDocHeaderH: fontPt * PT_MM * 4.4,
    });

    const base = {
      fontPt, fontMM, emMM, padMM, rowLineH, lineAdvance, colHeaderH, docFooterH,
      descW, ...hdr,
    };
    if (descW < MIN_DESC_MM) {
      return {
        ...base, errTableTooWide: true as const, cols: [] as PrintCol[], indentMM: 0,
        rowHeights: [] as number[], rowLines: [] as string[][],
        pageRows: [] as Array<{ start: number; end: number }>,
        totalsOnNewPage: false, bodyH: 0, totalsH: 0, pagesTall: 0,
      };
    }

    const cols: PrintCol[] = [
      { key: 'item', label: 'Item', w: wOf(chars.item), x: 0, align: 'center' },
      { key: 'desc', label: 'Descripción', w: descW, x: 0, align: 'left' },
      { key: 'unidad', label: 'Unidad', w: wOf(chars.unidad), x: 0, align: 'center' },
      { key: 'cantidad', label: 'Cantidad', w: wOf(chars.cantidad), x: 0, align: 'center' },
      { key: 'pu', label: 'P.U.', w: wOf(chars.pu), x: 0, align: 'right' },
      { key: 'total', label: 'Total', w: wOf(chars.total), x: 0, align: 'right' },
    ];
    let cx = 0;
    for (const c of cols) {
      c.x = cx;
      cx += c.w;
    }

    const indentMM = fontMM * 0.9;
    // Wrap every Descripción now (cell width minus its depth indent) — heights drive pagination.
    const rowLines: string[][] = [];
    const rowHeights = printRows.map((r) => {
      const lines = wrapTextMM(r.descripcion, descW - padMM - r.depth * indentMM, fontMM, MAX_DESC_LINES);
      rowLines.push(lines);
      return rowLineH + (lines.length - 1) * lineAdvance;
    });

    // Pack rows into pages by height; the totals block must fit under the last row
    // (or overflow onto one extra page of its own).
    const bodyH = phMM - hdr.docHeaderH - TABLE_GAP_MM - docFooterH - colHeaderH;
    const totalsH = totalsLines * rowLineH + 2;
    const pageRows: Array<{ start: number; end: number }> = [];
    let start = 0;
    let used = 0;
    printRows.forEach((_, i) => {
      const h = Math.min(rowHeights[i], bodyH); // a pathological row taller than a page still lands
      if (used > 0 && used + h > bodyH) {
        pageRows.push({ start, end: i });
        start = i;
        used = 0;
      }
      used += h;
    });
    pageRows.push({ start, end: printRows.length });
    const totalsOnNewPage = used + totalsH > bodyH && printRows.length > 0;
    const pagesTall = pageRows.length + (totalsOnNewPage ? 1 : 0);

    return {
      ...base, errTableTooWide: false as const, cols, indentMM, rowHeights, rowLines,
      pageRows, totalsOnNewPage, bodyH, totalsH, pagesTall,
    };
  };

  let L = derive(PRINT_FONTS[fontKey] ?? PRINT_FONTS.normal);
  let warn: string | null = null;
  if (!L.errTableTooWide && maxTall > 0 && L.pagesTall > maxTall) {
    // Shrinking the font never widens the table (every column shrinks with it),
    // so errTableTooWide cannot appear mid-loop if it wasn't there at the start.
    let fp = L.fontPt;
    while (L.pagesTall > maxTall && fp > MIN_PT) {
      fp = Math.max(MIN_PT, fp - 0.5);
      L = derive(fp);
    }
    if (L.pagesTall > maxTall) {
      warn = `No cabe en ${maxTall} pág. de alto ni con la letra mínima; usa ${L.pagesTall}.`;
    }
  }

  return { ...L, pwMM, phMM, maxTall, printRows, grandTotal, warn };
}

export type DesglosePrintLayout = ReturnType<typeof computeDesglosePrintLayout>;

// ---- page assembly ----

export function buildDesglosePrintPages(
  opts: DesglosePrintOptions,
  data: DesglosePrintData,
): { pages: string[]; layout: DesglosePrintLayout } {
  // Logos are attacker-influenceable uploads: require the data:image/ scheme and
  // escape — they land inside a same-origin popup document.
  const safeLogos = (arr: string[]) =>
    arr
      .map((s) => (s && s.startsWith('data:image/') ? esc(s) : null))
      .filter((s): s is string => s != null)
      .slice(0, MAX_LOGOS_PER_SIDE);
  const logosL = safeLogos(opts.logosLeft);
  const logosR = safeLogos(opts.logosRight);
  const layout = computeDesglosePrintLayout(opts, data);
  if (layout.errTableTooWide) return { pages: [], layout };
  const {
    pwMM, phMM, fontMM, padMM, rowLineH, lineAdvance, colHeaderH, docFooterH, docHeaderH,
    titleFontMM, titleLines, logoW, cols, indentMM, printRows, rowHeights, rowLines,
    pageRows, totalsOnNewPage, grandTotal,
  } = layout;

  const totalPages = layout.pagesTall;
  const colByKey = Object.fromEntries(cols.map((c) => [c.key, c])) as Record<PrintCol['key'], PrintCol>;
  const fColHdr = fontMM * 0.9;
  const LOGO_GAP_MM = 2;

  const cellText = (c: PrintCol, txt: string, y: number, o: { indent?: number; bold?: boolean; fill?: string } = {}) => {
    if (!txt) return '';
    const x = c.align === 'right' ? c.x + c.w - padMM / 2
      : c.align === 'center' ? c.x + c.w / 2
      : c.x + padMM / 2 + (o.indent || 0);
    const anchor = c.align === 'right' ? ' text-anchor="end"' : c.align === 'center' ? ' text-anchor="middle"' : '';
    return `<text x="${f2(x)}" y="${f2(y)}" font-size="${f2(fontMM)}" fill="${o.fill || COL.text}"` +
      `${anchor}${o.bold ? ' font-weight="600"' : ''}>${esc(txt)}</text>`;
  };

  /** Subtotal / ITBMS / Total como FILAS de la tabla (B'v2): todos en negrita,
   *  etiquetas en la columna P.U., montos en la columna Total, dentro del mismo
   *  marco y arrancando con una línea al color del marco (el cierre visual de
   *  las filas de datos). Devuelve el SVG y la Y donde termina (ahí cierra el
   *  marco). */
  const totalsRows = (yTop: number): { svg: string; yEnd: number } => {
    const labelX = colByKey.pu.x + colByKey.pu.w - padMM / 2;
    const valueX = pwMM - padMM / 2;
    let svg = `<line x1="0" y1="${f2(yTop)}" x2="${f2(pwMM)}" y2="${f2(yTop)}" stroke="${COL.frame}" stroke-width="0.3"/>`;
    let y = yTop;
    const line = (label: string, value: string) => {
      const by = y + rowLineH * 0.7;
      svg += `<text x="${f2(labelX)}" y="${f2(by)}" font-size="${f2(fontMM)}" fill="${COL.text}" text-anchor="end" font-weight="700">${esc(label)}</text>` +
        `<text x="${f2(valueX)}" y="${f2(by)}" font-size="${f2(fontMM)}" fill="${COL.text}" text-anchor="end" font-weight="700">${esc(value)}</text>`;
      y += rowLineH;
    };
    if (data.itbmsTasa != null) {
      const itbms = grandTotal * data.itbmsTasa / 100;
      line('Subtotal', money(grandTotal));
      line(`ITBMS (${fmtCantidad(data.itbmsTasa)}%)`, money(itbms));
      line('Total', money(grandTotal + itbms));
    } else {
      line('Total', money(grandTotal));
    }
    return { svg, yEnd: y + 1 };
  };

  /** Shared page shell: document header (logos + centered title) + footer.
   *  B': NO full-page frame — the table draws its own subtle box. */
  const openPage = (pageNo: number): string => {
    let svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(pwMM)} ${f2(phMM)}" ` +
      `width="${f2(pwMM)}mm" height="${f2(phMM)}mm" font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">`;
    svg += `<rect width="${f2(pwMM)}" height="${f2(phMM)}" fill="#ffffff"/>`;
    logosL.forEach((l, j) => {
      svg += `<image href="${l}" x="${f2(2 + j * (logoW + LOGO_GAP_MM))}" y="1.5" width="${f2(logoW)}" height="${f2(docHeaderH - 3)}" preserveAspectRatio="xMidYMid meet"/>`;
    });
    logosR.forEach((l, j) => {
      svg += `<image href="${l}" x="${f2(pwMM - 2 - logoW - j * (logoW + LOGO_GAP_MM))}" y="1.5" width="${f2(logoW)}" height="${f2(docHeaderH - 3)}" preserveAspectRatio="xMidYMid meet"/>`;
    });
    const titleLineMM = titleFontMM * 1.2;
    const subMM = opts.subtitle ? fontMM * 1.3 : 0;
    const blockH = titleLines.length * titleLineMM + subMM;
    let ty = Math.max(titleFontMM, (docHeaderH - blockH) / 2 + titleFontMM * 0.9);
    let lastTy = ty;
    for (const ln of titleLines) {
      svg += `<text x="${f2(pwMM / 2)}" y="${f2(ty)}" font-size="${f2(titleFontMM)}" font-weight="700" fill="${COL.text}" text-anchor="middle">${esc(ln)}</text>`;
      lastTy = ty;
      ty += titleLineMM;
    }
    if (opts.subtitle) svg += `<text x="${f2(pwMM / 2)}" y="${f2(lastTy + fontMM * 1.15)}" font-size="${f2(fontMM)}" fill="${COL.textDim}" text-anchor="middle">${esc(opts.subtitle)}</text>`;
    svg += `<line x1="0" y1="${f2(phMM - docFooterH)}" x2="${f2(pwMM)}" y2="${f2(phMM - docFooterH)}" stroke="${COL.hairline}" stroke-width="0.3"/>`;
    if (opts.fecha) svg += `<text x="0.5" y="${f2(phMM - docFooterH * 0.32)}" font-size="${f2(fColHdr)}" fill="${COL.textDim}">Impreso: ${esc(opts.fecha)}</text>`;
    svg += `<text x="${f2(pwMM - 0.5)}" y="${f2(phMM - docFooterH * 0.32)}" font-size="${f2(fColHdr)}" fill="${COL.textDim}" text-anchor="end">Pág ${pageNo} de ${totalPages}</text>`;
    // B'v2: the table drops TABLE_GAP_MM below the document header — the group
    // origin is the table's top-left corner.
    svg += `<g transform="translate(0,${f2(docHeaderH + TABLE_GAP_MM)})">`;
    return svg;
  };

  /** B'v2 frame: clip the band fills to the rounded corners, then stroke the
   *  rounded frame on top. `tag` keeps clipPath ids unique across the pages of
   *  one printed document. */
  const framedTable = (tag: string, body: string, yEnd: number): string =>
    `<defs><clipPath id="tclip${tag}"><rect x="0" y="0" width="${f2(pwMM)}" height="${f2(yEnd)}" rx="${f2(FRAME_RX)}"/></clipPath></defs>` +
    `<g clip-path="url(#tclip${tag})">${body}</g>` +
    `<rect x="0" y="0" width="${f2(pwMM)}" height="${f2(yEnd)}" rx="${f2(FRAME_RX)}" fill="none" stroke="${COL.frame}" stroke-width="0.35"/>`;

  /** Column header band (B'v2): fill darker than the level-0 section band,
   *  labels VERTICALLY CENTERED in the band. Every header centers on its
   *  column except Descripción. */
  const columnHeader = (): string => {
    let svg = `<rect x="0" y="0" width="${f2(pwMM)}" height="${f2(colHeaderH)}" fill="${COL.headFill}"/>`;
    const baseY = colHeaderH / 2 + fColHdr * 0.35; // baseline that optically centers the label
    for (const c of cols) {
      const centered = c.key !== 'desc';
      const hx = centered ? c.x + c.w / 2 : c.x + padMM / 2;
      svg += `<text x="${f2(hx)}" y="${f2(baseY)}" font-size="${f2(fColHdr)}" font-weight="600" fill="${COL.headText}"${centered ? ' text-anchor="middle"' : ''}>${esc(c.label)}</text>`;
    }
    svg += `<line x1="0" y1="${f2(colHeaderH)}" x2="${f2(pwMM)}" y2="${f2(colHeaderH)}" stroke="${COL.headBorder}" stroke-width="0.3"/>`;
    return svg;
  };

  const pages: string[] = [];
  pageRows.forEach(({ start, end }, p) => {
    let body = columnHeader();
    let y = colHeaderH;
    for (let i = start; i < end; i++) {
      const r = printRows[i];
      const h = rowHeights[i];
      if (r.grupo) {
        body += `<rect x="0" y="${f2(y)}" width="${f2(pwMM)}" height="${f2(h)}" fill="${grupoFill(r.depth)}"/>`;
      }
      const baseY = y + rowLineH * 0.7;
      body += cellText(colByKey.item, r.item, baseY);
      const descLines = rowLines[i];
      descLines.forEach((ln, li) => {
        body += cellText(colByKey.desc, ln, baseY + li * lineAdvance, { indent: r.depth * indentMM, bold: r.grupo });
      });
      body += cellText(colByKey.unidad, r.unidad, baseY);
      body += cellText(colByKey.cantidad, r.cantidad, baseY);
      body += cellText(colByKey.pu, r.pu, baseY);
      body += cellText(colByKey.total, r.total, baseY, { fill: r.container ? COL.textDim : COL.text, bold: r.grupo && !r.container });
      y += h;
      body += `<line x1="0" y1="${f2(y)}" x2="${f2(pwMM)}" y2="${f2(y)}" stroke="${COL.rowline}" stroke-width="0.2"/>`;
    }
    // totals attached as table rows on the last row page when they fit
    if (p === pageRows.length - 1 && !totalsOnNewPage) {
      const t = totalsRows(y);
      body += t.svg;
      y = t.yEnd;
    }
    const svg = openPage(p + 1) + framedTable(String(p), body, y) + '</g></svg>';
    pages.push(svg);
  });

  if (totalsOnNewPage) {
    // The totals didn't fit under the last row — they get a framed block of
    // their own on one extra page. (An EMPTY desglose never lands here: its
    // single page has room and attaches the totals under the column header.)
    const t = totalsRows(0);
    pages.push(openPage(totalPages) + framedTable('T', t.svg, t.yEnd) + '</g></svg>');
  }

  return { pages, layout };
}
