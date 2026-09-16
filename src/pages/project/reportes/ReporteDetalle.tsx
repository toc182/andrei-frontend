/**
 * Un reporte diario ya guardado. Solo lectura.
 *
 * No lleva hilo de comentarios: se decidió que los reportes se leen, no se
 * discuten dentro del sistema.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, Pencil, Send, Trash2, Loader2 } from 'lucide-react';
import api from '@/services/api';
import {
  Alert, ErrorState, PageHeader, SectionHeader, TableSkeleton,
} from '@/components/shell';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { type Reporte, clasesClima, fechaLarga } from './tipos';
import SeccionCorrecciones from './SeccionCorrecciones';

interface Props {
  projectId: number;
  reporteId: number;
  onVolver: () => void;
  onEditar: (r: Reporte) => void;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{children}</div>
    </div>
  );
}

/**
 * Las filas de Personal o Equipo en solo lectura, agrupadas por empresa.
 * El titulo del grupo solo aparece cuando hay mas de uno: con una sola
 * cuadrilla, el nombre propio seria una etiqueta de mas.
 */
function FilasLeidas({
  filas,
  propio,
}: {
  filas: { clave: string; grupo: string | null; nombre: string; valor: string }[];
  /** El titulo del grupo sin empresa: «Pinellas», o el consorcio. */
  propio: string;
}) {
  const grupos = [...new Set(filas.map((f) => f.grupo))];
  return (
    // Con tope de ancho: alinear los valores exige una columna fija, y sin
    // tope esa columna se va al borde de la pantalla.
    <div className="max-w-[26rem] space-y-3">
      {grupos.map((g) => (
        <div key={g ?? 'propio'}>
          {grupos.length > 1 && (
            <div className="pb-1 text-xs font-bold uppercase tracking-wide text-primary">
              {g ?? propio}
            </div>
          )}
          {filas.filter((f) => f.grupo === g).map((f) => (
            <div
              key={f.clave}
              className="flex items-baseline justify-between border-b border-slate-100 py-1.5 last:border-0"
            >
              <span className="text-[15px]">{f.nombre}</span>
              <span className="text-[15px] font-medium tabular-nums">{f.valor}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Texto({ etiqueta, valor, vacio }: { etiqueta: string; valor: string | null; vacio: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      {valor ? (
        <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed">{valor}</p>
      ) : (
        <p className="mt-0.5 text-[15px] italic text-muted-foreground">{vacio}</p>
      )}
    </div>
  );
}

export default function ReporteDetalle({ projectId, reporteId, onVolver, onEditar }: Props) {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [dandoBaja, setDandoBaja] = useState(false);

  const { user } = useAuth();
  const puedeDarDeBaja = user?.rol === 'admin' || user?.rol === 'co-admin';

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    api
      .get(`/proyecto-reportes/${projectId}/${reporteId}`)
      .then((r) => setReporte(r.data.data))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [projectId, reporteId]);

  useEffect(cargar, [cargar]);

  // El PDF se pide con el token puesto y se abre desde memoria: un enlace
  // pelado llegaría sin autenticación y el servidor lo rechazaría.
  const descargar = async () => {
    setBajando(true);
    try {
      const r = await api.get(`/proyecto-reportes/${projectId}/${reporteId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setBajando(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      await api.post(`/proyecto-reportes/${projectId}/${reporteId}/emitir`);
      // El correo es asunto del servidor: aqui solo se dice que ya salio de
      // sus manos, que es lo unico que le incumbe a quien lo manda.
      toast.success('Reporte enviado');
      cargar();
    } catch {
      toast.error('No se pudo enviar el reporte');
    } finally {
      setEnviando(false);
    }
  };

  // Por dentro es una baja logica —la fila y los PDF archivados sobreviven—
  // pero en pantalla se llama «Eliminar», que es lo que el usuario cree que
  // esta haciendo. No cambiar el texto por «dar de baja»: la diferencia es de
  // la maquina, no suya.
  const darDeBaja = async () => {
    setDandoBaja(true);
    try {
      await api.delete(`/proyecto-reportes/${projectId}/${reporteId}`);
      toast.success('Reporte eliminado');
      onVolver();
    } catch {
      toast.error('No se pudo eliminar el reporte');
      setDandoBaja(false);
      setConfirmandoBaja(false);
    }
  };

  if (cargando) return <Table><TableSkeleton rows={6} columns={4} /></Table>;
  if (error || !reporte) return <ErrorState onRetry={cargar} />;

  // Los reportes nuevos suman sus filas; los viejos, que no tienen ninguna,
  // siguen contando con los dos números de antes.
  const total = reporte.personal.length
    ? reporte.personal.reduce((n, f) => n + Number(f.cantidad), 0)
    : reporte.personal_calificado + reporte.ayudantes;
  const horas = reporte.horas_perdidas ? Number(reporte.horas_perdidas) : 0;

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
          title={fechaLarga(reporte.fecha)}
          subtitle={`${reporte.numero} · ${reporte.creador_nombre} · ${total} en obra · ${reporte.fotos.length} fotos`}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={descargar} disabled={bajando}>
            {bajando
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            PDF
          </Button>
          {reporte.puede_editar && (
            <Button variant="outline" size="sm" onClick={() => onEditar(reporte)}>
              <Pencil className="mr-2 h-4 w-4" /> Corregir
            </Button>
          )}
          {puedeDarDeBaja && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmandoBaja(true)}
              className="text-error hover:bg-error/10 hover:text-error"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* Solo cuando de verdad no salió.
          El envío lo hace el servidor por su cuenta y puede tardar un minuto
          en arrancar; mientras va en camino, envio_proximo_intento trae fecha
          y aquí no se dice nada. Avisar durante ese minuto sería alarmar por
          algo que está funcionando, que es la clase de mentira que este
          rediseño vino a quitar. */}
      {!reporte.enviado_at
        && !reporte.envio_proximo_intento
        && reporte.puede_editar && (
        <Alert
          variant="warning"
          title="Este reporte no se ha enviado por correo"
          description="Puede haber pasado si se cerró la página mientras subían las fotos."
          actions={
            <Button size="sm" onClick={enviar} disabled={enviando}>
              {enviando
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
              Enviar ahora
            </Button>
          }
        />
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="space-y-4 p-4">
          <SectionHeader title="Del día" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Clima</div>
              <Badge variant="outline" className={`mt-1 ${clasesClima(reporte.clima)}`}>
                {reporte.clima}
              </Badge>
            </div>
            <Dato etiqueta="Horas perdidas">
              {horas > 0 ? <span className="text-warning">{horas}</span> : '0'}
            </Dato>
            <Dato etiqueta="Personal">{total}</Dato>
          </div>
          {reporte.motivo && (
            <Texto etiqueta="Motivo" valor={reporte.motivo} vacio="" />
          )}
        </div>

        <div className="space-y-4 border-t border-border p-4">
          <SectionHeader title="Trabajo ejecutado" />
          {reporte.areas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {reporte.areas.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full border border-primary bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                >
                  {a.nombre}
                </span>
              ))}
            </div>
          )}
          <Texto etiqueta="Trabajo ejecutado" valor={reporte.que_se_hizo} vacio="—" />
          <Texto etiqueta="Atrasos o impedimentos" valor={reporte.atrasos} vacio="Sin atrasos reportados" />
          <Texto etiqueta="Novedades del día" valor={reporte.novedades} vacio="Sin novedades" />
        </div>

        {/* A dos columnas en pantalla ancha, como el formulario y el PDF:
            Personal a la izquierda, Equipo y Entregas a la derecha. Solo se
            pinta lo que el reporte tiene. */}
        {(reporte.personal.length > 0
          || reporte.equipos.length > 0
          || reporte.entregas.length > 0) && (
          <div className="border-t border-border md:grid md:grid-cols-2">
            {reporte.personal.length > 0 && (
              <div className="space-y-3 p-4 md:border-r md:border-border">
                <SectionHeader title="Personal" />
                <FilasLeidas
                  filas={reporte.personal.map((f) => ({
                    clave: `p${f.puesto_id}`,
                    grupo: f.empresa_nombre,
                    nombre: f.nombre,
                    valor: String(f.cantidad),
                  }))}
                  propio={reporte.nombre_propio}
                />
                <div className="flex max-w-[26rem] items-baseline justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">Total en obra</span>
                  <span className="font-bold tabular-nums">{total}</span>
                </div>
              </div>
            )}

            <div>
              {reporte.equipos.length > 0 && (
                <div className="space-y-3 border-t border-border p-4 md:border-t-0">
                  <SectionHeader title="Equipo" />
                  <FilasLeidas
                    filas={reporte.equipos.map((f) => ({
                      clave: `e${f.equipo_id}`,
                      grupo: null,
                      nombre: f.nombre,
                      valor: `${Number(f.unidades)} u · ${Number(f.horas)} h`,
                    }))}
                    propio={reporte.nombre_propio}
                  />
                </div>
              )}

              {reporte.entregas.length > 0 && (
                <div className="space-y-3 border-t border-border p-4">
                  <SectionHeader title="Entregas" />
                  <div className="max-w-[30rem]">
                    {reporte.entregas.map((f, i) => (
                      <div
                        key={`${f.descripcion}-${i}`}
                        className="flex items-baseline gap-2 border-b border-slate-100 py-1.5 last:border-0"
                      >
                        <span className="text-[15px] font-medium">{f.descripcion}</span>
                        <span className="text-xs text-muted-foreground">
                          {f.categoria.toLowerCase()}
                        </span>
                        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                          {[f.cantidad, f.unidad].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Los reportes de antes de las filas conservan su lista de texto. */}
        {reporte.personal.length === 0 && reporte.equipo.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Equipo" />
            <div className="flex flex-wrap gap-2">
              {reporte.equipo.map((e) => (
                <span
                  key={e}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {reporte.fotos.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title={`Fotos · ${reporte.fotos.length}`} />
            {/* Cada foto con su número y su leyenda debajo, como en el PDF. El
                número es el que usa Correcciones («Leyenda de la foto 3»). */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {reporte.fotos.map((f, i) => (
                <figure key={f.id} className="min-w-0">
                  <a
                    href={f.url} target="_blank" rel="noreferrer"
                    className="block overflow-hidden rounded border border-border"
                  >
                    <img
                      src={f.url} alt={f.leyenda ?? `Foto ${i + 1}`} loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105"
                    />
                  </a>
                  <figcaption className="mt-1.5 break-words text-[13px] leading-snug text-slate-700">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                    {f.leyenda && ` ${f.leyenda}`}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {reporte.correcciones.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <SectionHeader title="Correcciones" />
            <SeccionCorrecciones correcciones={reporte.correcciones} />
          </div>
        )}
      </div>

      <AlertDialog open={confirmandoBaja} onOpenChange={setConfirmandoBaja}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este reporte?</AlertDialogTitle>
            <AlertDialogDescription>
              El reporte <strong>{reporte.numero}</strong> desaparecerá de la lista
              y no se podrá abrir ni enviar. El PDF que ya salió por correo se
              conserva. Queda registrado a tu nombre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dandoBaja}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={darDeBaja}
              disabled={dandoBaja}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {dandoBaja && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
