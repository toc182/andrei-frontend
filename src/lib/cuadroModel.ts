// src/lib/cuadroModel.ts — cálculo puro del Cuadro de Presentación de Cuenta
// (tipo ETESA). El ÚNICO dato de entrada por fila es la cantidad ejecutada de
// este periodo; % y valores se derivan aquí a full precision (el formateo/
// redondeo para mostrar vive en el componente). Espejo del mock aprobado.
// Gate: scripts/cuadro.spec.ts.

export interface CuadroLinea {
  rowUid: string;
  parentRowUid: string | null;
  tipo: 'grupo' | 'item';
  item: string;
  descripcion: string;
  unidad: string | null;
  cantidadPresupuesto: number | null;
  precioUnitario: number | null;
  cantidadEjecutada: number; // este periodo (editable)
  cantidadAnterior: number; // hasta el periodo anterior (del backend, encadenado)
}

export interface Bloque {
  cant: number;
  valor: number;
  pct: number; // fracción 0..1 (multiplicar por 100 al mostrar)
}

export interface LineaCalc {
  esContenedor: boolean; // grupo con hijos → sin montos propios
  depth: number;
  presupuestoTotal: number;
  anterior: Bloque;
  este: Bloque;
  fecha: Bloque; // total a la fecha = anterior + este
  falta: Bloque; // trabajo por ejecutar = presupuesto − fecha
}

const ZERO: Bloque = { cant: 0, valor: 0, pct: 0 };

const bloque = (cant: number, precio: number, presup: number): Bloque => ({
  cant,
  valor: cant * precio,
  pct: presup ? cant / presup : 0,
});

/** Conjunto de rowUids que son PADRE de alguien (⇒ contenedores). */
export function parentsSet(lineas: CuadroLinea[]): Set<string> {
  const s = new Set<string>();
  for (const l of lineas) if (l.parentRowUid) s.add(l.parentRowUid);
  return s;
}

/** Profundidad de cada fila subiendo por parentRowUid (para la sangría). */
export function depthMap(lineas: CuadroLinea[]): Map<string, number> {
  const parent = new Map<string, string | null>();
  for (const l of lineas) parent.set(l.rowUid, l.parentRowUid);
  const memo = new Map<string, number>();
  const depth = (uid: string): number => {
    const hit = memo.get(uid);
    if (hit != null) return hit;
    const p = parent.get(uid) ?? null;
    const d = p == null || !parent.has(p) ? 0 : depth(p) + 1;
    memo.set(uid, d);
    return d;
  };
  for (const l of lineas) depth(l.rowUid);
  return memo;
}

/** Un grupo con hijos es CONTENEDOR (sin montos); un grupo sin hijos es una
 *  "sección de una línea" que lleva sus propios montos, igual que en el desglose. */
export const esContenedor = (l: CuadroLinea, parents: Set<string>): boolean =>
  l.tipo === 'grupo' && parents.has(l.rowUid);

export function calcLinea(l: CuadroLinea, contenedor: boolean, depth: number): LineaCalc {
  if (contenedor) {
    return { esContenedor: true, depth, presupuestoTotal: 0, anterior: ZERO, este: ZERO, fecha: ZERO, falta: ZERO };
  }
  const precio = l.precioUnitario ?? 0;
  const presup = l.cantidadPresupuesto ?? 0;
  const total = l.cantidadAnterior + l.cantidadEjecutada;
  return {
    esContenedor: false,
    depth,
    presupuestoTotal: presup * precio,
    anterior: bloque(l.cantidadAnterior, precio, presup),
    este: bloque(l.cantidadEjecutada, precio, presup),
    fecha: bloque(total, precio, presup),
    falta: bloque(presup - total, precio, presup),
  };
}

// ── Límites de la cantidad del periodo ──────────────────────────────────
// No se puede registrar más de lo que falta por ejecutar (presupuesto menos
// lo de periodos anteriores) ni cantidades negativas. La regla vive aquí,
// pura, y el backend la repite antes de guardar.

/** Lo que todavía cabe registrar en este periodo. Nunca negativa. */
export const cantidadDisponible = (l: CuadroLinea): number =>
  Math.max(0, (l.cantidadPresupuesto ?? 0) - l.cantidadAnterior);

export type CantidadError = 'invalida' | 'negativa' | 'excede';

/** Tolerancia por el redondeo binario al teclear decimales. */
const EPS = 1e-9;

/** Motivo por el que la cantidad no sirve, o null si está bien. */
export function validarCantidad(valor: number, l: CuadroLinea): CantidadError | null {
  if (!Number.isFinite(valor)) return 'invalida';
  if (valor < 0) return 'negativa';
  if (valor > cantidadDisponible(l) + EPS) return 'excede';
  return null;
}

export interface CuadroTotales {
  presupuesto: number;
  anterior: number;
  este: number;
  fecha: number;
  falta: number;
  pctAnterior: number;
  pctPeriodo: number;
  pctTotal: number;
  pctFalta: number;
}

/** Subtotales por columna (solo hojas; los contenedores no aportan) y sus %
 *  sobre el presupuesto. Sumar % a 2 decimales no cuadra; por eso el % se
 *  calcula del valor total, no de sumar los % de fila. */
export function calcTotales(lineas: CuadroLinea[]): CuadroTotales {
  const parents = parentsSet(lineas);
  let presupuesto = 0, anterior = 0, este = 0, fecha = 0, falta = 0;
  for (const l of lineas) {
    if (esContenedor(l, parents)) continue;
    const precio = l.precioUnitario ?? 0;
    const presup = l.cantidadPresupuesto ?? 0;
    const tot = l.cantidadAnterior + l.cantidadEjecutada;
    presupuesto += presup * precio;
    anterior += l.cantidadAnterior * precio;
    este += l.cantidadEjecutada * precio;
    fecha += tot * precio;
    falta += (presup - tot) * precio;
  }
  const p = (v: number) => (presupuesto ? v / presupuesto : 0);
  return {
    presupuesto, anterior, este, fecha, falta,
    pctAnterior: p(anterior), pctPeriodo: p(este), pctTotal: p(fecha), pctFalta: p(falta),
  };
}
