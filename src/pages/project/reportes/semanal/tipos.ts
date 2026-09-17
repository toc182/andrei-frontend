/**
 * Tipos y ayudas del reporte semanal, compartidos por la lista, el formulario
 * y el detalle.
 *
 * La semana va de lunes a domingo y se nombra por su número ISO; quien lo
 * calcula es el servidor (src/services/reporteSemana.ts), así que aquí solo se
 * escribe lo que ya viene dado.
 */

import { MESES_CORTOS } from './fechas';

export type EstadoMeta = 'completada' | 'parcial' | 'no_completada';

/** Una fila de la lista de reportes semanales. */
export interface SemanalFila {
  id: number;
  numero: string;
  semana_inicio: string;
  semana_fin: string;
  anio_iso: number;
  semana_iso: number;
  enviado_at: string | null;
  creador_nombre: string;
  metas: number;
  metas_completadas: number;
  metas_parciales: number;
  metas_no_completadas: number;
}

/** Una semana que todavía se puede reportar. */
export interface SemanaDisponible {
  semana_inicio: string;
  semana_fin: string;
  anio_iso: number;
  semana_iso: number;
  diarios: number;
  borrador_id: number | null;
}

export interface Meta {
  id: number;
  texto: string;
  cantidad: string | number | null;
  unidad: string | null;
  estado: EstadoMeta | null;
  cantidad_hecha: string | number | null;
  porcentaje: number | null;
  motivo: string | null;
  fuera_del_plan?: boolean;
}

export interface MetaPlan {
  id: number;
  texto: string;
  cantidad: string | number | null;
  unidad: string | null;
}

export interface Problema {
  id?: number;
  fecha: string | null;
  problema: string;
  accion: string | null;
}

export interface Decision {
  id?: number;
  texto: string;
}

export interface FotoSemana {
  id: number;
  fecha: string;
  leyenda: string | null;
  nombre_archivo: string;
  numero_diario: string;
  url: string;
}

/** Una fila «por día» de las tablas que salen solas. */
export interface FilaPorDia {
  nombre: string;
  por_dia: (number | null)[];
  total: number;
}

export interface DatosSemana {
  dias: { fecha: string; numero: string | null }[];
  personal: { empresa: string | null; filas: FilaPorDia[] }[];
  personal_total: (number | null)[];
  personal_promedio: number | null;
  horas_perdidas: {
    por_dia: (number | null)[];
    total: number;
    motivos: { fecha: string; horas: number; motivo: string | null }[];
  };
  equipos: FilaPorDia[];
  materiales: {
    fecha: string;
    categoria: string;
    descripcion: string;
    cantidad: number | null;
    unidad: string | null;
    notas: string | null;
  }[];
  pagos: {
    filas: { categoria: string | null; solicitudes: number; monto: number }[];
    solicitudes: number;
    monto: number;
  };
  comparacion: {
    semana_anterior: { inicio: string; fin: string };
    filas: { etiqueta: string; anterior: number | null; actual: number | null; unidad: string }[];
  };
}

/** El reporte entero, como lo manda el servidor. */
export interface SemanalDetalle {
  id: number;
  numero: string | null;
  semana_inicio: string;
  semana_fin: string;
  anio_iso: number;
  semana_iso: number;
  resumen: string | null;
  lo_que_se_espera: string | null;
  completo: boolean;
  enviado_at: string | null;
  /** Si el servidor tiene con qué redactar: sin llave, no se ofrece el botón. */
  ia_configurada: boolean;
  creado_por: number;
  datos: DatosSemana;
  metas: Meta[];
  metas_plan: MetaPlan[];
  problemas: (Problema & { id: number })[];
  decisiones: (Decision & { id: number })[];
  fotos_elegidas: number[];
  fotos: FotoSemana[];
  dias: string[];
}

/** Tope de fotos del reporte semanal, el mismo que el del servidor. */
export const FOTOS_MAX = 15;

/** Las tres maneras de marcar una meta, en el orden en que salen en pantalla. */
export const ESTADOS: { valor: EstadoMeta; etiqueta: string; punto: string }[] = [
  { valor: 'completada', etiqueta: 'Completada', punto: 'bg-success' },
  { valor: 'parcial', etiqueta: 'Parcial', punto: 'bg-warning' },
  { valor: 'no_completada', etiqueta: 'No completada', punto: 'bg-error' },
];

/** «7 sept → 13 sept», lo que va en la columna Fechas. */
export function rangoSemana(inicio: string, fin: string): string {
  const [, m1, d1] = inicio.slice(0, 10).split('-').map(Number);
  const [, m2, d2] = fin.slice(0, 10).split('-').map(Number);
  return `${d1} ${MESES_CORTOS[m1 - 1]} → ${d2} ${MESES_CORTOS[m2 - 1]}`;
}

/** «Lun 14», la cabecera de cada columna de día. */
export function diaCorto(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const dia = new Date(y, m - 1, d).toLocaleDateString('es-PA', { weekday: 'short' });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1, 3)} ${d}`;
}

/** La inicial del día para la tira de siete casillas: L M M J V S D. */
export const INICIALES_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const dinero = (n: number): string =>
  n.toLocaleString('es-PA', { style: 'currency', currency: 'USD' });

/** Un número que puede venir como texto de la base. */
export const comoNumero = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);
