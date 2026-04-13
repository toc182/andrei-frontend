// Estado badge for solicitudes-pago.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Behavior is identical to the original getEstadoBadge() — no visual changes.

import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  Clock,
  Send,
  CreditCard,
  FileCheck,
  Ban,
  ArrowRightLeft,
} from 'lucide-react';

interface BadgeConfig {
  variant: 'secondary' | 'outline' | 'default' | 'destructive';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VARIANTS: Record<string, BadgeConfig> = {
  borrador: { variant: 'secondary', label: 'Borrador', icon: Clock },
  pendiente: { variant: 'outline', label: 'Pendiente', icon: Send },
  aprobada: { variant: 'default', label: 'Aprobada', icon: Check },
  rechazada: { variant: 'destructive', label: 'Rechazada', icon: X },
  pagada: { variant: 'default', label: 'Pagada', icon: CreditCard },
  facturada: { variant: 'default', label: 'Facturada', icon: FileCheck },
  reembolsada: { variant: 'default', label: 'Reembolsada', icon: CreditCard },
  transferida: { variant: 'default', label: 'Transferida', icon: ArrowRightLeft },
  devolucion: { variant: 'outline', label: 'Devolución', icon: Ban },
};

const COLOR_OVERRIDES: Record<string, string> = {
  pendiente: ' bg-yellow-100 text-yellow-800 border border-yellow-300',
  pagada: ' bg-green-600 text-white',
  facturada: ' bg-blue-600 text-white',
  reembolsada: ' bg-blue-600 text-white',
  transferida: ' bg-teal-600 text-white',
  devolucion: ' bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
};

interface EstadoBadgeProps {
  estado: string;
  esMiTurno?: boolean;
}

export function EstadoBadge({ estado, esMiTurno }: EstadoBadgeProps) {
  const config = VARIANTS[estado] || {
    variant: 'secondary' as const,
    label: estado,
    icon: Clock,
  };
  const Icon = config.icon;

  let extraClass = COLOR_OVERRIDES[estado] || '';
  if (estado === 'pendiente' && esMiTurno) {
    extraClass = ' bg-white text-yellow-800 border border-yellow-300';
  }

  return (
    <Badge
      variant={config.variant}
      className={`flex items-center gap-1 w-fit${extraClass}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
