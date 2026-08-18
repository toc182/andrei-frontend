// cuentaImpresion.ts — el montaje de la hoja imprimible del Cuadro de
// Presentación de Cuenta: qué se guarda, qué se calcula y cómo se convierte en
// las opciones que consume cuadroPrint.ts.
//
// La regla que da sentido al módulo: **lo que el sistema ya sabe no se guarda
// como texto**. Cada línea del encabezado puede llevar un `origen`; si lo
// lleva, su valor se recalcula del cuadro cada vez que se abre la hoja y el
// panel no deja escribirlo. Guardar esos números a mano es exactamente lo que
// hizo que la Cuenta 2 se entregara diciendo 36.54% de avance del periodo
// cuando el pie de su propia tabla decía 12.81%.
//
// Puro: sin DOM y sin llamadas. Lo prueba scripts/cuenta-impresion.spec.ts.

import type { LogoChoice } from './cronogramaApi';
import {
  CUADRO_FONTS, MAX_LINEAS_FIRMA, MAX_TITULO_LINEAS, type CuadroPrintOptions,
} from './cuadroPrint';
import { fmt2 } from './desglosePrint';
import {
  COLOR_HOJA_DEFECTO, NIVELES_BLANCOS_DEFECTO, NIVELES_BLANCOS_MAX,
} from './cuadroColor';
import type { CuadroTotales } from './cuadroModel';

/** De dónde sale un valor que NO se escribe a mano. */
export type OrigenAuto =
  | 'proyecto'
  | 'valorContrato'
  | 'periodo'
  | 'ordenProceder'
  | 'pctTotal'
  | 'pctPeriodo'
  | 'montoContrato'
  | 'itbms'
  | 'valorTotal'
  | 'numeroCuenta';

/** Los `origen` que el sistema sabe resolver. Un montaje guardado puede traer
 *  uno que ya no existe — pasó con la fecha de presentación, que dejó de ser
 *  automática —; esa línea se degrada a texto en vez de romper la pantalla. */
export const ORIGENES: ReadonlySet<string> = new Set<OrigenAuto>([
  'proyecto', 'valorContrato', 'periodo', 'ordenProceder', 'pctTotal',
  'pctPeriodo', 'montoContrato', 'itbms', 'valorTotal', 'numeroCuenta',
]);

export interface LineaImpresion {
  etiqueta: string;
  valor: string;
  origen?: OrigenAuto;
  /** El valor va dentro de un recuadro (el «Cuenta N°» de la hoja de ETESA). */
  recuadro?: boolean;
}

/** Una firma es una lista de hasta MAX_LINEAS_FIRMA líneas: la primera es el
 *  nombre (va en negrita) y debajo caben cargo, empresa, cédula… */
export interface FirmaImpresion {
  lineas: string[];
}

/** Formato viejo del título: `[string, string]`, con «Cuenta No. N» implícito
 *  como tercer renglón. Se convierte al leer para que un montaje guardado
 *  antes del cambio no se pierda. */
function tituloDeCrudo(raw: unknown[], porDefecto: RenglonTitulo[]): RenglonTitulo[] {
  if (raw.length === 0) return porDefecto;
  if (raw.every((x) => typeof x === 'string')) {
    return [
      ...(raw as string[]).map((texto) => ({ texto })),
      { texto: '', origen: 'numeroCuenta' as const },
    ];
  }
  const out = raw.flatMap((x): RenglonTitulo[] => {
    if (x == null || typeof x !== 'object') return [];
    const r = x as { texto?: unknown; origen?: unknown };
    return [{
      texto: typeof r.texto === 'string' ? r.texto : '',
      ...(r.origen === 'numeroCuenta' ? { origen: 'numeroCuenta' as const } : {}),
    }];
  });
  return out.length ? out.slice(0, MAX_TITULO_LINEAS) : porDefecto;
}

/** Formato viejo: `{ nombre, cargo }`. Se convierte al leer para que un JSONB
 *  guardado antes del cambio no se pierda. */
function firmaDeCrudo(raw: unknown): FirmaImpresion {
  if (raw == null || typeof raw !== 'object') return { lineas: [''] };
  const f = raw as { lineas?: unknown; nombre?: unknown; cargo?: unknown };
  if (Array.isArray(f.lineas)) {
    const l = f.lineas.map((x) => (typeof x === 'string' ? x : '')).slice(0, MAX_LINEAS_FIRMA);
    return { lineas: l.length ? l : [''] };
  }
  return {
    lineas: [
      typeof f.nombre === 'string' ? f.nombre : '',
      typeof f.cargo === 'string' ? f.cargo : '',
    ],
  };
}

/** La hoja admite de 1 a 8 firmas; pasadas cinco se parten en dos hileras. */
export const MAX_FIRMAS = 8;

/** Las tres columnas del encabezado, como se nombran en los paneles. */
export const COLUMNA_TITULOS = ['Columna izquierda', 'Columna central', 'Columna derecha'];

/** La hoja que se entrega en la institución va SIEMPRE en legal horizontal.
 *  No es una preferencia: es el formato del documento, así que no se elige. */
export const PAPEL_HOJA = {
  papel: 'legal',
  orientacion: 'horizontal',
} as const;

/** Un renglón del título central. Con `origen` lo pone el sistema y no se
 *  escribe; sin él, es texto libre. El automático puede ir en cualquier
 *  posición: arriba, en medio o al final. */
export interface RenglonTitulo {
  texto: string;
  origen?: 'numeroCuenta';
}

export interface AjustesImpresion {
  /** Los renglones del título, en orden. */
  titulo: RenglonTitulo[];
  columnas: [LineaImpresion[], LineaImpresion[], LineaImpresion[]];
  firmas: FirmaImpresion[];
  logosIzq: LogoChoice[];
  logosDer: LogoChoice[];
  /** Color base de la hoja; de él sale toda la paleta (cuadroColor.ts). */
  color: string;
  /** Cuántas bandas van con letra blanca, contando desde arriba: 0 ninguna,
   *  1 el encabezado y el nivel 1, 2 hasta el nivel 2, y así. */
  nivelesBlancos: number;
  papel: string;
  orientacion: 'vertical' | 'horizontal';
  letra: keyof typeof CUADRO_FONTS;
  /** 0 = las que hagan falta. */
  maxPaginas: number;
}

/** Lo que el sistema conoce de esta cuenta y de su proyecto. */
export interface CtxImpresion {
  numero: number;
  periodoInicio: string | null;
  periodoFin: string | null;
  /** Fecha de la Orden de Proceder, del PROYECTO (Información). */
  ordenProceder: string | null;
  proyectoNombre: string;
  clienteNombre: string | null;
  itbmsTasa: number | null;
  totales: CuadroTotales;
}

// ---- fechas ----

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** '2026-05-28' → '28 de mayo de 2026'. Se parte la cadena en vez de usar Date
 *  para no correr un día por zona horaria. */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const mes = MESES[Number(m) - 1];
  if (!y || !mes || !d) return '';
  return `${Number(d)} de ${mes} de ${y}`;
}

const periodoLargo = (ini: string | null, fin: string | null): string => {
  const a = fechaLarga(ini);
  const b = fechaLarga(fin);
  if (a && b) return `${a} al ${b}`;
  return a || b || '';
};

// ---- resolución de los valores automáticos ----

const pct = (frac: number) => `${(frac * 100).toFixed(2)}%`;

/** El valor de una línea automática, calculado del cuadro. El «Monto de
 *  Contrato» es el subtotal presupuestado del desglose, no un dato aparte:
 *  así el encabezado y el pie de la tabla no pueden discrepar. */
export function resolverAuto(origen: OrigenAuto, ctx: CtxImpresion): string {
  const base = ctx.totales.presupuesto;
  const itbms = base * (ctx.itbmsTasa ?? 0) / 100;
  switch (origen) {
    case 'proyecto': return ctx.proyectoNombre;
    case 'periodo': return periodoLargo(ctx.periodoInicio, ctx.periodoFin);
    case 'ordenProceder': return fechaLarga(ctx.ordenProceder);
    case 'pctTotal': return pct(ctx.totales.pctTotal);
    case 'pctPeriodo': return pct(ctx.totales.pctPeriodo);
    case 'montoContrato': return fmt2(base);
    case 'itbms': return fmt2(itbms);
    case 'valorTotal': return fmt2(base + itbms);
    case 'valorContrato': return `B/. ${fmt2(base + itbms)}`;
    case 'numeroCuenta': return String(ctx.numero);
  }
}

/** El valor que se pinta: el calculado si la línea tiene origen, si no el
 *  escrito a mano. */
export const valorDe = (l: LineaImpresion, ctx: CtxImpresion): string =>
  l.origen ? resolverAuto(l.origen, ctx) : l.valor;

// ---- montaje por defecto ----

/** Con qué arranca un proyecto que todavía no ha llenado su hoja. Copia la
 *  estructura de la que se entrega a ETESA; lo que no sabemos queda en blanco
 *  para que se escriba una vez. */
export function ajustesPorDefecto(ctx: CtxImpresion): AjustesImpresion {
  return {
    titulo: [
      { texto: (ctx.clienteNombre || '').toUpperCase() },
      { texto: 'CUADRO DE PRESENTACIÓN DE CUENTA' },
      { texto: '', origen: 'numeroCuenta' },
    ],
    columnas: [
      [
        { etiqueta: 'CONTRATISTA:', valor: 'PINELLAS S.A.' },
        { etiqueta: 'ORDEN DE COMPRA N°', valor: '' },
        { etiqueta: 'PROYECTO:', valor: '', origen: 'proyecto' },
        { etiqueta: 'VALOR DEL CONTRATO:', valor: '', origen: 'valorContrato' },
      ],
      [
        { etiqueta: 'Periodo de la cuenta:', valor: '', origen: 'periodo' },
        { etiqueta: 'Orden de Proceder:', valor: '', origen: 'ordenProceder' },
        { etiqueta: 'Duración Contractual:', valor: '' },
      ],
      [
        { etiqueta: '% de Avance del Total', valor: '', origen: 'pctTotal' },
        { etiqueta: '% de Avance del periodo', valor: '', origen: 'pctPeriodo' },
        { etiqueta: 'Monto de Contrato B/.', valor: '', origen: 'montoContrato' },
        { etiqueta: `${ctx.itbmsTasa ?? 0}% ITBMS B/.`, valor: '', origen: 'itbms' },
        { etiqueta: 'Valor B/.', valor: '', origen: 'valorTotal' },
        { etiqueta: 'Cuenta N°', valor: '', origen: 'numeroCuenta', recuadro: true },
      ],
    ],
    firmas: [{ lineas: ['', 'CONTRATISTA — PINELLAS S.A.'] }],
    logosIzq: ['pinellas'],
    logosDer: [],
    color: COLOR_HOJA_DEFECTO,
    nivelesBlancos: NIVELES_BLANCOS_DEFECTO,
    papel: PAPEL_HOJA.papel,
    orientacion: PAPEL_HOJA.orientacion,
    letra: 'normal',
    maxPaginas: 0,
  };
}

/** Una línea automática que falta, con el sitio que ocupa por defecto: al
 *  reponerla vuelve a su posición, no al final de la columna. */
export interface AutoFaltante {
  linea: LineaImpresion;
  col: number;
  pos: number;
}

/** Un color guardado tiene que ser hex de verdad antes de llegar al SVG. */
const esHex = (v: unknown): v is string =>
  typeof v === 'string' && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

/** Mueve un elemento de sitio dentro de una lista. Fuera de rango devuelve la
 *  misma lista, así el llamador no tiene que comprobar los extremos. */
export function mover<T>(arr: T[], desde: number, hasta: number): T[] {
  if (hasta < 0 || hasta >= arr.length || desde === hasta) return arr;
  const next = [...arr];
  const [x] = next.splice(desde, 1);
  next.splice(hasta, 0, x);
  return next;
}

/** Las líneas automáticas que este montaje ya no tiene. Salen de los valores
 *  por defecto, no de una lista aparte, para que no puedan desincronizarse: es
 *  lo que permite volver a poner una línea `auto` después de borrarla. */
export function autoFaltantes(a: AjustesImpresion, ctx: CtxImpresion): AutoFaltante[] {
  const usados = new Set(
    a.columnas.flat().map((l) => l.origen).filter(Boolean) as OrigenAuto[],
  );
  const faltan: AutoFaltante[] = [];
  ajustesPorDefecto(ctx).columnas.forEach((col, ci) => {
    col.forEach((linea, pos) => {
      if (linea.origen && !usados.has(linea.origen)) faltan.push({ linea, col: ci, pos });
    });
  });
  return faltan;
}

/** Una línea que se escribía a mano y que ahora el sistema sabe calcular se
 *  asciende a automática por su etiqueta. Pasó con «Orden de Proceder:», que
 *  era texto libre hasta que el proyecto ganó su campo de fecha: sin esto, un
 *  montaje ya guardado seguiría imprimiendo lo que se tecleó una vez, y la
 *  hoja podría contradecir la ficha del proyecto — el mismo tipo de desfase
 *  que descuadró la Cuenta 2. */
function ascenderAutos(
  cols: AjustesImpresion['columnas'],
  d: AjustesImpresion,
): AjustesImpresion['columnas'] {
  const porEtiqueta = new Map<string, OrigenAuto>();
  d.columnas.flat().forEach((l) => {
    if (l.origen) porEtiqueta.set(l.etiqueta.trim().toLowerCase(), l.origen);
  });
  return cols.map((col) => col.flatMap((l): LineaImpresion[] => {
    // Un `origen` que ya no existe: si la línea nunca tuvo texto propio (su
    // valor lo ponía el sistema), desaparece — dejarla vacía solo obligaría a
    // borrarla a mano. Si alguien había escrito algo, se conserva como texto.
    if (l.origen && !ORIGENES.has(l.origen)) {
      if (!l.valor.trim()) return [];
      const { origen: _fuera, ...resto } = l;
      return [resto];
    }
    if (l.origen) return [l];
    const origen = porEtiqueta.get(l.etiqueta.trim().toLowerCase());
    return [origen ? { ...l, origen } : l];
  })) as AjustesImpresion['columnas'];
}

/** Rellena lo que falte de un montaje guardado. Un JSONB viejo al que le falte
 *  una clave no puede tumbar la pantalla. */
export function normalizarAjustes(raw: unknown, ctx: CtxImpresion): AjustesImpresion {
  const d = ajustesPorDefecto(ctx);
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const a = raw as Partial<AjustesImpresion>;
  const cols = Array.isArray(a.columnas) ? a.columnas : d.columnas;
  return {
    titulo: Array.isArray(a.titulo) ? tituloDeCrudo(a.titulo, d.titulo) : d.titulo,
    columnas: ascenderAutos(
      [0, 1, 2].map((i) =>
        Array.isArray(cols[i]) ? (cols[i] as LineaImpresion[]) : d.columnas[i],
      ) as AjustesImpresion['columnas'],
      d,
    ),
    firmas: Array.isArray(a.firmas) ? a.firmas.map(firmaDeCrudo) : d.firmas,
    logosIzq: Array.isArray(a.logosIzq) ? a.logosIzq : d.logosIzq,
    logosDer: Array.isArray(a.logosDer) ? a.logosDer : d.logosDer,
    color: esHex(a.color) ? a.color : d.color,
    nivelesBlancos: Number.isFinite(a.nivelesBlancos)
      ? Math.min(NIVELES_BLANCOS_MAX, Math.max(0, Math.floor(Number(a.nivelesBlancos))))
      : d.nivelesBlancos,
    papel: typeof a.papel === 'string' ? a.papel : d.papel,
    orientacion: a.orientacion === 'vertical' ? 'vertical' : 'horizontal',
    letra: a.letra && a.letra in CUADRO_FONTS ? a.letra : d.letra,
    maxPaginas: Number.isFinite(a.maxPaginas) ? Math.max(0, Number(a.maxPaginas)) : d.maxPaginas,
  };
}

// ---- hacia el constructor de páginas ----

/** El montaje + el contexto, traducidos a lo que espera buildCuadroPrintPages.
 *  El papel y los logos ya resueltos los pone el llamador. */
export function aOpcionesImpresion(
  a: AjustesImpresion,
  ctx: CtxImpresion,
  papel: { Wmm: number; Hmm: number; marginMM: number },
  logos: { izq: string[]; der: string[] },
): CuadroPrintOptions {
  return {
    ...papel,
    fontKey: a.letra,
    maxTall: a.maxPaginas,
    titulo: a.titulo.map((r) => (r.origen ? `Cuenta No. ${ctx.numero}` : r.texto)),
    columnas: a.columnas.map((col) =>
      col.map((l) => ({
        etiqueta: l.etiqueta,
        valor: valorDe(l, ctx),
        recuadro: l.recuadro,
        auto: !!l.origen,
      })),
    ) as CuadroPrintOptions['columnas'],
    firmas: a.firmas,
    color: a.color,
    nivelesBlancos: a.nivelesBlancos,
    logosLeft: logos.izq,
    logosRight: logos.der,
  };
}
