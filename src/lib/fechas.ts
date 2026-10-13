/**
 * La única manera de escribir una fecha en las pantallas: «07/oct/2026», y con hora
 * «07/oct/2026 3:05 p. m.» (Ivan, 2026-10-08).
 *
 * Los meses salen de una tabla propia y no de `toLocaleDateString`: es-PA escribe el
 * mes primero (10/07/2026 es el 7 de octubre) y abrevia septiembre como «sept».
 *
 * Dos clases de valor, y cada pantalla dice cuál tiene:
 * - un DÍA del calendario (columna DATE: la fecha de una solicitud, de una adenda):
 *   `fecha()`. Se leen sus diez primeros caracteres y nada más. El servidor en vivo
 *   corre en UTC y manda el 7 de octubre como «2026-10-07T00:00:00.000Z», que en
 *   Panamá es todavía el 6 a las 7 de la noche: pasarlo por `new Date()` lo
 *   enseñaría un día antes.
 * - un MOMENTO (created_at, la hora en que se aprobó algo): `fechaDeMomento()` y
 *   `fechaHora()`, siempre en la hora de Panamá, esté donde esté quien mira.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Valor = string | Date | null | undefined;

const dosCifras = (n: number) => String(n).padStart(2, '0');
const escribir = (anio: number, mes: number, dia: number) => `${dosCifras(dia)}/${MESES[mes - 1]}/${anio}`;

/** «07/oct/2026» de un día del calendario. Un Date hecho en pantalla se lee como el día que muestra. */
export function fecha(valor: Valor, vacio = '—'): string {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return vacio;
    return escribir(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
  if (!m) return vacio;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return vacio;
  return escribir(anio, mes, dia);
}

// Panamá no cambia la hora en el año, pero se le pregunta a Intl igual: así no hay
// que acordarse de por qué un -5 fijo era correcto.
const PANAMA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Panama',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function enPanama(valor: Valor) {
  if (valor == null || valor === '') return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, number> = {};
  for (const parte of PANAMA.formatToParts(d)) {
    if (parte.type !== 'literal') p[parte.type] = Number(parte.value);
  }
  return { anio: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute };
}

/** «07/oct/2026»: el día en Panamá de un momento. */
export function fechaDeMomento(valor: Valor, vacio = '—'): string {
  const t = enPanama(valor);
  return t ? escribir(t.anio, t.mes, t.dia) : vacio;
}

/** «3:05 p. m.»: la hora en Panamá de un momento, con espacios normales (se copia limpio a Excel). */
export function hora(valor: Valor, vacio = '—'): string {
  const t = enPanama(valor);
  if (!t) return vacio;
  return `${t.hora % 12 || 12}:${dosCifras(t.minuto)} ${t.hora < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * Una fecha 'YYYY-MM-DD' como medianoche LOCAL, para hacer cuentas con ella (días
 * que faltan, una barra de avance). `new Date('2027-04-30')` la lee como medianoche
 * UTC, que en Panamá es el día anterior a las 7 de la noche: por eso el resumen del
 * proyecto mostraba las fechas un día antes.
 */
export const fechaLocal = (valor: string): Date =>
  new Date(valor.includes('T') ? valor : `${valor}T00:00:00`);

/** «07/oct/2026 3:05 p. m.»: un momento con su hora, en Panamá. */
export function fechaHora(valor: Valor, vacio = '—'): string {
  const t = enPanama(valor);
  return t ? `${escribir(t.anio, t.mes, t.dia)} ${hora(valor)}` : vacio;
}
