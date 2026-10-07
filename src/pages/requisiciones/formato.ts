import type { Marca } from './tipos';

const PANAMA = { timeZone: 'America/Panama' } as const;

/** dd/mm/aaaa de una fecha DATE («2026-10-08»): sin pasar por la hora, no se corre de día. */
export function diaDe(valor: string | null): string {
  if (!valor) return '—';
  const [a, m, d] = valor.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// es-PA escribe el mes primero (10/06/2026 es el 6 de octubre): la fecha se
// arma con en-GB, que es día/mes/año, en la hora de Panamá.
const DIA = new Intl.DateTimeFormat('en-GB', { ...PANAMA, day: '2-digit', month: '2-digit', year: 'numeric' });
const DIA_MES = new Intl.DateTimeFormat('en-GB', { ...PANAMA, day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('es-PA', { ...PANAMA, hour: 'numeric', minute: '2-digit' });

/** dd/mm/aaaa de un momento (created_at), en la hora de Panamá. */
export function diaDeMomento(valor: string | null): string {
  if (!valor) return '—';
  return DIA.format(new Date(valor));
}

/** dd/mm h:mm de un momento, para la historia. */
export function momentoCorto(valor: string): string {
  const d = new Date(valor);
  return `${DIA_MES.format(d)} ${HORA.format(d)}`;
}

/** La cantidad como se lee: sin ceros de más. */
export function cantidadDe(valor: string | number): string {
  return Number(valor).toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** «1, 2, 3»: los números de línea (como se leen en el papel) de unos ids. */
export function numerosDeLineas(ids: number[], lineas: { id: number }[]): string {
  return lineas
    .map((l, i) => (ids.includes(l.id) ? i + 1 : null))
    .filter((n): n is number => n !== null)
    .join(', ');
}

export const MARCAS: Marca[] = ['pendiente', 'atendida', 'parcial', 'cancelada'];

export const ETIQUETA_MARCA: Record<Marca, string> = {
  pendiente: 'Pendiente',
  atendida: 'Atendida',
  parcial: 'Parcial',
  cancelada: 'Cancelada',
};

/** Las marcas de Compras, con el mapa de colores de la guía (§14). */
export const CLASE_MARCA: Record<Marca, string> = {
  pendiente: 'bg-warning/10 text-warning border-warning/30 border',
  atendida: 'bg-success/10 text-success border-success/30 border',
  parcial: 'bg-info/10 text-info border-info/30 border',
  cancelada: 'bg-error/10 text-error border-error/30 border',
};

/** La misma marca cuando Compras la puede cambiar: es un botón, se oscurece al pasar. */
export const CLASE_MARCA_SELECTOR: Record<Marca, string> = {
  pendiente: 'hover:bg-warning/20 hover:text-warning hover:border-warning/50',
  atendida: 'hover:bg-success/20 hover:text-success hover:border-success/50',
  parcial: 'hover:bg-info/20 hover:text-info hover:border-info/50',
  cancelada: 'hover:bg-error/20 hover:text-error hover:border-error/50',
};
