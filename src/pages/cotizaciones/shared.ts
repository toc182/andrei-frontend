// Shared non-component helpers for the Cotizaciones module. Kept in a
// .ts file (no JSX exports) so react-refresh stays happy. The TipoBadge
// component lives in components/TipoBadge.tsx.

import type { CotizacionTipo, CotizacionAmbito } from '@/types/api';

export const TIPO_LABEL: Record<CotizacionTipo, string> = {
  producto: 'Producto',
  servicio: 'Servicio',
};

export const AMBITO_LABEL: Record<CotizacionAmbito, string> = {
  oficina: 'Oficina',
  otros: 'Otros',
};

export function formatFecha(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// For a project-tied quote, show the project name. Otherwise fall back to
// the ambito label (Oficina / Otros). Legacy rows with neither default to
// Oficina.
export function proyectoLabel(
  nombre: string | null,
  ambito: CotizacionAmbito | null = null,
): string {
  if (nombre) return nombre;
  if (ambito) return AMBITO_LABEL[ambito];
  return 'Oficina';
}
