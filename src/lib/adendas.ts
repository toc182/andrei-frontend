/**
 * Las adendas de un contrato: lo que las pantallas comparten para mostrarlas y
 * para el formulario. El monto y la terminación VIGENTES del proyecto los
 * calcula el servidor (vista proyecto_contrato_vigente); aquí solo se calcula
 * lo que el formulario necesita mientras se escribe.
 */
import { formatMoney } from '@/utils/formatters';
import type { Adenda, Project } from '@/types';

export const TIPO_ADENDA: Record<Adenda['tipo'], string> = {
  tiempo: 'Extensión de Tiempo',
  costo: 'Modificación de Costo',
  mixta: 'Tiempo y Costo',
};

export const ESTADO_ADENDA: Record<Adenda['estado'], { label: string; className: string }> = {
  en_proceso: { label: 'En Proceso', className: 'bg-info/10 text-info border-info/30 border' },
  aprobada: { label: 'Aprobada', className: 'bg-success/10 text-success border-success/30 border' },
  rechazada: { label: 'Rechazada', className: 'bg-error/10 text-error border-error/30 border' },
};

export const tieneFecha = (tipo: Adenda['tipo']): boolean => tipo === 'tiempo' || tipo === 'mixta';
export const tieneMonto = (tipo: Adenda['tipo']): boolean => tipo === 'costo' || tipo === 'mixta';

/** El monto de una adenda con su signo: «+B/. 150,000.00», «−B/. 25,000.00». */
export function montoConSigno(monto: string | number): string {
  const n = Number(monto);
  return `${n < 0 ? '−' : '+'}${formatMoney(Math.abs(n))}`;
}

/** Días con su signo: «+92 días», «−197 días». */
export function diasConSigno(dias: number): string {
  return `${dias > 0 ? '+' : dias < 0 ? '−' : ''}${Math.abs(dias)} días`;
}

/**
 * La terminación que estaba en vigor antes de una adenda: la de la última
 * aprobada con número menor que la cambia, o la del proyecto. Sin número (una
 * adenda nueva) es la terminación vigente.
 */
export function terminacionAntesDe(
  project: Project,
  adendas: Adenda[],
  numero: number | null,
): string | null {
  if (numero === null) return project.fecha_fin_vigente ?? project.fecha_fin_estimada ?? null;
  const previa = adendas
    .filter((a) => a.estado === 'aprobada' && a.nueva_fecha_fin && a.numero_adenda < numero)
    .sort((a, b) => b.numero_adenda - a.numero_adenda)[0];
  return previa?.nueva_fecha_fin ?? project.fecha_fin_estimada ?? null;
}

/** Días de calendario de una fecha 'YYYY-MM-DD' a otra (negativos si va hacia atrás). */
export function diasEntre(desde: string, hasta: string): number | null {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
