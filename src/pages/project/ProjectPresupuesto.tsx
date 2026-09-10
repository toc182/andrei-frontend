// ProjectPresupuesto — los presupuestos de un proyecto.
//
// Un proyecto tiene VARIOS presupuestos independientes: uno antes de la
// licitacion, otro despues de adjudicado, otro con los disenos listos. No son
// versiones encadenadas; cada uno se guarda tal como quedo. Uno es el OFICIAL,
// marcado con una estrella, y es contra el que compara el control de costos.
//
// Esta pantalla es la lista; al pinchar una fila se abre su hoja
// (PresupuestoHoja), que es donde se escriben los costos.
//
// Tabla-en-tarjeta con barra y pie, segun FRONTEND_CONVENTIONS.md §10. El
// ancho de las columnas es fijo (table-fixed): la estrella aparece y desaparece
// y los costos crecen al escribirlos, y nada de eso puede correr la tabla.

import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal, Plus, Star, Trash2, Wallet } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '@/utils/dateUtils';
import PresupuestoHoja, { type CabeceraHoja } from '@/components/presupuesto/PresupuestoHoja';
import PresupuestoHojaCero from '@/components/presupuesto/PresupuestoHojaCero';
import NuevoPresupuestoDialog from '@/components/presupuesto/NuevoPresupuestoDialog';
import {
  eliminarPresupuesto, getPresupuestos, marcarPrincipal,
  type DesgloseDisponible, type PresupuestoLista,
} from '@/lib/presupuestoApi';

const TH = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

interface ProjectPresupuestoProps {
  projectId: number;
  /** Cual presupuesto esta abierto en su hoja; null = la lista. Lo maneja la
   *  pantalla que contiene la pestana, porque el titulo de arriba pasa a ser el
   *  nombre del presupuesto y pinchar la pestana es lo que cierra la hoja. */
  abierto: number | null;
  onAbrir: (presupuestoId: number | null) => void;
  /** El cuadro de crear uno nuevo. Lo abre el boton que vive arriba, en la fila
   *  del titulo, junto con el resto de los botones de crear de la aplicacion. */
  creando: boolean;
  onCreando: (creando: boolean) => void;
  /** Lo que la hoja quiere en la cabecera de arriba: su nombre y el guardar. */
  onCabecera?: (cabecera: CabeceraHoja) => void;
}

export default function ProjectPresupuesto({
  projectId, abierto, onAbrir, creando, onCreando, onCabecera,
}: ProjectPresupuestoProps) {
  const [lista, setLista] = useState<PresupuestoLista[]>([]);
  const [desglose, setDesglose] = useState<DesgloseDisponible | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<PresupuestoLista | null>(null);
  // Como se armo el presupuesto que esta abierto y como se llama. Decide cual
  // de las dos hojas se pinta, y se sabe sin preguntarle al servidor: sale de
  // la fila que se pincho, o del que se acaba de crear —que todavia no esta en
  // `lista`, porque esta se recarga al volver.
  const [abiertoComo, setAbiertoComo] = useState<{ origen: 'desglose' | 'cero'; nombre: string }>(
    { origen: 'desglose', nombre: 'Presupuesto' },
  );

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPresupuestos(projectId);
      setLista(data.presupuestos);
      setDesglose(data.desglose);
    } catch (err) {
      console.error('Error cargando los presupuestos:', err);
      setError('No se pudieron cargar los presupuestos.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Carga al entrar y vuelve a cargar al cerrar una hoja, para que el costo de
  // la fila salga al dia despues de escribirlo.
  useEffect(() => { if (abierto == null) cargar(); }, [abierto, cargar]);

  const marcarOficial = async (id: number) => {
    try {
      setLista(await marcarPrincipal(projectId, id));
    } catch (err) {
      console.error('Error marcando el presupuesto oficial:', err);
    }
  };

  const borrar = async () => {
    if (!porBorrar) return;
    try {
      setLista(await eliminarPresupuesto(projectId, porBorrar.id));
    } catch (err) {
      console.error('Error eliminando el presupuesto:', err);
    } finally {
      setPorBorrar(null);
    }
  };

  // La hoja de uno concreto ocupa el sitio de la lista, dentro de la misma
  // pestana. Se sale pinchando «Presupuestos» arriba.
  if (abierto != null) {
    // Armado desde cero: es el editor del desglose, con su barra, su pegar
    // desde Excel y su propio Guardar. Copiado del desglose: la hoja de solo
    // costos, que reporta el guardar hacia la cabecera de arriba.
    if (abiertoComo.origen === 'cero') {
      return (
        <PresupuestoHojaCero
          projectId={projectId}
          presupuestoId={abierto}
          nombre={abiertoComo.nombre}
          onBack={() => onAbrir(null)}
        />
      );
    }
    return (
      <PresupuestoHoja
        projectId={projectId}
        presupuestoId={abierto}
        onCabecera={onCabecera}
      />
    );
  }

  // El mismo boton que arriba, repetido dentro del vacio: sin presupuestos, la
  // tarjeta es lo unico que se mira.
  const botonNuevo = (
    <Button onClick={() => onCreando(true)}>
      <Plus className="mr-2 h-4 w-4" />
      Nuevo presupuesto
    </Button>
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        {loading ? (
          <Table><TableSkeleton columns={4} /></Table>
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Este proyecto todavía no tiene presupuestos"
            description={
              desglose
                ? 'Empieza uno a partir del desglose del proyecto —trae los renglones con sus cantidades y tú escribes lo que te cuesta cada uno— o desde cero, con la hoja en blanco.'
                : 'Empieza uno desde cero: la hoja nace en blanco y tú escribes los renglones.'
            }
            action={botonNuevo}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                    <TableHead className="w-[44px] px-0" />
                    <TableHead className={TH}>Nombre</TableHead>
                    <TableHead className={`${TH} w-[140px] whitespace-nowrap`}>Creado</TableHead>
                    <TableHead className={`${TH} w-[160px] whitespace-nowrap text-right`}>Costo</TableHead>
                    <TableHead className="w-[52px] px-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((p) => (
                    <TableRow
                      key={p.id}
                      onClick={() => {
                        setAbiertoComo({ origen: p.origen, nombre: p.nombre });
                        onAbrir(p.id);
                      }}
                      className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                    >
                      {/* El oficial se marca SOLO con el simbolo: sin etiqueta y
                          sin fondo. La columna existe siempre, con o sin
                          estrella, para que la fila no se corra al marcarla. */}
                      <TableCell className="px-0 py-3 text-center">
                        {p.esPrincipal && (
                          <Star
                            className="mx-auto h-4 w-4 fill-teal text-teal"
                            aria-label="Presupuesto oficial"
                          />
                        )}
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 text-sm font-medium text-foreground">
                        {p.nombre}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                        {formatDate(p.creadoAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                        {formatMoney(p.costo)}
                      </TableCell>
                      <TableCell className="px-0 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            {/* La fila entera navega; el menu no puede
                                arrastrarla consigo. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Opciones del presupuesto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              disabled={p.esPrincipal}
                              onClick={() => marcarOficial(p.id)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Marcar como oficial
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-error focus:text-error"
                              onClick={() => setPorBorrar(p)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <NuevoPresupuestoDialog
        open={creando}
        onOpenChange={onCreando}
        projectId={projectId}
        desglose={desglose}
        onCreado={(p) => {
          setAbiertoComo({ origen: p.origen, nombre: p.nombre });
          onAbrir(p.id);
        }}
      />

      <AlertDialog open={porBorrar !== null} onOpenChange={(o) => { if (!o) setPorBorrar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{porBorrar?.nombre}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita de la lista con todos sus costos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar} className={buttonVariants({ variant: 'destructive' })}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
