// Tinted badge for cotización tipo (producto = teal, servicio = info).

import { Badge } from '@/components/ui/badge';
import type { CotizacionTipo } from '@/types/api';
import { TIPO_LABEL } from '../shared';

export function TipoBadge({ tipo }: { tipo: CotizacionTipo | null }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;
  const cls =
    tipo === 'producto'
      ? 'bg-teal/10 text-teal border-teal/30 border'
      : 'bg-info/10 text-info border-info/30 border';
  return <Badge className={cls}>{TIPO_LABEL[tipo]}</Badge>;
}
