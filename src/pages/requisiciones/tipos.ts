// Lo que el servidor devuelve de una requisición (routes/requisiciones.ts).

export type EstadoRequisicion = 'por_aprobar' | 'aprobada' | 'anulada';
export type Prioridad = 'normal' | 'urgente';
export type Marca = 'pendiente' | 'atendida' | 'parcial' | 'cancelada';
export type TipoCuenta = 'ahorro' | 'corriente';

/** Una fila de la lista. */
export interface RequisicionFila {
  id: number;
  numero: string;
  proyecto_id: number;
  proyecto_nombre: string;
  descripcion: string;
  created_at: string;
  fecha_requerida: string;
  prioridad: Prioridad;
  estado: EstadoRequisicion;
  creado_por_nombre: string;
  lineas: number;
  lineas_pendientes: number;
}

export interface LineaRequisicion {
  id: number;
  orden: number;
  cantidad: string;
  unidad: string | null;
  descripcion: string;
  renglon_desglose: string | null;
  marca: Marca;
  marca_at: string | null;
  marca_por_nombre: string | null;
  /** Las solicitudes de pago y órdenes de compra en que va esta línea. */
  compras: CompraLinea[];
}

export type TipoCompra = 'solicitud' | 'orden';

export interface CompraLinea {
  tipo: TipoCompra;
  id: number;
  numero: string;
}

/** Una solicitud u orden que salió de la requisición, con las líneas que lleva. */
export interface CompraRequisicion extends CompraLinea {
  proveedor: string;
  created_at: string;
  creado_por_nombre: string;
  lineas: number[];
}

export interface AdjuntoRequisicion {
  id: number;
  tipo: 'adjunto' | 'cuadro_comparativo';
  nombre_original: string;
  tipo_mime: string;
  tamano: number;
  descripcion: string | null;
  created_at: string;
  subido_por_nombre: string;
  lineas: number[];
}

export interface CotizacionRequisicion {
  id: number;
  proveedor: string;
  monto: string | null;
  nombre_original: string;
  tipo_mime: string;
  tamano: number;
  created_at: string;
  subido_por_nombre: string;
  lineas: number[];
}

export interface CambioRequisicion {
  id: number;
  cambios: { campo: string; antes: unknown; despues: unknown }[];
  created_at: string;
  user_nombre: string;
}

export interface RequisicionDetalle {
  id: number;
  proyecto_id: number;
  proyecto_nombre: string;
  numero: string;
  descripcion: string;
  fecha_requerida: string;
  prioridad: Prioridad;
  notas: string | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: TipoCuenta | null;
  numero_cuenta: string | null;
  estado: EstadoRequisicion;
  creado_por: number;
  creado_por_nombre: string;
  aprobada_por: number | null;
  aprobada_por_nombre: string | null;
  aprobada_at: string | null;
  anulada_por_nombre: string | null;
  anulada_at: string | null;
  aprobador_id: number | null;
  aprobador_nombre: string | null;
  created_at: string;
  lineas: LineaRequisicion[];
  adjuntos: AdjuntoRequisicion[];
  cotizaciones: CotizacionRequisicion[];
  cambios: CambioRequisicion[];
  compras: CompraRequisicion[];
  puede: { editar: boolean; aprobar: boolean; anular: boolean; atender: boolean };
}

/** Un archivo que va adjunto a la solicitud u orden que nace de la requisición. */
export interface ArchivoQueVa {
  clave: string;
  tipo: 'cotizacion' | 'cuadro' | 'papel';
  /** De la cotización o del cuadro; el papel no tiene. */
  id: number | null;
  nombre: string;
  /** «Cotización · Aceros del Istmo», «La requisición, con la línea 1 marcada». */
  detalle: string;
}

/**
 * Lo que la solicitud de pago o la orden de compra trae puesto cuando nace de
 * una requisición (mock 15–16). Se puede cambiar todo antes de guardar.
 */
export interface DesdeRequisicion {
  requisicion_id: number;
  numero: string;
  /** «línea 1», «líneas 1 y 2». */
  lineasTexto: string;
  proveedor: string;
  urgente: boolean;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: TipoCuenta | null;
  numero_cuenta: string | null;
  lineas: { id: number; marca: 'atendida' | 'parcial' }[];
  cotizacion_id: number | null;
  archivos: ArchivoQueVa[];
  /** Para la orden: sus renglones ya escritos, sin precio. */
  renglones: { cantidad: string; unidad: string | null; descripcion: string }[];
}

/** Una línea como la escribe el formulario: todo texto, como se teclea. */
export interface LineaBorrador {
  clave: string;
  cantidad: string;
  unidad: string;
  descripcion: string;
  renglon_desglose: string;
}

/** Los globitos y en qué proyectos aprueba la persona. */
export interface PendientesRequisiciones {
  total: number;
  por_aprobar: number;
  por_atender: number;
  por_proyecto: Record<string, number>;
  aprueba_en: number[];
}
