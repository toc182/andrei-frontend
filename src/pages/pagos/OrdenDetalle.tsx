/**
 * Una orden de compra por dentro.
 *
 * El orden de lo que se ve no es casual: primero los datos, después los cuatro
 * números que contestan «¿cuánto se debe?», después lo que se compró con lo que
 * ya llegó de cada renglón, y al final las entregas con sus documentos y los
 * pagos. «Falta por retirar» se enseña en gris y diciendo que no se debe, para
 * que nadie lo sume al costo.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  Download,
  FileCheck2,
  Pencil,
  PackagePlus,
  Plus,
  Check,
  Ban,
  Settings,
} from 'lucide-react';
import api from '@/services/api';
import { recordado, recordar } from '@/lib/recordados';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  ApprovalPillBar,
  ErrorState,
  SectionHeader,
  StatCard,
  TableSkeleton,
} from '@/components/shell';
import { EstadoOrdenBadge, VenceBadge } from './estados';
import { diasHasta, fechaCorta, plata } from './formato';
import { aprobadoresDe, type OrdenDetalle as Orden } from './tiposDetalle';
import EntregaDialog from './dialogs/EntregaDialog';
import ActivarPagoDialog from './dialogs/ActivarPagoDialog';
import BajaDialog from './dialogs/BajaDialog';
import OrdenFormDialog from './dialogs/OrdenFormDialog';
import { BulkApprovalPasswordDialog } from '@/pages/solicitudes/dialogs/BulkApprovalPasswordDialog';

interface Props {
  ordenId: number;
  onVolver: () => void;
  onCambio: () => void;
}

const Dato = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {etiqueta}
    </p>
    <div className="mt-1 text-sm text-foreground">{children}</div>
  </div>
);

export default function OrdenDetallePage({ ordenId, onVolver, onCambio }: Props) {
  const { user, hasPermission } = useAuth();
  // Una orden ya abierta en la sesión sale al instante y se refresca por detrás.
  // Quien la monta le pone key={ordenId}: otra orden es otra pantalla.
  const [orden, setOrden] = useState<Orden | null>(
    () => recordado<Orden>(`orden:${ordenId}`) ?? null,
  );
  const [cargando, setCargando] = useState(true);
  const lenta = useCargaLenta(cargando && !orden);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<
    'entrega' | 'pago' | 'baja' | 'editar' | 'aprobar' | null
  >(null);
  // Aprobar pide la contraseña, igual que una solicitud de pago (Ivan, 01/10).
  const [clave, setClave] = useState('');
  const [errorClave, setErrorClave] = useState<string | null>(null);

  const traer = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.get(`/ordenes-compra/${ordenId}`);
      recordar(`orden:${ordenId}`, res.data.data);
      setOrden(res.data.data);
    } catch {
      setError('No se pudo cargar la orden');
    } finally {
      setCargando(false);
    }
  }, [ordenId]);

  useEffect(() => {
    void traer();
  }, [traer]);

  const refrescar = () => {
    void traer();
    onCambio();
  };

  const llamar = async (ruta: string, cuerpo?: unknown) => {
    setAccion(ruta);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${ordenId}/${ruta}`, cuerpo ?? {});
      refrescar();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo completar la acción');
    } finally {
      setAccion(null);
    }
  };

  const aprobar = async () => {
    if (!clave.trim()) return;
    setAccion('aprobar');
    setErrorClave(null);
    try {
      await api.post(`/ordenes-compra/${ordenId}/aprobar`, { password: clave });
      setDialogo(null);
      setClave('');
      refrescar();
    } catch (e) {
      // La contraseña equivocada se dice dentro de la ventana, sin cerrarla.
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorClave(msg ?? 'No se pudo aprobar la orden');
    } finally {
      setAccion(null);
    }
  };

  if (cargando && !orden) {
    // Las primeras 0.3 s el esqueleto guarda su sitio sin verse (useCargaLenta).
    return (
      <div className={cn('space-y-6', !lenta && 'invisible')}>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableSkeleton rows={8} columns={4} />
          </Table>
        </Card>
      </div>
    );
  }
  if (error && !orden) {
    return <ErrorState description={error} onRetry={() => void traer()} />;
  }
  if (!orden) return null;

  const esAdmin = user?.rol === 'admin';
  const esAdminOCo = esAdmin || user?.rol === 'co-admin';
  const miTurno =
    orden.estado === 'pendiente' &&
    orden.aprobadores[orden.aprobaciones.length]?.user_id === user?.id;
  const puedeEntregar = hasPermission('ordenes_entregas') && orden.estado === 'enviada';
  const puedeActivar =
    Number(orden.disponible_para_activar) > 0 &&
    (orden.estado === 'enviada' || orden.estado === 'dada_de_baja');
  const yaSalio = orden.estado === 'enviada' || orden.estado === 'cerrada';
  const puedeEditar = yaSalio
    ? esAdmin
    : orden.estado === 'pendiente' || orden.estado === 'por_enviar';
  const puedeDarDeBaja =
    esAdminOCo && orden.estado !== 'dada_de_baja' && orden.estado !== 'rechazada';

  const abrirPdf = () => {
    const token = localStorage.getItem('token');
    window.open(
      `${api.defaults.baseURL}/ordenes-compra/${orden.id}/pdf?token=${token ?? ''}`,
      '_blank',
    );
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Pagos · Órdenes de compra
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">{orden.numero}</h1>
            <Button variant="outline" size="sm" onClick={abrirPdf}>
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
            <EstadoOrdenBadge estado={orden.estado_calculado} />
            {orden.vence && diasHasta(orden.vence) < 0 && <VenceBadge vence={orden.vence} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {orden.proveedor} · {orden.proyecto_nombre}
          </p>
          {orden.descripcion && (
            <p className="mt-0.5 text-sm text-foreground">{orden.descripcion}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {orden.estado === 'por_enviar' && (
            <Button
              size="sm"
              onClick={() => void llamar('marcar-enviada')}
              disabled={accion !== null}
            >
              <Check className="mr-2 h-4 w-4" />
              Marcar como enviada
            </Button>
          )}
          {puedeActivar && (
            <Button size="sm" onClick={() => setDialogo('pago')}>
              <Plus className="mr-2 h-4 w-4" />
              Activar solicitud de pago
            </Button>
          )}
          {(puedeEditar || puedeEntregar || puedeDarDeBaja) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Más acciones"
                  aria-label="Más acciones"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {puedeEntregar && (
                  <DropdownMenuItem onClick={() => setDialogo('entrega')}>
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Registrar entrega
                  </DropdownMenuItem>
                )}
                {puedeEditar && (
                  <DropdownMenuItem onClick={() => setDialogo('editar')}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                )}
                {puedeDarDeBaja && (
                  <DropdownMenuItem
                    onClick={() => setDialogo('baja')}
                    className="text-error focus:text-error"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Dar de baja
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      {orden.estado === 'dada_de_baja' && (
        <Alert
          variant="warning"
          title="Esta orden está dada de baja"
          description={`${orden.baja_motivo ?? ''} Lo que ya llegó se sigue debiendo y se puede pagar; no admite más entregas.`}
        />
      )}

      {orden.estado === 'pendiente' && (
        <Alert
          variant="info"
          title="Esperando aprobación"
          description={
            <span className="flex flex-wrap items-center gap-3">
              <ApprovalPillBar aprobadores={aprobadoresDe(orden)} />
              <span>
                {orden.aprobadores.map((a) => a.nombre).join(' → ') || 'Sin aprobadores'}
              </span>
            </span>
          }
          actions={
            miTurno ? (
              <Button
                size="sm"
                onClick={() => {
                  setClave('');
                  setErrorClave(null);
                  setDialogo('aprobar');
                }}
                disabled={accion !== null}
              >
                Aprobar
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Los datos de la orden */}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Proyecto">{orden.proyecto_nombre}</Dato>
          <Dato etiqueta="Proveedor">
            {orden.proveedor}
            {orden.proveedor_ruc && (
              <span className="block text-xs tabular-nums text-muted-foreground">
                RUC {orden.proveedor_ruc}
              </span>
            )}
          </Dato>
          <Dato etiqueta="Categoría">{orden.categoria_nombre ?? '—'}</Dato>
          <Dato etiqueta="Fecha de la orden">
            <span className="tabular-nums">{fechaCorta(orden.fecha)}</span>
          </Dato>
          <Dato etiqueta="Término de pago">
            {orden.termino_dias === 0
              ? 'Contado'
              : `${orden.termino_dias} días desde cada entrega`}
          </Dato>
          <Dato etiqueta="Entrega">
            {orden.entrega === 'sitio' ? 'En sitio' : 'Retiro en el local'}
          </Dato>
          {orden.condiciones && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Dato etiqueta="Condiciones de compra">{orden.condiciones}</Dato>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monto de la orden"
          value={plata(orden.monto_total)}
          caption="Lo acordado con el proveedor"
          accent="navy"
        />
        <StatCard
          label="Recibido"
          value={plata(orden.recibido)}
          caption={`${orden.entregas.length} ${
            orden.entregas.length === 1 ? 'entrega' : 'entregas'
          } · pagado ${plata(orden.pagado)}`}
          accent="teal"
        />
        <StatCard
          label="Por pagar"
          value={plata(orden.por_pagar)}
          caption={
            orden.vence
              ? `Vence el ${fechaCorta(orden.vence)}`
              : 'Nada se debe hasta que llegue'
          }
          accent={Number(orden.por_pagar) > 0 ? 'warning' : 'navy'}
        />
        <StatCard
          label="Falta por retirar"
          value={plata(orden.falta_por_retirar)}
          caption="Todavía no se debe ni se cuenta"
        />
      </div>

      <div className="space-y-3">
        <SectionHeader title="Detalle de compra" />
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="w-[84px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pedido
                </TableHead>
                <TableHead className="w-[100px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recibido
                </TableHead>
                <TableHead className="w-[76px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Unidad
                </TableHead>
                <TableHead className="w-[96px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Código
                </TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </TableHead>
                <TableHead className="w-[108px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Precio unit.
                </TableHead>
                <TableHead className="w-[120px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Precio total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orden.items.map((i) => {
                const recibido = Number(i.recibido_cantidad);
                const completo = recibido >= Number(i.cantidad);
                return (
                  <TableRow key={i.id} className="border-b border-slate-100 last:border-0">
                    <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                      {Number(i.cantidad).toLocaleString('en-US')}
                    </TableCell>
                    <TableCell
                      className={`px-4 py-3 text-right text-sm tabular-nums ${
                        recibido === 0
                          ? 'text-muted-foreground'
                          : completo
                            ? 'text-success'
                            : 'text-warning'
                      }`}
                    >
                      {recibido === 0 ? '—' : recibido.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-700">{i.unidad}</TableCell>
                    <TableCell className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                      {i.codigo ?? '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-700">
                      {i.descripcion}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                      {plata(i.precio_unitario)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                      {plata(i.precio_total)}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">
                  Sub total
                </TableCell>
                <TableCell colSpan={2} className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                  {plata(orden.subtotal)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">
                  Descuento
                </TableCell>
                <TableCell colSpan={2} className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                  {plata(orden.descuento)}
                </TableCell>
              </TableRow>
              <TableRow className="border-b border-slate-100">
                <TableCell colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">
                  ITBMS {(Number(orden.itbms_tasa) * 100).toFixed(0)}%
                </TableCell>
                <TableCell colSpan={2} className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                  {plata(orden.itbms)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                  Total de la orden
                </TableCell>
                <TableCell colSpan={2} className="px-4 py-3 text-right text-base font-bold tabular-nums">
                  {plata(orden.monto_total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader title="Entregas" />
          <Card className="overflow-hidden p-0">
            {orden.entregas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Todavía no ha llegado nada de esta orden.
              </p>
            ) : (
              orden.entregas.map((e) => {
                const pendiente = Number(e.monto_total) - Number(e.pagado);
                return (
                  <div key={e.id} className="border-b border-slate-100 px-5 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {fechaCorta(e.fecha)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {e.items
                            .map(
                              (i) =>
                                `${i.descripcion}, ${Number(i.cantidad).toLocaleString('en-US')} ${i.unidad}`,
                            )
                            .join(' · ')}
                        </span>
                      </p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {plata(e.monto_total)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {e.adjuntos.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <FileCheck2 className="h-3.5 w-3.5 text-success" />
                          {e.adjuntos[0].descripcion || 'Documento de entrega'}
                        </span>
                      ) : (
                        <span className="text-xs text-warning">Sin documento de entrega</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {pendiente <= 0 ? (
                          'Pagada'
                        ) : (
                          <>
                            Vence {fechaCorta(e.vence)} · faltan {plata(pendiente)}
                          </>
                        )}
                      </span>
                    </div>
                    {e.nota && (
                      <p className="mt-1.5 text-xs text-muted-foreground">{e.nota}</p>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <SectionHeader title="Pagos de esta orden" />
          <Card className="overflow-hidden p-0">
            {orden.pagos.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Todavía no se ha activado ningún pago.
              </p>
            ) : (
              orden.pagos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-primary">{p.numero}</p>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta(p.fecha)} · {p.estado}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{plata(p.monto)}</p>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      {orden.cambios.length > 0 && (
        <div className="space-y-3">
          <SectionHeader title="Cambios después de enviarla" />
          <Card className="overflow-hidden p-0">
            {orden.cambios.map((c) => (
              <div key={c.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {c.usuario_nombre ?? 'Alguien'}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {new Date(c.created_at).toLocaleString('es-PA')}
                  </p>
                </div>
                <ul className="mt-2 space-y-1">
                  {c.cambios.map((x, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      {x.campo}{' '}
                      <span className="text-error line-through tabular-nums">
                        {String(x.antes ?? '—')}
                      </span>{' '}
                      <span className="text-muted-foreground">→</span>{' '}
                      <span className="font-semibold text-success tabular-nums">
                        {String(x.despues ?? '—')}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Motivo: {c.motivo}</p>
              </div>
            ))}
          </Card>
        </div>
      )}

      <EntregaDialog
        orden={orden}
        open={dialogo === 'entrega'}
        onOpenChange={(v) => setDialogo(v ? 'entrega' : null)}
        onListo={refrescar}
      />
      <ActivarPagoDialog
        orden={orden}
        open={dialogo === 'pago'}
        onOpenChange={(v) => setDialogo(v ? 'pago' : null)}
        onListo={refrescar}
      />
      <BajaDialog
        orden={orden}
        open={dialogo === 'baja'}
        onOpenChange={(v) => setDialogo(v ? 'baja' : null)}
        onListo={refrescar}
      />
      <BulkApprovalPasswordDialog
        open={dialogo === 'aprobar'}
        onOpenChange={(v) => setDialogo(v ? 'aprobar' : null)}
        password={clave}
        onPasswordChange={setClave}
        pendingApprovalId={orden.id}
        reviewedCount={0}
        loading={accion === 'aprobar'}
        error={errorClave}
        onConfirm={() => void aprobar()}
        description={`Ingresa tu contraseña para aprobar la orden ${orden.numero}.`}
      />
      <OrdenFormDialog
        orden={orden}
        open={dialogo === 'editar'}
        onOpenChange={(v) => setDialogo(v ? 'editar' : null)}
        esAdmin={esAdmin}
        onListo={refrescar}
      />
    </div>
  );
}
