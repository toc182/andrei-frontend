/**
 * Pagos de UN proyecto: las mismas dos pestañas de la vista consolidada, pero
 * mirando solo esta obra.
 *
 * Es deliberado que se vea igual que la general. Quien aprende a leer una de
 * las dos no tiene que aprender la otra, y la diferencia —que aquí no hay
 * columna de proyecto porque sobra— no cambia nada de cómo se usa.
 *
 * Aquí la orden no pregunta de qué proyecto es: ya se sabe.
 */
import { useCallback, useState } from 'react';
import { useVolverAlSitio } from '@/hooks/useVolverAlSitio';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import ProjectSolicitudesPago from './ProjectSolicitudesPago';
import OrdenesTab from '@/pages/pagos/OrdenesTab';
import OrdenDetallePage from '@/pages/pagos/OrdenDetalle';
import OrdenFormDialog from '@/pages/pagos/dialogs/OrdenFormDialog';

interface Props {
  projectId: number;
  projectName?: string;
  onNavigate?: (view: string) => void;
}

export default function ProjectPagos({ projectId, projectName, onNavigate }: Props) {
  const { user, hasPermission } = useAuth();
  const verSolicitudes = hasPermission('solicitudes_ver');
  const verOrdenes = hasPermission('ordenes_ver');

  const [pestana, setPestana] = useState(verSolicitudes ? 'solicitudes' : 'ordenes');
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({
    [verSolicitudes ? 'solicitudes' : 'ordenes']: true,
  });
  const [ordenAbierta, setOrdenAbierta] = useState<number | null>(null);
  const [recargar, setRecargar] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);

  const [abrirSolicitud, setAbrirSolicitud] = useState<(() => void) | null>(null);
  const recibirAccion = useCallback(
    (abrir: (() => void) | null) => setAbrirSolicitud(() => abrir),
    [],
  );

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
      proyectoId={projectId}
      recargar={recargar}
      onAbrirOrden={abrirOrden}
      onNuevaOrden={() => setFormAbierto(true)}
    />
  );

  const listaSolicitudes = (
    <ProjectSolicitudesPago
      projectId={projectId}
      onNavigate={onNavigate}
      enPestana
      onAccionNueva={recibirAccion}
    />
  );

  const accion =
    pestana === 'ordenes'
      ? verOrdenes && (
          <Button onClick={() => setFormAbierto(true)}>
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

  const dialogoOrden = verOrdenes && (
    <OrdenFormDialog
      open={formAbierto}
      onOpenChange={setFormAbierto}
      proyectoId={projectId}
      proyectoNombre={projectName}
      esAdmin={user?.rol === 'admin'}
      onListo={(id) => {
        setRecargar((n) => n + 1);
        abrirOrden(id);
      }}
    />
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
        <PageHeader title="Pagos">{accion}</PageHeader>
        {cuerpo}
        {dialogoOrden}
      </div>
    </>
  );
}
