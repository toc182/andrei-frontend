// src/lib/asistentePagosApi.ts — el asistente de partidas.
//
// Tres llamadas: preguntar si esta disponible, conversar, y aplicar lo que se
// propuso. Conversar NO guarda nada; aplicar es el unico que escribe, y solo
// con los cambios que la persona dejo marcados.

import api from '@/services/api';
import type { PartidaAsignada } from './costosApi';

export interface MensajeChat {
  rol: 'usuario' | 'asistente';
  texto: string;
}

export interface LineaPropuesta {
  rowUid: string;
  /** null cuando la fila ya no esta en el desglose; solo pasa en el "antes". */
  item: string | null;
  descripcion: string | null;
  monto: number;
}

export type ReglaPropuesta =
  | 'una_partida'
  | 'proporcional_presupuesto'
  | 'partes_iguales'
  | 'porcentajes'
  | 'sin_partida';

export interface CambioPropuesto {
  solicitudId: number;
  numero: string | null;
  proveedor: string | null;
  monto: number;
  antes: LineaPropuesta[];
  despues: LineaPropuesta[];
  regla: ReglaPropuesta;
  motivo: string;
  /** Como estaba el pago cuando se propuso. Viaja de vuelta al aplicar: si ya
   *  no coincide, el servidor rechaza el lote entero. */
  huella: string;
}

export interface Propuesta {
  id: string;
  resumen: string;
  cambios: CambioPropuesto[];
}

export async function getEstadoAsistente(): Promise<boolean> {
  const res = await api.get('/costs/asistente-pagos/estado');
  return Boolean(res.data.data?.disponible);
}

export async function conversarAsistente(
  proyectoId: number,
  mensajes: MensajeChat[],
  propuestaPrevia: Propuesta | null,
): Promise<{ mensaje: string; propuesta: Propuesta | null; aviso?: string }> {
  const res = await api.post(`/costs/projects/${proyectoId}/asistente-pagos`, {
    mensajes,
    propuestaPrevia,
  });
  return res.data.data;
}

export async function aplicarPropuesta(
  proyectoId: number,
  propuestaId: string,
  cambios: CambioPropuesto[],
): Promise<{ solicitudId: number; partidas: PartidaAsignada[] }[]> {
  const res = await api.post(`/costs/projects/${proyectoId}/pagos/partidas/lote`, {
    propuestaId,
    cambios: cambios.map((c) => ({
      solicitudId: c.solicitudId,
      huella: c.huella,
      partidas: c.despues.map((l) => ({ rowUid: l.rowUid, monto: l.monto })),
    })),
  });
  return res.data.data.aplicados;
}
