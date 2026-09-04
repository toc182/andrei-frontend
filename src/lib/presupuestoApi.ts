// src/lib/presupuestoApi.ts — cliente de la Hoja de Presupuesto.
// Espeja routes/presupuestos.ts.
//
// Un proyecto tiene VARIOS presupuestos independientes; uno lleva la estrella y
// es contra el que compara el control de costos. Se arman a partir del desglose
// oficial del proyecto, que aporta descripcion, unidad, cantidad y PRECIO. Lo
// unico que se edita despues es el COSTO unitario de cada renglon.
import api from '@/services/api';

export interface PresupuestoLista {
  id: number;
  nombre: string;
  origen: 'desglose' | 'cero';
  /** La estrella: el que usa el control de costos. */
  esPrincipal: boolean;
  creadoAt: string;
  costo: number;
  precio: number;
  renglones: number;
}

/** El desglose oficial del proyecto. null = no hay, y armar a partir de el sale
 *  apagado. */
export interface DesgloseDisponible {
  id: number;
  nombre: string;
  filas: number;
}

export interface PresupuestosProyecto {
  presupuestos: PresupuestoLista[];
  desglose: DesgloseDisponible | null;
}

export interface PresupuestoMeta {
  id: number;
  proyectoId: number;
  nombre: string;
  origen: 'desglose' | 'cero';
  esPrincipal: boolean;
  desgloseId: number | null;
  creadoAt: string;
  updatedAt: string; // sello de concurrencia; se devuelve tal cual al guardar
}

export interface PresupuestoRenglon {
  id: number;
  rowUid: string;
  parentId: number | null;
  tipo: 'grupo' | 'item';
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  /** Lo que se COBRA. Viene del desglose; no se edita aqui. */
  precioUnitario: number | null;
  /** Lo que CUESTA. Lo unico que escribe el usuario. */
  costoUnitario: number | null;
  orden: number;
}

export interface PresupuestoDoc {
  presupuesto: PresupuestoMeta;
  renglones: PresupuestoRenglon[];
}

/** La lanza guardarCostos con un 409: otro usuario guardo primero. Va aparte de
 *  los errores de red para poder ofrecer "Recargar". */
export class PresupuestoConflictError extends Error {
  constructor(message = 'Otro usuario guardó cambios; recarga para combinar.') {
    super(message);
    this.name = 'PresupuestoConflictError';
  }
}

const base = (proyectoId: number) => `/presupuestos/proyecto/${proyectoId}`;

export async function getPresupuestos(proyectoId: number): Promise<PresupuestosProyecto> {
  const res = await api.get(base(proyectoId));
  return res.data.data;
}

export async function crearPresupuesto(
  proyectoId: number,
  nombre: string,
): Promise<PresupuestoDoc> {
  const res = await api.post(base(proyectoId), { nombre, origen: 'desglose' });
  return res.data.data;
}

export async function getPresupuesto(
  proyectoId: number,
  presupuestoId: number,
): Promise<PresupuestoDoc> {
  const res = await api.get(`${base(proyectoId)}/${presupuestoId}`);
  return res.data.data;
}

export async function guardarCostos(
  proyectoId: number,
  presupuestoId: number,
  baseUpdatedAt: string,
  costos: { id: number; costoUnitario: number | null }[],
  nombre?: string,
): Promise<PresupuestoDoc> {
  try {
    const res = await api.put(`${base(proyectoId)}/${presupuestoId}`, {
      baseUpdatedAt, costos, nombre,
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

/** Pone la estrella en uno y la quita del anterior. Devuelve la lista ya al día. */
export async function marcarPrincipal(
  proyectoId: number,
  presupuestoId: number,
): Promise<PresupuestoLista[]> {
  const res = await api.put(`${base(proyectoId)}/${presupuestoId}/principal`);
  return res.data.data ?? [];
}

/** Borrado suave. Devuelve la lista ya al día. */
export async function eliminarPresupuesto(
  proyectoId: number,
  presupuestoId: number,
): Promise<PresupuestoLista[]> {
  const res = await api.delete(`${base(proyectoId)}/${presupuestoId}`);
  return res.data.data ?? [];
}
