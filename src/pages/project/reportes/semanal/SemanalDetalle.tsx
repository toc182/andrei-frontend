/**
 * El reporte semanal ya enviado, en pantalla.
 *
 * Lee lo mismo que sale en el papel y en el mismo orden, con los números
 * congelados: un reporte enviado dice lo que dijo al salir, aunque después se
 * corrija un reporte diario de esa semana.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, Loader2, Pencil, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Alert, ErrorState, PageHeader, SectionHeader } from '@/components/shell';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import SeccionDatos from './SeccionDatos';
import SeccionCorrecciones from '../SeccionCorrecciones';
import type { Correccion } from '../tipos';
import { semanaLarga } from './fechas';
import { comoNumero, diaCorto, type Meta, type SemanalDetalle as Detalle } from './tipos';

const PUNTO: Record<string, string> = {
  completada: 'bg-success',
  parcial: 'bg-warning',
  no_completada: 'bg-error',
};

/** Cómo quedó una meta, en palabras: «38 de 45 m³» o «70 %». */
function avance(m: Meta): string | null {
  if (m.estado !== 'parcial') return null;
  const cantidad = comoNumero(m.cantidad);
  const hecho = comoNumero(m.cantidad_hecha);
  if (cantidad !== null && hecho !== null) {
    return `${hecho} de ${cantidad} ${m.unidad ?? ''}`.trim();
  }
  return m.porcentaje === null ? null : `${m.porcentaje} %`;
}

export default function SemanalDetalle({
  projectId, reporteId, onVolver, onPdf, bajandoPdf, onCorregir,
}: {
  projectId: number;
  reporteId: number;
  onVolver: () => void;
  onPdf: () => void;
  bajandoPdf: boolean;
  onCorregir: () => void;
}) {
  const { user } = useAuth();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    api
      .get(`/proyecto-reportes-semanales/${projectId}/${reporteId}`)
      .then((r) => setDetalle(r.data.data as Detalle))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [projectId, reporteId]);

  useEffect(cargar, [cargar]);

  const eliminar = async () => {
    setBorrando(true);
    try {
      await api.delete(`/proyecto-reportes-semanales/${projectId}/${reporteId}`);
      toast.success('Reporte eliminado');
      onVolver();
    } catch {
      toast.error('No se pudo eliminar el reporte');
    } finally {
      setBorrando(false);
      setConfirmar(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo el reporte…
      </div>
    );
  }
  if (error || !detalle) return <ErrorState onRetry={cargar} />;

  const esAdmin = user?.rol === 'admin' || user?.rol === 'co-admin';
  // Corrige quien lo escribió, o un admin: lo mismo que deja pasar el servidor.
  const puedeCorregir = esAdmin || user?.id === detalle.creado_por;
  // Las líneas vienen armadas del servidor, las mismas que imprime el PDF; la
  // sección es la del reporte diario, que ya las sabe dibujar.
  const correcciones: Correccion[] = detalle.correcciones.map((c) => ({
    id: c.id,
    created_at: c.created_at,
    usuario_nombre: c.quien,
    cambios: c.cambios as Correccion['cambios'],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onVolver}
          aria-label="Volver a reportes"
          className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title={`Semana ${detalle.semana_iso} · ${semanaLarga(detalle.semana_inicio, detalle.semana_fin)}`}
          subtitle={detalle.numero}
        >
          {puedeCorregir && (
            <Button variant="outline" size="sm" onClick={onCorregir}>
              <Pencil className="mr-2 h-4 w-4" /> Corregir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onPdf} disabled={bajandoPdf}>
            {bajandoPdf
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            PDF
          </Button>
          {esAdmin && (
            <Button variant="outline" size="sm" onClick={() => setConfirmar(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          )}
        </PageHeader>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="space-y-3 p-4">
          <SectionHeader title="Resumen de la semana" />
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {detalle.resumen ?? '—'}
          </p>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Datos de la semana" />
          <SeccionDatos datos={detalle.datos} />
        </div>

        {detalle.metas.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Metas de la semana" />
            <div>
              {detalle.metas.map((m) => (
                <div key={m.id} className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <span
                    className={`mt-1.5 h-3 w-3 flex-none rounded-full ${PUNTO[m.estado ?? ''] ?? 'bg-slate-200'}`}
                    title={m.estado ?? 'sin marcar'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {m.texto}
                      {m.fuera_del_plan && (
                        <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                          fuera del plan
                        </span>
                      )}
                    </span>
                    {avance(m) && (
                      <span className="block text-sm font-semibold tabular-nums text-slate-700">
                        {avance(m)}
                      </span>
                    )}
                    {m.motivo && (
                      <span className="block text-sm text-muted-foreground">{m.motivo}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detalle.problemas.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Problemas y atrasos" />
            <div className="space-y-3">
              {detalle.problemas.map((p) => (
                <div key={p.id} className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 md:grid-cols-[7rem_1fr_1fr] md:gap-3">
                  <span className="text-sm text-muted-foreground">
                    {p.fecha ? diaCorto(p.fecha) : 'Toda la semana'}
                  </span>
                  <span className="text-sm">{p.problema}</span>
                  <span className="text-sm text-slate-700">
                    {p.accion ?? <span className="text-muted-foreground">Sin acción anotada</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(detalle.lo_que_se_espera || detalle.metas_plan.length > 0) && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Plan de la próxima semana" />
            {detalle.lo_que_se_espera && (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{detalle.lo_que_se_espera}</p>
            )}
            <ul className="space-y-1.5">
              {detalle.metas_plan.map((m) => (
                <li key={m.id} className="flex justify-between gap-4 border-b border-slate-100 pb-1.5 text-sm last:border-0">
                  <span>{m.texto}</span>
                  <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {comoNumero(m.cantidad) === null ? '' : `${comoNumero(m.cantidad)} ${m.unidad ?? ''}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {detalle.decisiones.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Decisiones que se necesitan" />
            <ul className="space-y-1.5 text-sm">
              {detalle.decisiones.map((d) => (
                <li key={d.id} className="border-b border-slate-100 pb-1.5 last:border-0">{d.texto}</li>
              ))}
            </ul>
          </div>
        )}

        {detalle.fotos.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Fotos" count={detalle.fotos.length} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {detalle.fotos.map((f, i) => (
                <figure key={f.id} className="space-y-1">
                  <img
                    src={f.url}
                    alt={f.leyenda ?? `Foto ${i + 1}`}
                    className="aspect-square w-full rounded border border-border object-cover"
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {i + 1}. {f.leyenda ?? diaCorto(f.fecha)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>

      {correcciones.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="space-y-3 p-4">
            <SectionHeader title="Correcciones" count={correcciones.length} />
            <SeccionCorrecciones correcciones={correcciones} />
          </div>
        </div>
      )}

      {!detalle.completo && (
        <Alert
          variant="warning"
          title="Este reporte todavía no se ha enviado"
          description="Ábrelo desde «Nuevo reporte semanal» para terminarlo."
        />
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el reporte {detalle.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de verse en la lista y su semana vuelve a quedar abierta para los reportes
              diarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} disabled={borrando}>
              {borrando ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
