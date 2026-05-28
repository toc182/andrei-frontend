import { Badge } from '@/components/ui/badge';
import type { CuentaEstado } from '@/types/api';
import { getBadgeDisplay } from './config';

interface Props {
  estado: CuentaEstado | string;
  clienteLabel?: string | null;
  className?: string;
}

export default function CuentaEstadoBadge({ estado, clienteLabel, className = '' }: Props) {
  const display = getBadgeDisplay(estado as CuentaEstado, clienteLabel);
  return (
    <Badge className={`${display.className} ${className}`}>
      {display.label}
    </Badge>
  );
}
