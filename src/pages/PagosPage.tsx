/**
 * Pagos: la sección donde vive todo lo que Pinellas le debe a alguien.
 *
 * Dos pestañas, porque son dos papeles distintos con dos vidas distintas: una
 * solicitud de pago se mira por dónde va en las aprobaciones; una orden de
 * compra, por cuánto ha llegado y cuándo hay que pagarlo. En una sola lista la
 * mitad de las columnas quedaría vacía en la mitad de las filas.
 *
 * El botón de alta vive ARRIBA, en el encabezado, y cambia con la pestaña: el
 * encabezado es donde se busca la acción de una página, no suelto debajo de los
 * tabs.
 *
 * Quien solo tiene una de las dos llaves no ve pestañas: ve su lista y ya.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useVolverAlSitio } from '@/hooks/useVolverAlSitio';
import SolicitudesPagoGeneral from './SolicitudesPagoGeneral';
import OrdenesTab from './pagos/OrdenesTab';
import OrdenDetallePage from './pagos/OrdenDetalle';
import OrdenFormDialog from './pagos/dialogs/OrdenFormDialog';
import { ProjectSelectorDialog } from './solicitudes/dialogs/ProjectSelectorDialog';

interface Props {
  onNavigate?: (view: string) => void;
}

interface ProyectoOpcion {
  id: number;
  nombre: string;
  nombre_corto?: string;
}

export default function PagosPage({ onNavigate }: Props) {
  const { user, hasPermission } = useAuth();
  const verSolicitudes = hasPermission('solicitudes_ver');
  const verOrdenes = hasPermission('ordenes_ver');

  const [pestana, setPestana] = useState(verSolicitudes ? 'solicitudes' : 'ordenes');
  // Las solicitudes traen mucho: se montan la primera vez que se abren y se
  // quedan montadas, para no repetir la carga ni perder los filtros.
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({
    [verSolicitudes ? 'solicitudes' : 'ordenes']: true,
  });

  const [ordenAbierta, setOrdenAbierta] = useState<number | null>(null);
  const [recargar, setRecargar] = useState(0);

  const [proyectos, setProyectos] = useState<ProyectoOpcion[]>([]);
  const [eligiendoProyecto, setEligiendoProyecto] = useState(false);
  const [proyectoElegido, setProyectoElegido] = useState<number | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);

  // El alta de una solicitud la dispara su propia vista; aquí solo se guarda el
  // disparador para poder ponerlo en el encabezado.
  const [abrirSolicitud, setAbrirSolicitud] = useState<(() => void) | null>(null);
  const recibirAccion = useCallback((abrir: () => void) => setAbrirSolicitud(() => abrir), []);

  useEffect(() => {
    if (!verOrdenes) return;
    api
      .get('/projects')
      .then((r) => setProyectos(r.data.proyectos ?? r.data.data ?? []))
      .catch(() => setProyectos([]));
  }, [verOrdenes]);

  const nuevaOrden = () => {
    // Una orden es de UN proyecto: primero se elige, como en las solicitudes.
    setProyectoElegido(null);
    setEligiendoProyecto(true);
  };

  const cambiarPestana = (v: string) => {
    setPestana(v);
    setAbiertas((a) => ({ ...a, [v]: true }));
  };

  // La orden se abre ENCIMA de la lista, que se queda montada y escondida: al
  // volver está como se dejó —pestaña, búsqueda, página y hasta dónde estaba
  // bajada— sin pasar por ninguna carga (Ivan, 01/10).
  const tapada = ordenAbierta !== null;
  const { ref: listaRef, salir } = useVolverAlSitio(tapada);
  const abrirOrden = (id: number) => {
    salir();
    setOrdenAbierta(id);
  };

  const listaOrdenes = (
    <OrdenesTab
      puedeCrear={verOrdenes}
      recargar={recargar}
      onAbrirOrden={abrirOrden}
      onNuevaOrden={nuevaOrden}
    />
  );

  const listaSolicitudes = (
    <SolicitudesPagoGeneral onNavigate={onNavigate} enPestana onAccionNueva={recibirAccion} />
  );

  const accion =
    pestana === 'ordenes'
      ? verOrdenes && (
          <Button onClick={nuevaOrden}>
            <Plus className="mr-2 h-4 w-4" />
            Orden de compra
          </Button>
        )
      : abrirSolicitud && (
          <Button onClick={abrirSolicitud}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        );

  const dialogos = verOrdenes && (
    <>
      <ProjectSelectorDialog
        open={eligiendoProyecto}
        onOpenChange={setEligiendoProyecto}
        proyectos={proyectos}
        onProjectSelected={(id) => {
          setProyectoElegido(Number(id));
          setEligiendoProyecto(false);
          setFormAbierto(true);
        }}
        checkingApprovers={false}
        selectorNoApprovers={false}
        selectedProjectId={proyectoElegido}
        onNavigateToMiembros={(pid) => {
          setEligiendoProyecto(false);
          onNavigate?.(`project-${pid}-miembros`);
        }}
      />
      <OrdenFormDialog
        open={formAbierto}
        onOpenChange={setFormAbierto}
        proyectoId={proyectoElegido}
        proyectoNombre={
          proyectos.find((p) => p.id === proyectoElegido)?.nombre_corto ??
          proyectos.find((p) => p.id === proyectoElegido)?.nombre
        }
        esAdmin={user?.rol === 'admin'}
        onListo={(id) => {
          setRecargar((n) => n + 1);
          abrirOrden(id);
        }}
      />
    </>
  );

  // Con una sola llave no hay nada que escoger: la pestaña sobra.
  const cuerpo =
    verSolicitudes && verOrdenes ? (
      <Tabs value={pestana} onValueChange={cambiarPestana}>
        <TabsList className="mb-6 w-full justify-center">
          <TabsTrigger value="solicitudes">Solicitudes de pago</TabsTrigger>
          <TabsTrigger value="ordenes">Órdenes de compra</TabsTrigger>
        </TabsList>

        {abiertas.solicitudes && (
          <TabsContent
            value="solicitudes"
            forceMount
            className={cn('space-y-6', pestana !== 'solicitudes' && 'hidden')}
          >
            {listaSolicitudes}
          </TabsContent>
        )}

        {abiertas.ordenes && (
          <TabsContent
            value="ordenes"
            forceMount
            className={cn('space-y-6', pestana !== 'ordenes' && 'hidden')}
          >
            {listaOrdenes}
          </TabsContent>
        )}
      </Tabs>
    ) : verOrdenes ? (
      listaOrdenes
    ) : (
      listaSolicitudes
    );

  return (
    <>
      {ordenAbierta !== null && (
        <OrdenDetallePage
          key={ordenAbierta}
          ordenId={ordenAbierta}
          onVolver={() => setOrdenAbierta(null)}
          onCambio={() => setRecargar((n) => n + 1)}
        />
      )}
      <div ref={listaRef} className={cn('space-y-6', tapada && 'hidden')}>
        <PageHeader title="Pagos" subtitle="Vista consolidada de todos los proyectos">
          {accion}
        </PageHeader>
        {cuerpo}
        {dialogos}
      </div>
    </>
  );
}
