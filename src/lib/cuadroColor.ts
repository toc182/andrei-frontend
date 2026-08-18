// cuadroColor.ts — la paleta de la hoja del Cuadro de Cuenta, derivada de UN
// solo color.
//
// Por qué un color y no varios escogidos a mano: la tabla lleva bandas por
// nivel de anidamiento, y el desglose puede tener cuatro niveles o nueve. Una
// lista fija de tonos se queda corta y a partir del último todos los niveles
// se ven iguales; una escala generada da tantos pasos como niveles haya y
// además garantiza que el texto oscuro siempre caiga sobre un fondo claro.
//
// Puro: sin DOM. Los colores salen como hex crudo porque van dentro de
// atributos SVG (mismo criterio que cuadroPrint/desglosePrint).

/** El azul con el que sale la hoja si nadie escoge otro. Es el primero de la
 *  fila de abajo, para que al abrir la pantalla se vea cuál está puesto. */
export const COLOR_HOJA_DEFECTO = '#355C97';

/**
 * Los seis colores de arranque del selector. Van a media claridad, no en el
 * extremo oscuro: puestos en fila unos tonos casi negros se ven todos iguales
 * y no se distingue el verde del vino. Cada uno sigue siendo el paso más
 * oscuro de su propia escala — los niveles se aclaran a partir de aquí.
 */
export const COLORES_HOJA: { nombre: string; hex: string }[] = [
  { nombre: 'Azul', hex: '#355C97' },
  { nombre: 'Verde', hex: '#307E50' },
  { nombre: 'Vino', hex: '#853240' },
  { nombre: 'Ocre', hex: '#96732C' },
  { nombre: 'Gris', hex: '#5A6472' },
  { nombre: 'Morado', hex: '#654691' },
];

interface Hsl { h: number; s: number; l: number }

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** '#1F375F' → {h,s,l} en grados y porcentajes. Acepta también '1f375f' y la
 *  forma corta de tres dígitos. */
export function hexAHsl(hex: string): Hsl {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { h: 216, s: 50, l: 25 };
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  let hue = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: s * 100, l: l * 100 };
}

export function hslAHex({ h, s, l }: Hsl): string {
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const seg = Math.floor(((h % 360) + 360) % 360 / 60);
  const [r, g, b] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg];
  const dos = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

/** Un tono claro del color base. La saturación baja con la claridad: un tinte
 *  muy claro con la saturación del original se ve chillón sobre papel. */
const tinte = (base: Hsl, l: number): string =>
  hslAHex({ h: base.h, s: clamp(base.s * 0.7, 10, 45), l });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** La tinta oscura de la hoja — la misma del resto del texto. */
const TINTA_OSCURA = '#1c1f24';
const BLANCO = '#ffffff';

/**
 * Cuántas bandas llevan letra blanca, contando desde arriba, si el proyecto no
 * ha dicho otra cosa. Uno: el encabezado y el nivel 1, que son los que llevan
 * el color puro y por tanto el tono más oscuro de la hoja.
 */
export const NIVELES_BLANCOS_DEFECTO = 1;

/** Hasta dónde puede llegar el ajuste. Más allá del octavo nivel el desglose
 *  ya no anida en la práctica. */
export const NIVELES_BLANCOS_MAX = 8;

/**
 * Los tonos de las bandas por nivel. El PRIMERO es el color escogido tal cual
 * — es el principal — y cada nivel de anidamiento lo aclara un paso. Siempre
 * `niveles` pasos, así que ocho niveles dan ocho tonos distintos.
 *
 * La saturación baja al aclarar: un tono muy claro con la saturación del
 * original se ve chillón sobre papel.
 */
function escalaNiveles(hex: string, base: Hsl, niveles: number): string[] {
  const n = Math.max(1, niveles);
  if (n === 1) return [hex];
  // Hasta dónde se aclara: siempre bastante más claro que el color escogido,
  // aunque este ya sea claro de por sí.
  const hasta = Math.min(96, Math.max(base.l + 12, 90));
  const satClara = clamp(base.s * 0.55, 10, 40);
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return hex;
    const t = i / (n - 1);
    return hslAHex({
      h: base.h,
      s: lerp(base.s, satClara, t),
      l: lerp(base.l, hasta, t),
    });
  });
}

export interface PaletaCuadro {
  /** Banda del encabezado de columnas. */
  headFill: string;
  /** Texto sobre esa banda. */
  headText: string;
  /** Fondo de las filas de totales del pie. */
  totalFill: string;
  /** Un tono por nivel de anidamiento; más allá del último se repite. */
  niveles: string[];
  /** La tinta de cada nivel, en el mismo orden que `niveles`. */
  tintas: string[];
}

/**
 * La paleta completa a partir del color base, de cuántos niveles tiene el
 * desglose y de cuántas bandas van con letra blanca. Todo sale del mismo tono,
 * así que la hoja no puede quedar con un encabezado de un color y unas bandas
 * de otro.
 *
 * La letra blanca NO se calcula: la pone el proyecto con `nivelesBlancos`,
 * contando desde arriba. Se decidía sola comparando contrastes, pero el punto
 * en que volteaba nunca coincidía con el gusto de quien firma la hoja.
 */
export function paletaCuadro(
  color: string,
  niveles: number,
  nivelesBlancos: number = NIVELES_BLANCOS_DEFECTO,
): PaletaCuadro {
  const base = hexAHsl((color || COLOR_HOJA_DEFECTO).trim());
  const normalizado = hslAHex(base); // '1f375f' o '#1F375F' → '#1f375f'
  const tonos = escalaNiveles(normalizado, base, niveles);
  const blancos = Number.isFinite(nivelesBlancos)
    ? clamp(Math.floor(nivelesBlancos), 0, NIVELES_BLANCOS_MAX)
    : NIVELES_BLANCOS_DEFECTO;
  return {
    // La banda del encabezado lleva el color escogido, igual que el nivel 1:
    // es lo que hace que la hoja se vea del color del consorcio y no de un
    // tinte pálido que nunca se parece al que se eligió.
    headFill: normalizado,
    // El encabezado va pegado al nivel 1 y con su mismo color, así que comparte
    // tinta: si uno saliera blanco y el otro oscuro se leería como un error.
    headText: blancos >= 1 ? BLANCO : TINTA_OSCURA,
    totalFill: tinte(base, 93),
    niveles: tonos,
    tintas: tonos.map((_, i) => (i < blancos ? BLANCO : TINTA_OSCURA)),
  };
}

/** El tono que le toca a una fila. Más allá del último nivel se queda en el
 *  más claro, que es mejor que quedarse sin color. */
export const tonoDeNivel = (p: PaletaCuadro, depth: number): string =>
  p.niveles[Math.min(Math.max(0, depth), p.niveles.length - 1)];

/** La tinta que le toca a esa misma fila, con el mismo tope que el tono. */
export const tintaDeNivel = (p: PaletaCuadro, depth: number): string =>
  p.tintas[Math.min(Math.max(0, depth), p.tintas.length - 1)];
