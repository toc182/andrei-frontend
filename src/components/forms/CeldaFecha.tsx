import { useRef, useState } from 'react';
import { CalendarIcon, CircleAlert } from 'lucide-react';
import { es } from 'react-day-picker/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fecha } from '@/lib/fechas';
import { leerCelda, type FechaDeCelda } from '@/lib/fechasPegadas';

interface CeldaFechaProps {
  valor: FechaDeCelda;
  onCambio: (v: FechaDeCelda) => void;
  /** Un pegado de varias celdas: lo reparte la tabla, que sabe a qué filas y columnas va. */
  onPegarVarias?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  /** La fila ya tiene datos y le falta la fecha: sin ella no se guardaría. */
  falta?: boolean;
  className?: string;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * La fecha en una tabla donde se escribe o se pega desde Excel (caja menuda). Se
 * escribe como sea —«07/10/2026», «7-oct-26»— y se muestra «07/oct/2026»; un clic
 * abre el calendario. Lo que no se puede leer se queda en rojo, tal como se pegó,
 * en vez de borrarse: así nadie guarda la fila creyendo que tenía fecha.
 */
export function CeldaFecha({ valor, onCambio, onPegarVarias, falta, className }: CeldaFechaProps) {
  // null = no se está escribiendo; se muestra la fecha ya leída.
  const [texto, setTexto] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const celda = useRef<HTMLDivElement>(null);

  const mostrado = valor.cruda ?? fecha(valor.fecha, '');
  const mal = Boolean(valor.cruda) || Boolean(falta);
  const terminar = () => {
    if (texto === null) return;
    onCambio(leerCelda(texto));
    setTexto(null);
  };
  const elegida = valor.fecha ? new Date(`${valor.fecha}T00:00:00`) : undefined;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverAnchor asChild>
        <div
          ref={celda}
          className={cn('flex min-w-0 items-center gap-1.5 pl-2 pr-1.5', mal && 'bg-error/10 text-error', className)}
          title={valor.cruda ? `${valor.cruda}: ${valor.motivo}` : falta ? 'Falta la fecha' : undefined}
        >
          <input
            className="min-w-0 flex-1 bg-transparent py-2 text-sm tabular-nums outline-none placeholder:text-muted-foreground"
            placeholder="dd/mmm/aaaa"
            aria-label="Fecha"
            aria-invalid={mal || undefined}
            value={texto ?? mostrado}
            onFocus={() => setTexto(mostrado)}
            onClick={() => setAbierto(true)}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={terminar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                terminar();
                setAbierto(false);
              }
            }}
            onPaste={(e) => {
              const pegado = e.clipboardData.getData('text');
              // Excel deja un salto de línea al final aun con una sola celda.
              if (/[\t\n]/.test(pegado.replace(/\r?\n$/, ''))) {
                // Se deja de escribir: si no, al salir de la celda se leería lo que había
                // antes del pegado y se borraría la fecha que acaba de llegar.
                setTexto(null);
                onPegarVarias?.(e);
                return;
              }
              e.preventDefault();
              setTexto(null);
              onCambio(leerCelda(pegado));
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Abrir calendario"
            className={cn('shrink-0 rounded p-0.5', mal ? 'text-error' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setAbierto((v) => !v)}
          >
            {valor.cruda ? <CircleAlert className="h-3.5 w-3.5" /> : <CalendarIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        // El foco se queda en la celda: se puede seguir escribiendo con el calendario abierto.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (celda.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <Calendar
          mode="single"
          selected={elegida}
          defaultMonth={elegida}
          onSelect={(d) => {
            if (!d) return;
            setTexto(null);
            onCambio({ fecha: ymd(d) });
            setAbierto(false);
          }}
          fixedWeeks
          locale={es}
          weekStartsOn={0}
          className="bg-transparent"
        />
      </PopoverContent>
    </Popover>
  );
}
