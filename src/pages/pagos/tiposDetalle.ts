/** Lo que trae la orden abierta, con todo lo que cuelga de ella. */
import type { AprobadorEstado, EstadoOrden } from './tipos';

export interface OrdenItem {
  id: number;
  cantidad: string;
  unidad: string;
  codigo: string | null;
  descripcion: string;
  precio_unitario: string;
  precio_total: string;
  orden: number;
  /** Cuánto de este renglón ha llegado, sumando todas las entregas. */
  recibido_cantidad: string;
}

export interface OrdenAdjunto {
  id: number;
  entrega_id: number | null;
  nombre_original: string;
  tipo_mime: string;
  tamano: number;
  descripcion: string | null;
  subido_por_nombre: string | null;
}

export interface EntregaItem {
  item_id: number;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio_total: string;
}

export interface Entrega {
  id: number;
  fecha: string;
  /** Congelado al registrarla: fecha + el término de ese momento. */
  vence: string;
  subtotal: string;
  itbms: string;
  monto_total: string;
  nota: string | null;
  registrada_por_nombre: string | null;
  pagado: string;
  /** Lo que ya tiene una solicitud encima, aunque no se haya pagado. */
  reclamado: string;
  items: EntregaItem[];
  adjuntos: OrdenAdjunto[];
}

export interface PagoDeOrden {
  id: number;
  numero: string;
  estado: string;
  fecha: string;
  monto: string;
}

export interface CambioAnotado {
  id: number;
  usuario_nombre: string | null;
  motivo: string;
  created_at: string;
  cambios: { campo: string; antes: unknown; despues: unknown }[];
}

export interface OrdenDetalle {
  id: number;
  proyecto_id: number;
  proyecto_nombre: string | null;
  numero: string;
  fecha: string;
  proveedor: string;
  proveedor_ruc: string | null;
  descripcion: string | null;
  categoria_id: number | null;
  categoria_nombre: string | null;
  termino_dias: number;
  entrega: 'sitio' | 'local';
  condiciones: string | null;
  observaciones: string | null;
  subtotal: string;
  descuento: string;
  itbms_tasa: string;
  itbms: string;
  monto_total: string;
  estado: EstadoOrden;
  estado_calculado: EstadoOrden;
  codigo_verificacion: string;
  creado_por_nombre: string | null;
  enviada_por_nombre: string | null;
  baja_motivo: string | null;
  recibido: string;
  pagado: string;
  por_pagar: string;
  disponible_para_activar: string;
  falta_por_retirar: string;
  vence: string | null;
  items: OrdenItem[];
  entregas: Entrega[];
  adjuntos: OrdenAdjunto[];
  aprobadores: { user_id: number; orden: number; nombre: string }[];
  aprobaciones: {
    user_id: number;
    orden: number;
    accion: string;
    comentario: string | null;
    fecha: string;
    usuario_nombre: string | null;
  }[];
  cambios: CambioAnotado[];
  pagos: PagoDeOrden[];
}

/** La cadena de firmas con lo que cada quien hizo, para la barra de iniciales. */
export function aprobadoresDe(o: OrdenDetalle): AprobadorEstado[] {
  return o.aprobadores.map((a) => {
    const firma = o.aprobaciones.find((x) => x.user_id === a.user_id);
    return {
      nombre: a.nombre,
      estado: (firma?.accion ?? 'pendiente') as AprobadorEstado['estado'],
    };
  });
}
