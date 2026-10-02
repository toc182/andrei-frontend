/**
 * Cómo se ve cada estado de una orden, y cómo se lee su vencimiento.
 *
 * Vive aparte porque lo usan la lista, la página de la orden y sus diálogos, y
 * un estado que se vea de dos colores distintos según la pantalla es un estado
 * que nadie entiende.
 */
import { Check, Clock, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EstadoOrden } from './tipos';
import { diasHasta } from './formato';

const PASTILLAS: Record<
  EstadoOrden,
  { etiqueta: string; clases: string; icono?: typeof Check }
> = {
  pendiente: {
    etiqueta: 'Pendiente',
    clases: 'bg-warning/10 text-warning border-warning/30',
  },
  rechazada: {
    etiqueta: 'Rechazada',
    clases: 'bg-error/10 text-error border-error/30',
  },
  // Por enviar es una espera, no una novedad: gris, para que no compita con lo
  // que sí necesita atención.
  por_enviar: {
    etiqueta: 'Por enviar',
    clases: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  enviada: {
    etiqueta: 'Enviada',
    clases: 'bg-teal/10 text-teal border-teal/30',
  },
  recibida: {
    etiqueta: 'Recibida',
    clases: 'bg-info/10 text-info border-info/30',
  },
  cerrada: {
    etiqueta: 'Cerrada',
    clases: 'bg-success/10 text-success border-success/30',
    icono: Check,
  },
  dada_de_baja: {
    etiqueta: 'Dada de baja',
    clases: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrden }) {
  const p = PASTILLAS[estado] ?? {
    etiqueta: estado,
    clases: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const Icono = p.icono;
  return (
    <Badge className={`border ${p.clases}`}>
      {Icono && <Icono className="h-3 w-3" />}
      {p.etiqueta}
    </Badge>
  );
}

/** La celda «Vence»: gris si falta, ámbar si aprieta, roja si ya pasó. */
export function VenceBadge({ vence }: { vence: string | null }) {
  if (!vence) return <span className="text-sm text-muted-foreground">—</span>;

  const dias = diasHasta(vence);

  if (dias < 0) {
    const d = Math.abs(dias);
    return (
      <Badge className="border bg-error/10 text-error border-error/30 font-bold">
        <TriangleAlert className="h-3 w-3" />
        hace {d} {d === 1 ? 'día' : 'días'}
      </Badge>
    );
  }
  if (dias <= 7) {
    return (
      <Badge className="border bg-warning/10 text-warning border-warning/30">
        <Clock className="h-3 w-3" />
        {dias === 0 ? 'hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`}
      </Badge>
    );
  }
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      en {dias} días
    </span>
  );
}
