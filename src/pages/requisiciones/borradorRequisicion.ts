/**
 * La requisición nueva que se está escribiendo, guardada en el navegador con
 * cada cambio (lib/borradorLocal.ts).
 *
 * Nace del 2026-11-12: a Cesar se le cerró la ventana a media requisición, con
 * muchas líneas escritas, y tuvo que llenarla otra vez. Con esto, al volver a
 * pulsar «Nueva requisición» se le ofrece seguirla, venga de donde venga el
 * cierre: un toque fuera, el navegador, la batería, la señal.
 *
 * Solo una requisición NUEVA: la que se corrige ya existe entera en el servidor.
 * Los archivos elegidos no se guardan —no caben—; se recuerda cuántos eran para
 * avisar que hay que volver a subirlos.
 *
 * Una por persona y proyecto, como el reporte diario.
 */
import { borrarBorrador, guardarBorrador, leerBorrador, type Guardado } from '@/lib/borradorLocal';
import { lineaEnBlanco, lineaVacia } from './lineas';
import type { LineaBorrador, Prioridad } from './tipos';

/** El formulario, con la forma de su estado. */
export interface BorradorRequisicion {
  descripcion: string;
  fecha: string;
  prioridad: Prioridad;
  lineas: LineaBorrador[];
  notas: string;
  beneficiario: string;
  banco: string;
  /** Como el formulario: 'ahorro', 'corriente' o su valor de «sin elegir». */
  tipoCuenta: string;
  numeroCuenta: string;
  /** Cuántos archivos se habían elegido y no llegaron a subirse. */
  adjuntosSinSubir: number;
}

/** Las líneas con algo escrito: las en blanco se descartan al guardar. */
export const lineasEscritas = (b: BorradorRequisicion): LineaBorrador[] =>
  (Array.isArray(b.lineas) ? b.lineas : []).filter((l) => !lineaEnBlanco(l));

/**
 * Si hay algo que valga la pena recordar: cualquier cosa que la persona haya
 * escrito o elegido. Los archivos solos no cuentan: no se guardan.
 */
function tieneContenido(b: BorradorRequisicion): boolean {
  return (
    [b.descripcion, b.fecha, b.notas, b.beneficiario, b.banco, b.numeroCuenta].some(
      (t) => String(t ?? '').trim() !== '',
    ) ||
    b.prioridad === 'urgente' ||
    b.tipoCuenta === 'ahorro' ||
    b.tipoCuenta === 'corriente' ||
    lineasEscritas(b).length > 0
  );
}

const clave = (userId: number, proyectoId: number) =>
  `requisicion-sin-guardar:${userId}:${proyectoId}`;

export function leerRequisicion(userId: number, proyectoId: number): Guardado<BorradorRequisicion> | null {
  return leerBorrador(clave(userId, proyectoId), tieneContenido);
}

export function guardarRequisicion(userId: number, proyectoId: number, b: BorradorRequisicion): void {
  guardarBorrador(clave(userId, proyectoId), b, tieneContenido);
}

export function borrarRequisicion(userId: number, proyectoId: number): void {
  borrarBorrador(clave(userId, proyectoId));
}

/**
 * Las líneas recuperadas, con claves nuevas: las guardadas se numeraron en otra
 * visita a la página, y las que se agreguen ahora podrían repetirlas.
 */
export const conClavesNuevas = (lineas: LineaBorrador[]): LineaBorrador[] =>
  lineas.map((l) => ({ ...l, clave: lineaVacia().clave }));
