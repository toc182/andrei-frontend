// Estado badge for solicitudes-pago — tinted pattern per FRONTEND_CONVENTIONS §21.1
// Labels: aprobada → "Por pagar", transferida → "Verificada"

import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  Clock,
  CreditCard,
  FileCheck,
  ShieldCheck,
  Undo2,
} from 'lucide-react';

interface BadgeConfig {
  className: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const VARIANTS: Record<string, BadgeConfig> = {
  borrador: { className: 'bg-slate-100 text-slate-600 border-slate-200 border', label: 'Borrador' },
  pendiente: { className: 'bg-warning/10 text-warning border-warning/30 border', label: 'Pendiente', icon: Clock },
  aprobada: { className: 'bg-warning/10 text-warning border-warning/30 border', label: 'Por pagar' },
  rechazada: { className: 'bg-error/10 text-error border-error/30 border', label: 'Rechazada', icon: X },
  pagada: { className: 'bg-success/10 text-success border-success/30 border', label: 'Pagada', icon: Check },
  facturada: { className: 'bg-info/10 text-info border-info/30 border', label: 'Facturada', icon: FileCheck },
  reembolsada: { className: 'bg-info/10 text-info border-info/30 border', label: 'Reembolsada', icon: CreditCard },
  transferida: { className: 'bg-info/10 text-info border-info/30 border', label: 'Verificada', icon: ShieldCheck },
  devolucion: { className: 'bg-slate-100 text-slate-600 border-slate-200 border', label: 'Devolución', icon: Undo2 },
};

interface EstadoBadgeProps {
  estado: string;
  esMiTurno?: boolean;
}

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const config = VARIANTS[estado] || {
    className: 'bg-slate-100 text-slate-600 border-slate-200 border',
    label: estado,
  };
  const Icon = config.icon;

  return (
    <Badge className={`flex items-center gap-1 w-fit ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
