// Small icon button shown next to "proveedor" in the solicitudes table.
// Click opens a popover with the mensaje + author. Two visual states:
// MessageSquareDot (current user hasn't seen the latest version) vs
// MessageSquare (already read). Opening the popover marks it read.

import { useState } from 'react';
import { MessageSquare, MessageSquareDot } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MensajeIconPopoverProps {
  mensaje: string;
  autorNombre: string | null;
  leido: boolean;
  solicitudId: number;
  onMarkRead: (id: number) => void;
}

export function MensajeIconPopover({
  mensaje,
  autorNombre,
  leido,
  solicitudId,
  onMarkRead,
}: MensajeIconPopoverProps) {
  const [open, setOpen] = useState(false);
  const Icon = leido ? MessageSquare : MessageSquareDot;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !leido) onMarkRead(solicitudId);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded p-1 text-info hover:bg-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40"
          aria-label="Ver mensaje"
        >
          <Icon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-semibold">
          {autorNombre ?? 'Usuario eliminado'}:
        </span>{' '}
        <span className="whitespace-pre-wrap break-words">{mensaje}</span>
      </PopoverContent>
    </Popover>
  );
}
