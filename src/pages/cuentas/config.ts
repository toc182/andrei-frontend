import type { CuentaEstado } from '@/types/api';

// ── Estado display config ──────────────────────────────────────────────

export const ESTADO_CONFIG: Record<
  CuentaEstado,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  borrador: { label: 'Borrador', variant: 'outline', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  enviada: { label: 'Enviada', variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  observaciones: { label: 'Observaciones', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobada: { label: 'Aprobada', variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' },
  enviada_institucion: { label: 'Enviada a inst.', variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  observaciones_institucion: { label: 'Obs. institución', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobada_institucion: { label: 'Aprobada inst.', variant: 'outline', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  enviada_contraloria: { label: 'En Contraloría', variant: 'outline', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  observaciones_contraloria: { label: 'Obs. Contraloría', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobada_contraloria: { label: 'Aprobada Contraloría', variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' },
  pagada: { label: 'Pagada', variant: 'outline', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// Status for "current cuenta" (not yet in the system or borrador)
export const CURRENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  no_iniciada: { label: 'No iniciada', className: 'bg-gray-50 text-gray-400 border-gray-200' },
  borrador: { label: 'Borrador', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

// ── Transitions per flow ───────────────────────────────────────────────

export type CuentaFlow = 'privado' | 'publico_normal' | 'publico_ipt';

export function getFlow(clienteTipo?: string, tieneIpt?: boolean): CuentaFlow {
  if (clienteTipo === 'privado') return 'privado';
  if (tieneIpt) return 'publico_ipt';
  return 'publico_normal';
}

export const TRANSICIONES: Record<CuentaFlow, Partial<Record<CuentaEstado, { to: CuentaEstado; label: string }[]>>> = {
  privado: {
    borrador: [{ to: 'enviada', label: 'Enviar al cliente' }],
    enviada: [
      { to: 'observaciones', label: 'Registrar observaciones' },
      { to: 'aprobada', label: 'Marcar aprobada' },
    ],
    observaciones: [{ to: 'enviada', label: 'Reenviar al cliente' }],
    aprobada: [{ to: 'pagada', label: 'Marcar pagada' }],
  },
  publico_normal: {
    borrador: [{ to: 'enviada_institucion', label: 'Enviar a institución' }],
    enviada_institucion: [
      { to: 'observaciones_institucion', label: 'Registrar observaciones de institución' },
      { to: 'aprobada_institucion', label: 'Marcar aprobada por institución' },
    ],
    observaciones_institucion: [{ to: 'enviada_institucion', label: 'Reenviar a institución' }],
    aprobada_institucion: [{ to: 'enviada_contraloria', label: 'Enviar a Contraloría' }],
    enviada_contraloria: [
      { to: 'observaciones_contraloria', label: 'Registrar observaciones de Contraloría' },
      { to: 'aprobada_contraloria', label: 'Marcar aprobada por Contraloría' },
    ],
    observaciones_contraloria: [{ to: 'enviada_contraloria', label: 'Reenviar a Contraloría' }],
    aprobada_contraloria: [{ to: 'pagada', label: 'Marcar pagada' }],
  },
  publico_ipt: {
    borrador: [{ to: 'enviada_institucion', label: 'Enviar a institución' }],
    enviada_institucion: [
      { to: 'observaciones_institucion', label: 'Registrar observaciones de institución' },
      { to: 'aprobada_institucion', label: 'Marcar aprobada por institución' },
    ],
    observaciones_institucion: [{ to: 'enviada_institucion', label: 'Reenviar a institución' }],
    aprobada_institucion: [
      { to: 'observaciones_institucion', label: 'Reabrir (observaciones desde IPT)' },
      { to: 'pagada', label: 'Marcar pagada (requiere IPT aprobado)' },
    ],
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

export function formatMonto(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  return `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateExact(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  const dd = String(d.getDate()).padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}-${months[d.getMonth()]}-${yy}`;
}

// Returns { inicio, fin } strings for rendering with an arrow icon between them
export function formatPeriodoParts(inicio: string | null, fin: string | null): { inicio: string; fin: string } {
  return {
    inicio: inicio ? formatDateExact(inicio) : '',
    fin: fin ? formatDateExact(fin) : '',
  };
}

export function formatPeriodo(inicio: string | null, fin: string | null): string {
  if (!inicio && !fin) return '—';
  const i = inicio ? formatDateExact(inicio) : '';
  const f = fin ? formatDateExact(fin) : '';
  if (i && f) return `${i} → ${f}`;
  if (i) return `${i} →`;
  return f;
}

export function waitColor(days: number): string {
  if (days >= 30) return 'text-red-600 font-semibold';
  if (days >= 14) return 'text-orange-500 font-medium';
  if (days >= 7) return 'text-amber-600';
  return 'text-muted-foreground';
}

export function formatWait(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${days} días`;
}
