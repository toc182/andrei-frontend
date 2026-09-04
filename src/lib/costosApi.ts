// src/lib/costosApi.ts — resumen de Control de Costos.
// Espeja el endpoint /costs/projects/:id/resumen.
//
// Tres numeros: lo que se va a cobrar (contrato), lo que se calculo que iba a
// costar (el presupuesto con la estrella) y lo que se lleva gastado (las
// solicitudes de pago ya pagadas).
import api from '@/services/api';

export interface ResumenCategoria {
  id: number;
  codigo: string;
  nombre: string;
  color: string;
  monto: number;
  solicitudes: number;
}

/** Una linea del reparto de un pago. item y descripcion vienen en null cuando la
 *  fila ya no esta en el desglose: la partida se borro despues de asignarla, y
 *  ese pago vuelve a contar como pendiente. */
export interface PartidaAsignada {
  rowUid: string;
  item: string | null;
  descripcion: string | null;
  monto: number;
}

export interface ResumenSolicitud {
  id: number;
  numero: string | null;
  fecha: string; // YYYY-MM-DD, la del comprobante de pago
  proveedor: string | null;
  monto: number;
  categoriaId: number | null;
  partidas: PartidaAsignada[];
}

/** Una fila costeable del desglose oficial: las que se pueden escoger. */
export interface Partida {
  rowUid: string;
  item: string;
  descripcion: string;
}

/** Una fila del cuadro de presupuestado contra gastado. presupuestado null = el
 *  presupuesto oficial no tiene esa partida, o el proyecto no tiene presupuesto. */
export interface ComparativoFila {
  rowUid: string;
  item: string;
  descripcion: string;
  presupuestado: number | null;
  gastado: number;
}

export interface ResumenCostos {
  contrato: number | null;
  presupuesto: { id: number; nombre: string; costo: number } | null;
  gastado: number;
  categorias: ResumenCategoria[];
  /** Pagos sin categoria de gasto. En la pantalla es un aviso, no una fila mas. */
  sinClasificar: { monto: number; solicitudes: number };
  /** Lo pagado por dia; el acumulado se arma en la pantalla. */
  serie: { fecha: string; monto: number }[];
  solicitudes: ResumenSolicitud[];
  /** Presupuestado contra gastado, partida por partida. Va vacio si el proyecto
   *  no tiene desglose: las partidas salen de ahi. */
  comparativo: {
    filas: ComparativoFila[];
    /** Lo gastado que no cae en ninguna fila del cuadro. Sale por diferencia,
     *  asi que el cuadro siempre cierra con el gastado total. */
    sinPartida: { monto: number; pagos: number };
  };
  fechas: { inicio: string | null; fin: string | null };
}

export async function getResumenCostos(proyectoId: number): Promise<ResumenCostos> {
  const res = await api.get(`/costs/projects/${proyectoId}/resumen`);
  return res.data.data;
}

/** Las partidas del desglose oficial del proyecto. desgloseId null = el
 *  proyecto no tiene desglose, y entonces no hay nada que asignar. */
export async function getPartidas(
  proyectoId: number,
): Promise<{ desgloseId: number | null; partidas: Partida[] }> {
  const res = await api.get(`/costs/projects/${proyectoId}/partidas`);
  return res.data.data;
}

/** Guarda el reparto de un pago. Lista vacia = dejarlo sin clasificar. Con
 *  lineas, la suma tiene que dar el monto del pago o el servidor lo rechaza. */
export async function guardarPartidasDePago(
  proyectoId: number,
  solicitudId: number,
  partidas: { rowUid: string; monto: number }[],
): Promise<PartidaAsignada[]> {
  const res = await api.put(
    `/costs/projects/${proyectoId}/pagos/${solicitudId}/partidas`,
    { partidas },
  );
  return res.data.data;
}
