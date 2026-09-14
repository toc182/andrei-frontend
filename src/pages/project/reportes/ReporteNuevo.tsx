/**
 * «Nuevo reporte»: antes de abrir el formulario en blanco, mira si hay un
 * reporte que el ingeniero dejó sin enviar y le ofrece seguirlo.
 *
 * Lo sin enviar puede estar en dos sitios, y se combinan:
 * - en el teléfono (borradorLocal.ts): lo último que escribió, aunque nunca
 *   haya pulsado Guardar;
 * - en el servidor: el borrador que nace al pulsar Guardar, con las fotos que
 *   alcanzaron a subir.
 *
 * Si están los dos y son el mismo reporte, el texto sale del teléfono —es lo
 * más nuevo— y las fotos del servidor. Si el del teléfono apunta a otro
 * borrador, o a ninguno, manda el teléfono y el formulario creará un borrador
 * nuevo al guardar: el viejo se lo lleva el barrido de la madrugada.
 *
 * Mockup aprobado por Ivan el 2026-09-14.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ReporteForm from './ReporteForm';
import {
  type Semilla, borrarLocal, leerLocal, semillaDeReporte,
} from './borradorLocal';
import type { Foto, Reporte } from './tipos';

interface Props {
  projectId: number;
  onListo: () => void;
  onCancelar: () => void;
  onNumeroPrevisto?: (numero: string | null) => void;
}

interface SinEnviar {
  semilla: Semilla;
  fotos: Foto[];
  /** Cuándo se tocó por última vez, en ISO. */
  cuando: string;
  /** Los borradores del servidor que «Descartarlo» tiene que dar de baja. */
  descartar: number[];
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

function fechaDelReporte(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function arranque(texto: string, tope = 110): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= tope) return limpio;
  const corte = limpio.slice(0, tope);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > tope * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

export default function ReporteNuevo({
  projectId, onListo, onCancelar, onNumeroPrevisto,
}: Props) {
  const { user } = useAuth();
  const [fase, setFase] = useState<'buscando' | 'preguntando' | 'listo'>('buscando');
  const [sinEnviar, setSinEnviar] = useState<SinEnviar | null>(null);
  const [inicio, setInicio] = useState<{ semilla?: Semilla; fotos?: Foto[] }>({});

  useEffect(() => {
    if (!user) return;
    let vigente = true;
    const local = leerLocal(user.id, projectId);

    // Con tope de tiempo: en obra, con mala señal, esta consulta no puede dejar
    // al ingeniero mirando una pantalla vacía. Si no contesta, se sigue con lo
    // que haya en el teléfono.
    api
      .get(`/proyecto-reportes/${projectId}/borrador`, { timeout: 8000 })
      .then((r) => (r.data?.data ?? null) as Reporte | null)
      .catch(() => null)
      .then((servidor) => {
        if (!vigente) return;
        let hallado: SinEnviar | null = null;

        if (local) {
          const mismo = servidor !== null && local.borradorId === servidor.id;
          const { guardadoEn, ...semilla } = local;
          hallado = {
            semilla: { ...semilla, borradorId: mismo ? servidor.id : null },
            fotos: mismo ? servidor.fotos : [],
            cuando: guardadoEn,
            descartar: [local.borradorId, servidor?.id].filter(
              (x, i, xs): x is number => typeof x === 'number' && xs.indexOf(x) === i,
            ),
          };
        } else if (servidor) {
          hallado = {
            semilla: semillaDeReporte(servidor, servidor.id),
            fotos: servidor.fotos,
            cuando: servidor.updated_at ?? servidor.created_at,
            descartar: [servidor.id],
          };
        }

        setSinEnviar(hallado);
        setFase(hallado ? 'preguntando' : 'listo');
      });

    return () => {
      vigente = false;
    };
  }, [user, projectId]);

  const continuar = () => {
    if (!sinEnviar) return;
    setInicio({ semilla: sinEnviar.semilla, fotos: sinEnviar.fotos });
    setFase('listo');
  };

  const descartar = () => {
    if (!sinEnviar || !user) return;
    borrarLocal(user.id, projectId);
    // Sin esperar: si la baja no llega, el borrador vuelve a ofrecerse la
    // próxima vez y se puede descartar entonces. No vale la pena detener al
    // ingeniero por eso.
    for (const id of sinEnviar.descartar) {
      api.delete(`/proyecto-reportes/${projectId}/${id}/borrador`).catch(() => undefined);
    }
    setInicio({});
    setFase('listo');
  };

  if (fase === 'buscando') {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo el formulario…
      </div>
    );
  }

  if (fase === 'preguntando' && sinEnviar) {
    const fotos = sinEnviar.fotos.length;
    return (
      // Hay que elegir: sin equis, sin cerrar con Escape ni tocando fuera. Si se
      // pudiera cerrar sin elegir, el formulario en blanco que queda debajo
      // pisaría en el teléfono lo que quedó sin enviar en cuanto se escribiera.
      <AlertDialog open>
        <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes un reporte sin enviar</AlertDialogTitle>
            <AlertDialogDescription>
              {/* La hora en es-PA ya termina en punto («p. m.»): no se le añade otro. */}
              Quedó sin enviar {cuandoFue(sinEnviar.cuando).replace(/\.?$/, '.')} Puedes
              seguir donde lo dejaste.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Fecha del reporte</span>
              <span className="font-semibold tabular-nums">
                {fechaDelReporte(sinEnviar.semilla.fecha)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Fotos ya subidas</span>
              <span className="font-semibold tabular-nums">{fotos}</span>
            </div>
            {sinEnviar.semilla.queSeHizo.trim() && (
              <p className="border-t border-border pt-1.5 text-slate-700">
                «{arranque(sinEnviar.semilla.queSeHizo)}»
              </p>
            )}
          </div>

          {/* Lado a lado también en el teléfono, como en el mockup: son dos
              opciones del mismo peso, no una acción y su cancelar. */}
          <AlertDialogFooter className="flex-row gap-2 sm:justify-between sm:space-x-0">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={descartar}>
              Descartarlo
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={continuar}>
              Continuarlo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <ReporteForm
      projectId={projectId}
      semilla={inicio.semilla}
      fotosGuardadas={inicio.fotos}
      onCancelar={onCancelar}
      onListo={onListo}
      onNumeroPrevisto={onNumeroPrevisto}
    />
  );
}
