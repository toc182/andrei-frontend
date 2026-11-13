/**
 * «Tienes un … sin guardar»: lo que se le ofrece a quien vuelve a un formulario
 * que dejó a medias (lib/borradorLocal.ts). Seguirlo o descartarlo.
 *
 * Mockup aprobado por Ivan el 2026-09-14 para el reporte diario; el 2026-11-13
 * aprobó el mismo para la requisición. Los dos montan este.
 *
 * Hay que elegir: sin equis, sin cerrar con Escape ni tocando fuera. Si se
 * pudiera cerrar sin elegir, el formulario en blanco que queda debajo pisaría lo
 * guardado en cuanto se escribiera.
 */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface FilaAviso {
  etiqueta: string;
  valor: ReactNode;
  /** Cifras y fechas: con dígitos alineados. */
  numero?: boolean;
}

interface Props {
  /** «Tienes un reporte sin enviar». */
  titulo: string;
  /** «Quedó sin enviar»: lo que va antes de cuándo. */
  quedo: string;
  /** Cuándo se tocó por última vez, en ISO. */
  cuando: string;
  /** «Puedes seguir donde lo dejaste.» */
  invitacion: string;
  filas: FilaAviso[];
  /** El arranque de lo escrito, en una línea; se recorta aquí. */
  extracto?: string;
  /** «Descartarlo» / «Continuarlo», con el género de lo que es. */
  descartar: string;
  continuar: string;
  onDescartar: () => void;
  onContinuar: () => void;
}

/** «hoy a las 4:23 p. m.», «ayer a las…», «el 12/09 a las…». */
function cuandoFue(iso: string): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-PA', { hour: 'numeric', minute: '2-digit' });
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(new Date()) - dia(d)) / 86_400_000);
  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `ayer a las ${hora}`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `el ${p(d.getDate())}/${p(d.getMonth() + 1)} a las ${hora}`;
}

function arranque(texto: string, tope = 110): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= tope) return limpio;
  const corte = limpio.slice(0, tope);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > tope * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

export function AvisoSinGuardar({
  titulo, quedo, cuando, invitacion, filas, extracto, descartar, continuar, onDescartar, onContinuar,
}: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>
            {/* La hora en es-PA ya termina en punto («p. m.»): no se le añade otro. */}
            {quedo} {cuandoFue(cuando).replace(/\.?$/, '.')} {invitacion}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5 rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
          {filas.map((f) => (
            <div key={f.etiqueta} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{f.etiqueta}</span>
              <span className={f.numero ? 'text-right font-semibold tabular-nums' : 'text-right font-semibold'}>
                {f.valor}
              </span>
            </div>
          ))}
          {extracto?.trim() && (
            <p className="border-t border-border pt-1.5 text-slate-700">«{arranque(extracto)}»</p>
          )}
        </div>

        {/* Lado a lado también en el teléfono, como en el mockup: son dos
            opciones del mismo peso, no una acción y su cancelar. */}
        <AlertDialogFooter className="flex-row gap-2 sm:justify-between sm:space-x-0">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={onDescartar}>
            {descartar}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={onContinuar}>
            {continuar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
