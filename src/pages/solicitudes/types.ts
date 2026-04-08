// Shared types for the solicitudes-pago views.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

export type EstadoSolicitud =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada'
  | 'pagada'
  | 'facturada'
  | 'devolucion'
  | 'reembolsada';

export type TipoSolicitud = 'regular' | 'reembolso';

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
  estado: EstadoSolicitud;
  tipo: TipoSolicitud;
  observaciones: string | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  urgente: boolean;
  pinellas_paga: boolean;
  revisada?: boolean;
  es_mi_turno?: boolean;
  aprobadores_estado?: { nombre: string; estado: string }[];
  reembolso_registrado?: boolean;
  proyecto_nombre?: string;
  preparado_nombre?: string;
  solicitado_nombre?: string;
  requisicion_numero?: string;
  updated_at?: string;
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
  { value: 'pagada', label: 'Pagada' },
  { value: 'facturada', label: 'Facturada' },
  { value: 'reembolsada', label: 'Reembolsada' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'rechazada', label: 'Rechazada' },
];

export const ALL_ESTADOS = ESTADO_OPTIONS.map((e) => e.value);
