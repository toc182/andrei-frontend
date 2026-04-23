import type { CuentaEstado } from '@/types/api';

// ── Estado display config ──────────────────────────────────────────────

export const ESTADO_CONFIG: Record<
  CuentaEstado,
  { label: string; className: string }
> = {
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-600 border-slate-200 border' },
  enviada: { label: 'Enviada', className: 'bg-info/10 text-info border-info/30 border' },
  observaciones: { label: 'Observaciones', className: 'bg-warning/10 text-warning border-warning/30 border' },
  aprobada: { label: 'Aprobada', className: 'bg-success/10 text-success border-success/30 border' },
  enviada_institucion: { label: 'Enviada a inst.', className: 'bg-info/10 text-info border-info/30 border' },
  observaciones_institucion: { label: 'Obs. institución', className: 'bg-warning/10 text-warning border-warning/30 border' },
  aprobada_institucion: { label: 'Aprobada inst.', className: 'bg-teal/10 text-teal border-teal/30 border' },
  enviada_contraloria: { label: 'En Contraloría', className: 'bg-navy/10 text-navy border-navy/30 border' },
  observaciones_contraloria: { label: 'Obs. Contraloría', className: 'bg-warning/10 text-warning border-warning/30 border' },
  aprobada_contraloria: { label: 'Aprobada Contraloría', className: 'bg-success/10 text-success border-success/30 border' },
  pagada: { label: 'Pagada', className: 'bg-slate-100 text-slate-600 border-slate-200 border' },
};

// Status for "current cuenta" (not yet in the system or borrador)
export const CURRENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  no_iniciada: { label: 'No iniciada', className: 'bg-slate-50 text-muted-foreground border-slate-200' },
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-600 border-slate-200 border' },
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
  if (days >= 30) return 'text-error font-semibold';
  if (days >= 14) return 'text-warning font-medium';
  if (days >= 7) return 'text-warning';
  return 'text-muted-foreground';
}

export function formatWait(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${days} días`;
}
