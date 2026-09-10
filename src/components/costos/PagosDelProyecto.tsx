// PagosDelProyecto — la lista de solicitudes de pago YA PAGADAS del proyecto, y
// el sitio donde se le pone PARTIDA a cada una.
//
// Es la tercera pestana de Control de Costos y sale del mismo resumen que la
// curva: ese endpoint ya devuelve las pagadas una por una, ordenadas de la mas
// reciente a la mas vieja, asi que no hace falta pedirlas aparte.
//
// Los mismos pagos que suman "Gastado hasta hoy": estado pagada o facturada, y
// la fecha es la del comprobante de pago (si no hay, la de la solicitud).
//
// La partida se escoge EN LA MISMA FILA. Sin partida no es un error: es la
// bandeja de pendientes, y por eso el filtro de arriba nace en «Sin partida» en
// cuanto hay alguno — es el trabajo que queda por hacer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, EmptyState, ErrorState, TableSkeleton } from '@/components/shell';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import SelectorPartida, { DiferenciaPartida, EtiquetaPartida } from './SelectorPartida';
import RepartoPartidasDialog from './RepartoPartidasDialog';
import DetallePagoDialog from './DetallePagoDialog';
import AsistentePagos from './AsistentePagos';
import BarraPropuesta from './BarraPropuesta';
import {
  getPartidas, getResumenCostos, guardarPartidasDePago,
  type Partida, type ResumenSolicitud, type Seccion,
} from '@/lib/costosApi';
import {
  aplicarPropuesta, getEstadoAsistente, type Propuesta,
} from '@/lib/asistentePagosApi';

const TH = 'px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

/** Un pago cuenta como pendiente si no tiene lineas, o si la unica que tiene
 *  apunta a una fila que ya no esta en el desglose. */
const sinPartida = (p: ResumenSolicitud) =>
  p.partidas.length === 0 || p.partidas.every((x) => x.item == null);

interface PagosDelProyectoProps {
  projectId: number;
  /** Salida a la pantalla de Solicitudes de Pago, desde el detalle de un pago. */
  onAbrirSolicitudes?: () => void;
}

export default function PagosDelProyecto({ projectId, onAbrirSolicitudes }: PagosDelProyectoProps) {
  const [pagos, setPagos] = useState<ResumenSolicitud[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [hayPresupuesto, setHayPresupuesto] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Se entra viendo TODOS los pagos: la lista completa es la que se mira a
  // diario. «Sin partida» es un filtro que se pide, no el estado de entrada.
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [repartiendo, setRepartiendo] = useState<ResumenSolicitud | null>(null);
  const [mirando, setMirando] = useState<number | null>(null);

  // El asistente. La propuesta vive AQUI, no en el panel: lo que se marca son
  // las filas de esta tabla, y el boton de aplicar esta encima de ella.
  const [hayAsistente, setHayAsistente] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [errorPropuesta, setErrorPropuesta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [resumen, disponibles] = await Promise.all([
        getResumenCostos(projectId),
        getPartidas(projectId),
      ]);
      setPagos(resumen.solicitudes);
      setPartidas(disponibles.partidas);
      setSecciones(disponibles.secciones ?? []);
      setHayPresupuesto(disponibles.presupuestoId != null);
    } catch (err) {
      console.error('Error cargando los pagos del proyecto:', err);
      setError('No se pudieron cargar los pagos.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Si no hay llave puesta en el servidor, el panel no se ensena: mejor que no
  // aparezca a que aparezca y falle al primer intento.
  useEffect(() => {
    getEstadoAsistente().then(setHayAsistente).catch(() => setHayAsistente(false));
  }, []);

  /** Una propuesta nueva llega con todos sus cambios marcados. Soltar los que
   *  no convencen es el caso raro, no el normal. */
  const recibirPropuesta = useCallback((p: Propuesta | null) => {
    setPropuesta(p);
    setErrorPropuesta(null);
    setSeleccionados(new Set(p ? p.cambios.map((c) => c.solicitudId) : []));
  }, []);

  const cambiosPorPago = useMemo(() => {
    const m = new Map<number, Propuesta['cambios'][number]>();
    for (const c of propuesta?.cambios ?? []) m.set(c.solicitudId, c);
    return m;
  }, [propuesta]);

  const aplicar = async () => {
    if (!propuesta) return;
    const marcados = propuesta.cambios.filter((c) => seleccionados.has(c.solicitudId));
    if (marcados.length === 0) return;
    try {
      setAplicando(true);
      setErrorPropuesta(null);
      const aplicados = await aplicarPropuesta(projectId, propuesta.id, marcados);
      // Las filas se ponen al dia en su sitio, sin recargar la lista entera:
      // asi se ve lo que acaba de cambiar sin perder donde estabas.
      setPagos((prev) => prev.map((p) => {
        const hecho = aplicados.find((a) => a.solicitudId === p.id);
        return hecho ? { ...p, partidas: hecho.partidas } : p;
      }));
      setPropuesta(null);
      setSeleccionados(new Set());
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorPropuesta(e.response?.data?.message ?? 'No se pudieron aplicar los cambios.');
    } finally {
      setAplicando(false);
    }
  };

  const pendientes = useMemo(() => pagos.filter(sinPartida).length, [pagos]);
  const visibles = useMemo(
    () => (soloPendientes ? pagos.filter(sinPartida) : pagos),
    [pagos, soloPendientes],
  );
  const total = visibles.reduce((s, p) => s + p.monto, 0);

  /** Guarda el reparto de un pago y lo deja al dia en la lista, sin recargarla
   *  entera: la fila se queda donde esta y se ve lo que acaba de cambiar. */
  const guardar = useCallback(async (
    pagoId: number,
    lineas: { rowUid: string; monto: number }[],
  ) => {
    const guardadas = await guardarPartidasDePago(projectId, pagoId, lineas);
    setPagos((prev) => prev.map((p) => (p.id === pagoId ? { ...p, partidas: guardadas } : p)));
  }, [projectId]);

  const escogerUna = async (pago: ResumenSolicitud, rowUid: string) => {
    try {
      // Escoger una sola partida le echa el pago entero: repartirlo es el otro
      // camino, el del cuadro.
      await guardar(pago.id, [{ rowUid, monto: pago.monto }]);
    } catch (err) {
      console.error('Error asignando la partida del pago:', err);
      setError('No se pudo guardar la partida de ese pago.');
    }
  };

  /** Devolver el pago a cero. Lista vacia = sin clasificar, que es un estado
   *  bueno: el pago vuelve a la bandeja de pendientes y alguien decide luego. */
  const eliminarTodas = async (pago: ResumenSolicitud) => {
    try {
      await guardar(pago.id, []);
    } catch (err) {
      console.error('Error quitando las partidas del pago:', err);
      setError('No se pudieron quitar las partidas de ese pago.');
    }
  };

  return (
    <>
      {/* La tabla manda; el asistente va al lado. Debajo de 2xl el panel baja,
          que en una pantalla angosta la tabla no cabe partida en dos.
          El corte va en 2xl y no en lg porque el panel se lleva 376px: a 1280
          la tabla se quedaba en 584 y la columna de Proveedor desaparecia. */}
      <div className={cn('grid items-start gap-4', hayAsistente && '2xl:grid-cols-[1fr_360px]')}>
      <div className="min-w-0 space-y-3">
      {propuesta && (
        <BarraPropuesta
          cambios={propuesta.cambios}
          seleccionados={seleccionados}
          aplicando={aplicando}
          onAplicar={aplicar}
          onDescartar={() => recibirPropuesta(null)}
        />
      )}
      {errorPropuesta && <Alert variant="error" title={errorPropuesta} />}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <Table><TableSkeleton columns={5} /></Table>
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : pagos.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Todavía no hay pagos"
            description="Aquí aparecen las solicitudes de pago del proyecto en cuanto se marcan como pagadas."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <Button
                variant={soloPendientes ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setSoloPendientes(true)}
              >
                Sin partida · {pendientes}
              </Button>
              <Button
                variant={soloPendientes ? 'outline' : 'default'}
                size="sm"
                className="h-8"
                onClick={() => setSoloPendientes(false)}
              >
                Todos · {pagos.length}
              </Button>
            </div>

            {!hayPresupuesto && (
              <div className="border-b border-border px-4 py-3">
                <Alert
                  variant="info"
                  title="Este proyecto todavía no tiene presupuesto oficial"
                  description="Las partidas salen del presupuesto marcado con la estrella, así que hasta que exista no hay nada que asignar."
                />
              </div>
            )}

            {/* Movil: tarjetas. Escritorio: tabla. */}
            <div className="divide-y divide-slate-100 md:hidden">
              {visibles.map((p) => (
                <div key={p.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setMirando(p.id)}
                    className="flex w-full items-baseline justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.proveedor ?? 'Sin proveedor'}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.numero ?? '—'} · {formatDate(p.fecha)}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-sm tabular-nums text-slate-700">
                      {formatMoney(p.monto)}
                    </div>
                  </button>
                  <div className="mt-2">
                    <SelectorPartida
                      partidas={partidas}
                      asignadas={p.partidas}
                      disabled={!hayPresupuesto}
                      onEscoger={(rowUid) => escogerUna(p, rowUid)}
                      onRepartir={() => setRepartiendo(p)}
                      onEliminarTodas={() => eliminarTodas(p)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              {/* min-w: por debajo de esto el contenedor hace scroll. Apretar
                  mas no cabe, y lo que pasaba antes era que una columna se
                  aplastaba hasta desaparecer en vez de avisar. */}
              <Table className="min-w-[700px] table-fixed">
                <TableHeader>
                  <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                    {/* La columna de casillas solo existe mientras hay una
                        propuesta en pantalla. */}
                    {propuesta && <TableHead className="w-[38px] px-0" />}
                    {/* Proveedor es la columna que se lee, asi que es la que
                        lleva porcentaje; Partida se queda con lo que sobre. Al
                        reves —Partida con un 45% fijo— Proveedor recibia las
                        migajas y desaparecia en cuanto la pantalla se achicaba.
                        Las tres fijas miden lo que mide su texto, ni un px mas. */}
                    <TableHead className={`${TH} w-[84px] whitespace-nowrap`}>Número</TableHead>
                    <TableHead className={`${TH} w-[30%]`}>Proveedor</TableHead>
                    <TableHead className={`${TH} w-[92px] whitespace-nowrap`}>Pagado</TableHead>
                    <TableHead className={`${TH} w-[128px] whitespace-nowrap text-right`}>Monto</TableHead>
                    <TableHead className={TH}>Partida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((p) => {
                    const cambio = cambiosPorPago.get(p.id);
                    const marcado = cambio != null && seleccionados.has(p.id);
                    return (
                    <TableRow
                      key={p.id}
                      onClick={() => setMirando(p.id)}
                      className={cn(
                        'cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60',
                        marcado && 'bg-info/[0.06] shadow-[inset_3px_0_0_var(--color-info)] hover:bg-info/[0.09]',
                        cambio && !marcado && 'opacity-50',
                      )}
                    >
                      {propuesta && (
                        <TableCell className="px-0 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {cambio && (
                            <Checkbox
                              checked={marcado}
                              onCheckedChange={(v) => setSeleccionados((prev) => {
                                const s = new Set(prev);
                                if (v) s.add(p.id); else s.delete(p.id);
                                return s;
                              })}
                              aria-label={`Aplicar el cambio de ${p.numero ?? p.id}`}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="truncate px-2.5 py-2 text-sm font-medium text-foreground">
                        {p.numero ?? '—'}
                      </TableCell>
                      <TableCell className="truncate px-2.5 py-2 text-sm text-slate-700">
                        {p.proveedor ?? 'Sin proveedor'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-2 text-sm text-slate-700">
                        {formatDate(p.fecha)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-2 text-right text-sm tabular-nums text-slate-700">
                        {formatMoney(p.monto)}
                      </TableCell>
                      {/* La casilla de Partida abre su desplegable, no el
                          detalle: la fila entera navega y esta celda no puede
                          arrastrarla consigo. */}
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        {cambio ? (
                          <DiferenciaPartida antes={cambio.antes} despues={cambio.despues} />
                        ) : hayPresupuesto ? (
                          <SelectorPartida
                            partidas={partidas}
                            asignadas={p.partidas}
                            onEscoger={(rowUid) => escogerUna(p, rowUid)}
                            onRepartir={() => setRepartiendo(p)}
                            onEliminarTodas={() => eliminarTodas(p)}
                          />
                        ) : (
                          <div className="px-1.5 py-1">
                            <EtiquetaPartida asignadas={p.partidas} />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>{visibles.length === 1 ? '1 pago' : `${visibles.length} pagos`}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
          </>
        )}
      </Card>
      </div>

      {hayAsistente && (
        /* Se queda pegado arriba mientras bajas por la tabla: la conversacion
           y las filas que va marcando se miran a la vez. */
        <div className="lg:sticky lg:top-4">
          <AsistentePagos
            projectId={projectId}
            propuesta={propuesta}
            onPropuesta={recibirPropuesta}
          />
        </div>
      )}
      </div>

      <RepartoPartidasDialog
        open={repartiendo !== null}
        onOpenChange={(o) => { if (!o) setRepartiendo(null); }}
        pago={repartiendo}
        partidas={partidas}
        secciones={secciones}
        onGuardar={async (lineas) => {
          if (repartiendo) await guardar(repartiendo.id, lineas);
        }}
      />

      <DetallePagoDialog
        open={mirando !== null}
        onOpenChange={(o) => { if (!o) setMirando(null); }}
        solicitudId={mirando}
        onAbrirSolicitudes={onAbrirSolicitudes}
      />
    </>
  );
}
