// Monto — un importe con el símbolo a la izquierda y el número a la derecha.
//
// En una columna de dinero el "B/." tiene que quedar a plomo de arriba abajo
// (Ivan, 2026-09-10): con el texto entero alineado a la derecha, el símbolo se
// corre según el largo del número y la columna se lee torcida. Aquí el símbolo
// se ancla a la izquierda de la celda y el número a la derecha.

import { partesMoney } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface MontoProps {
  value: number | string | null | undefined;
  className?: string;
}

export function Monto({ value, className }: MontoProps) {
  const { simbolo, numero } = partesMoney(value);
  return (
    <span className={cn('flex items-baseline justify-between gap-2 tabular-nums', className)}>
      <span>{simbolo}</span>
      <span>{numero}</span>
    </span>
  );
}
