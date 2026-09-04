// NumberCell — casilla numerica de las tablas del presupuesto.
//
// Va SIN control: el texto que se escribe es del input y solo se convierte a
// numero al salir de la casilla o al dar Enter. Controlarla por tecla rompia
// escribir "3.5", porque el "3." intermedio no es un numero y se colapsaba.
// La `key` de quien la usa (uid de la fila + de la columna) la vuelve a montar
// cuando el valor cambia por fuera.

import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cellInputClass, parseNumero } from './celdas';

interface NumberCellProps {
  value: number | null;
  onCommit: (value: number | null) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

export function NumberCell({ value, onCommit, className, placeholder, ariaLabel }: NumberCellProps) {
  const commited = useRef(value);
  const commit = (raw: string) => {
    const n = parseNumero(raw);
    if (n === commited.current) return; // no ensucia la hoja si no cambio nada
    commited.current = n;
    onCommit(n);
  };
  return (
    <Input
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      defaultValue={value ?? ''}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(cellInputClass, 'text-right tabular-nums', className)}
    />
  );
}