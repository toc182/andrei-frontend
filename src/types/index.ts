/**
 * Types Index
 * Exporta todos los tipos para uso en la aplicación
 */

// Re-export all API types
export * from './api';

// ============================================
// COMPONENT PROP TYPES
// ============================================

import { ReactNode } from 'react';

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FormProps<T> extends ModalProps {
  onSave: (data: T) => Promise<void>;
  editingItem?: T | null;
}

// ============================================
// NAVIGATION
// ============================================

export type NavigationView =
  | 'dashboard'
  | 'projects'
  | 'clients'
  | 'documents'
  | 'requisiciones'
  | 'equipos-info'
  | 'equipos-status'
  | 'equipos-asignaciones'
  | `project-${number}-${string}`;

// ============================================
// FORM DATA TYPES
// ============================================

export interface ExpenseFormData {
  category_id: string;
  fecha: string;
  concepto: string;
  monto: string;
  descripcion: string;
  tipo_gasto: 'real' | 'compromiso' | 'estimado';
  moneda: string;
  aprobado: boolean;
}

export interface ProjectFormData {
  nombre: string;
  nombre_corto: string;
  codigo_proyecto: string;
  cliente_id: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin_estimada: string;
  presupuesto_base: string;
  contrato: string;
  acto_publico: string;
  es_consorcio: boolean;
  observaciones: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: Status;
  error: string | null;
}
