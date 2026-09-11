/** Tipos compartidos por la lista, el formulario y el detalle de reportes. */

export const CLIMAS = [
  'Soleado',
  'Nublado',
  'Lluvia parcial',
  'Lluvia todo el día',
] as const;

export type Clima = (typeof CLIMAS)[number];

/** Una fila de cualquiera de las listas del proyecto. */
export interface ItemLista {
  id: number;
  nombre: string;
  orden: number;
  /** Solo en puestos: null es el bloque propio, con valor es el de esa empresa. */
  empresa_id?: number | null;
  /** Solo en puestos: los cuatro de arranque, que no se quitan. */
  fijo?: boolean;
}

/** Las cuatro listas del proyecto, como las devuelve /proyecto-listas. */
export interface Listas {
  empresas: ItemLista[];
  puestos: ItemLista[];
  equipos: ItemLista[];
  categorias: ItemLista[];
}

/** Lo que se llena cada día. */
export interface FilaPersonal { puesto_id: number; cantidad: number | string; }
export interface FilaEquipo {
  equipo_id: number;
  unidades: number | string;
  horas: number | string;
}
export interface FilaEntrega {
  categoria_id: number;
  descripcion: string;
  cantidad: number | string | null;
  unidad: string | null;
  notas: string | null;
}

/** Las mismas filas como vuelven del detalle, ya con sus nombres. */
export interface PersonalGuardado extends FilaPersonal {
  nombre: string;
  empresa_id: number | null;
  empresa_nombre: string | null;
}
export interface EquipoGuardado extends FilaEquipo { nombre: string; }
export interface EntregaGuardada extends FilaEntrega { categoria: string; }

export interface Area {
  id: number;
  proyecto_id: number;
  nombre: string;
  orden: number;
  activo: boolean;
}

/** Una fila de la lista. */
export interface ReporteFila {
  id: number;
  numero: string;
  fecha: string;
  clima: Clima;
  horas_perdidas: string | null;
  motivo: string | null;
  personal_calificado: number;
  ayudantes: number;
  equipo: string[];
  creado_por: number;
  creador_nombre: string;
  enviado_at: string | null;
  fotos: number;
  areas: string[];
  /** Recortado a 300 caracteres por el servidor; la lista lo corta otra vez. */
  que_se_hizo: string;
}

export interface Foto {
  id: number;
  nombre_archivo: string;
  tipo_mime: string | null;
  tamano: number | null;
  orden: number;
  url: string;
}

export interface Correccion {
  id: number;
  created_at: string;
  usuario_nombre: string;
  detalles: {
    cambios?: Record<
      string,
      { label: string; antes: string | number | null; despues: string | number | null }
    >;
  } | null;
}

/** El reporte completo, como lo devuelve el detalle. */
export interface Reporte {
  id: number;
  proyecto_id: number;
  numero: string;
  fecha: string;
  clima: Clima;
  horas_perdidas: string | null;
  motivo: string | null;
  personal_calificado: number;
  ayudantes: number;
  equipo: string[];
  que_se_hizo: string;
  atrasos: string | null;
  novedades: string | null;
  creado_por: number;
  creador_nombre: string;
  proyecto_nombre: string;
  created_at: string;
  enviado_at: string | null;
  puede_editar: boolean;
  areas: { id: number; nombre: string }[];
  fotos: Foto[];
  correcciones: Correccion[];
  personal: PersonalGuardado[];
  equipos: EquipoGuardado[];
  entregas: EntregaGuardada[];
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * El año solo aparece cuando no es el año en curso, para que un proyecto que
 * cruza el fin de año se lea "Diciembre 2025" junto a "Enero" sin confundir
 * un enero con el otro.
 */
export function etiquetaMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const actual = new Date().getFullYear();
  return y === actual ? MESES[m - 1] : `${MESES[m - 1]} ${y}`;
}

/** Las fechas viajan como YYYY-MM-DD o ISO; siempre se lee la parte de fecha. */
function partes(fecha: string): [number, number, number] {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

/**
 * El mes solo, "sep". Va en mayúsculas por CSS.
 *
 * Sin año a propósito: en español la fecha se escribe con el día primero,
 * así que un "SEP 26" encima de un día en grande se lee como el 26 de
 * septiembre, y el año de cuatro cifras no cabe bien en la banda. De qué
 * año es lo dice el filtro de mes que está encima de la tabla.
 */
export function mesCorto(fecha: string): string {
  return MESES[partes(fecha)[1] - 1].slice(0, 3).toLowerCase();
}

/** El día del mes: el número grande de la celda de fecha. */
export function diaDelMes(fecha: string): number {
  return partes(fecha)[2];
}

export function fechaCorta(fecha: string): string {
  const [y, m, d] = partes(fecha);
  return `${d} ${MESES[m - 1].slice(0, 3).toLowerCase()} ${y}`;
}

export function diaDeLaSemana(fecha: string): string {
  const [y, m, d] = partes(fecha);
  return new Date(y, m - 1, d).toLocaleDateString('es-PA', { weekday: 'long' });
}

export function fechaLarga(fecha: string): string {
  const [y, m, d] = partes(fecha);
  const texto = new Date(y, m - 1, d).toLocaleDateString('es-PA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Hoy en YYYY-MM-DD, en la zona del navegador. */
export function hoyYMD(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Clases del badge de clima, siguiendo el patrón bg-[name]/10 text-[name]. */
export function clasesClima(clima: string): string {
  switch (clima) {
    case 'Soleado':
      return 'bg-warning/10 text-warning border-warning/30';
    case 'Nublado':
      return 'bg-muted text-muted-foreground border-border';
    case 'Lluvia parcial':
      return 'bg-info/10 text-info border-info/30';
    case 'Lluvia todo el día':
      return 'bg-info/20 text-info border-info/40';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
