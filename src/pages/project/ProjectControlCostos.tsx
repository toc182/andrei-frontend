// ProjectControlCostos — una sola entrada del menu para Presupuesto y Costos.
//
// Antes eran dos entradas separadas y obligaban a saltar de una a otra: los
// presupuestos son la vara contra la que se mide el gasto. Ahora es una
// pantalla con pestanas, iguales a las de Informacion (shadcn Tabs, TabsList
// centrada debajo del titulo).
//
//   Control de Costos -> los tres numeros, la curva y el reparto (por defecto)
//   Presupuestos      -> la lista de presupuestos y la hoja de cada uno
//   Pagos             -> las solicitudes de pago ya pagadas
//
// Cada pestana monta su contenido al entrar y lo suelta al salir: volver de
// Presupuestos a Costos vuelve a pedir el resumen, que es justo lo que se
// quiere despues de escribir costos en una hoja.
//
// Con la hoja de un presupuesto abierta hay UNA sola cabecera, no dos: el
// titulo de arriba pasa a ser el nombre del presupuesto, su boton de guardar se
// pinta al lado, y las pestanas se quedan donde estan. Se sale pinchando
// «Presupuestos», que es la unica manera de volver a la lista — la hoja ya no
// trae flecha propia.

import { useCallback, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shell';
import ProjectCostos from './ProjectCostos';
import ProjectPresupuesto from './ProjectPresupuesto';
import PagosDelProyecto from '@/components/costos/PagosDelProyecto';
import { type CabeceraHoja } from '@/components/presupuesto/PresupuestoHoja';

type Pestana = 'costos' | 'presupuestos' | 'pagos';

interface ProjectControlCostosProps {
  projectId: number;
  /** Con que pestana abrir. Por defecto, el control de costos. */
  tabInicial?: Pestana;
  /** Para salir a otra pantalla del proyecto desde el detalle de un pago. */
  onNavigate?: (view: string) => void;
}

export default function ProjectControlCostos({
  projectId,
  tabInicial = 'costos',
  onNavigate,
}: ProjectControlCostosProps) {
  const [pestana, setPestana] = useState<Pestana>(tabInicial);
  const [presupuestoAbierto, setPresupuestoAbierto] = useState<number | null>(null);
  const [cabHoja, setCabHoja] = useState<CabeceraHoja | null>(null);
  const [creandoPresupuesto, setCreandoPresupuesto] = useState(false);

  const hojaAbierta = presupuestoAbierto != null;

  const cerrarHoja = useCallback(() => {
    setPresupuestoAbierto(null);
    setCabHoja(null);
  }, []);

  const abrirPresupuesto = useCallback((id: number | null) => {
    if (id == null) cerrarHoja();
    else setPresupuestoAbierto(id);
  }, [cerrarHoja]);

  // Estable: viaja hasta la hoja, que la usa como dependencia de su aviso.
  const recibirCabecera = useCallback((c: CabeceraHoja) => setCabHoja(c), []);

  // Salir de Presupuestos cierra la hoja: si no, el titulo de arriba seguiria
  // diciendo el nombre del presupuesto mientras se mira otra pestana.
  const cambiarPestana = (valor: Pestana) => {
    if (valor !== 'presupuestos') cerrarHoja();
    setPestana(valor);
  };

  // Los botones de la fila del titulo cambian con lo que se esta mirando: el
  // guardar de la hoja abierta, o el crear de la lista de presupuestos.
  const acciones = hojaAbierta
    ? cabHoja && (
        <Button onClick={cabHoja.guardar} disabled={!cabHoja.puedeGuardar}>
          <Save className="mr-2 h-4 w-4" />
          {cabHoja.guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      )
    : pestana === 'presupuestos' && (
        <Button onClick={() => setCreandoPresupuesto(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo presupuesto
        </Button>
      );

  return (
    <div className="space-y-6">
      {/* min-h-9, el alto de un boton: sin el, las pestanas suben y bajan 4px
          al cambiar de una a otra segun si la fila del titulo trae boton. */}
      {/* Una hoja armada desde cero trae su propio encabezado de sección con su
          nombre —es el editor del desglose—, así que arriba se queda el nombre
          de la pantalla, igual que en Información. Solo la hoja de costos, que
          no tiene encabezado propio, sube el suyo hasta aquí. */}
      <PageHeader
        className="min-h-9"
        title={cabHoja?.titulo ?? 'Control de Costos'}
      >
        {acciones || undefined}
      </PageHeader>

      <Tabs value={pestana} onValueChange={(v) => cambiarPestana(v as Pestana)}>
        <TabsList className="mb-6 w-full justify-center">
          <TabsTrigger value="costos">Control de Costos</TabsTrigger>
          {/* Con la hoja abierta la pestana ya esta activa, asi que Radix no
              dispara onValueChange: el onClick es lo que la cierra. */}
          <TabsTrigger value="presupuestos" onClick={() => { if (hojaAbierta) cerrarHoja(); }}>
            Presupuestos
          </TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        {/* mt-0 quita el margen por defecto de TabsContent: el aire ya lo pone
            el mb-6 de la barra de pestanas. */}
        <TabsContent value="costos" className="mt-0">
          <ProjectCostos
            projectId={projectId}
            onIrAPresupuestos={() => cambiarPestana('presupuestos')}
          />
        </TabsContent>

        <TabsContent value="presupuestos" className="mt-0">
          <ProjectPresupuesto
            projectId={projectId}
            abierto={presupuestoAbierto}
            onAbrir={abrirPresupuesto}
            creando={creandoPresupuesto}
            onCreando={setCreandoPresupuesto}
            onCabecera={recibirCabecera}
          />
        </TabsContent>

        <TabsContent value="pagos" className="mt-0">
          <PagosDelProyecto
            projectId={projectId}
            onAbrirSolicitudes={
              onNavigate ? () => onNavigate(`project-${projectId}-solicitudes-pago`) : undefined
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
