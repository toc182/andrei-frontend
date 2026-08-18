// Golden gate del módulo de impresión del Cuadro de Presentación de Cuenta
// (solo funciones puras — sin DOM). Espejo de scripts/desglose-print.spec.ts.
//   cd andrei-frontend && npx tsx scripts/cuadro-print.spec.ts
//
// El fixture es la CUENTA 2 DE ETESA tal como se entregó en la institución
// (H:\Shared drives\Pinellas\ETESA\CUENTAS\CUENTA 2\CUENTA 2 - ENTREGADA,
// páginas 1-2). Sus totales están impresos en esa hoja y verificados a mano:
//
//   SUB-TOTAL      351,004.26 · 83,266.04 · 44,980.74 · 128,246.78 · 222,757.48
//   PORCENTAJE (%)     100.00% ·    23.72% ·    12.81% ·     36.54% ·     63.46%
//
// Si alguno de esos números se mueve, este spec falla: es la única forma de
// saber que la hoja que produce la app es la misma que ya se entregó.

import {
  fmtCant, fmtPct, toCuadroPrintRows, computeCuadroPrintLayout, buildCuadroPrintPages,
  BLOQUES, CELDA_TIPO, type CuadroPrintOptions,
} from '../src/lib/cuadroPrint';
import { calcTotales, type CuadroLinea } from '../src/lib/cuadroModel';
import { paletaCuadro, hexAHsl, tintaDeNivel } from '../src/lib/cuadroColor';

let passed = 0;
let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${label}`); }
}
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.log(`FAIL  ${label}\n        esperado: ${e}\n        obtenido: ${a}`); }
}

// ── fixture ─────────────────────────────────────────────────────────────

let uid = 0;
const grupo = (item: string, descripcion: string): CuadroLinea => ({
  rowUid: `g${++uid}:${item}`, parentRowUid: null, tipo: 'grupo',
  item, descripcion, unidad: null,
  cantidadPresupuesto: null, precioUnitario: null,
  cantidadEjecutada: 0, cantidadAnterior: 0,
});
const item = (
  padre: string | null, itemNo: string, descripcion: string, unidad: string,
  cant: number, pu: number, anterior = 0, este = 0,
): CuadroLinea => ({
  rowUid: `i${++uid}:${itemNo}`, parentRowUid: padre, tipo: 'item',
  item: itemNo, descripcion, unidad,
  cantidadPresupuesto: cant, precioUnitario: pu,
  cantidadEjecutada: este, cantidadAnterior: anterior,
});

const G13 = grupo('1.3', 'Levantamiento y Replanteo del proyecto');
const G14 = grupo('1.4', 'Diseño de Obras Civiles');
const G15 = grupo('1.5', 'Estudio de Impacto Ambiental');
const G16 = grupo('1.6', 'Permisos ante Autoridades');
const G18 = grupo('1.8', 'Medidas Ambientales');
const G19 = grupo('1.9', 'Informes de Seguimiento Ambiental');
const G110 = grupo('1.10', 'Mejoras de camino');
const G111 = grupo('1.11', 'Canales o Cunetas pavimentadas');
const G112 = grupo('1.12', 'DRENAJES TUBULARES');

const MEDIDA = (n: string, pct: string) =>
  `Primer Informe de Cumplimiento de Medidas de Mitigación Ambiental al llegar al ${pct} de avance de la obra ` +
  `y entrega de informes de seguimiento ambiental al día (${n})`;

export const ETESA_C2: CuadroLinea[] = [
  item(null, '1.2', 'Pólizas de seguro y Fianzas', 'global', 1, 15000, 1),
  G13,
  item(G13.rowUid, '1.3.1', 'Levantamiento topográfico del proyecto (50%)', 'global', 1, 10000, 1),
  item(G13.rowUid, '1.3.2', 'Replanteo del proyecto (50%)', 'global', 1, 7500, 1),
  G14,
  item(G14.rowUid, '1.4.1', 'Memorias de diseño aprobados por ETESA (20%)', 'global', 1, 7000, 1),
  item(G14.rowUid, '1.4.2', 'Planos Constructivos aprobados por ETESA (40%)', 'global', 1, 14000, 1),
  item(G14.rowUid, '1.4.3', 'Planos finales (Asbuilt) aprobados por ETESA (40%)', 'global', 1, 14000),
  G15,
  item(G15.rowUid, '1.5.1', 'Elaboración de EsIA (20%)', 'global', 1, 3600),
  item(G15.rowUid, '1.5.2', 'Aprobación de EsIA por ETESA (30%)', 'global', 1, 5400),
  item(G15.rowUid, '1.5.3', 'Admisión de EsIA por MIAMBIENTE (30%)', 'global', 1, 5400),
  item(G15.rowUid, '1.5.4', 'Aprobación de EsIA por MIAMBIENTE (20%)', 'global', 1, 3600),
  G16,
  item(G16.rowUid, '1.6.1', 'Permisos Municipales', 'global', 1, 3500, 1),
  item(G16.rowUid, '1.6.2', 'Otros Permisos', 'global', 1, 326.04, 1),
  item(null, '1.7', 'Permiso de Obra en Cauce', 'global', 1, 1000),
  G18,
  item(G18.rowUid, '1.8.1', MEDIDA('1', '25%'), 'global', 1, 1300),
  item(G18.rowUid, '1.8.2', MEDIDA('2', '50%'), 'global', 1, 1300),
  item(G18.rowUid, '1.8.3', MEDIDA('3', '75%'), 'global', 1, 1300),
  item(G18.rowUid, '1.8.4', MEDIDA('4', '100%'), 'global', 1, 1300),
  G19,
  item(G19.rowUid, '1.9.1', 'Informes de seguimiento ambiental al día, al llegar al 25% de avance en obra', 'global', 1, 1300),
  item(G19.rowUid, '1.9.2', 'Informes de seguimiento ambiental al día, al llegar al 50% de avance en obra', 'global', 1, 1300),
  item(G19.rowUid, '1.9.3', 'Informes de seguimiento ambiental al día, al llegar al 75% de avance en obra', 'global', 1, 1300),
  item(G19.rowUid, '1.9.4', 'Informes de seguimiento ambiental al día, al llegar al 100% de avance en obra', 'global', 1, 1300),
  G110,
  item(G110.rowUid, '1.10.1', 'Conformación de calzada', 'm2', 4120, 7.8, 128.205, 3991.795),
  item(G110.rowUid, '1.10.2', 'Suministro, colocación y compactación de Material Selecto 0.20m', 'm3', 1008, 61),
  item(G110.rowUid, '1.10.3', 'Conformación de Cunetas y floreos', 'm', 2160, 7, 0, 1977.82),
  G111,
  item(G111.rowUid, '1.11.1', 'Construcción de Cunetas pavimentadas en "Trapezoidal"', 'm', 16, 75),
  item(G111.rowUid, '1.11.2', 'Limpieza de tubos de 0.90m', 'mL', 6, 150),
  item(G111.rowUid, '1.11.3', 'Demolición de puente existente (INCLUYE RETIRO DE ESCOMBROS)', 'm2', 21, 890, 21),
  item(G111.rowUid, '1.11.4', 'Construcción de Cajón Pluvial, aletas, losa de acceso y Barandales', 'm3', 90.51, 872),
  item(G111.rowUid, '1.11.5', 'Relleno general Cajón Pluvial', 'm3', 457.5, 18),
  item(G111.rowUid, '1.11.6', 'Habilitación temporal de cruce vehicular', 'm2', 250, 25, 250),
  item(G111.rowUid, '1.11.7', 'Rectificación, Canalización de la Quebrada en entrada y salida del cajón', 'm3', 451, 17.5),
  G112,
  item(G112.rowUid, '1.12.1', 'Material y Excavación para lecho clase "B"', 'm3', 75.6, 25),
  item(G112.rowUid, '1.12.2', 'Colocación de tubos de hormigón reforzado clase III de 0.90m', 'm', 28, 180),
  item(G112.rowUid, '1.12.3', 'Hormigón reforzado para cabezales 0.90m', 'm3', 18.76, 500),
  item(G112.rowUid, '1.12.4', 'Zampeado con mortero en entrada y salidas de tubos', 'm2', 34.8, 90),
];

const baseOpts = (over: Partial<CuadroPrintOptions> = {}): CuadroPrintOptions => ({
  // Legal horizontal: el papel con el que se entrega la hoja.
  Wmm: 355.6, Hmm: 215.9, marginMM: 10, fontKey: 'normal', maxTall: 0,
  titulo: [
    'EMPRESA DE TRANSMISIÓN ELÉCTRICA, S.A. (ETESA)',
    'CUADRO DE PRESENTACIÓN DE CUENTA',
    'Cuenta No. 2',
  ],
  columnas: [
    [
      { etiqueta: 'CONTRATISTA:', valor: 'PINELLAS S.A.' },
      { etiqueta: 'ORDEN DE COMPRA N°', valor: '47346' },
      { etiqueta: 'PROYECTO:', valor: 'MEJORAS AL CAMINO DE ACCESO TRAMO 2 - LT 230KV 20A/20B TORRE 27B Y26B - CHANGUINOLA - LA ESPERANZA, ZONA 3', auto: true },
      { etiqueta: 'VALOR DEL CONTRATO:', valor: 'B/. 375,574.56', auto: true },
    ],
    [
      { etiqueta: 'Periodo de la cuenta:', valor: '20 de diciembre de 2025 al 28 de mayo de 2026', auto: true },
      { etiqueta: 'Orden de Proceder:', valor: '13-oct-25' },
      { etiqueta: 'Duración Contractual:', valor: '310 días' },
      { etiqueta: 'Fecha de presentación:', valor: '29 de mayo de 2026' },
    ],
    [
      { etiqueta: '% de Avance del Total', valor: '36.54%', auto: true },
      { etiqueta: '% de Avance del periodo', valor: '12.81%', auto: true },
      { etiqueta: 'Monto de Contrato B/.', valor: '351,004.26', auto: true },
      { etiqueta: '7% ITBMS B/.', valor: '24,570.30', auto: true },
      { etiqueta: 'Valor B/.', valor: '375,574.56', auto: true },
      { etiqueta: 'Cuenta N°', valor: '2', recuadro: true, auto: true },
    ],
  ],
  firmas: [
    { lineas: ['Ing. Moisés Méndez', 'CONTRATISTA — PINELLAS S.A.'] },
    { lineas: ['VoBo. ETESA', 'Gerencia de Mantenimiento y Control de Servidumbre'] },
    { lineas: ['VoBo. ETESA', 'Dirección de Operaciones y Mantenimiento'] },
    { lineas: ['Fiscalización', 'Contraloría General de la República'] },
  ],
  logosLeft: [], logosRight: [],
  ...over,
});

const repetir = (veces: number): CuadroLinea[] => {
  const out: CuadroLinea[] = [];
  for (let k = 0; k < veces; k++) {
    for (const l of ETESA_C2) {
      out.push({
        ...l,
        rowUid: `k${k}-${l.rowUid}`,
        parentRowUid: l.parentRowUid ? `k${k}-${l.parentRowUid}` : null,
      });
    }
  }
  return out;
};

// ── 1 · formato ─────────────────────────────────────────────────────────

eq(fmtCant(4120), '4,120.00', 'fmtCant: entero se muestra con dos decimales');
eq(fmtCant(128.205), '128.205', 'fmtCant: tres decimales se conservan');
eq(fmtCant(3991.795), '3,991.795', 'fmtCant: miles agrupados con tres decimales');
eq(fmtCant(0), '0.00', 'fmtCant: cero');
eq(fmtCant(-182.18), '-182.18', 'fmtCant: negativo');
eq(fmtCant(1008), '1,008.00', 'fmtCant: mil con dos decimales');

eq(fmtPct(1, 2), '100.00%', 'fmtPct: uno es cien por ciento');
eq(fmtPct(0.9689, 0), '97%', 'fmtPct: sin decimales redondea');
eq(fmtPct(0.128149, 2), '12.81%', 'fmtPct: dos decimales');
eq(fmtPct(0, 0), '0%', 'fmtPct: cero');
eq(fmtPct(-0.000001, 2), '0.00%', 'fmtPct: nunca imprime -0');
eq(fmtPct(0.365371, 2), '36.54%', 'fmtPct: el total a la fecha de la Cuenta 2');

// ── 2 · los totales de la hoja entregada ────────────────────────────────

const T = calcTotales(ETESA_C2);
eq(T.presupuesto.toFixed(2), '351004.26', 'SUB-TOTAL presupuesto');
eq(T.anterior.toFixed(2), '83266.04', 'SUB-TOTAL hasta periodo anterior');
eq(T.este.toFixed(2), '44980.74', 'SUB-TOTAL este periodo');
eq(T.fecha.toFixed(2), '128246.78', 'SUB-TOTAL total a la fecha');
eq(T.falta.toFixed(2), '222757.48', 'SUB-TOTAL por ejecutar');

eq(fmtPct(T.pctAnterior, 2), '23.72%', 'PORCENTAJE hasta periodo anterior');
eq(fmtPct(T.pctPeriodo, 2), '12.81%', 'PORCENTAJE este periodo');
eq(fmtPct(T.pctTotal, 2), '36.54%', 'PORCENTAJE total a la fecha');
eq(fmtPct(T.pctFalta, 2), '63.46%', 'PORCENTAJE por ejecutar');

// El total a la fecha del pie es exactamente lo que la card de avance del
// proyecto tiene que mostrar: la división completa, no la suma de redondeos.
ok(Math.abs(T.pctTotal * 100 - 36.5371) < 0.001, 'el % a la fecha sale de la división completa');
ok(Math.abs(T.anterior + T.este - T.fecha) < 1e-6, 'anterior + este = a la fecha');
ok(Math.abs(T.fecha + T.falta - T.presupuesto) < 1e-6, 'a la fecha + por ejecutar = presupuesto');

// ── 3 · filas imprimibles ───────────────────────────────────────────────

const { printRows } = toCuadroPrintRows(ETESA_C2, 0);
eq(printRows.length, ETESA_C2.length, 'una fila impresa por línea');
ok(printRows.every((r) => r.celdas.length === 15), 'toda fila trae las 15 celdas numéricas');
eq(BLOQUES.flatMap((b) => b.subs).length, 15, 'los cinco bloques definen 15 sub-columnas');

const contenedores = printRows.filter((r) => r.container);
eq(contenedores.length, 9, 'los nueve grupos con hijos son contenedores');
ok(contenedores.every((r) => r.celdas.every((c) => c === '')), 'un contenedor no lleva montos');

const calzada = printRows.find((r) => r.num === '1.10.1')!;
eq(
  calzada.celdas,
  [
    '4,120.00', '7.80', '32,136.00',
    '128.205', '3%', '1,000.00',
    '3,991.795', '97%', '31,136.00',
    '4,120.00', '100%', '32,136.00',
    '0.00', '0%', '0.00',
  ],
  'fila 1.10.1 (Conformación de calzada), celda por celda',
);

const cunetas = printRows.find((r) => r.num === '1.10.3')!;
eq(cunetas.celdas[7], '92%', 'fila 1.10.3: 92% este periodo');
eq(cunetas.celdas[14], '1,275.26', 'fila 1.10.3: 1,275.26 por ejecutar');

const polizas = printRows.find((r) => r.num === '1.2')!;
eq(polizas.celdas[4], '100%', 'fila 1.2: 100% hasta el periodo anterior');
eq(polizas.celdas[13], '0%', 'fila 1.2: nada por ejecutar');

const conDosDec = toCuadroPrintRows(ETESA_C2, 2).printRows.find((r) => r.num === '1.10.1')!;
eq(conDosDec.celdas[4], '3.11%', 'decimalesFila manda en el % de la fila');

// ── 4 · layout ──────────────────────────────────────────────────────────

const L = computeCuadroPrintLayout(baseOpts(), { lineas: ETESA_C2 });
ok(!L.errTableTooWide, 'en legal horizontal la tabla cabe a lo ancho');
eq(L.cols.length, 18, 'dieciocho columnas');
eq(L.cols[0].key, 'num', 'primera columna: N°');
eq(L.cols[1].key, 'desc', 'segunda columna: Actividades');
ok(L.descW >= 40, 'Actividades se queda con el sobrante y es legible');
ok(
  Math.abs(L.cols.reduce((s, c) => s + c.w, 0) - L.pwMM) < 0.01,
  'las columnas suman exactamente el ancho útil',
);
ok(L.cols.every((c, i) => i === 0 || c.x >= L.cols[i - 1].x + L.cols[i - 1].w - 0.01), 'las columnas no se solapan');
ok(L.colHeaderH > 0 && L.grupoHdrH > 0 && L.subHdrH > 0, 'la cabecera tiene sus dos filas');
eq(L.grupoHdrH + L.subHdrH, L.colHeaderH, 'la cabecera mide lo que suman sus dos filas');
ok(L.info.cols.length === 3, 'el encabezado tiene tres columnas');
eq(L.info.cols.map((c) => c.lineas.length), [4, 4, 6], 'cada columna del encabezado con sus líneas');
ok(L.info.h > 0, 'el bloque de información ocupa alto');
ok(L.docHeaderH > L.info.h, 'el encabezado incluye el título además de la información');
eq(L.titleLines.filter(Boolean).length, 3, 'las tres líneas del título');
ok(L.firmas.boxes.length === 4 && L.firmas.filas === 1, 'cuatro firmas en una sola hilera');
ok(L.warn == null, 'sin advertencias en el ajuste automático');

// Un papel angosto no puede con 18 columnas: hay que avisarlo, no imprimir
// una hoja ilegible.
const angosto = computeCuadroPrintLayout(baseOpts({ Wmm: 148, Hmm: 210 }), { lineas: ETESA_C2 });
ok(angosto.errTableTooWide, 'en A5 vertical la tabla no cabe y se avisa');

// ── 5 · paginación ──────────────────────────────────────────────────────

ok(L.pagesTall >= 1, 'al menos una página');
eq(
  L.pageRows.reduce((s, p) => s + (p.end - p.start), 0),
  ETESA_C2.length,
  'las páginas se reparten todas las filas, sin perder ni repetir',
);
ok(L.pageRows.every((p) => p.end > p.start), 'ninguna página queda vacía');
ok(
  L.pageRows.every((p, i) => i === 0 || p.start === L.pageRows[i - 1].end),
  'las páginas van una detrás de otra',
);

const largo = computeCuadroPrintLayout(baseOpts(), { lineas: repetir(6) });
ok(largo.pagesTall > L.pagesTall, 'seis veces las filas necesita más páginas');
eq(
  largo.pageRows.reduce((s, p) => s + (p.end - p.start), 0),
  ETESA_C2.length * 6,
  'con seis repeticiones tampoco se pierde una fila',
);

// Con tope de páginas la letra se encoge en vez de desbordar.
const apretado = computeCuadroPrintLayout(baseOpts({ maxTall: 2 }), { lineas: repetir(4) });
const suelto = computeCuadroPrintLayout(baseOpts(), { lineas: repetir(4) });
ok(apretado.fontPt < suelto.fontPt, 'con maxTall la letra baja');
ok(apretado.pagesTall <= suelto.pagesTall, 'y el documento no crece');

const imposible = computeCuadroPrintLayout(baseOpts({ maxTall: 1 }), { lineas: repetir(12) });
ok(imposible.warn != null, 'lo que no cabe ni con la letra mínima se avisa');
ok(imposible.fontPt >= 6, 'la letra nunca baja de 6 pt');

// ── 6 · páginas ─────────────────────────────────────────────────────────

const { pages, campos, layout } = buildCuadroPrintPages(baseOpts(), { lineas: ETESA_C2 });
eq(pages.length, layout.pagesTall, 'se emiten tantas páginas como dice el layout');
ok(pages.every((p) => p.startsWith('<svg') && p.endsWith('</svg>')), 'cada página es un SVG cerrado');
ok(pages.every((p) => (p.match(/<g /g) || []).length === (p.match(/<\/g>/g) || []).length), 'los grupos abren y cierran parejos');
ok(pages.every((p) => p.includes('viewBox="0 0 335.60 195.90"')), 'el viewBox va en mm del área útil');

const conActividades = pages.filter((p) => p.includes('Actividades')).length;
eq(conActividades, pages.length, 'la cabecera de columnas se repite en todas las páginas');
const conBloque = pages.filter((p) => p.includes('Ejecutado')).length;
eq(conBloque, pages.length, 'los bloques de la cabecera también se repiten');

const conSubtotal = pages.filter((p) => p.includes('SUB-TOTAL')).length;
eq(conSubtotal, 1, 'SUB-TOTAL sale una sola vez');
const conPorcentaje = pages.filter((p) => p.includes('PORCENTAJE (%)')).length;
eq(conPorcentaje, 1, 'PORCENTAJE (%) sale una sola vez');
ok(pages[pages.length - 1].includes('SUB-TOTAL'), 'el pie va en la última página');

const ultima = pages[pages.length - 1];
ok(ultima.includes('351,004.26'), 'el subtotal del presupuesto se imprime');
ok(ultima.includes('128,246.78'), 'el total a la fecha se imprime');
ok(ultima.includes('36.54%'), 'el porcentaje a la fecha se imprime');
ok(ultima.includes('63.46%'), 'el porcentaje por ejecutar se imprime');

const conFirma = pages.filter((p) => p.includes('Fiscalización')).length;
eq(conFirma, 1, 'las firmas salen una sola vez');
ok(ultima.includes('Fiscalización'), 'y van en la última página');
ok(pages[0].includes('CUADRO DE PRESENTACIÓN DE CUENTA'), 'el título va en la primera página');
eq(
  pages.filter((p) => p.includes('CUADRO DE PRESENTACIÓN DE CUENTA')).length,
  pages.length,
  'el encabezado del documento se repite en todas las páginas',
);
ok(pages.every((p, i) => p.includes(`${i + 1} de ${pages.length}`)), 'cada página se numera');

// Cada fila se imprime una sola vez, y la última no tiene por qué caer en la
// última página: cuando la cola no cabe debajo, se lleva una página propia.
eq(pages.filter((p) => p.includes('Zampeado')).length, 1, 'la última fila del cuadro se imprime una vez');
eq(pages.filter((p) => p.includes('Pólizas de seguro y Fianzas')).length, 1, 'la primera fila también');
ok(pages[0].includes('Pólizas de seguro y Fianzas'), 'y la primera va en la primera página');

// Un texto con & o < no puede romper el SVG.
const conRaros = buildCuadroPrintPages(
  baseOpts({ titulo: ['Obras & Servicios <S.A.>', '', ''] }),
  { lineas: ETESA_C2 },
);
ok(conRaros.pages[0].includes('Obras &amp; Servicios &lt;S.A.&gt;'), 'el título se escapa');
ok(!conRaros.pages[0].includes('<S.A.>'), 'no queda marcado suelto en el SVG');

// Los logos que no son data:image/ se descartan (llegan de una subida).
const conLogoMalo = buildCuadroPrintPages(
  baseOpts({ logosLeft: ['javascript:alert(1)', 'data:image/png;base64,AAA'], logosRight: [] }),
  { lineas: ETESA_C2 },
);
ok(!conLogoMalo.pages[0].includes('javascript:'), 'un logo con esquema raro no llega al SVG');
ok(conLogoMalo.pages[0].includes('data:image/png;base64,AAA'), 'el logo válido sí se dibuja');

// ── 6b · el símbolo B/. ─────────────────────────────────────────────────
// La hoja lleva "B/." en TODA celda de monto, al filo izquierdo, con la cifra
// al derecho — es el formato contable del Excel que se entrega.

eq(CELDA_TIPO.filter((t) => t === 'money').length, 6, 'seis columnas de monto');
eq(CELDA_TIPO.filter((t) => t === 'pct').length, 4, 'cuatro columnas de porcentaje');
eq(CELDA_TIPO.filter((t) => t === 'cant').length, 5, 'cinco columnas de cantidad');

// Una columna de monto es más ancha que la de cantidad de su mismo bloque:
// el símbolo pide su sitio.
ok(L.cols[3 + 5].w > L.cols[3 + 3].w, 'la columna de monto reserva ancho para el B/.');

// El relleno va a los DOS lados de la celda. Con la mitad, la raya quedaba
// emparedada entre la cifra de una celda y el "B/." de la siguiente y se leían
// como un solo bloque. La columna 5 (Valor B/. del periodo anterior) tiene
// '18,690.00' como contenido más largo: 9 caracteres más los 3.6 del símbolo.
ok(
  Math.abs(L.cols[3 + 5].w - ((9 + 3.6) * L.emMM + 2 * L.padNumMM)) < 0.01,
  'la celda de monto reserva relleno a izquierda y derecha, no solo medio',
);

const unaSola = buildCuadroPrintPages(baseOpts(), {
  lineas: [item(null, '1', 'Única', 'global', 1, 100, 0, 1)],
});
const simbolos = (unaSola.pages[0].match(/>B\/\.<\/text>/g) || []).length;
// 6 de la fila + 5 del SUB-TOTAL. Ni uno más: la fila PORCENTAJE (%) no lleva
// símbolo, sus valores son porcentajes.
eq(simbolos, 11, 'el B/. sale en cada monto y no en los porcentajes');
ok(unaSola.pages[0].includes('100.00%'), 'y el porcentaje se imprime sin símbolo');

// La raya que separa las dos filas de la cabecera no puede cruzar N°,
// Actividades ni Unidad: esas tres ocupan las dos filas.
const yCab = layout.grupoHdrH.toFixed(2);
ok(!pages[0].includes(`<line x1="0.00" y1="${yCab}"`), 'la cabecera no se parte en las tres primeras columnas');
ok(pages[0].includes(`y1="${yCab}" x2="${layout.pwMM.toFixed(2)}"`), 'pero sí separa los cinco bloques');

// ── 7 · campos editables ────────────────────────────────────────────────

const ids = campos.map((c) => c.id);
eq(new Set(ids).size, ids.length, 'no hay dos campos con el mismo id');
eq(ids.filter((i) => i.startsWith('titulo:')).length, 3, 'un campo por línea de título');
eq(ids.filter((i) => i.startsWith('col:')).length, (4 + 4 + 6) * 2, 'etiqueta y valor por cada línea del encabezado');
eq(ids.filter((i) => i.startsWith('firma:')).length, 4 * 2, 'nombre y pie por cada firma');
ok(campos.every((c) => c.wMM > 0 && c.hMM > 0), 'ningún campo mide cero');
ok(
  campos.every((c) => c.xMM >= -0.01 && c.yMM >= -0.01 && c.xMM + c.wMM <= layout.pwMM + 0.01),
  'todos los campos caen dentro del ancho de la hoja',
);
ok(
  campos.every((c) => c.yMM + c.hMM <= layout.phMM + 0.01),
  'todos los campos caen dentro del alto de la hoja',
);
ok(campos.filter((c) => c.id.startsWith('titulo:') || c.id.startsWith('col:')).every((c) => c.pagina === 0),
  'el encabezado se edita en la primera página');
ok(campos.filter((c) => c.id.startsWith('firma:')).every((c) => c.pagina === pages.length - 1),
  'las firmas se editan en la última');

// El valor del campo es lo que el usuario escribió, no el texto ya partido.
const proyecto = campos.find((c) => c.id === 'col:0:2:valor')!;
ok(proyecto.valor.startsWith('MEJORAS AL CAMINO DE ACCESO'), 'el campo lleva el valor original');
ok(proyecto.valor.length > 100, 'sin truncar por el ajuste de línea');
ok(proyecto.auto, 'el nombre del proyecto viene marcado como automático');
ok(!campos.find((c) => c.id === 'col:1:1:valor')!.auto, 'la orden de proceder se escribe a mano');
eq(campos.find((c) => c.id === 'titulo:2')!.valor, 'Cuenta No. 2', 'el título conserva su línea');

// El título ya no lleva ninguna línea en negrita: el peso lo daba la última,
// y desde que «Cuenta No. N» puede ir en cualquier posición eso dejó de tener
// sentido. Las únicas negritas de la primera página son las del encabezado de
// tres columnas y las de la tabla.
const svgTitulo = buildCuadroPrintPages(
  baseOpts({ titulo: ['UNO', 'DOS', 'Cuenta No. 2'] }), { lineas: ETESA_C2 },
).pages[0];
const negritasConTitulo = (svgTitulo.match(/font-weight="700"/g) || []).length;
const svgSinTitulo = buildCuadroPrintPages(
  baseOpts({ titulo: [] }), { lineas: ETESA_C2 },
).pages[0];
eq(
  negritasConTitulo,
  (svgSinTitulo.match(/font-weight="700"/g) || []).length,
  'ninguna línea del título va en negrita',
);

// Seis renglones de título caben; el séptimo se recorta.
const seisTitulos = computeCuadroPrintLayout(
  baseOpts({ titulo: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }), { lineas: ETESA_C2 },
);
eq(seisTitulos.titleLines.length, 6, 'el título se recorta a seis renglones');
const tresTitulos = computeCuadroPrintLayout(
  baseOpts({ titulo: ['A', 'B', 'C'] }), { lineas: ETESA_C2 },
);
ok(seisTitulos.topH > tresTitulos.topH, 'y cada renglón de más sube el alto del encabezado');
eq(campos.find((c) => c.id === 'col:2:0:valor')!.align, 'right', 'la columna derecha alinea a la derecha');
eq(campos.find((c) => c.id === 'col:1:0:etiqueta')!.align, 'right', 'la etiqueta del centro alinea a la derecha');
eq(campos.find((c) => c.id === 'col:2:0:etiqueta')!.align, 'right', 'la etiqueta de la derecha también');

// En la columna derecha manda el valor: la etiqueta se le pega. Si el ancho lo
// mandara la etiqueta, quedarían separadas por medio tercio de página.
const colDer = layout.info.cols[2];
ok(colDer.valW <= colDer.w * 0.5, 'el valor de la columna derecha no se come la columna');
ok(colDer.labelW >= colDer.w * 0.4, 'y la etiqueta llega hasta pegarse a él');

// ── 8 · firmas de 1 a 8 ─────────────────────────────────────────────────

const firmasDe = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ lineas: [`Firma ${i + 1}`, `Cargo ${i + 1}`] }));

// La hilera REPARTE el ancho de la hoja — con dos firmas, una a la izquierda y
// otra a la derecha — pero la RAYA tiene ancho propio y va centrada en su
// hueco. Antes la raya se estiraba con el hueco y una firma sola cruzaba la
// hoja entera, que es justo lo que no parece una línea de firma.
const FIRMA_ANCHO_MM = 70;

for (let n = 1; n <= 8; n++) {
  const l = computeCuadroPrintLayout(baseOpts({ firmas: firmasDe(n) }), { lineas: ETESA_C2 });
  ok(l.firmas.boxes.length === n, `${n} firma(s): se dibujan todas`);
  ok(l.firmas.filas === (n <= 5 ? 1 : 2), `${n} firma(s): ${n <= 5 ? 'una' : 'dos'} hilera(s)`);
  ok(l.firmas.h > 0, `${n} firma(s): el bloque ocupa alto`);
  const fila0 = l.firmas.boxes.filter((b) => b.fila === 0);
  const anchoFila0 = fila0.reduce((s, b) => s + b.w, 0);
  ok(Math.abs(anchoFila0 - l.pwMM) < 0.01, `${n} firma(s): la hilera reparte el ancho`);
  ok(
    fila0.every((b) => Math.abs(b.lineW - fila0[0].lineW) < 0.01),
    `${n} firma(s): todas las rayas del mismo largo`,
  );
  ok(fila0[0].lineW <= FIRMA_ANCHO_MM + 0.01, `${n} firma(s): la raya no pasa de 7 cm`);
  ok(
    fila0.every((b) => b.lineW <= b.w + 0.01),
    `${n} firma(s): la raya cabe en su hueco`,
  );
}

// El caso que motivó el cambio.
const firmaUnica = computeCuadroPrintLayout(baseOpts({ firmas: firmasDe(1) }), { lineas: ETESA_C2 });
ok(
  firmaUnica.firmas.boxes[0].lineW < firmaUnica.pwMM * 0.5,
  'una firma sola no se lleva la hoja entera',
);
eq(firmaUnica.firmas.boxes[0].lineW, FIRMA_ANCHO_MM, 'y su raya mide los 7 cm');

// Con dos, una queda en la mitad izquierda y la otra en la derecha.
const dos = computeCuadroPrintLayout(baseOpts({ firmas: firmasDe(2) }), { lineas: ETESA_C2 });
const centro = (b: { x: number; w: number }) => b.x + b.w / 2;
ok(centro(dos.firmas.boxes[0]) < dos.pwMM / 2, 'con dos firmas, la primera va a la izquierda');
ok(centro(dos.firmas.boxes[1]) > dos.pwMM / 2, 'y la segunda a la derecha');

// Hasta cuatro líneas por firma; de la quinta en adelante se recortan.
const dosLineas = computeCuadroPrintLayout(
  baseOpts({ firmas: [{ lineas: ['Nombre', 'Cargo'] }] }), { lineas: ETESA_C2 },
);
const cuatroLineas = computeCuadroPrintLayout(
  baseOpts({ firmas: [{ lineas: ['Nombre', 'Cargo', 'Empresa', 'Cédula'] }] }), { lineas: ETESA_C2 },
);
ok(cuatroLineas.firmas.h > dosLineas.firmas.h, 'cuatro líneas ocupan más alto que dos');
eq(cuatroLineas.firmas.boxes[0].pieLines.length, 3, 'tres líneas debajo del nombre');
const seisLineas = computeCuadroPrintLayout(
  baseOpts({ firmas: [{ lineas: ['A', 'B', 'C', 'D', 'E', 'F'] }] }), { lineas: ETESA_C2 },
);
eq(seisLineas.firmas.boxes[0].pieLines.length, 3, 'de la quinta línea en adelante se recorta');

const nueve = computeCuadroPrintLayout(baseOpts({ firmas: firmasDe(9) }), { lineas: ETESA_C2 });
eq(nueve.firmas.boxes.length, 8, 'más de ocho firmas se recortan a ocho');

const sinFirmas = buildCuadroPrintPages(baseOpts({ firmas: [] }), { lineas: ETESA_C2 });
ok(sinFirmas.pages.length > 0, 'sin firmas también se imprime');
ok(!sinFirmas.campos.some((c) => c.id.startsWith('firma:')), 'y no quedan campos de firma');

// ── 8.5 · el color de la hoja ───────────────────────────────────────────

// De UN color salen la banda del encabezado, su texto, el pie y un tono por
// nivel: cambiarlo tiene que mover la hoja entera, no una parte.
const azul = buildCuadroPrintPages(baseOpts(), { lineas: ETESA_C2 }).pages[0];
const verde = buildCuadroPrintPages(
  baseOpts({ color: '#1F5F3A' }), { lineas: ETESA_C2 },
).pages[0];
ok(azul !== verde, 'cambiar el color cambia la hoja');
ok(!verde.includes('#dfe5ee'), 'y no queda ningún tono del azul viejo');

// La escala tiene tantos pasos como niveles tenga el desglose, y todos son
// distintos: con una lista fija, del cuarto nivel en adelante se repetían.
const p4 = paletaCuadro('#1F375F', 4);
const p8 = paletaCuadro('#1F375F', 8);
eq(p4.niveles.length, 4, 'cuatro niveles, cuatro tonos');
eq(p8.niveles.length, 8, 'ocho niveles, ocho tonos');
eq(new Set(p8.niveles).size, 8, 'y los ocho son distintos entre sí');
ok(
  hexAHsl(p8.niveles[0]).l < hexAHsl(p8.niveles[7]).l,
  'la escala va de más oscuro a más claro',
);

// El color escogido aparece TAL CUAL: es la banda del encabezado y el primer
// nivel. Antes solo se usaban versiones aclaradas y el color elegido no salía
// por ningún lado — un amarillo brillante terminaba en tonos crema.
eq(p4.headFill, '#1f375f', 'la banda del encabezado es el color escogido');
eq(p4.niveles[0], '#1f375f', 'y el nivel 1 también');

// La letra blanca la pone el proyecto, no el cálculo: es acumulativa desde
// arriba y el encabezado va con el nivel 1.
const blancos0 = paletaCuadro('#1F375F', 4, 0);
eq(blancos0.headText, '#1c1f24', 'en 0 el encabezado va con letra oscura');
eq(new Set(blancos0.tintas).size, 1, 'y ningún nivel lleva letra blanca');
eq(blancos0.tintas[0], '#1c1f24', 'ni siquiera el primero');

const blancos1 = paletaCuadro('#1F375F', 4, 1);
eq(blancos1.headText, '#ffffff', 'en 1 el encabezado va con letra blanca');
eq(blancos1.tintas.join(), '#ffffff,#1c1f24,#1c1f24,#1c1f24', 'y solo el nivel 1');

const blancos3 = paletaCuadro('#1F375F', 4, 3);
eq(
  blancos3.tintas.join(),
  '#ffffff,#ffffff,#ffffff,#1c1f24',
  'en 3 los tres primeros niveles van en blanco: es acumulativo',
);

// Pedir más bandas blancas que niveles tiene el desglose no rompe nada.
eq(
  paletaCuadro('#1F375F', 2, 8).tintas.join(),
  '#ffffff,#ffffff',
  'pedir más blancos que niveles deja todos en blanco',
);
eq(tintaDeNivel(blancos1, 9), '#1c1f24', 'más allá del último nivel, la tinta se queda en la del último');

// El ajuste manda sobre el tono: un amarillo brillante con letra blanca queda
// ilegible, y aun así sale, porque lo pidió el proyecto.
const amarillo = paletaCuadro('#FFE600', 4, 1);
eq(amarillo.headFill, '#ffe600', 'un amarillo brillante se usa tal cual');
eq(amarillo.headText, '#ffffff', 'y el ajuste manda aunque el tono sea claro');
ok(
  hexAHsl(amarillo.niveles[3]).h > 40 && hexAHsl(amarillo.niveles[3]).h < 70,
  'los niveles del amarillo siguen siendo amarillos, no marrones',
);

// Y el ajuste tiene que llegar hasta la hoja armada, no quedarse en la paleta.
const hoja3 = buildCuadroPrintPages(baseOpts({ nivelesBlancos: 3 }), { lineas: ETESA_C2 }).pages[0];
const hoja0 = buildCuadroPrintPages(baseOpts({ nivelesBlancos: 0 }), { lineas: ETESA_C2 }).pages[0];
ok(hoja3 !== hoja0, 'cambiar los niveles con letra blanca cambia la hoja');
ok(hoja0.length > 0 && hoja3.length > 0, 'y en los dos extremos la hoja sigue saliendo');

// La columna N° es una rejilla continua: las bandas de sección también llevan
// su filo derecho. Va en la tinta de la banda, si no se pierde sobre el tono
// oscuro del nivel 1.
const conBandas = buildCuadroPrintPages(baseOpts(), { lineas: ETESA_C2 }).pages[0];
const filosBlancos = [...conBandas.matchAll(
  /<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="#ffffff"/g,
)].filter((m) => m[1] === m[2]);
ok(filosBlancos.length > 0, 'las bandas de sección llevan el filo de la columna N°');
const xNum = filosBlancos[0][1];
ok(
  new RegExp(`<line x1="${xNum}" y1="[\\d.]+" x2="${xNum}" y2="[\\d.]+" stroke="#2b3140"`).test(conBandas),
  'y cae justo donde va esa misma vertical en las filas normales',
);
ok(
  !hoja0.includes('stroke="#ffffff"'),
  'con la letra en oscuro, ese filo también sale oscuro y no queda ninguna línea blanca',
);

// El «Cuenta N°» va dentro de un recuadro, y el número centrado en la caja.
const caja = conBandas.match(
  /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" fill="none" stroke="#111827"/,
);
ok(caja != null, 'el valor de Cuenta N° sale dentro de un recuadro');
const centroCaja = (Number(caja![1]) + Number(caja![2]) / 2).toFixed(2);
ok(
  conBandas.includes(`<text x="${centroCaja}"`),
  'y el número va centrado en la caja, no pegado a su filo derecho',
);

// Un color inservible no puede tumbar la hoja.
ok(
  buildCuadroPrintPages(baseOpts({ color: 'no-es-color' }), { lineas: ETESA_C2 }).pages.length > 0,
  'un color inválido cae al azul de la casa en vez de romper',
);

// ── 9 · casos límite ────────────────────────────────────────────────────

const vacio = buildCuadroPrintPages(baseOpts(), { lineas: [] });
eq(vacio.pages.length, 1, 'un cuadro sin filas es una página');
ok(vacio.pages[0].includes('SUB-TOTAL'), 'con su pie en cero');
ok(vacio.pages[0].includes('0.00%'), 'y sus porcentajes en cero');

const unaFila = buildCuadroPrintPages(baseOpts(), {
  lineas: [item(null, '1', 'Única', 'global', 1, 100, 0, 1)],
});
eq(unaFila.pages.length, 1, 'una sola fila cabe en una página');
ok(unaFila.pages[0].includes('100.00%'), 'ejecutada al 100% en el periodo');

// La cola (totales + firmas) que no cabe bajo la última fila se va a una
// página propia, y allí la cabecera de columnas se repite.
const justo = computeCuadroPrintLayout(baseOpts({ Hmm: 150 }), { lineas: repetir(2) });
const justoPages = buildCuadroPrintPages(baseOpts({ Hmm: 150 }), { lineas: repetir(2) });
eq(justoPages.pages.length, justo.pagesTall, 'la cola cuenta como página cuando toca');
eq(justoPages.pages.filter((p) => p.includes('SUB-TOTAL')).length, 1, 'y el pie sigue siendo único');
eq(
  justoPages.pages.filter((p) => p.includes('Actividades')).length,
  justoPages.pages.length,
  'la cabecera se repite también en la página de la cola',
);

// ── resultado ───────────────────────────────────────────────────────────

console.log(`\ncuadro-print.spec: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
