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
 * El aviso que lo ofrece (mockup aprobado por Ivan el 2026-09-14) es el mismo
 * de la requisición: components/AvisoSinGuardar.tsx.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fecha } from '@/lib/fechas';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { AvisoSinGuardar } from '@/components/AvisoSinGuardar';
import ReporteForm from './ReporteForm';
import {
  type Semilla, borrarLocal, leerLocal, semillaDeReporte, trabajosDeSemilla,
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

/** Lo que se escribió del trabajo ejecutado, en una línea. */
const loEscrito = (s: Semilla) => trabajosDeSemilla(s).map((t) => t.texto).join(' · ');

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
    return (
      <AvisoSinGuardar
        titulo="Tienes un reporte sin enviar"
        quedo="Quedó sin enviar"
        cuando={sinEnviar.cuando}
        invitacion="Puedes seguir donde lo dejaste."
        filas={[
          { etiqueta: 'Fecha del reporte', valor: fecha(sinEnviar.semilla.fecha), numero: true },
          { etiqueta: 'Fotos ya subidas', valor: sinEnviar.fotos.length, numero: true },
        ]}
        // El arranque de lo escrito: los puntos por área, o el texto de un
        // reporte empezado antes de ese cambio.
        extracto={loEscrito(sinEnviar.semilla)}
        descartar="Descartarlo"
        continuar="Continuarlo"
        onDescartar={descartar}
        onContinuar={continuar}
      />
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
