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

// ── Bucket picker (free-form estado picker) ────────────────────────────
//
// The TRANSICIONES map above describes the legacy linear flow, but it is
// no longer enforced. The "Cambiar estado" UI now shows a flat list of
// "places" (buckets) where the cuenta can be, per flow. Each bucket maps
// to one granular DB estado at submit time. The granular DB estado set
// stays the same so audit log, badges, and existing filters keep working.

export type Bucket =
  | 'borrador'
  | 'cliente'
  | 'contraloria'
  | 'por_subsanar'
  | 'aprobada'
  | 'pagada';

export function getBuckets(flow: CuentaFlow): Bucket[] {
  if (flow === 'privado') {
    return ['borrador', 'cliente', 'por_subsanar', 'aprobada', 'pagada'];
  }
  // publico_normal and publico_ipt — same 6-bucket shape.
  return [
    'borrador',
    'cliente',
    'contraloria',
    'por_subsanar',
    'aprobada',
    'pagada',
  ];
}

export function bucketLabel(bucket: Bucket, clienteLabel: string): string {
  switch (bucket) {
    case 'borrador':
      return 'Borrador';
    case 'cliente':
      return clienteLabel;
    case 'contraloria':
      return 'Contraloría';
    case 'por_subsanar':
      return 'Por Subsanar';
    case 'aprobada':
      return 'Aprobada';
    case 'pagada':
      return 'Pagada';
  }
}

export function bucketToEstado(
  bucket: Bucket,
  flow: CuentaFlow,
  currentEstado: CuentaEstado,
): CuentaEstado {
  switch (bucket) {
    case 'borrador':
      return 'borrador';
    case 'cliente':
      return flow === 'privado' ? 'enviada' : 'enviada_institucion';
    case 'contraloria':
      return 'enviada_contraloria';
    case 'por_subsanar':
      if (flow === 'privado') return 'observaciones';
      // Context-aware: if the cuenta was last at Contraloría, observations
      // come from there. Otherwise default to institución.
      if (
        currentEstado === 'enviada_contraloria' ||
        currentEstado === 'aprobada_contraloria' ||
        currentEstado === 'observaciones_contraloria'
      ) {
        return 'observaciones_contraloria';
      }
      return 'observaciones_institucion';
    case 'aprobada':
      if (flow === 'privado') return 'aprobada';
      if (flow === 'publico_ipt') return 'aprobada_institucion';
      return 'aprobada_contraloria';
    case 'pagada':
      return 'pagada';
  }
}

export function estadoToBucket(estado: CuentaEstado): Bucket {
  switch (estado) {
    case 'borrador':
      return 'borrador';
    case 'enviada':
    case 'enviada_institucion':
      return 'cliente';
    case 'enviada_contraloria':
      return 'contraloria';
    case 'observaciones':
    case 'observaciones_institucion':
    case 'observaciones_contraloria':
      return 'por_subsanar';
    case 'aprobada':
    case 'aprobada_institucion':
    case 'aprobada_contraloria':
      return 'aprobada';
    case 'pagada':
      return 'pagada';
  }
}

// Bucket-based badge colors. Borrador and Por Subsanar both represent
// "in the office" — Borrador is neutral (slate), Por Subsanar uses warning
// to signal "office action needed".
const BUCKET_BADGE_CLASS: Record<Bucket, string> = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200 border',
  cliente: 'bg-info/10 text-info border-info/30 border',
  por_subsanar: 'bg-warning/10 text-warning border-warning/30 border',
  contraloria: 'bg-navy/10 text-navy border-navy/30 border',
  aprobada: 'bg-success/10 text-success border-success/30 border',
  pagada: 'bg-teal/10 text-teal border-teal/30 border',
};

export function getBadgeDisplay(
  estado: CuentaEstado,
  clienteLabel?: string | null,
): { label: string; className: string } {
  const bucket = estadoToBucket(estado);
  const label = bucket === 'cliente'
    ? (clienteLabel?.trim() || 'Cliente')
    : bucketLabel(bucket, '');
  return { label, className: BUCKET_BADGE_CLASS[bucket] };
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function formatMonto(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  return `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Periodo fields come back as either "YYYY-MM-DD" (DATE column) or
// "YYYY-MM-DDT00:00:00.000Z" (DATE column auto-serialized by pg+Express).
// Both formats represent a calendar day, not an instant — but JS Date
// treats the "T00:00:00.000Z" form as UTC midnight, and getDate() then
// returns the previous day in negative-offset timezones. Parse the
// Y-M-D prefix directly so the calendar day is preserved.
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  return parseLocalDate(s).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateExact(s: string | null | undefined): string {
  if (!s) return '';
  const d = parseLocalDate(s);
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
