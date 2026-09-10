// src/lib/presupuestoApi.ts — cliente de la Hoja de Presupuesto.
// Espeja routes/presupuestos.ts.
//
// Un proyecto tiene VARIOS presupuestos independientes; uno lleva la estrella y
// es contra el que compara el control de costos. Dos maneras de armarlos:
//
//   'desglose' — a partir del desglose oficial del proyecto, que aporta
//     descripcion, unidad, cantidad y PRECIO. La estructura queda bloqueada y lo
//     unico que se edita es el COSTO unitario (guardarCostos, solo el diff).
//
//   'cero' — nace vacio y los renglones se escriben en la hoja. No hay precio,
//     porque no hay desglose de donde sacarlo. La hoja se guarda ENTERA
//     (guardarHoja), igual que un desglose.
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

/** Fila que viaja al guardar una hoja armada DESDE CERO. Las filas van planas y
 *  en orden de documento, y el padre se nombra por `tempId` —no por id— porque
 *  una fila recien agregada todavia no tiene id en la base. `orden` sale de la
 *  posicion en el arreglo, no de un campo. */
export interface PresupuestoRenglonInput {
  tempId: number;
  /** UUID estable; se reenvia para que la fila conserve identidad a traves del
   *  borra-y-reinserta del servidor. Ausente = fila nueva. */
  rowUid?: string;
  parentTempId: number | null;
  tipo: 'grupo' | 'item';
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  costoUnitario: number | null;
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
  origen: 'desglose' | 'cero' = 'desglose',
): Promise<PresupuestoDoc> {
  const res = await api.post(base(proyectoId), { nombre, origen });
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

/** Guarda la hoja ENTERA de un presupuesto armado desde cero: reemplaza lo que
 *  hubiera. El servidor lo rechaza con 400 si el presupuesto salió de un
 *  desglose, donde la estructura no se toca. */
export async function guardarHoja(
  proyectoId: number,
  presupuestoId: number,
  baseUpdatedAt: string,
  renglones: PresupuestoRenglonInput[],
  nombre?: string,
): Promise<PresupuestoDoc> {
  try {
    const res = await api.put(`${base(proyectoId)}/${presupuestoId}/hoja`, {
      baseUpdatedAt, renglones, nombre,
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
