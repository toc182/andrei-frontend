// APARTADO — no lo usa ninguna pantalla viva.
//
// Cliente de la primera hoja de Presupuesto, la de dos bloques (Items y Costos
// Generales) con calculo por partes. Ivan la vio y no le gusto: "lo siento
// enredado", "no se como empezar". Se conserva junto con PresupuestoPorBloques
// para cuando se retomen las OTRAS maneras de armar un presupuesto.
//
// Ojo: los endpoints que llama YA NO EXISTEN con esta forma. /presupuestos
// ahora devuelve la lista de presupuestos del proyecto (ver lib/presupuestoApi).
// Antes de revivir esta pantalla hay que rehacer estas llamadas.
import api from '@/services/api';
import type {
  PresupuestoRenglonInput, PresupuestoRow, RenglonCalculo, Seccion,
} from '@/lib/presupuestoModel';

export type { PresupuestoRenglonInput } from '@/lib/presupuestoModel';

export interface PresupuestoMeta {
  id: number;
  proyectoId: number;
  nombre: string;
  /** Multiplica todos los renglones de la hoja. 1 = sin factor. */
  factor: number;
  itbmsTasa: number | null;
  updatedAt: string; // sello de concurrencia; se devuelve tal cual al guardar
}

export interface PresupuestoRenglonWire {
  id: number;
  rowUid?: string;
  parentId: number | null;
  seccion: Seccion;
  tipo: 'grupo' | 'item';
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  usaCalculo: boolean;
  calculo: RenglonCalculo | null;
  orden: number;
}

export interface PresupuestoDoc {
  presupuesto: PresupuestoMeta;
  renglones: PresupuestoRenglonWire[];
}

/** La lanza savePresupuesto cuando el backend responde 409: otro usuario guardo
 *  primero, o —en el primer guardado— dos creaciones corrieron a la vez. Va
 *  aparte de los errores de red para que quien llama pueda ofrecer "Recargar". */
export class PresupuestoConflictError extends Error {
  constructor(message = 'Otro usuario guardo cambios; recarga para combinar.') {
    super(message);
    this.name = 'PresupuestoConflictError';
  }
}

export async function getPresupuesto(proyectoId: number): Promise<PresupuestoDoc | null> {
  const res = await api.get(`/presupuestos/proyecto/${proyectoId}`);
  return res.data.data;
}

export async function savePresupuesto(
  proyectoId: number,
  baseUpdatedAt: string | null,
  renglones: PresupuestoRenglonInput[],
  factor: number,
  itbmsTasa: number | null,
): Promise<PresupuestoDoc> {
  try {
    const res = await api.put(`/presupuestos/proyecto/${proyectoId}`, {
      baseUpdatedAt, renglones, factor, itbmsTasa,
    });
    return res.data.data;
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { message?: string } } };
    if (err.response?.status === 409) {
      throw new PresupuestoConflictError(err.response?.data?.message);
    }
    throw e;
  }
}

/** Filas de la DB (indexadas por padre) -> filas planas del editor con depth. */
export function wireToRows(renglones: PresupuestoRenglonWire[]): PresupuestoRow[] {
  const byParent = new Map<number | null, PresupuestoRenglonWire[]>();
  for (const r of renglones) {
    const list = byParent.get(r.parentId) ?? [];
    list.push(r);
    byParent.set(r.parentId, list);
  }
  const out: PresupuestoRow[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const r of (byParent.get(parentId) ?? []).sort((a, b) => a.orden - b.orden)) {
      out.push({
        tempId: r.id,
        rowUid: r.rowUid,
        depth,
        seccion: r.seccion,
        tipo: r.tipo,
        codigo: r.codigo,
        descripcion: r.descripcion,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precioUnitario: r.precioUnitario,
        usaCalculo: r.usaCalculo,
        calculo: r.calculo,
      });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}