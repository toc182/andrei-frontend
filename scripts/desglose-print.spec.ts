// Golden gate for the desglose print module (pure functions only — no DOM).
// Mirrors scripts/cronograma-print.spec.ts.  cd andrei-frontend && npx tsx scripts/desglose-print.spec.ts
//
// The main fixture reproduces the Chagres QA desglose (18 rows, 3 levels, priced
// single-line sections) whose hand-verified totals are Subtotal 445,695.00 /
// ITBMS 7% 31,198.65 / Total 476,893.65.

import {
  fmt2, fmtCantidad, money, toPrintRows, wrapTextMM, grupoFill,
  computeDesglosePrintLayout, buildDesglosePrintPages,
  type DesglosePrintOptions,
} from '../src/lib/desglosePrint';
import type { DesgloseRow } from '../src/lib/desgloseModel';

let passed = 0;
let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${label}`); }
}

const row = (tempId: number, depth: number, tipo: 'grupo' | 'item', item: string,
  descripcion: string, unidad: string | null = null, cantidad: number | null = null,
  precioUnitario: number | null = null): DesgloseRow =>
  ({ tempId, depth, tipo, item, descripcion, unidad, cantidad, precioUnitario });

// Chagres QA fixture (desglose 6 / proyecto 3) — totals verified by hand.
const CHAGRES: DesgloseRow[] = [
  row(1, 0, 'grupo', '1', 'Trabajos preliminares'),
  row(2, 1, 'item', '1.1', 'Movilización y desmovilización de equipos', 'global', 1, 15000),
  row(3, 1, 'item', '1.2', 'Trazado y replanteo topográfico', 'm', 250, 12),
  row(4, 0, 'grupo', '2', 'Subestructura'),
  row(5, 1, 'grupo', '2.1', 'Excavación y cimentación'),
  row(6, 2, 'item', '2.1.1', 'Excavación para estribos', 'm³', 480, 18.5),
  row(7, 2, 'item', '2.1.2', 'Excavación para pilas', 'm³', 320, 22),
  row(8, 1, 'grupo', '2.2', 'Hormigón armado'),
  row(9, 2, 'item', '2.2.1', "Hormigón f'c=280 kg/cm² en estribos", 'm³', 145, 165),
  row(10, 2, 'item', '2.2.2', 'Acero de refuerzo grado 60', 'qq', 890, 42),
  row(11, 1, 'item', '2.3', 'Pilotes hincados de concreto', 'un', 24, 3200),
  row(12, 1, 'grupo', '2.4', 'Misceláneos de subestructura', 'global', 1, 5000),
  row(13, 0, 'grupo', '3', 'Superestructura'),
  row(14, 1, 'item', '3.1', 'Vigas postensadas tipo AASHTO', 'un', 8, 18500),
  row(15, 1, 'item', '3.2', 'Losa de tablero de concreto', 'm³', 210, 175),
  row(16, 1, 'item', '3.3', 'Barandas metálicas y juntas de expansión', 'm', 96, 145),
  row(17, 0, 'grupo', '4', 'Imprevistos de obra', 'global', 1, 25000),
  row(18, 0, 'grupo', '5', 'Administración y utilidad', 'global', 1, 45000),
];

const baseOpts = (over: Partial<DesglosePrintOptions> = {}): DesglosePrintOptions => ({
  Wmm: 215.9, Hmm: 279.4, marginMM: 10, fontKey: 'normal', maxTall: 0,
  title: 'Construcción de Puente Vehicular sobre Río Chagres',
  subtitle: 'Desglose de Precios', logosLeft: [], logosRight: [],
  ...over,
});

const repeatChagres = (times: number): DesgloseRow[] => {
  const out: DesgloseRow[] = [];
  for (let k = 0; k < times; k++) {
    for (const r of CHAGRES) out.push({ ...r, tempId: k * 100 + r.tempId });
  }
  return out;
};

// ---- number formatting ----
{
  ok(fmt2(1234.5) === '1,234.50', `fmt2: 1234.5 → 1,234.50 (got ${fmt2(1234.5)})`);
  ok(fmt2(0) === '0.00', 'fmt2: 0 → 0.00');
  ok(fmt2(445695) === '445,695.00', 'fmt2: 445695 agrupa miles');
  ok(fmt2(-1234567.891) === '-1,234,567.89', `fmt2: negativo redondeado (got ${fmt2(-1234567.891)})`);
  ok(money(5000) === 'B/. 5,000.00', 'money: prefijo B/.');
  ok(fmtCantidad(480) === '480', 'fmtCantidad: entero sin decimales');
  ok(fmtCantidad(0.5) === '0.5', 'fmtCantidad: decimal corto');
  ok(fmtCantidad(2.25) === '2.25', 'fmtCantidad: sin ceros de cola');
  ok(fmtCantidad(1234567.5) === '1,234,567.5', `fmtCantidad: agrupa miles (got ${fmtCantidad(1234567.5)})`);
}

// ---- toPrintRows (screen parity) ----
{
  const { printRows, grandTotal } = toPrintRows(CHAGRES);
  ok(grandTotal === 445695, `toPrintRows: grandTotal 445,695 (got ${grandTotal})`);
  const r2 = printRows[3]; // sección 2, contenedora
  ok(r2.container && r2.unidad === '' && r2.cantidad === '' && r2.pu === '',
    'contenedora: montos en blanco');
  ok(r2.total === 'B/. 159,025.00', `contenedora: total derivado (got ${r2.total})`);
  const r24 = printRows[11]; // 2.4, sección de una línea con precio
  ok(r24.grupo && !r24.container && r24.cantidad === '1' && r24.pu === 'B/. 5,000.00' && r24.total === 'B/. 5,000.00',
    'sección de una línea: muestra sus montos');
  const r23 = printRows[10];
  ok(r23.total === 'B/. 76,800.00', `item 2.3: 24 × 3,200 (got ${r23.total})`);
}

// ---- wrapTextMM ----
{
  ok(wrapTextMM('corto', 60, 3.175, 4).length === 1, 'wrap: texto corto = 1 línea');
  const long = 'Suministro e instalación de tubería de acero al carbón de doce pulgadas incluyendo accesorios y pruebas hidrostáticas según especificaciones';
  const lines = wrapTextMM(long, 60, 3.175, 4);
  ok(lines.length > 1 && lines.length <= 4, `wrap: descripción larga envuelve (got ${lines.length})`);
  const maxChars = Math.floor(60 / (3.175 * 0.62));
  ok(lines.every((l) => l.length <= maxChars), 'wrap: ninguna línea excede el ancho');
  const capped = wrapTextMM(long + ' ' + long + ' ' + long, 40, 3.175, 3);
  ok(capped.length === 3 && capped[2].endsWith('…'), 'wrap: tope de líneas trunca con …');
  ok(wrapTextMM('', 60, 3.175, 4).length === 1, 'wrap: vacío = 1 línea vacía');
  const hard = wrapTextMM('X'.repeat(200), 40, 3.175, 4);
  ok(hard[0].length <= maxChars + 20 && hard.length > 1, 'wrap: palabra kilométrica se parte');
}

// ---- layout ----
{
  const L = computeDesglosePrintLayout(baseOpts(), { rows: CHAGRES, itbmsTasa: 7 });
  ok(!L.errTableTooWide, 'layout carta vertical: cabe');
  ok(L.descW >= 35, `layout: Descripción se lleva el sobrante (${L.descW.toFixed(1)}mm)`);
  const sumW = L.cols.reduce((s, c) => s + c.w, 0);
  ok(Math.abs(sumW - L.pwMM) < 0.01, `layout: Σ anchos === pwMM (got ${sumW.toFixed(2)} vs ${L.pwMM})`);
  ok(L.cols[1].key === 'desc' && L.cols.every((c, i) => i === 0 || c.x > L.cols[i - 1].x),
    'layout: columnas en orden y x monotónico');
  ok(L.pageRows.length === 1, `layout: Chagres cabe en 1 página (got ${L.pageRows.length})`);
}
{
  const L = computeDesglosePrintLayout(baseOpts({ Wmm: 80, Hmm: 100 }), { rows: CHAGRES, itbmsTasa: 7 });
  ok(L.errTableTooWide === true, 'papel diminuto: errTableTooWide');
  const r = buildDesglosePrintPages(baseOpts({ Wmm: 80, Hmm: 100 }), { rows: CHAGRES, itbmsTasa: 7 });
  ok(r.pages.length === 0, 'papel diminuto: buildDesglosePrintPages devuelve []');
}

// ---- pagination (many rows; every row lands exactly once) ----
{
  const many = repeatChagres(8);
  const L = computeDesglosePrintLayout(baseOpts(), { rows: many, itbmsTasa: 7 });
  ok(L.pageRows.length > 1, `paginación: ${many.length} filas → varias páginas (got ${L.pageRows.length})`);
  ok(L.pageRows[0].start === 0 && L.pageRows[L.pageRows.length - 1].end === many.length &&
    L.pageRows.every((p, i) => i === 0 || p.start === L.pageRows[i - 1].end),
    'paginación: contigua, sin filas perdidas ni repetidas');
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: many, itbmsTasa: 7 });
  ok(pages.length === L.pageRows.length + (L.totalsOnNewPage ? 1 : 0), 'paginación: páginas = bandas (+totales)');
  ok(pages[0].includes(`Pág 1 de ${pages.length}`) && pages[pages.length - 1].includes(`Pág ${pages.length} de ${pages.length}`),
    'paginación: numeración Pág X de Y');
  const withSubtotal = pages.filter((p) => p.includes('>Subtotal<'));
  ok(withSubtotal.length === 1 && pages[pages.length - 1].includes('>Subtotal<'),
    'totales: solo en la última página');
}

// ---- ajustar a páginas de alto (encoge la letra hasta caber; nunca < 6pt) ----
{
  const many = repeatChagres(8);
  const L0 = computeDesglosePrintLayout(baseOpts(), { rows: many, itbmsTasa: 7 });
  ok(L0.pagesTall > 2 && L0.fontPt === 9 && L0.warn == null,
    `maxTall 0: sin encoger ni avisar (got ${L0.pagesTall} pág, ${L0.fontPt}pt)`);
  const L = computeDesglosePrintLayout(baseOpts({ maxTall: 2 }), { rows: many, itbmsTasa: 7 });
  ok(L.pagesTall <= 2 || L.warn != null, 'maxTall 2: cumple o avisa');
  if (L.pagesTall <= 2) ok(L.fontPt < 9, `maxTall 2: encogió la letra (got ${L.fontPt}pt)`);
  ok(L.fontPt >= 6, 'maxTall: nunca baja de 6pt');
  const { pages } = buildDesglosePrintPages(baseOpts({ maxTall: 2 }), { rows: many, itbmsTasa: 7 });
  ok(pages.length === L.pagesTall, `maxTall: páginas construidas = pagesTall (got ${pages.length} vs ${L.pagesTall})`);
}
{
  const huge = repeatChagres(60);
  const L = computeDesglosePrintLayout(baseOpts({ maxTall: 1 }), { rows: huge, itbmsTasa: 7 });
  ok(L.fontPt === 6 && L.warn != null && L.warn.includes('letra mínima'),
    `maxTall imposible: tope 6pt + aviso (got ${L.fontPt}pt, warn=${L.warn})`);
  ok(L.pagesTall > 1, 'maxTall imposible: usa las páginas que necesita');
}
{
  // Chagres ya cabe en 1 página: pedir 1 no debe encoger nada.
  const L = computeDesglosePrintLayout(baseOpts({ maxTall: 1 }), { rows: CHAGRES, itbmsTasa: 7 });
  ok(L.fontPt === 9 && L.warn == null, 'maxTall que ya cabe: letra intacta');
}

// ---- totals block ----
{
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: CHAGRES, itbmsTasa: 7 });
  const last = pages[pages.length - 1];
  ok(last.includes('B/. 445,695.00') && last.includes('ITBMS (7%)') &&
    last.includes('B/. 31,198.65') && last.includes('B/. 476,893.65'),
    'totales: Subtotal / ITBMS 7% / Total dorados del fixture Chagres');
}
{
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: CHAGRES, itbmsTasa: null });
  const all = pages.join('');
  ok(!all.includes('>Subtotal<') && !all.includes('ITBMS'), 'sin ITBMS: no hay Subtotal ni línea ITBMS');
  ok(pages[pages.length - 1].includes('B/. 445,695.00'), 'sin ITBMS: Total = subtotal');
}

// ---- alignment (Ivan 2026-07-20: Item/Unidad/Cantidad centered content+header;
// P.U./Total right-aligned content but centered header; Descripción left) ----
{
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: CHAGRES, itbmsTasa: 7 });
  const p1 = pages[0];
  ok(/text-anchor="middle">Item</.test(p1) && /text-anchor="middle">Unidad</.test(p1) &&
    /text-anchor="middle">Cantidad</.test(p1) && /text-anchor="middle">P\.U\.</.test(p1) &&
    /text-anchor="middle">Total</.test(p1),
    'alineación: todos los encabezados centrados salvo Descripción');
  ok(!/text-anchor="middle">Descripción</.test(p1) && p1.includes('>Descripción<'),
    'alineación: encabezado Descripción a la izquierda');
  ok(/text-anchor="middle">2\.1\.1</.test(p1), 'alineación: código de item centrado');
  ok(/text-anchor="middle">m³</.test(p1), 'alineación: unidad centrada');
  ok(/text-anchor="middle">480</.test(p1), 'alineación: cantidad centrada');
  ok(/text-anchor="end">B\/\. 3,200\.00</.test(p1), 'alineación: P.U. a la derecha');
  ok(/text-anchor="end">B\/\. 76,800\.00</.test(p1), 'alineación: Total a la derecha');
}

// ---- diseño B'v2 (aprobado por Ivan sobre mock, 2026-07-20: tabla enmarcada
// con borde sutil REDONDEADO, sin líneas verticales, banda de encabezado
// #9cb0d0 (más oscura que la banda nivel 0) con texto centrado, totales como
// FILAS de la tabla todos en negrita, tabla separada del encabezado) ----
{
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: CHAGRES, itbmsTasa: 7 });
  const p1 = pages[0];
  ok(!p1.includes('rgba(120,130,150,0.28)'), 'B\': sin líneas verticales entre columnas');
  ok(!p1.includes('#888888'), 'B\': sin marco de página (el gris viejo desapareció)');
  ok(p1.includes('fill="#9cb0d0"'), 'B\'v2: banda de encabezado más oscura que la banda nivel 0');
  ok(p1.includes('stroke="#c9cfd8"'), 'B\': marco sutil alrededor de la tabla');
  ok(/rx="1\.50"/.test(p1), 'B\'v2: esquinas del marco redondeadas 1.5mm');
  ok(/font-weight="700">Subtotal</.test(p1) && /font-weight="700">ITBMS \(7%\)</.test(p1) &&
    /font-weight="700">Total</.test(p1),
    'B\'v2: Subtotal, ITBMS y Total en negrita');
}
{
  const { pages } = buildDesglosePrintPages(baseOpts({ fecha: '20 jul 2026' }), { rows: CHAGRES, itbmsTasa: 7 });
  ok(pages[0].includes('Impreso: 20 jul 2026'), 'B\': fecha de impresión en el pie');
  const { pages: sin } = buildDesglosePrintPages(baseOpts(), { rows: CHAGRES, itbmsTasa: 7 });
  ok(!sin[0].includes('Impreso:'), 'B\': sin fecha no hay etiqueta Impreso');
}

// ---- page content ----
{
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: CHAGRES, itbmsTasa: 7 });
  const p1 = pages[0];
  ok(p1.includes(`fill="${grupoFill(0)}"`) && p1.includes(`fill="${grupoFill(1)}"`),
    'bandas: grupos nivel 0 y 1 con su relleno');
  ok(p1.includes('Pilotes hincados de concreto') && p1.includes('B/. 76,800.00'),
    'contenido: item 2.3 con su total');
  ok(p1.includes('Misceláneos de subestructura') && p1.includes('B/. 5,000.00'),
    'contenido: sección de una línea con su precio');
  ok(p1.includes('Desglose de Precios'), 'contenido: subtítulo presente');
}
{
  const hostile = [row(1, 0, 'item', '1', 'A & B <x> "q"', 'm', 1, 1)];
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: hostile, itbmsTasa: null });
  ok(pages[0].includes('A &amp; B &lt;x&gt; &quot;q&quot;') && !pages[0].includes('<x>'),
    'escape: descripción hostil no inyecta SVG');
}
{
  const { pages } = buildDesglosePrintPages(
    baseOpts({ logosLeft: ['javascript:alert(1)', 'data:image/png;base64,AAA'], logosRight: ['no-data'] }),
    { rows: CHAGRES, itbmsTasa: 7 },
  );
  ok((pages[0].match(/<image /g) || []).length === 1, 'logos: solo data:image/ se incrusta');
}
{
  const { pages } = buildDesglosePrintPages(baseOpts(), { rows: [], itbmsTasa: null });
  ok(pages.length === 1 && pages[0].includes('Pág 1 de 1') && pages[0].includes('B/. 0.00'),
    'desglose vacío: 1 página con Total 0');
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
