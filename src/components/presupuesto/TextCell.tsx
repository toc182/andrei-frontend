// TextCell — casilla de texto de la hoja de presupuesto.
//
// Mismo trato que NumberCell, y por la misma razon: va SIN control y el valor
// solo sube al salir de la casilla o al dar Enter. Controlarla por tecla vuelve
// a pintar la hoja entera en cada letra, y con 40 renglones eso se siente.
// La `key` de quien la usa la vuelve a montar cuando el valor cambia por fuera.

import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cellInputClass } from './celdas';

interface TextCellProps {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
}

export function TextCell({
  value, onCommit, className, placeholder, ariaLabel, maxLength,
}: TextCellProps) {
  const commited = useRef(value);
  const commit = (raw: string) => {
    const limpio = raw.trim();
    if (limpio === commited.current) return; // no ensucia la hoja si no cambio nada
    commited.current = limpio;
    onCommit(limpio);
  };
  return (
    <Input
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      defaultValue={value}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(cellInputClass, className)}
    />
  );
}
