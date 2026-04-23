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
    return <Badge className={`bg-slate-100 text-slate-600 border-slate-200 border ${className}`}>{estado}</Badge>;
  }
  return (
    <Badge className={`${cfg.className} ${className}`}>
      {cfg.label}
    </Badge>
  );
}
