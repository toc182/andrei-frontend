import { Badge } from '@/components/ui/badge';
import type { CuentaEstado } from '@/types/api';
import { ESTADO_CONFIG } from './config';

interface Props {
  estado: CuentaEstado | string;
  className?: string;
}

export default function CuentaEstadoBadge({ estado, className = '' }: Props) {
  const cfg = ESTADO_CONFIG[estado as CuentaEstado];
  if (!cfg) {
    return <Badge variant="outline" className={className}>{estado}</Badge>;
  }
  return (
    <Badge variant={cfg.variant} className={`${cfg.className} ${className}`}>
      {cfg.label}
    </Badge>
  );
}
