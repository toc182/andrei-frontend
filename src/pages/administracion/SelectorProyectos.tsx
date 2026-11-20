// «Proyectos» de la persona: un desplegable con «Todos los proyectos» arriba
// (Ivan, 2026-10-07). «Todos» es acceso_global; la lista es user_project_access,
// y se conserva aunque esté «Todos», como hasta ahora.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ProyectoOpcion } from './tipos';

interface Props {
  proyectos: ProyectoOpcion[];
  todos: boolean;
  elegidos: number[];
  onCambiar: (todos: boolean, elegidos: number[]) => void;
  /** Gerencia entra a todos los proyectos: no se elige. */
  fijoEnTodos?: boolean;
}

function textoProyectos(proyectos: ProyectoOpcion[], todos: boolean, elegidos: number[]): string {
  if (todos) return 'Todos los proyectos';
  const nombres = proyectos.filter((p) => elegidos.includes(p.id)).map((p) => p.nombre);
  return nombres.length ? nombres.join(', ') : 'Ningún proyecto';
}

export function SelectorProyectos({ proyectos, todos, elegidos, onCambiar, fijoEnTodos = false }: Props) {
  const [abierto, setAbierto] = useState(false);
  const boton =
    'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm';

  if (fijoEnTodos) {
    return (
      <div className={cn(boton, 'cursor-default bg-muted text-muted-foreground')}>Todos los proyectos</div>
    );
  }

  const alternar = (id: number) =>
    onCambiar(todos, elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(boton, 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}>
          <span className="truncate">{textoProyectos(proyectos, todos, elegidos)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-1">
        <label className="flex cursor-pointer items-start gap-2 rounded-sm border-b border-border px-2 py-2 hover:bg-muted">
          <Checkbox checked={todos} onCheckedChange={() => onCambiar(!todos, elegidos)} className="mt-0.5" />
          <span className="text-sm">
            Todos los proyectos
            <span className="block text-xs text-muted-foreground">También los que se creen después.</span>
          </span>
        </label>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {proyectos.map((p) => {
            const marcado = todos || elegidos.includes(p.id);
            return (
              <label
                key={p.id}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  todos ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-muted',
                )}
              >
                <Checkbox checked={marcado} disabled={todos} onCheckedChange={() => alternar(p.id)} />
                <span className="truncate">{p.nombre}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
