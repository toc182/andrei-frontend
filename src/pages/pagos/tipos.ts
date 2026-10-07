/**
 * Lo que el sistema sabe de una orden de compra.
 *
 * Los montos llegan como texto porque Postgres devuelve NUMERIC como texto: si
 * viajara como número, un total de 33,790.60 podría perder un centavo por el
 * camino. Se convierten al mostrarlos, nunca antes.
 */

/**
 * Los seis que se guardan, más los que salen de las facturas: «entrega
 * parcial» (tiene facturas y no se ha marcado completa) y «recibida» (ya está
 * completa). Una completa y pagada se ve «cerrada» sin que nadie la cierre.
 */
export type EstadoOrden =
  | 'pendiente'
  | 'rechazada'
  | 'por_enviar'
  | 'enviada'
  | 'entrega_parcial'
  | 'recibida'
  | 'cerrada'
  | 'dada_de_baja';

export interface AprobadorEstado {
  nombre: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
}

/** Una fila de la lista. */
export interface OrdenFila {
  id: number;
  numero: string;
  fecha: string;
  proveedor: string;
  /** Una línea que diga de qué es la compra. */
  descripcion: string | null;
  monto_total: string;
  estado: EstadoOrden;
  /** El que se enseña: mientras está enviada, mandan sus facturas. */
  estado_calculado: EstadoOrden;
  proyecto_id: number;
  proyecto_nombre: string | null;
  categoria_nombre: string | null;
  recibido: string;
  pagado: string;
  por_pagar: string;
  /** El vencimiento más viejo que sigue sin pagarse. Null si no se debe nada. */
  vence: string | null;
  aprobadores_estado: AprobadorEstado[];
}

export interface ResumenOrdenes {
  abiertas: number;
  por_pagar: string;
  vencidas: number;
}

export interface RespuestaOrdenes {
  success: boolean;
  data: OrdenFila[];
  resumen: ResumenOrdenes;
}
