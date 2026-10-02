/**
 * La pestaña «Órdenes de compra» de la sección Pagos.
 *
 * Es la lista de las compras a crédito de todos los proyectos que la persona
 * alcanza. Tres números arriba, un buscador y la tabla.
 *
 * Dos cosas que se decidieron mirando el mock y conviene no deshacer:
 *
 *   * No hay columna de saldo. El monto que se enseña es el acordado con el
 *     proveedor; lo que se debe hoy sale de las entregas y vive dentro de la
 *     orden, no en una columna que obligaría a explicar dos números parecidos.
 *   * Mientras la orden espera aprobación, en Estado van las iniciales de quien
 *     falta por firmar. «Pendiente» no dice de quién se está esperando.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, ShoppingCart } from 'lucide-react';
import api from '@/services/api';
import { recordado, recordar } from '@/lib/recordados';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ApprovalPillBar,
  EmptyState,
  ErrorState,
  StatCard,
  TableSkeleton,
} from '@/components/shell';
import { SolicitudesPagination } from '@/pages/solicitudes/components/SolicitudesPagination';
import { EstadoOrdenBadge, VenceBadge } from './estados';
import { fechaCorta, plata } from './formato';
import type { OrdenFila, ResumenOrdenes } from './tipos';

const TAMANOS = [25, 50, 100];

interface ListaOrdenes {
  ordenes: OrdenFila[];
  resumen: ResumenOrdenes | null;
}

interface Props {
  /** Dibuja el botón de alta aquí dentro. La página de Pagos lo pone en su
   *  encabezado y lo deja en false; una vista embebida sin encabezado propio lo
   *  pide en true. El de la pantalla vacía sale siempre: ahí es la única salida. */
  botonPropio?: boolean;
  puedeCrear: boolean;
  onAbrirOrden: (id: number) => void;
  onNuevaOrden: () => void;
  /** Sube cuando algo de afuera cambió una orden y hay que releer. */
  recargar?: number;
  /** Con un proyecto, solo salen sus órdenes. */
  proyectoId?: number;
}

export default function OrdenesTab({
  botonPropio = false,
  puedeCrear,
  onAbrirOrden,
  onNuevaOrden,
  recargar = 0,
  proyectoId,
}: Props) {
  // Si esta lista ya se trajo antes en la sesión, sale al instante con lo que
  // tenía y se refresca por detrás. El esqueleto queda solo para cuando no hay
  // nada que enseñar todavía.
  const clave = `ordenes:${proyectoId ?? 'todas'}`;
  const previa = recordado<ListaOrdenes>(clave);
  const [claveVista, setClaveVista] = useState(clave);
  const [ordenes, setOrdenes] = useState<OrdenFila[]>(previa?.ordenes ?? []);
  const [resumen, setResumen] = useState<ResumenOrdenes | null>(previa?.resumen ?? null);
  const [cargando, setCargando] = useState(!previa);
  const lenta = useCargaLenta(cargando);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(TAMANOS[0]);

  // Otro proyecto: las filas del anterior no pueden quedarse en pantalla ni un
  // instante mientras llegan las nuevas.
  if (claveVista !== clave) {
    setClaveVista(clave);
    setOrdenes(previa?.ordenes ?? []);
    setResumen(previa?.resumen ?? null);
    setCargando(!previa);
  }

  const traer = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(
        proyectoId ? `/ordenes-compra?proyecto_id=${proyectoId}` : '/ordenes-compra',
      );
      const lista: ListaOrdenes = {
        ordenes: res.data.data ?? [],
        resumen: res.data.resumen ?? null,
      };
      recordar(clave, lista);
      setOrdenes(lista.ordenes);
      setResumen(lista.resumen);
    } catch {
      setError('No se pudieron cargar las órdenes de compra');
    } finally {
      setCargando(false);
    }
  }, [clave, proyectoId]);

  useEffect(() => {
    void traer();
  }, [traer, recargar]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return ordenes;
    return ordenes.filter((o) =>
      [o.numero, o.proveedor, o.proyecto_nombre ?? '']
        .join(' ')
        .toLowerCase()
        .includes(t),
    );
  }, [ordenes, busqueda]);

  // La búsqueda cambia cuántas filas hay: quedarse en la página 7 de un
  // resultado de 3 filas enseña una tabla vacía que parece un error.
  useEffect(() => {
    setPagina(1);
  }, [busqueda, tamano]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamano));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const desde = (paginaSegura - 1) * tamano;
  const enPantalla = filtradas.slice(desde, desde + tamano);

  /** Abre el PDF de la orden. El token va en la dirección porque window.open no
   *  manda cabeceras, igual que en las solicitudes de pago. */
  const descargar = (ordenId: number) => {
    const token = localStorage.getItem('token');
    window.open(
      `${api.defaults.baseURL}/ordenes-compra/${ordenId}/pdf?token=${token ?? ''}`,
      '_blank',
    );
  };

  const botonNueva = puedeCrear ? (
    <Button onClick={onNuevaOrden}>
      <Plus className="h-4 w-4 mr-2" />
      Orden de compra
    </Button>
  ) : null;

  if (error) {
    return <ErrorState description={error} onRetry={() => void traer()} />;
  }

  return (
    <div className="space-y-6">
      {/* Mientras no ha llegado nada van las mismas tarjetas sin número: guardan
          el alto exacto y nada salta cuando llegan los datos. Las primeras 0.3 s
          ni siquiera se ven (useCargaLenta). */}
      {cargando && (
        <div
          className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', !lenta && 'invisible')}
        >
          <StatCard label="Órdenes abiertas" value="—" accent="navy" />
          <StatCard label="Por pagar" value="—" accent="teal" />
          <StatCard label="Vencidas" value="—" accent="navy" />
        </div>
      )}

      {!cargando && ordenes.length > 0 && resumen && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Órdenes abiertas" value={String(resumen.abiertas)} accent="navy" />
          <StatCard label="Por pagar" value={plata(resumen.por_pagar)} accent="teal" />
          <StatCard
            label="Vencidas"
            value={String(resumen.vencidas)}
            accent={Number(resumen.vencidas) > 0 ? 'error' : 'navy'}
          />
        </div>
      )}

      {cargando && <div className="h-9" />}

      {!cargando && ordenes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por número, proveedor, proyecto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoComplete="off"
            className="w-full sm:max-w-sm"
          />
          {botonPropio && <div className="sm:ml-auto">{botonNueva}</div>}
        </div>
      )}

      {/* Móvil: tarjetas. En una tabla de siete columnas en un teléfono no se
          lee nada, y estas órdenes se miran desde la obra. */}
      <div className="space-y-3 md:hidden">
        {enPantalla.map((o) => (
          <Card
            key={o.id}
            className="cursor-pointer p-4"
            onClick={() => onAbrirOrden(o.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{o.numero}</p>
                <p className="truncate text-sm text-slate-700">{o.proveedor}</p>
                {o.descripcion && (
                  <p className="truncate text-sm text-foreground">{o.descripcion}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {proyectoId ? fechaCorta(o.fecha) : `${o.proyecto_nombre} · ${fechaCorta(o.fecha)}`}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {plata(o.monto_total)}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {o.estado === 'pendiente' ? (
                <ApprovalPillBar aprobadores={o.aprobadores_estado ?? []} />
              ) : (
                <EstadoOrdenBadge estado={o.estado_calculado} />
              )}
              <VenceBadge vence={o.vence} />
            </div>
          </Card>
        ))}
      </div>

      {/* Mientras carga, la tabla entera guarda su sitio sin verse las primeras
          0.3 s: esconder solo las filas dejaba asomar sus rayas. */}
      <div className={cn('hidden md:block', cargando && !lenta && 'invisible')}>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="w-[120px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Número
                </TableHead>
                {!proyectoId && (
                  <TableHead className="w-[124px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proyecto
                  </TableHead>
                )}
                <TableHead className="w-[100px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fecha
                </TableHead>
                <TableHead className="w-[196px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proveedor
                </TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </TableHead>
                <TableHead className="w-[116px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Monto
                </TableHead>
                <TableHead className="w-[136px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vence
                </TableHead>
                <TableHead className="w-[140px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado
                </TableHead>
                <TableHead className="w-[52px] px-2 py-2.5" />
              </TableRow>
            </TableHeader>
            {cargando ? (
              <TableSkeleton rows={6} columns={proyectoId ? 8 : 9} />
            ) : (
              <TableBody>
                {enPantalla.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={proyectoId ? 8 : 9} className="p-0">
                      {ordenes.length === 0 ? (
                        <EmptyState
                          icon={ShoppingCart}
                          title="Todavía no hay órdenes de compra"
                          description="Una compra a crédito entra aquí el día que se le manda la orden al proveedor, sin esperar a pagarla."
                          action={botonNueva}
                        />
                      ) : (
                        <EmptyState
                          title="Ninguna orden coincide"
                          description="Prueba con otro número, proveedor o proyecto."
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  enPantalla.map((o) => {
                    const vencida = o.vence !== null && new Date(`${o.vence.slice(0, 10)}T00:00:00Z`).getTime() <
                      Date.UTC(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        new Date().getDate(),
                      );
                    return (
                      <TableRow
                        key={o.id}
                        className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 ${
                          vencida ? 'bg-error/[0.025]' : ''
                        }`}
                        onClick={() => onAbrirOrden(o.id)}
                      >
                        {/* La raya roja va como sombra, no como borde: en una tabla
                            un borde de 3 px en una celda ensancha la orilla de toda
                            la columna, y la cabecera gris dejaba ver una franja
                            blanca a su izquierda. */}
                        <TableCell
                          className={`px-4 py-3 text-sm font-medium text-foreground ${
                            vencida ? 'shadow-[inset_3px_0_0_var(--color-error)]' : ''
                          }`}
                        >
                          {o.numero}
                        </TableCell>
                        {!proyectoId && (
                          <TableCell className="truncate px-4 py-3 text-sm text-slate-700">
                            {o.proyecto_nombre}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-3 text-sm tabular-nums text-slate-700">
                          {fechaCorta(o.fecha)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-slate-700">
                          {o.proveedor}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-slate-700">
                          {o.descripcion ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                          {plata(o.monto_total)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <VenceBadge vence={o.vence} />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {o.estado === 'pendiente' ? (
                            <ApprovalPillBar aprobadores={o.aprobadores_estado ?? []} />
                          ) : (
                            <EstadoOrdenBadge estado={o.estado_calculado} />
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={`Descargar ${o.numero}`}
                            aria-label={`Descargar ${o.numero}`}
                            onClick={(ev) => {
                              // La fila entera abre la orden: este botón baja el
                              // papel sin salir de la lista.
                              ev.stopPropagation();
                              descargar(o.id);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            )}
          </Table>
        </Card>
      </div>

      {filtradas.length > 0 && (
        <SolicitudesPagination
          totalItems={filtradas.length}
          showingFrom={desde + 1}
          showingTo={Math.min(desde + tamano, filtradas.length)}
          currentPage={paginaSegura}
          totalPages={totalPaginas}
          pageSize={tamano}
          pageSizeOptions={TAMANOS}
          onPageChange={setPagina}
          onPageSizeChange={setTamano}
        />
      )}
    </div>
  );
}
