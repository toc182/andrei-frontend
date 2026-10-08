import { ChevronDown, CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CLASE_MARCA, CLASE_MARCA_SELECTOR, ETIQUETA_MARCA, MARCAS } from './formato';
import type { Marca, Prioridad } from './tipos';

/**
 * La prioridad: un ícono rojo para urgente y uno verde para normal, las dos con
 * su palabra (Ivan, 2026-10-02: «una con badge y otra con texto» no).
 */
export function PrioridadEtiqueta({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-slate-700', className)}>
      {prioridad === 'urgente' ? (
        <TriangleAlert className="h-3.5 w-3.5 text-error" aria-hidden />
      ) : (
        <Clock className="h-3.5 w-3.5 text-success" aria-hidden />
      )}
      {prioridad === 'urgente' ? 'Urgente' : 'Normal'}
    </span>
  );
}

export function MarcaBadge({ marca }: { marca: Marca }) {
  return <Badge className={CLASE_MARCA[marca]}>{ETIQUETA_MARCA[marca]}</Badge>;
}

/**
 * La marca de una línea cuando la pone Compras: la misma etiqueta, con una
 * flecha que abre las cuatro. Cambia al escoger, sin botón de guardar.
 */
export function MarcaSelector({
  marca,
  onCambiar,
  ocupado,
  titulo,
  opciones = MARCAS,
}: {
  marca: Marca;
  onCambiar: (m: Marca) => void;
  ocupado?: boolean;
  /** Quién la marcó y cuándo, al pasar el ratón. */
  titulo?: string;
  /** Las que se pueden escoger; por omisión, las cuatro. */
  opciones?: Marca[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          title={titulo}
          aria-label={`Marca: ${ETIQUETA_MARCA[marca]}`}
          className={cn(
            'h-6 gap-1 pl-2 pr-1.5 text-xs font-semibold [&_svg]:size-3.5',
            CLASE_MARCA[marca],
            CLASE_MARCA_SELECTOR[marca],
          )}
        >
          {ETIQUETA_MARCA[marca]}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={marca} onValueChange={(v) => v !== marca && onCambiar(v as Marca)}>
          {opciones.map((m) => (
            <DropdownMenuRadioItem key={m} value={m}>
              {ETIQUETA_MARCA[m]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EstadoBadge({ estado }: { estado: 'por_aprobar' | 'aprobada' | 'anulada' }) {
  if (estado === 'aprobada') {
    return (
      <Badge className="bg-success/10 text-success border-success/30 border">
        <CircleCheck className="mr-1 h-3 w-3" />
        Aprobada
      </Badge>
    );
  }
  if (estado === 'anulada') {
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">Anulada</Badge>;
  }
  return <Badge className="bg-warning/10 text-warning border-warning/30 border">Por aprobar</Badge>;
}
