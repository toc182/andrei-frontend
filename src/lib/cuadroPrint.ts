// cuadroPrint.ts — constructor de páginas del "Cuadro de Presentación de
// Cuenta" (la hoja que se imprime y se entrega en la institución). Hermano de
// desglosePrint.ts y sigue exactamente su tubería: cada página es un <svg> con
// viewBox en MILÍMETROS, el texto va a tamaño físico fijo (pt→mm), las filas
// paginan solas y la cabecera de columnas se repite en cada página.
//
// Qué lo distingue del desglose:
//   · 18 columnas en cinco bloques, con cabecera de DOS filas (bloque arriba,
//     Cant./%/Valor abajo). "Actividades" absorbe todo el sobrante, igual que
//     Descripción allá.
//   · Un encabezado de documento mucho más rico: logos, título central y TRES
//     columnas de líneas etiqueta/valor.
//   · Un pie de tabla (SUB-TOTAL y PORCENTAJE) y una hilera de FIRMAS, ambos
//     solo en la última página.
//   · Devuelve `campos`: el rectángulo en mm de cada texto editable, para que
//     la pantalla de vista previa pueda editar SOBRE la hoja sin que este
//     módulo deje de ser puro.
//
// Los montos van sin "B/." en la celda: el símbolo vive en la cabecera de la
// columna. Repetirlo en ocho columnas costaba ~5 cm de ancho, y el ancho es
// justo lo que escasea con 18 columnas.
//
// Todo aquí es puro (sin DOM) — gate: scripts/cuadro-print.spec.ts
// (cd andrei-frontend && npx tsx scripts/cuadro-print.spec.ts).
//
// Los colores son hex crudo dentro de atributos SVG (contexto tipo canvas,
// igual que cronogramaPrint/desglosePrint) — la regla de "nada de hex" apunta
// a las clases de Tailwind.

import { PT_MM, MAX_LOGOS_PER_SIDE, fitLogoWidth } from './cronogramaPrint';
import { esc, f2, fmt2, fmtCantidad, grupoFill, wrapTextMM } from './desglosePrint';
import {
  calcLinea, calcTotales, depthMap, esContenedor, parentsSet,
  type CuadroLinea, type CuadroTotales,
} from './cuadroModel';

// Retícula tipo Excel: la hoja que recibe la institución lleva líneas en todas
// las celdas. Fina para el cuerpo, fuerte para el marco, la cabecera y el pie.
const COL = {
  text: '#1c1f24',
  textDim: '#6b7280',
  grid: '#2b3140',
  frame: '#111827',
  headFill: '#dfe5ee',
  headText: '#16233a',
  totalFill: '#e9edf2',
};

const GRID_W = 0.18;
const FRAME_W = 0.35;

// El viewBox es EXACTAMENTE el área útil (0..pwMM), así que un trazo centrado
// sobre el borde pierde su mitad de fuera: el marco y el recuadro de «Cuenta N°»
// salían a medio grosor, y el visor lo lee como una hoja cortada. Todo lo que
// toque el filo se mete hacia adentro este medio trazo. Solo afecta a lo que
// llega a pwMM — las columnas interiores no se mueven, y por eso la geometría
// que fija el golden (las columnas suman el ancho útil) queda intacta.
const EDGE_MM = FRAME_W / 2;
/** Retranquea al filo derecho: deja el trazo completo dentro del viewBox. */
const clampRight = (x: number, pwMM: number) => Math.min(x, pwMM - EDGE_MM);

/** Escala de letra propia del cuadro. No usa PRINT_FONTS (9/11/13 pt) porque
 *  este documento lleva 18 columnas: a 9 pt las quince columnas numéricas se
 *  comen el ancho y la hoja se va al doble de páginas que la que se entrega.
 *  A 7 pt la Cuenta 2 de ETESA cabe en dos páginas, igual que el Excel. */
export const CUADRO_FONTS = { compacta: 6, normal: 7, grande: 8.5, extra: 10 } as const;

const MIN_DESC_MM = 40; // por debajo de esto "Actividades" no se lee
const MAX_DESC_LINES = 4;
const MAX_INFO_LINES = 4; // líneas por valor del encabezado de tres columnas
const MIN_PT = 6; // piso al encoger la letra (el mismo del desglose)

const LOGO_GAP_MM = 2;
const INFO_GAP_MM = 6; // aire entre las tres columnas del encabezado
const INFO_LV_GAP_MM = 1.6; // aire entre la etiqueta y su valor
const TABLE_GAP_MM = 4; // aire entre el encabezado del documento y la tabla
const FIRMAS_GAP_MM = 16; // aire entre la tabla y las firmas
const MAX_FIRMAS = 8;
export const MAX_LINEAS_FIRMA = 4;
/** Cada renglón de título le come alto a la tabla que va debajo. */
export const MAX_TITULO_LINEAS = 6;
/** Ancho de la raya sobre la que se firma. Es fijo a propósito: repartir el
 *  ancho de la hoja entre las firmas hacía que una sola firma se llevara la
 *  página entera, que es justo lo que no parece una línea de firma. */
const FIRMA_ANCHO_MM = 70;

// ---- tipos ----

/** Una línea del encabezado: "Orden de Proceder: 13-oct-25". */
export interface CuadroPrintLinea {
  etiqueta: string;
  valor: string;
  /** El valor va dentro de un recuadro (el "Cuenta N°" de la hoja de ETESA). */
  recuadro?: boolean;
  /** Lo calcula el sistema: la pantalla no deja escribirlo. Este módulo solo
   *  lo repite en `campos` para que la vista previa sepa bloquearlo. */
  auto?: boolean;
}

/** Una firma: de 1 a MAX_LINEAS_FIRMA líneas. La primera es el nombre y va en
 *  negrita; las de abajo (cargo, empresa, cédula…) van tenues. */
export interface CuadroPrintFirma {
  lineas: string[];
}

export interface CuadroPrintOptions {
  Wmm: number;
  Hmm: number;
  marginMM: number;
  fontKey: keyof typeof CUADRO_FONTS;
  /** Máx. páginas de alto (0 = auto). Si no cabe, la letra baja de 0.5 en
   *  0.5 pt hasta MIN_PT; si aun así no cabe, `warn` lo dice. */
  maxTall: number;
  /** Título central, hasta MAX_TITULO_LINEAS renglones. Ninguno va en negrita:
   *  el peso lo daba la última línea, y desde que el renglón automático
   *  «Cuenta No. N» puede ir en cualquier posición, esa regla dejó de tener
   *  sentido. */
  titulo: string[];
  /** Las tres columnas del encabezado: izquierda, centro, derecha. */
  columnas: [CuadroPrintLinea[], CuadroPrintLinea[], CuadroPrintLinea[]];
  /** De 1 a 8; más de cinco se reparten en dos hileras. */
  firmas: CuadroPrintFirma[];
  logosLeft: string[]; // data URLs
  logosRight: string[];
  /** Decimales del % de cada fila. La hoja de ETESA los lleva enteros. */
  decimalesFila?: number;
  /** Decimales del % de la fila PORCENTAJE del pie. */
  decimalesTotal?: number;
}

export interface CuadroPrintData {
  lineas: CuadroLinea[];
}

/** Rectángulo en mm de un texto editable, en el espacio del SVG de su página. */
export interface CuadroCampo {
  id: string;
  pagina: number; // 0-based
  xMM: number;
  yMM: number;
  wMM: number;
  hMM: number;
  align: 'left' | 'center' | 'right';
  valor: string;
  auto: boolean;
}

/** Una fila ya reducida a las cadenas exactas que se imprimen. */
export interface CuadroPrintRow {
  num: string;
  desc: string;
  unidad: string;
  /** Las 15 columnas numéricas, en el orden de BLOQUES. */
  celdas: string[];
  depth: number;
  grupo: boolean;
  /** Grupo CON hijos: sin montos propios. */
  container: boolean;
}

// ---- formato ----

/** Cantidad: miles agrupados, dos decimales, o hasta cuatro si los usa
 *  ('4,120.00', '128.205'). El cuadro mezcla cantidades redondas con medidas
 *  de campo y la hoja original las muestra así. */
export function fmtCant(n: number): string {
  const dec = Math.abs(n).toFixed(4).split('.')[1].replace(/0+$/, '');
  return dec.length > 2 ? fmtCantidad(n) : fmt2(n);
}

/** Porcentaje desde una fracción 0..1. '-0%' nunca se imprime. */
export function fmtPct(frac: number, dec: number): string {
  const s = (frac * 100).toFixed(dec);
  return `${/^-0(\.0+)?$/.test(s) ? s.slice(1) : s}%`;
}

// ---- columnas ----

interface Bloque {
  label: string;
  subs: [string, string, string];
}

/** Los cinco bloques de la cabecera, en orden. El primero no lleva % — lleva
 *  el precio unitario, que es el dato del contrato. */
export const BLOQUES: Bloque[] = [
  { label: 'Presupuesto estimado', subs: ['Cant.', 'P. Unit. B/.', 'Total B/.'] },
  { label: 'Ejecutado hasta periodo anterior', subs: ['Cant.', '%', 'Valor B/.'] },
  { label: 'Ejecutado en este periodo', subs: ['Cant.', '%', 'Valor B/.'] },
  { label: 'Ejecutado total a la fecha', subs: ['Cant.', '%', 'Valor B/.'] },
  { label: 'Trabajo por ejecutar', subs: ['Cant.', '%', 'Valor B/.'] },
];

/** Qué es cada una de las 15 celdas numéricas. Los montos se pintan al estilo
 *  contable de la hoja original: "B/." pegado a la izquierda de la celda y la
 *  cifra a la derecha, no "B/. 15,000.00" como un solo bloque. */
export const CELDA_TIPO: Array<'cant' | 'pct' | 'money'> = BLOQUES.flatMap((b) =>
  b.subs.map((s) => (s === '%' ? 'pct' : s === 'Cant.' ? 'cant' : 'money')) as Array<'cant' | 'pct' | 'money'>,
);

/** Cantidades y montos a la derecha, porcentajes centrados. */
const CELDA_ALIGN: Array<'right' | 'center'> = CELDA_TIPO.map((t) => (t === 'pct' ? 'center' : 'right'));

/** El símbolo y el aire que se le reserva dentro de la celda, en caracteres. */
const MONEDA = 'B/.';
const MONEDA_CHARS = MONEDA.length + 0.6;

interface PrintCol {
  key: string;
  label: string;
  w: number;
  x: number;
  align: 'left' | 'center' | 'right';
}

// ---- filas imprimibles ----

const celdasDe = (b: { cant: number; pct: number; valor: number }, dec: number): string[] =>
  [fmtCant(b.cant), fmtPct(b.pct, dec), fmt2(b.valor)];

export function toCuadroPrintRows(
  lineas: CuadroLinea[],
  decimalesFila: number,
): { printRows: CuadroPrintRow[]; totales: CuadroTotales } {
  const parents = parentsSet(lineas);
  const depths = depthMap(lineas);
  const printRows = lineas.map((l) => {
    const cont = esContenedor(l, parents);
    const c = calcLinea(l, cont, depths.get(l.rowUid) ?? 0);
    if (cont) {
      return {
        num: l.item, desc: l.descripcion, unidad: '',
        celdas: Array<string>(15).fill(''),
        depth: c.depth, grupo: true, container: true,
      };
    }
    return {
      num: l.item,
      desc: l.descripcion,
      unidad: l.unidad ?? '',
      celdas: [
        fmtCant(l.cantidadPresupuesto ?? 0),
        fmt2(l.precioUnitario ?? 0),
        fmt2(c.presupuestoTotal),
        ...celdasDe(c.anterior, decimalesFila),
        ...celdasDe(c.este, decimalesFila),
        ...celdasDe(c.fecha, decimalesFila),
        ...celdasDe(c.falta, decimalesFila),
      ],
      depth: c.depth,
      grupo: l.tipo === 'grupo',
      container: false,
    };
  });
  return { printRows, totales: calcTotales(lineas) };
}

// ---- encabezado de tres columnas ----

interface InfoLinea {
  etiqueta: string;
  valorLines: string[];
  /** El valor tal cual lo escribió el usuario: `valorLines` puede venir
   *  partido o truncado con '…', y lo que se edita es el original. */
  valorRaw: string;
  recuadro: boolean;
  auto: boolean;
  /** Y relativa al tope del bloque de información. */
  y: number;
  h: number;
}

interface InfoCol {
  x: number;
  w: number;
  labelW: number;
  valW: number;
  modo: 'izq' | 'centro' | 'der';
  lineas: InfoLinea[];
}

/** Reparte las tres columnas y envuelve cada valor. Alto = la columna más
 *  larga; las tres arrancan del mismo tope. */
function layoutInfo(
  columnas: CuadroPrintOptions['columnas'],
  pwMM: number,
  fontMM: number,
): { cols: InfoCol[]; h: number } {
  const colW = (pwMM - 2 * INFO_GAP_MM) / 3;
  const emMM = fontMM * 0.62;
  const lineH = fontMM * 1.35;
  const modos: Array<InfoCol['modo']> = ['izq', 'centro', 'der'];

  const cols = columnas.map((lineas, i): InfoCol => {
    // En la columna derecha manda el VALOR: son cifras cortas y la etiqueta se
    // pega a ellas por la derecha. Si la etiqueta mandara, quedarían separadas
    // por medio tercio de página.
    const anchoDe = (f: (l: CuadroPrintLinea) => string) =>
      Math.max(0, ...lineas.map((l) => f(l).length * emMM));
    const valW = modos[i] === 'der'
      ? Math.min(colW * 0.5, Math.max(emMM * 5, anchoDe((l) => l.valor)))
      : Math.max(emMM * 3, colW - Math.min(colW * 0.62, anchoDe((l) => l.etiqueta)) - INFO_LV_GAP_MM);
    const labelW = Math.max(0, colW - valW - INFO_LV_GAP_MM);
    let y = 0;
    const out: InfoLinea[] = lineas.map((l) => {
      // La derecha son cifras: una sola línea, nunca envuelve.
      const maxL = modos[i] === 'der' ? 1 : MAX_INFO_LINES;
      const valorLines = l.valor ? wrapTextMM(l.valor, valW, fontMM, maxL) : [''];
      const h = valorLines.length * lineH;
      const item: InfoLinea = {
        etiqueta: l.etiqueta,
        valorLines,
        valorRaw: l.valor,
        recuadro: !!l.recuadro,
        auto: !!l.auto,
        y,
        h,
      };
      y += h;
      return item;
    });
    return { x: i * (colW + INFO_GAP_MM), w: colW, labelW, valW, modo: modos[i], lineas: out };
  });

  return { cols, h: Math.max(0, ...cols.map((c) => c.lineas.reduce((s, l) => s + l.h, 0))) };
}

// ---- firmas ----

interface FirmaBox {
  /** El hueco que le toca a la firma: la hilera reparte el ancho útil. */
  x: number;
  w: number;
  /** La raya sobre la que se firma, centrada dentro del hueco. */
  lineW: number;
  fila: number;
  nombre: string;
  /** Lo que va debajo del nombre, ya envuelto: cargo, empresa, cédula… */
  pieLines: string[];
}

/** Hasta cinco firmas van en una hilera; de seis en adelante se parten en dos
 *  para que ninguna quede apretada contra la de al lado.
 *
 *  La hilera reparte el ancho de la hoja — con dos firmas, una queda a la
 *  izquierda y la otra a la derecha —, pero la RAYA tiene ancho propio y va
 *  centrada en su hueco. Antes la raya se estiraba con el hueco y una firma
 *  sola cruzaba la página entera. */
function layoutFirmas(
  firmas: CuadroPrintFirma[],
  pwMM: number,
  fontMM: number,
): { boxes: FirmaBox[]; filas: number; h: number } {
  const usables = firmas
    .map((f) => (f.lineas ?? []).slice(0, MAX_LINEAS_FIRMA))
    .slice(0, MAX_FIRMAS);
  if (!usables.length) return { boxes: [], filas: 0, h: 0 };
  const porFila = usables.length <= 5 ? usables.length : Math.ceil(usables.length / 2);
  const filas = Math.ceil(usables.length / porFila);
  const lineH = fontMM * 1.25;

  let maxPie = 1;
  const boxes = usables.map((lineas, i): FirmaBox => {
    const fila = Math.floor(i / porFila);
    const enFila = Math.min(porFila, usables.length - fila * porFila);
    const w = pwMM / enFila;
    const lineW = Math.min(FIRMA_ANCHO_MM, w * 0.84);
    const pieLines = lineas.slice(1)
      .flatMap((t) => (t ? wrapTextMM(t, lineW, fontMM * 0.92, 2) : ['']));
    maxPie = Math.max(maxPie, pieLines.length || 1);
    return {
      x: (i - fila * porFila) * w, w, lineW, fila, nombre: lineas[0] ?? '', pieLines,
    };
  });

  // Alto de UNA hilera: la raya de la firma, el nombre y lo que va debajo.
  const filaH = lineH * (1 + maxPie) + fontMM * 0.8;
  return { boxes, filas, h: filas * filaH + (filas - 1) * FIRMAS_GAP_MM * 0.5 };
}

// ---- layout ----

export function computeCuadroPrintLayout(opts: CuadroPrintOptions, data: CuadroPrintData) {
  const { Wmm, Hmm, marginMM, fontKey, titulo, columnas, firmas, logosLeft, logosRight } = opts;
  const pwMM = Wmm - 2 * marginMM;
  const phMM = Hmm - 2 * marginMM;
  const maxTall = Math.max(0, Math.round(opts.maxTall || 0));
  const decFila = Math.max(0, Math.min(10, opts.decimalesFila ?? 0));
  const decTotal = Math.max(0, Math.min(10, opts.decimalesTotal ?? 2));
  const { printRows, totales } = toCuadroPrintRows(data.lineas, decFila);

  const { logoW, logoStripW } = fitLogoWidth(pwMM, logosLeft.length, logosRight.length);

  // Todo el layout es función del tamaño de letra: columnas, envolturas, altos
  // y paginación se mueven juntos, así que el bucle de ajuste vuelve a derivar
  // todo en cada paso en vez de escalar nada.
  const derive = (fontPt: number) => {
    const fontMM = fontPt * PT_MM;
    const emMM = fontMM * 0.62;
    const padMM = fontMM * 0.6;
    const padNumMM = fontMM * 0.4;
    const rowLineH = Math.max(fontPt * PT_MM * 1.7, fontMM * 1.4);
    const lineAdvance = fontMM * 1.25;
    const fHdr = fontMM * 0.86; // cabecera de columnas, un punto por debajo
    const docFooterH = fontPt * PT_MM * 2.2;

    // --- título: dos tamaños por encima del cuerpo, no el 1.7 del cronograma;
    // esta hoja lleva un título discreto de tres líneas, no un titular.
    const titleFontMM = fontMM * 1.2;
    const titleAvail = pwMM - 2 * (logoStripW + 4);
    // Una línea de entrada = una línea impresa (se trunca con '…' si no cabe),
    // y las vacías se conservan como '': así el índice de cada campo editable
    // coincide con el del título que escribió el usuario.
    const titleLines = titulo.slice(0, MAX_TITULO_LINEAS).map((t) =>
      t && t.trim() ? wrapTextMM(t.trim(), titleAvail, titleFontMM, 1)[0] : '',
    );
    const nTitle = titleLines.filter(Boolean).length;
    const titleLineMM = titleFontMM * 1.28;
    const topH = Math.max(logoW > 0 ? 12 : 0, nTitle * titleLineMM + 2.5);

    const info = layoutInfo(columnas, pwMM, fontMM);
    const docHeaderH = topH + 1.5 + info.h;

    // --- columnas: las 17 angostas se ajustan a su contenido y Actividades
    // se queda con el resto.
    const longest = (get: (r: CuadroPrintRow) => string, min: number) =>
      Math.max(min, ...printRows.map((r) => get(r).length));
    const charsNum = Math.min(Math.max(longest((r) => r.num, 2), 3), 10);
    const charsUni = Math.min(Math.max(longest((r) => r.unidad, 3), 5), 9);
    // Cada sub-etiqueta puede partirse en dos líneas, así que solo su palabra
    // más larga condiciona el ancho.
    const subWord = (s: string) => Math.max(...s.split(' ').map((w) => w.length));
    const subs = BLOQUES.flatMap((b) => b.subs);
    const charsCel = subs.map((s, i) =>
      Math.min(Math.max(longest((r) => r.celdas[i], subWord(s)), 5), 15)
      + (CELDA_TIPO[i] === 'money' ? MONEDA_CHARS : 0),
    );

    // Las columnas angostas respiran menos que Actividades: con quince de
    // ellas, cada milímetro de relleno son quince menos para el texto. Aun
    // así el relleno va a los DOS lados: con la mitad, la raya quedaba
    // emparedada entre la cifra de una celda y el "B/." de la siguiente.
    const wOf = (c: number) => c * emMM + 2 * padNumMM;
    const wNum = wOf(charsNum);
    const wUni = wOf(charsUni);
    const wCel = charsCel.map(wOf);
    const fixedW = wNum + wUni + wCel.reduce((a, b) => a + b, 0);
    const descW = pwMM - fixedW;

    const base = {
      fontPt, fontMM, emMM, padMM, padNumMM, rowLineH, lineAdvance, fHdr, docFooterH,
      titleFontMM, titleLines, nTitle, titleLineMM, topH, logoW, info, docHeaderH, descW,
      decFila, decTotal,
    };
    if (descW < MIN_DESC_MM) {
      return {
        ...base, errTableTooWide: true as const, cols: [] as PrintCol[], indentMM: 0,
        grupoHdrH: 0, subHdrH: 0, colHeaderH: 0, grupoHdrLines: [] as string[][],
        subHdrLines: [] as string[][], rowHeights: [] as number[], rowLines: [] as string[][],
        pageRows: [] as Array<{ start: number; end: number }>,
        tailOnNewPage: false, bodyH: 0, totalsH: 0, firmas: { boxes: [], filas: 0, h: 0 },
        pagesTall: 0,
      };
    }

    const cols: PrintCol[] = [
      { key: 'num', label: 'N°', w: wNum, x: 0, align: 'center' },
      { key: 'desc', label: 'Actividades', w: descW, x: 0, align: 'left' },
      { key: 'unidad', label: 'Unidad', w: wUni, x: 0, align: 'center' },
      ...subs.map((s, i) => ({
        key: `c${i}`, label: s, w: wCel[i], x: 0, align: CELDA_ALIGN[i],
      })),
    ];
    let cx = 0;
    for (const c of cols) {
      c.x = cx;
      cx += c.w;
    }

    // --- cabecera de dos filas
    const grupoHdrLines = BLOQUES.map((b, bi) => {
      const spanW = wCel[bi * 3] + wCel[bi * 3 + 1] + wCel[bi * 3 + 2];
      return wrapTextMM(b.label, spanW - padNumMM, fHdr, 2);
    });
    const subHdrLines = subs.map((s, i) => wrapTextMM(s, wCel[i] - padNumMM * 0.5, fHdr, 2));
    const hdrLineH = fHdr * 1.2;
    const grupoHdrH = Math.max(...grupoHdrLines.map((l) => l.length)) * hdrLineH + fHdr * 0.7;
    const subHdrH = Math.max(...subHdrLines.map((l) => l.length)) * hdrLineH + fHdr * 0.7;
    const colHeaderH = grupoHdrH + subHdrH;

    // --- filas: se envuelve Actividades y su alto manda en la paginación
    const indentMM = fontMM * 0.9;
    const rowLines: string[][] = [];
    const rowHeights = printRows.map((r) => {
      const lines = wrapTextMM(r.desc, descW - padMM - r.depth * indentMM, fontMM, MAX_DESC_LINES);
      rowLines.push(lines);
      return rowLineH + (lines.length - 1) * lineAdvance;
    });

    const firmasL = layoutFirmas(firmas, pwMM, fontMM);
    const bodyH = phMM - docHeaderH - TABLE_GAP_MM - docFooterH - colHeaderH;
    const totalsH = 2 * rowLineH;
    // La cola (totales + firmas) solo cabe en la última página si sobra sitio
    // debajo de la última fila; si no, se va a una página de más.
    const tailH = totalsH + (firmasL.h > 0 ? FIRMAS_GAP_MM + firmasL.h : 0);

    const pageRows: Array<{ start: number; end: number }> = [];
    let start = 0;
    let used = 0;
    printRows.forEach((_, i) => {
      const h = Math.min(rowHeights[i], bodyH);
      if (used > 0 && used + h > bodyH) {
        pageRows.push({ start, end: i });
        start = i;
        used = 0;
      }
      used += h;
    });
    pageRows.push({ start, end: printRows.length });
    const tailOnNewPage = used + tailH > bodyH && printRows.length > 0;
    const pagesTall = pageRows.length + (tailOnNewPage ? 1 : 0);

    return {
      ...base, errTableTooWide: false as const, cols, indentMM,
      grupoHdrH, subHdrH, colHeaderH, grupoHdrLines, subHdrLines, hdrLineH,
      rowHeights, rowLines, pageRows, tailOnNewPage, bodyH, totalsH,
      firmas: firmasL, pagesTall,
    };
  };

  let L = derive(CUADRO_FONTS[fontKey] ?? CUADRO_FONTS.normal);
  let warn: string | null = null;
  if (!L.errTableTooWide && maxTall > 0 && L.pagesTall > maxTall) {
    let fp = L.fontPt;
    while (L.pagesTall > maxTall && fp > MIN_PT) {
      fp = Math.max(MIN_PT, fp - 0.5);
      L = derive(fp);
    }
    if (L.pagesTall > maxTall) {
      warn = `No cabe en ${maxTall} pág. de alto ni con la letra mínima; usa ${L.pagesTall}.`;
    }
  }

  return { ...L, pwMM, phMM, maxTall, printRows, totales, warn };
}

export type CuadroPrintLayout = ReturnType<typeof computeCuadroPrintLayout>;

// ---- armado de páginas ----

export function buildCuadroPrintPages(
  opts: CuadroPrintOptions,
  data: CuadroPrintData,
): { pages: string[]; campos: CuadroCampo[]; layout: CuadroPrintLayout } {
  // Los logos son subidas del usuario: exigimos el esquema data:image/ y se
  // escapan — acaban dentro de un documento emergente del mismo origen.
  const safeLogos = (arr: string[]) =>
    arr
      .map((s) => (s && s.startsWith('data:image/') ? esc(s) : null))
      .filter((s): s is string => s != null)
      .slice(0, MAX_LOGOS_PER_SIDE);
  const logosL = safeLogos(opts.logosLeft);
  const logosR = safeLogos(opts.logosRight);

  const layout = computeCuadroPrintLayout(opts, data);
  if (layout.errTableTooWide) return { pages: [], campos: [], layout };
  const {
    pwMM, phMM, fontMM, padMM, padNumMM, rowLineH, lineAdvance, fHdr, hdrLineH, docFooterH, docHeaderH,
    titleFontMM, titleLines, nTitle, titleLineMM, topH, logoW, info, cols, indentMM, printRows,
    rowHeights, rowLines, pageRows, tailOnNewPage, totales, grupoHdrH, subHdrH, colHeaderH,
    grupoHdrLines, subHdrLines, decTotal, firmas,
  } = layout;

  const totalPages = layout.pagesTall;
  const tailPage = tailOnNewPage ? totalPages - 1 : pageRows.length - 1;
  const campos: CuadroCampo[] = [];

  const text = (
    x: number, y: number, s: string,
    o: { size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; fill?: string } = {},
  ) => {
    if (!s) return '';
    const a = o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '';
    return `<text x="${f2(x)}" y="${f2(y)}" font-size="${f2(o.size ?? fontMM)}" ` +
      `fill="${o.fill ?? COL.text}"${a}${o.bold ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
  };

  const line = (x1: number, y1: number, x2: number, y2: number, c: string, w: number) =>
    `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${c}" stroke-width="${w}"/>`;

  /** Una de las 15 celdas numéricas. Los montos van al estilo contable: el
   *  "B/." pegado al filo izquierdo y la cifra al derecho, igual que la hoja
   *  que se entrega. */
  const celdaNum = (
    ci: number, v: string, baseY: number,
    o: { bold?: boolean; tipo?: 'cant' | 'pct' | 'money' } = {},
  ): string => {
    if (!v) return '';
    const c = cols[3 + ci];
    const bold = !!o.bold;
    const tipo = o.tipo ?? CELDA_TIPO[ci];
    if (tipo === 'pct') return text(c.x + c.w / 2, baseY, v, { anchor: 'middle', bold });
    let out = text(c.x + c.w - padNumMM, baseY, v, { anchor: 'end', bold });
    if (tipo === 'money') out = text(c.x + padNumMM, baseY, MONEDA, { bold }) + out;
    return out;
  };

  // ---- encabezado del documento (se repite en todas las páginas) ----
  const docHeader = (pageNo: number): string => {
    let svg = '';
    logosL.forEach((l, j) => {
      svg += `<image href="${l}" x="${f2(j * (logoW + LOGO_GAP_MM))}" y="0.5" ` +
        `width="${f2(logoW)}" height="${f2(topH - 1.5)}" preserveAspectRatio="xMidYMid meet"/>`;
    });
    logosR.forEach((l, j) => {
      svg += `<image href="${l}" x="${f2(pwMM - logoW - j * (logoW + LOGO_GAP_MM))}" y="0.5" ` +
        `width="${f2(logoW)}" height="${f2(topH - 1.5)}" preserveAspectRatio="xMidYMid meet"/>`;
    });

    let ty = Math.max(titleFontMM, (topH - nTitle * titleLineMM) / 2 + titleFontMM);
    titleLines.forEach((ln, i) => {
      if (!ln) return;
      svg += text(pwMM / 2, ty, ln, { size: titleFontMM, anchor: 'middle' });
      if (pageNo === 0) {
        campos.push({
          id: `titulo:${i}`, pagina: 0,
          xMM: pwMM * 0.22, yMM: ty - titleFontMM, wMM: pwMM * 0.56, hMM: titleLineMM,
          align: 'center', valor: opts.titulo[i] ?? '', auto: false,
        });
      }
      ty += titleLineMM;
    });

    const infoTop = topH + 1.5;
    info.cols.forEach((c, ci) => {
      c.lineas.forEach((l, li) => {
        const y0 = infoTop + l.y;
        const baseY = y0 + fontMM;
        // Etiqueta: pegada a su valor por la derecha salvo en la columna
        // izquierda, que es la de texto corrido.
        const alaIzq = c.modo === 'izq';
        svg += text(alaIzq ? c.x : c.x + c.labelW, baseY, l.etiqueta, {
          bold: true, anchor: alaIzq ? 'start' : 'end',
        });
        // Valor
        // En la columna de la derecha el valor se ancla al filo de la columna,
        // que en la última ES el filo de la hoja: sin retranqueo el glifo queda
        // pegado al corte y se lee como cortado.
        const valX = c.modo === 'der'
          ? clampRight(c.x + c.w, pwMM)
          : c.x + c.labelW + INFO_LV_GAP_MM;
        l.valorLines.forEach((vl, vi) => {
          svg += text(valX, baseY + vi * fontMM * 1.35, vl, {
            anchor: c.modo === 'der' ? 'end' : 'start',
            bold: c.modo === 'der',
          });
        });
        if (l.recuadro && l.valorLines[0]) {
          const bw = Math.max(fontMM * 4, l.valorLines[0].length * fontMM * 0.62 + fontMM);
          const bRight = clampRight(c.x + c.w, pwMM);
          svg += `<rect x="${f2(bRight - bw)}" y="${f2(y0 + fontMM * 0.15)}" ` +
            `width="${f2(bw)}" height="${f2(fontMM * 1.25)}" fill="none" ` +
            `stroke="${COL.frame}" stroke-width="${FRAME_W}"/>`;
        }
        if (pageNo === 0) {
          campos.push({
            id: `col:${ci}:${li}:etiqueta`, pagina: 0,
            xMM: c.x, yMM: y0, wMM: c.labelW, hMM: fontMM * 1.35,
            align: c.modo === 'izq' ? 'left' : 'right', valor: l.etiqueta, auto: false,
          });
          campos.push({
            id: `col:${ci}:${li}:valor`, pagina: 0,
            xMM: c.modo === 'der' ? c.x + c.w - c.valW : c.x + c.labelW + INFO_LV_GAP_MM,
            yMM: y0, wMM: c.valW, hMM: l.h,
            align: c.modo === 'der' ? 'right' : 'left', valor: l.valorRaw, auto: l.auto,
          });
        }
      });
    });
    return svg;
  };

  // ---- cabecera de columnas (dos filas), dibujada en el espacio de la tabla ----
  const columnHeader = (): string => {
    let svg = `<rect x="0" y="0" width="${f2(pwMM)}" height="${f2(colHeaderH)}" fill="${COL.headFill}"/>`;
    const [cNum, cDesc, cUni] = cols;
    const fijas = [cNum, cDesc, cUni];

    // Las tres primeras abarcan las dos filas: etiqueta centrada verticalmente.
    fijas.forEach((c) => {
      const lines = wrapTextMM(c.label, c.w - padNumMM * 0.5, fHdr, 2);
      let y = (colHeaderH - lines.length * hdrLineH) / 2 + fHdr;
      lines.forEach((ln) => {
        svg += text(c.x + c.w / 2, y, ln, { size: fHdr, anchor: 'middle', bold: true, fill: COL.headText });
        y += hdrLineH;
      });
      const sx = clampRight(c.x + c.w, pwMM);
      svg += line(sx, 0, sx, colHeaderH, COL.frame, GRID_W * 1.6);
    });

    // Bloques arriba, sub-etiquetas abajo.
    BLOQUES.forEach((_, bi) => {
      const first = cols[3 + bi * 3];
      const last = cols[3 + bi * 3 + 2];
      const spanX = first.x;
      const spanW = last.x + last.w - first.x;
      const lines = grupoHdrLines[bi];
      let y = (grupoHdrH - lines.length * hdrLineH) / 2 + fHdr;
      lines.forEach((ln) => {
        svg += text(spanX + spanW / 2, y, ln, { size: fHdr, anchor: 'middle', bold: true, fill: COL.headText });
        y += hdrLineH;
      });
      const bx = clampRight(spanX + spanW, pwMM);
      svg += line(bx, 0, bx, colHeaderH, COL.frame, GRID_W * 1.6);
    });
    // La línea que separa las dos filas de la cabecera arranca en el primer
    // bloque: N°, Actividades y Unidad ocupan las dos filas y una raya a media
    // altura las partiría en dos celdas que no existen.
    svg += line(cols[3].x, grupoHdrH, pwMM, grupoHdrH, COL.frame, GRID_W * 1.6);

    cols.slice(3).forEach((c, i) => {
      const lines = subHdrLines[i];
      let y = grupoHdrH + (subHdrH - lines.length * hdrLineH) / 2 + fHdr;
      lines.forEach((ln) => {
        svg += text(c.x + c.w / 2, y, ln, { size: fHdr, anchor: 'middle', bold: true, fill: COL.headText });
        y += hdrLineH;
      });
      if ((i + 1) % 3 !== 0) svg += line(c.x + c.w, grupoHdrH, c.x + c.w, colHeaderH, COL.grid, GRID_W);
    });

    svg += line(0, colHeaderH, pwMM, colHeaderH, COL.frame, FRAME_W);
    return svg;
  };

  /** Verticales de la retícula a lo largo de un tramo. `desdeX` las recorta:
   *  en las filas de totales la etiqueta ocupa varias columnas y una línea
   *  atravesando "PORCENTAJE (%)" se lee como un error de impresión. */
  const verticales = (yTop: number, yBot: number, desdeX = 0): string =>
    cols.slice(0, -1)
      .filter((c) => c.x + c.w >= desdeX - 0.01)
      .map((c) => line(c.x + c.w, yTop, c.x + c.w, yBot, COL.grid, GRID_W))
      .join('');

  /** SUB-TOTAL y PORCENTAJE (%): las dos filas del pie. Las etiquetas ocupan
   *  las tres columnas fijas más las dos primeras del presupuesto; los montos
   *  caen bajo la columna Total/Valor de cada bloque. */
  const totalsRows = (yTop: number): { svg: string; yEnd: number } => {
    const labelEnd = cols[4].x + cols[4].w; // hasta P. Unitario
    const montos = [
      { i: 2, v: fmt2(totales.presupuesto), p: fmtPct(1, decTotal) },
      { i: 5, v: fmt2(totales.anterior), p: fmtPct(totales.pctAnterior, decTotal) },
      { i: 8, v: fmt2(totales.este), p: fmtPct(totales.pctPeriodo, decTotal) },
      { i: 11, v: fmt2(totales.fecha), p: fmtPct(totales.pctTotal, decTotal) },
      { i: 14, v: fmt2(totales.falta), p: fmtPct(totales.pctFalta, decTotal) },
    ];
    let svg = `<rect x="0" y="${f2(yTop)}" width="${f2(pwMM)}" height="${f2(2 * rowLineH)}" fill="${COL.totalFill}"/>`;
    svg += line(0, yTop, pwMM, yTop, COL.frame, FRAME_W);
    svg += line(0, yTop + rowLineH, pwMM, yTop + rowLineH, COL.grid, GRID_W);

    [['SUB-TOTAL', 'v'], ['PORCENTAJE (%)', 'p']].forEach(([etiqueta, campo], r) => {
      const by = yTop + r * rowLineH + rowLineH * 0.7;
      svg += text(labelEnd - padNumMM, by, etiqueta, { anchor: 'end', bold: true });
      // La fila de porcentajes va bajo las columnas de monto pero no lleva
      // "B/." — es un porcentaje, no una cifra en balboas.
      montos.forEach((m) => {
        svg += celdaNum(m.i, campo === 'v' ? m.v : m.p, by, {
          bold: true, tipo: campo === 'v' ? 'money' : 'cant',
        });
      });
    });
    const yEnd = yTop + 2 * rowLineH;
    svg += verticales(yTop, yEnd, labelEnd);
    return { svg, yEnd };
  };

  /** Las firmas, debajo de la tabla y solo en la última página. `yTop` va en el
   *  espacio de la tabla. */
  const firmasBlock = (yTop: number): string => {
    if (!firmas.boxes.length) return '';
    const lineH = fontMM * 1.25;
    const filaH = (firmas.h - (firmas.filas - 1) * FIRMAS_GAP_MM * 0.5) / firmas.filas;
    let svg = '';
    firmas.boxes.forEach((b, i) => {
      const y0 = yTop + b.fila * (filaH + FIRMAS_GAP_MM * 0.5);
      const cx = b.x + b.w / 2;
      const x0 = cx - b.lineW / 2;
      svg += line(x0, y0, x0 + b.lineW, y0, COL.frame, GRID_W * 1.6);
      const nomY = y0 + lineH;
      svg += text(cx, nomY, b.nombre, { anchor: 'middle', bold: true });
      b.pieLines.forEach((cl, ci) => {
        svg += text(cx, nomY + (ci + 1) * lineH, cl, {
          size: fontMM * 0.92, anchor: 'middle', fill: COL.textDim,
        });
      });
      campos.push({
        id: `firma:${i}:nombre`, pagina: tailPage,
        xMM: x0, yMM: docHeaderH + TABLE_GAP_MM + nomY - fontMM,
        wMM: b.lineW, hMM: lineH, align: 'center', valor: b.nombre, auto: false,
      });
      campos.push({
        id: `firma:${i}:pie`, pagina: tailPage,
        xMM: x0, yMM: docHeaderH + TABLE_GAP_MM + nomY,
        wMM: b.lineW, hMM: lineH * Math.max(1, b.pieLines.length), align: 'center',
        valor: b.pieLines.join(' '), auto: false,
      });
    });
    return svg;
  };

  /** Cascarón de página: encabezado del documento, pie con paginación, y el
   *  grupo trasladado al origen de la tabla. */
  const openPage = (pageNo: number): string => {
    let svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(pwMM)} ${f2(phMM)}" ` +
      `width="${f2(pwMM)}mm" height="${f2(phMM)}mm" ` +
      `font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">`;
    svg += `<rect width="${f2(pwMM)}" height="${f2(phMM)}" fill="#ffffff"/>`;
    svg += docHeader(pageNo);
    svg += line(0, phMM - docFooterH, pwMM, phMM - docFooterH, COL.grid, GRID_W);
    svg += text(pwMM - 0.5, phMM - docFooterH * 0.32, `${pageNo + 1} de ${totalPages}`, {
      size: fHdr, anchor: 'end', fill: COL.textDim,
    });
    svg += `<g transform="translate(0,${f2(docHeaderH + TABLE_GAP_MM)})">`;
    return svg;
  };

  /** Marco exterior de la tabla, retranqueado medio trazo para que los cuatro
   *  lados salgan completos y no a la mitad contra el filo del viewBox. */
  const marco = (yEnd: number) =>
    `<rect x="${f2(EDGE_MM)}" y="${f2(EDGE_MM)}" ` +
    `width="${f2(pwMM - 2 * EDGE_MM)}" height="${f2(yEnd - 2 * EDGE_MM)}" fill="none" ` +
    `stroke="${COL.frame}" stroke-width="${FRAME_W}"/>`;

  const pages: string[] = [];
  pageRows.forEach(({ start, end }, p) => {
    let body = columnHeader();
    let y = colHeaderH;
    for (let i = start; i < end; i++) {
      const r = printRows[i];
      const h = rowHeights[i];
      if (r.grupo) {
        // La banda de grupo va limpia, sin verticales — igual que en pantalla
        // (§22/§23): es un bloque, no una fila de datos.
        body += `<rect x="0" y="${f2(y)}" width="${f2(pwMM)}" height="${f2(h)}" fill="${grupoFill(r.depth)}"/>`;
      } else {
        body += verticales(y, y + h);
      }
      const baseY = y + rowLineH * 0.7;
      const [cNum, cDesc, cUni] = cols;
      body += text(cNum.x + cNum.w / 2, baseY, r.num, { anchor: 'middle', bold: r.grupo });
      rowLines[i].forEach((ln, li) => {
        body += text(cDesc.x + padMM / 2 + r.depth * indentMM, baseY + li * lineAdvance, ln, { bold: r.grupo });
      });
      body += text(cUni.x + cUni.w / 2, baseY, r.unidad, { anchor: 'middle' });
      r.celdas.forEach((v, ci) => { body += celdaNum(ci, v, baseY); });
      y += h;
      body += line(0, y, pwMM, y, COL.grid, GRID_W);
    }

    if (p === pageRows.length - 1 && !tailOnNewPage) {
      const t = totalsRows(y);
      body += t.svg;
      y = t.yEnd;
      body = body + marco(y) + firmasBlock(y + FIRMAS_GAP_MM);
      pages.push(openPage(p) + body + '</g></svg>');
      return;
    }
    pages.push(openPage(p) + body + marco(y) + '</g></svg>');
  });

  if (tailOnNewPage) {
    // Los totales no cabían bajo la última fila: se van con las firmas a una
    // página propia, repitiendo la cabecera de columnas — es la tabla que sigue.
    let body = columnHeader();
    const t = totalsRows(colHeaderH);
    body += t.svg;
    body = body + marco(t.yEnd) + firmasBlock(t.yEnd + FIRMAS_GAP_MM);
    pages.push(openPage(totalPages - 1) + body + '</g></svg>');
  }

  return { pages, campos, layout };
}
