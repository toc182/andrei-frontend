// Smart default sort comparator for solicitudes-pago lists.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Priority order (lower = higher in the list):
// 1. es_mi_turno first (the user's pending approvals bubble to the top)
// 2. Estado priority group: pendiente > aprobada > pagada/devolucion >
//    facturada/reembolsada > rechazada
// 3. Date desc, with id as tiebreaker (higher id = more recent)

import type { SolicitudPago } from '../types';

export const ESTADO_PRIORITY: Record<string, number> = {
  pendiente: 1,
  aprobada: 2,
  pagada: 3,
  devolucion: 3,
  facturada: 4,
  reembolsada: 4,
  rechazada: 5,
};

export function smartDefaultSort(a: SolicitudPago, b: SolicitudPago): number {
  // 1. Need my approval first
  if (a.es_mi_turno && !b.es_mi_turno) return -1;
  if (!a.es_mi_turno && b.es_mi_turno) return 1;

  // 2. Estado priority group
  const aPrio = ESTADO_PRIORITY[a.estado] ?? 99;
  const bPrio = ESTADO_PRIORITY[b.estado] ?? 99;
  if (aPrio !== bPrio) return aPrio - bPrio;

  // 3. Date desc, then id desc as tiebreaker
  const dateDiff = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  if (dateDiff !== 0) return dateDiff;
  return b.id - a.id;
}
