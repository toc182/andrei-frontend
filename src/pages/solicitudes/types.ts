// Shared types for the solicitudes-pago views.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

import type { SolicitudPagoAdjunto } from '@/types/api';

export type EstadoSolicitud =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada'
  | 'abonada'
  | 'pagada'
  | 'facturada'
  | 'devolucion'
  | 'reembolsada'
  | 'transferida';

export type TipoSolicitud = 'regular' | 'reembolso' | 'apertura';

export interface SolicitudPago {
  id: number;
  proyecto_id: number | null;
  numero: string;
  fecha: string;
  proveedor: string;
  preparado_por: number;
  solicitado_por: number | null;
  requisicion_id: number | null;
  subtotal: number;
  descuentos: number;
  impuestos: number;
  monto_total: number;
  // Lo pagado y el saldo (vista solicitud_pago_saldo, migración 191). Solo los
  // trae el detalle; llegan como texto, igual que monto_total.
  pagado?: number | string;
  saldo?: number | string;
  estado: EstadoSolicitud;
  tipo: TipoSolicitud;
  observaciones: string | null;
  mensaje?: string | null;
  mensaje_autor_id?: number | null;
  mensaje_autor_nombre?: string | null;
  mensaje_updated_at?: string | null;
  mensaje_leido?: boolean | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  urgente: boolean;
  pinellas_paga: boolean;
  // Categoría de gasto (issue #71). Never required — a solicitud can stay
  // unclassified and be labelled later by whoever does cost control.
  categoria_id?: number | null;
  categoria_nombre?: string | null;
  revisada?: boolean;
  es_mi_turno?: boolean;
  aprobadores_estado?: { nombre: string; estado: string }[];
  reembolso_registrado?: boolean;
  proyecto_nombre?: string;
  preparado_nombre?: string;
  solicitado_nombre?: string;
  requisicion_numero?: string;
  updated_at?: string;
  // Solo en el detalle de la apertura de una caja menuda: su caja y cuántos
  // gastos tiene. Con gastos no se puede rechazar; sin ellos, rechazarla
  // cancela la caja.
  caja_apertura?: { id: number; nombre: string; gastos: number } | null;
}

export interface SolicitudItem {
  id: number;
  solicitud_pago_id?: number;
  cantidad: number;
  unidad: string;
  descripcion: string;
  descripcion_detallada: string | null;
  precio_unitario: number;
  precio_total: number;
}

export interface SolicitudAjuste {
  id: number;
  solicitud_pago_id?: number;
  tipo: string;
  descripcion: string;
  porcentaje: number | null;
  monto: number;
}

/** Un pago de una solicitud (pagos parciales, migración 191), con sus
 *  comprobantes. Un pago anulado viene con activo = false, quién, cuándo y por
 *  qué: no cuenta, pero queda a la vista. */
export interface PagoSolicitud {
  id: number;
  fecha_pago: string; // YYYY-MM-DD
  monto: string; // «1293.75»
  activo: boolean;
  registrado_por_nombre: string | null;
  anulado_por_nombre: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  adjuntos: SolicitudPagoAdjunto[];
}

export interface ProjectOption {
  id: number;
  nombre: string;
  nombre_corto?: string;
  sp_prefijo?: string | null;
}

export interface Aprobacion {
  id: number;
  solicitud_pago_id: number;
  user_id: number;
  orden: number;
  accion: 'aprobado' | 'rechazado';
  comentario: string | null;
  fecha: string;
  usuario_nombre: string;
}

export interface AprobadorProyecto {
  user_id: number;
  orden: number;
  nombre: string;
  email: string;
}

export const ESTADO_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'abonada', label: 'Abonada' },
  { value: 'pagada', label: 'Pagada' },
  { value: 'facturada', label: 'Facturada' },
  { value: 'reembolsada', label: 'Reembolsada' },
  { value: 'transferida', label: 'Verificada' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'rechazada', label: 'Rechazada' },
];

export const ALL_ESTADOS = ESTADO_OPTIONS.map((e) => e.value);
