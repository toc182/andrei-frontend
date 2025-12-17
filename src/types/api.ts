/**
 * API Types
 * Tipos para todas las respuestas de la API
 *
 * CONVENCIÓN: Usar español para campos que vienen del backend
 * para mantener consistencia con la base de datos
 */

// ============================================
// BASE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  errors?: Array<{ msg: string; param: string }>;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================
// AUTH & USERS
// ============================================

export interface User {
  id: number;
  email: string;
  nombre: string;
  rol: 'admin' | 'project_manager' | 'field_user' | 'viewer';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

// ============================================
// PROJECTS
// ============================================

export interface Project {
  id: number;
  nombre: string;
  nombre_corto?: string;
  codigo_proyecto?: string;
  cliente_id?: number;
  cliente_nombre?: string;
  estado: 'planificacion' | 'en_curso' | 'pausado' | 'completado' | 'cancelado';
  fecha_inicio?: string;
  fecha_fin_estimada?: string;
  presupuesto_base?: number;
  itbms?: number;
  monto_total?: number;
  contrato?: string;
  acto_publico?: string;
  es_consorcio?: boolean;
  consorcio_data?: {
    empresas: Array<{
      nombre: string;
      participacion: number;
    }>;
  };
  datos_adicionales?: {
    observaciones?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id?: number;
  external_contact_id?: number;
  rol: 'responsable' | 'colaborador' | 'supervisor' | 'consultor';
  fecha_asignacion: string;
  activo: boolean;
  // Joined fields
  usuario_nombre?: string;
  usuario_email?: string;
  contacto_nombre?: string;
  contacto_empresa?: string;
  contacto_telefono?: string;
  contacto_email?: string;
}

export interface Adenda {
  id: number;
  project_id: number;
  numero_adenda: number;
  tipo: 'tiempo' | 'costo' | 'mixta';
  estado: 'en_proceso' | 'aprobada' | 'rechazada';
  fecha_solicitud: string;
  fecha_aprobacion?: string;
  nueva_fecha_fin?: string;
  dias_extension?: number;
  nuevo_monto?: number;
  monto_adicional?: number;
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// COSTS & BUDGET
// ============================================

export interface ExpenseCategory {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  color: string;
  orden: number;
  activo: boolean;
}

export interface ProjectCategory {
  id: number;
  project_id: number;
  category_id: number | null; // null for custom categories
  nombre: string;
  codigo: string;
  color: string;
  activo: boolean;
  orden: number;
  is_custom: boolean;
}

export interface Expense {
  id: number;
  project_id: number;
  category_id: number;
  fecha: string;
  concepto: string;
  descripcion?: string;
  monto: number;
  moneda: string;
  tipo_gasto: 'real' | 'compromiso' | 'estimado';
  aprobado: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  categoria_nombre?: string;
  categoria_codigo?: string;
  categoria_color?: string;
  creado_por_nombre?: string;
}

export interface CategoryBudget {
  project_category_id: number;
  nombre: string;
  codigo: string;
  color: string;
  presupuesto_actual: number;
  gastado: number;
  disponible: number;
  porcentaje_usado: number;
  total_gastos: number;
}

export interface ProjectBudget {
  id: number;
  project_id: number;
  presupuesto_total: number;
  notas?: string;
  tiene_presupuesto_configurado: boolean;
  created_at: string;
  updated_at: string;
}

export interface CostDashboard {
  budget: ProjectBudget & {
    proyecto_nombre: string;
  };
  totalSpent: number;
  totalAvailable: number;
  percentageUsed: number;
  categoryBreakdown: CategoryBudget[];
  recentExpenses: Expense[];
  monthlyTrend: Array<{
    mes: string;
    total_mes: number;
  }>;
}

// ============================================
// REQUISICIONES
// ============================================

export interface Requisicion {
  id: number;
  project_id: number;
  numero_requisicion: string;
  fecha_solicitud: string;
  fecha_necesidad?: string;
  descripcion: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'completada' | 'cancelada';
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  solicitante_id: number;
  aprobador_id?: number;
  monto_estimado?: number;
  monto_real?: number;
  observaciones?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  proyecto_nombre?: string;
  solicitante_nombre?: string;
  aprobador_nombre?: string;
  items_count?: number;
}

export interface RequisicionItem {
  id: number;
  requisicion_id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario_estimado?: number;
  precio_unitario_real?: number;
  observaciones?: string;
}

// ============================================
// EQUIPOS
// ============================================

export interface Equipo {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  marca?: string;
  modelo?: string;
  año?: number;
  estado: 'disponible' | 'en_uso' | 'mantenimiento' | 'fuera_servicio';
  ubicacion_actual?: string;
  propietario: 'propio' | 'alquilado' | 'subcontratado';
  costo_hora?: number;
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface Asignacion {
  id: number;
  equipo_id: number;
  project_id: number;
  fecha_asignacion: string;
  fecha_devolucion?: string;
  estado: 'activa' | 'finalizada' | 'cancelada';
  operador?: string;
  observaciones?: string;
  // Joined fields
  equipo_nombre?: string;
  equipo_codigo?: string;
  proyecto_nombre?: string;
}

export interface RegistroUso {
  id: number;
  asignacion_id: number;
  fecha: string;
  horas_trabajadas: number;
  combustible_litros?: number;
  horometro_inicio?: number;
  horometro_fin?: number;
  observaciones?: string;
}

// ============================================
// BITÁCORA
// ============================================

export interface BitacoraEntry {
  id: number;
  project_id: number;
  titulo: string;
  contenido: string;
  tipo: 'general' | 'avance' | 'problema' | 'decision' | 'reunion';
  fecha_entrada: string;
  autor_id: number;
  clima?: string;
  personal_presente?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  autor_nombre?: string;
  comments_count?: number;
  attachment_count?: number;
  attachments?: BitacoraAttachment[];
}

export interface BitacoraComment {
  id: number;
  entry_id: number;
  autor_id: number;
  contenido: string;
  created_at: string;
  // Joined fields
  autor_nombre?: string;
  attachments?: BitacoraAttachment[];
}

export interface BitacoraAttachment {
  id: number;
  entry_id?: number;
  comment_id?: number;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  created_at: string;
}

// ============================================
// TODOS / TASKS
// ============================================

export interface ProjectTodo {
  id: number;
  project_id: number;
  titulo: string;
  descripcion?: string;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
  prioridad: 'baja' | 'media' | 'alta';
  fecha_limite?: string;
  fecha_completado?: string;
  asignado_a?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  asignado_nombre?: string;
  creador_nombre?: string;
}

// ============================================
// CLIENTES
// ============================================

export interface Cliente {
  id: number;
  nombre: string;
  tipo: 'empresa' | 'gobierno' | 'particular';
  ruc?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  contacto_principal?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// EXTERNAL CONTACTS
// ============================================

export interface ExternalContact {
  id: number;
  nombre: string;
  empresa?: string;
  cargo?: string;
  telefono?: string;
  email?: string;
  tipo: 'proveedor' | 'subcontratista' | 'consultor' | 'cliente' | 'otro';
  activo: boolean;
  created_at: string;
  updated_at: string;
}
