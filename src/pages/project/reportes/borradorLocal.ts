/**
 * El reporte que se está escribiendo, guardado en el teléfono mientras se
 * escribe.
 *
 * Nace del 2026-09-14: el ingeniero Cesar llenó un reporte en Playa Blanca, el
 * envío falló por una foto de 11 MB y salió del formulario. Lo que había escrito
 * estaba en el servidor como borrador, pero la pantalla no tenía cómo
 * mostrárselo. Con esto, cualquier reporte que no llegó a enviarse —se cortó la
 * señal, cerró el navegador, se le acabó la batería, nunca pulsó Guardar— se le
 * ofrece al volver a abrir «Nuevo reporte».
 *
 * Solo el texto y lo elegido, no las fotos: un archivo no cabe en localStorage.
 * Las fotos que ya subieron las trae el servidor con el borrador.
 *
 * localStorage puede fallar (navegación privada, almacenamiento lleno o
 * bloqueado): cada acceso va en try/catch, y si falla simplemente no se
 * recuerda nada, que es como funcionaba antes.
 */

import type { FilaEntrega, Reporte, Trabajo } from './tipos';

/** Lo que el formulario necesita para arrancar, con la forma de su estado. */
export interface Semilla {
  fecha: string;
  clima: string;
  horas: string;
  motivo: string;
  /**
   * Los puntos de «Trabajo ejecutado» por área. Puede faltar en lo que un
   * teléfono guardó antes del cambio: esa semilla trae solo queSeHizo.
   */
  trabajos?: Trabajo[];
  /** La forma de antes: la lista de áreas aparte y el texto. */
  areasElegidas: number[];
  queSeHizo: string;
  atrasos: string;
  novedades: string;
  personal: Record<number, string>;
  equiposUso: Record<number, { unidades: string; horas: string }>;
  entregas: FilaEntrega[];
  /** El borrador del servidor, si ya se pulsó Guardar alguna vez. */
  borradorId: number | null;
}

export interface SemillaGuardada extends Semilla {
  /** Cuándo se tocó por última vez, en ISO. */
  guardadoEn: string;
}

/** El formulario a partir de un reporte del servidor: corregir o seguir un borrador. */
export function semillaDeReporte(r: Reporte, borradorId: number | null): Semilla {
  return {
    fecha: r.fecha.slice(0, 10),
    clima: r.clima ?? '',
    horas: r.horas_perdidas ?? '',
    motivo: r.motivo ?? '',
    trabajos: (r.trabajos ?? []).map((t) => ({ area_id: t.area_id, texto: t.texto })),
    areasElegidas: r.areas.map((a) => a.id),
    queSeHizo: r.que_se_hizo ?? '',
    atrasos: r.atrasos ?? '',
    novedades: r.novedades ?? '',
    personal: Object.fromEntries(
      (r.personal ?? []).map((f) => [f.puesto_id, String(f.cantidad)]),
    ),
    equiposUso: Object.fromEntries(
      (r.equipos ?? []).map((f) => [
        f.equipo_id,
        { unidades: String(f.unidades), horas: String(f.horas) },
      ]),
    ),
    entregas: (r.entregas ?? []).map((f) => ({
      categoria_id: f.categoria_id,
      descripcion: f.descripcion,
      cantidad: f.cantidad ?? '',
      unidad: f.unidad ?? '',
      notas: f.notas ?? '',
    })),
    borradorId,
  };
}

/**
 * Los puntos con los que arranca un reporte por áreas.
 *
 * Lo que se escribió con la forma de antes —un borrador del servidor o del
 * teléfono de antes del cambio— no se pierde: su texto entra como un punto de
 * «General», que el ingeniero puede mover de área o partir.
 */
export function trabajosDeSemilla(s: Semilla | null): Trabajo[] {
  if (!s) return [];
  if (s.trabajos && s.trabajos.length > 0) return s.trabajos;
  const texto = s.queSeHizo?.trim();
  return texto ? [{ area_id: null, texto }] : [];
}

/**
 * Si hay algo que valga la pena recordar. La fecha no cuenta: viene puesta
 * sola, y un formulario recién abierto no es un reporte a medias.
 */
export function tieneContenido(s: Semilla): boolean {
  return (
    s.borradorId !== null ||
    [s.clima, s.horas, s.motivo, s.queSeHizo, s.atrasos, s.novedades].some(
      (t) => String(t ?? '').trim() !== '',
    ) ||
    s.areasElegidas.length > 0 ||
    (s.trabajos?.length ?? 0) > 0 ||
    Object.values(s.personal).some((v) => v !== '' && Number(v) !== 0) ||
    Object.values(s.equiposUso).some(
      (v) => (v.unidades !== '' && Number(v.unidades) !== 0) || (v.horas !== '' && Number(v.horas) !== 0),
    ) ||
    s.entregas.length > 0
  );
}

const clave = (userId: number, projectId: number) =>
  `reporte-sin-enviar:${userId}:${projectId}`;

export function leerLocal(userId: number, projectId: number): SemillaGuardada | null {
  try {
    const crudo = localStorage.getItem(clave(userId, projectId));
    if (!crudo) return null;
    const s = JSON.parse(crudo) as SemillaGuardada;
    return tieneContenido(s) ? s : null;
  } catch {
    return null;
  }
}

export function guardarLocal(userId: number, projectId: number, s: Semilla): void {
  try {
    if (!tieneContenido(s)) {
      localStorage.removeItem(clave(userId, projectId));
      return;
    }
    const guardada: SemillaGuardada = { ...s, guardadoEn: new Date().toISOString() };
    localStorage.setItem(clave(userId, projectId), JSON.stringify(guardada));
  } catch {
    // Sin almacenamiento no se recuerda nada; el formulario sigue funcionando.
  }
}

export function borrarLocal(userId: number, projectId: number): void {
  try {
    localStorage.removeItem(clave(userId, projectId));
  } catch {
    // Igual que arriba.
  }
}
