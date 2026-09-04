// src/lib/curvaGasto.ts — la aritmetica de la curva de gasto acumulado.
//
// Va aparte del componente para poder probarla: las cuentas de fechas son
// justo donde se cuelan los errores de un dia. Con red en
// scripts/curva-gasto.spec.ts.

/** YYYY-MM-DD -> dias enteros desde 1970, SIN pasar por la zona horaria local.
 *  Con `new Date('2026-03-01')` en Panama (UTC-5) el dia se corre uno atras. */
export const toDay = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** El dia de hoy en la fecha local del usuario, no en UTC. */
export const hoyISO = (ahora: Date = new Date()): string => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Marcas del eje de tiempo: un primero de mes cada tantos, para que quepan
 *  unas doce sin amontonarse.
 *
 *  Si la obra cruza de ano, la marca lleva el ano —pero solo la primera de cada
 *  uno—: en una obra de cuatro anos, "Abr, Ago, Dic" repetido cuatro veces no
 *  dice nada, y ponerle el ano a las doce es ruido. */
export function marcasDeMes(d0: number, d1: number): { dia: number; texto: string }[] {
  const desde = new Date(d0 * 86_400_000);
  const todos: { dia: number; mes: number; anio: number }[] = [];
  let anio = desde.getUTCFullYear();
  let mes = desde.getUTCMonth();
  for (let i = 0; i < 600; i++) {
    const dia = Math.floor(Date.UTC(anio, mes, 1) / 86_400_000);
    if (dia > d1) break;
    if (dia >= d0) todos.push({ dia, mes, anio });
    mes += 1;
    if (mes > 11) { mes = 0; anio += 1; }
  }
  const paso = Math.max(1, Math.ceil(todos.length / 12));
  const vistas = paso > 1 ? todos.filter((_, i) => i % paso === 0) : todos;

  const variosAnios = new Set(vistas.map((t) => t.anio)).size > 1;
  let anterior: number | null = null;
  return vistas.map((t) => {
    const marcaAnio = variosAnios && anterior !== t.anio;
    anterior = t.anio;
    return {
      dia: t.dia,
      texto: marcaAnio ? `${MESES[t.mes]} ${String(t.anio).slice(2)}` : MESES[t.mes],
    };
  });
}

export interface PuntoAcumulado {
  dia: number;
  fecha: string;
  monto: number;
  acumulado: number;
}

/** Escalones del acumulado: cada fecha de pago suma sobre lo anterior. La
 *  entrada puede venir desordenada; el acumulado solo tiene sentido en orden. */
export function acumular(serie: { fecha: string; monto: number }[]): PuntoAcumulado[] {
  let total = 0;
  return [...serie]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((s) => {
      total += s.monto;
      return { dia: toDay(s.fecha), fecha: s.fecha, monto: s.monto, acumulado: total };
    });
}

/** Etiquetas del eje de plata: escalones redondos de verdad (1, 2, 2.5, 5 ×
 *  potencia de 10), no el maximo partido en trozos. Se apunta a unos siete para
 *  que el eje tenga referencias suficientes y se pueda leer una altura a ojo. */
export function escalonesY(max: number): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const base = Math.pow(10, Math.floor(Math.log10(max / 7)));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * base).find((p) => max / p <= 7) ?? base * 10;
  // El tope se REDONDEA HACIA ARRIBA al siguiente escalon. Parar en el ultimo
  // escalon que cabe debajo del maximo dejaba la raya del presupuesto por
  // encima del cuadro.
  const tope = Math.ceil(max / paso) * paso;
  const out: number[] = [];
  for (let v = 0; v <= tope + paso * 0.001; v += paso) out.push(Number(v.toFixed(6)));
  return out;
}

export interface DominioCurva {
  /** Primer y ultimo dia del eje de tiempo. */
  d0: number;
  d1: number;
  /** Nunca 0: dividir entre el ancho del dominio no puede reventar. */
  span: number;
  hoy: number;
  gastado: number;
  /** Tope del eje de plata, ya redondeado hacia arriba. */
  yMax: number;
  pasos: number[];
}

/** El dominio del cuadro. El eje de tiempo cubre SIEMPRE el inicio de la obra,
 *  todos los pagos, hoy y el fin previsto: si un pago cae fuera del plazo, la
 *  curva tiene que seguir viendose. */
export function dominioCurva(
  puntos: PuntoAcumulado[],
  presupuesto: number | null,
  inicio: string | null,
  fin: string | null,
  hoy: number,
): DominioCurva {
  const dias = puntos.map((p) => p.dia);
  const primero = dias.length ? Math.min(...dias) : hoy;
  const ultimo = dias.length ? Math.max(...dias) : hoy;

  const d0 = Math.min(inicio ? toDay(inicio) : primero, primero);
  const d1 = Math.max(fin ? toDay(fin) : hoy, hoy, ultimo);

  const gastado = puntos.length ? puntos[puntos.length - 1].acumulado : 0;
  const techo = Math.max(presupuesto ?? 0, gastado);
  const pasos = escalonesY(techo || 1);

  return {
    d0,
    d1,
    span: Math.max(1, d1 - d0),
    hoy,
    gastado,
    yMax: Math.max(pasos[pasos.length - 1], 1),
    pasos,
  };
}
