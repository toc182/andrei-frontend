// src/lib/desgloseApi.ts — API client + wire types for the Desglose feature.
// Mirrors routes/desgloses.ts shapes. The PUT item shape (DesgloseItemInput)
// is owned by desgloseModel.ts and re-exported here.
import api from '@/services/api';
import type { DesgloseItemInput, DesgloseRow } from './desgloseModel';

export type { DesgloseItemInput } from './desgloseModel';

export interface DesgloseMeta {
  id: number;
  proyectoId: number;
  nombre: string;
  tipo: string;
  updatedAt: string; // optimistic-concurrency stamp; echo back on save
}

export interface DesgloseItemWire {
  id: number;
  parentId: number | null;
  tipo: 'grupo' | 'item';
  item: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  orden: number;
}

export interface DesgloseDoc {
  desglose: DesgloseMeta;
  items: DesgloseItemWire[];
}

/** Thrown by saveDesglose when the backend rejects the save with 409 (another
 *  user saved first, or — on the very first save — raced another create).
 *  Distinct from transient/network errors so the caller can branch. */
export class DesgloseConflictError extends Error {
  constructor(message = 'Otro usuario guardó cambios; recarga para combinar.') {
    super(message);
    this.name = 'DesgloseConflictError';
  }
}

export async function getDesglose(proyectoId: number): Promise<DesgloseDoc | null> {
  const res = await api.get(`/desgloses/proyecto/${proyectoId}`);
  return res.data.data;
}

export async function saveDesglose(
  proyectoId: number,
  baseUpdatedAt: string | null,
  items: DesgloseItemInput[],
): Promise<DesgloseDoc> {
  try {
    const res = await api.put(`/desgloses/proyecto/${proyectoId}`, { baseUpdatedAt, items });
    return res.data.data;
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { message?: string } } };
    if (err.response?.status === 409) {
      throw new DesgloseConflictError(err.response?.data?.message);
    }
    throw e;
  }
}

/** DB rows (parent-indexed) -> flat editor rows in document order with depth. */
export function wireToRows(items: DesgloseItemWire[]): DesgloseRow[] {
  const byParent = new Map<number | null, DesgloseItemWire[]>();
  for (const it of items) {
    const list = byParent.get(it.parentId) ?? [];
    list.push(it);
    byParent.set(it.parentId, list);
  }
  const out: DesgloseRow[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const it of (byParent.get(parentId) ?? []).sort((a, b) => a.orden - b.orden)) {
      out.push({
        tempId: it.id, depth, tipo: it.tipo, item: it.item, descripcion: it.descripcion,
        unidad: it.unidad, cantidad: it.cantidad, precioUnitario: it.precioUnitario,
      });
      walk(it.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
