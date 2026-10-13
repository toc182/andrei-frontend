import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { es } from "react-day-picker/locale";
import { fecha } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function parseYMD(s: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return undefined;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Seleccionar fecha",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseYMD(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start bg-card font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {value ? fecha(value, placeholder) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatYMD(d));
              setOpen(false);
            } else {
              onChange("");
            }
          }}
          defaultMonth={selected}
          // Todos los meses con 6 semanas: sin esto el calendario cambia de
          // alto según el mes (5 o 6 filas) y el popover se reacomoda solo al
          // pasar de mes, saltando arriba y abajo bajo el cursor.
          fixedWeeks
          // Meses y días en español; la semana sigue empezando en domingo,
          // como antes (el español de date-fns la empieza en lunes).
          locale={es}
          weekStartsOn={0}
          className="bg-transparent"
        />
      </PopoverContent>
    </Popover>
  );
}
