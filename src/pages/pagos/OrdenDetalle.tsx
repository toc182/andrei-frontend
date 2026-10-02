/**
 * Una orden de compra por dentro (rediseñada con Ivan el 2026-10-02: «para
 * entenderla era más fácil bajar el PDF»).
 *
 * De arriba abajo, lo que cualquiera tiene que poder leer de un vistazo:
 *
 *   1. Dónde va: Aprobada → Enviada al proveedor → Recibida → Pagada y
 *      cerrada, y debajo el SIGUIENTE PASO con el único botón que toca.
 *   2. La orden como el papel: proveedor, proyecto, términos de pago, los
 *      renglones y los totales —y, recibida, lo pagado y lo que se debe—.
 *   3. La historia y los documentos.
 *
 * La orden llega completa, en un solo paso: no hay entregas parciales ni «qué
 * se pidió contra qué llegó».
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Ban,
  Check,
  ChevronLeft,
  Download,
  FileCheck2,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  Settings,
  TriangleAlert,
  Upload,
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
import { Alert, ApprovalPillBar, ErrorState, SectionHeader, TableSkeleton } from '@/components/shell';
import { EstadoOrdenBadge } from './estados';
import { diasHasta, fechaCorta, plata } from './formato';
import { aprobadoresDe, type OrdenDetalle as Orden } from './tiposDetalle';
import RecibirDialog from './dialogs/RecibirDialog';
import ActivarPagoDialog from './dialogs/ActivarPagoDialog';
import BajaDialog from './dialogs/BajaDialog';
import OrdenFormDialog from './dialogs/OrdenFormDialog';
import { BulkApprovalPasswordDialog } from '@/pages/solicitudes/dialogs/BulkApprovalPasswordDialog';
import { RechazarSolicitudDialog } from '@/pages/solicitudes/dialogs/RechazarSolicitudDialog';
import AdjuntosPreview from '@/components/AdjuntosPreview';
import { abrirAdjunto } from './adjuntos';

interface Props {
  ordenId: number;
  onVolver: () => void;
  onCambio: () => void;
}

const PASOS = ['Aprobada', 'Enviada al proveedor', 'Recibida', 'Pagada y cerrada'];

/** Cómo se dice el estado de una solicitud de pago en la historia de la orden. */
const ESTADO_SOLICITUD: Record<string, string> = {
  pendiente: 'Esperando aprobación',
  aprobada: 'Aprobada, falta pagarla',
  pagada: 'Pagada',
  facturada: 'Pagada y facturada',
  rechazada: 'Rechazada',
  devolucion: 'Devuelta',
};

/** Día de un momento guardado con hora: en la hora de Panamá, no en UTC. */
const diaDe = (ts: string) => {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
/** Para ordenar la historia: un DATE vale como el mediodía de ese día. */
const momentoDe = (valor: string, esFecha: boolean) =>
  esFecha ? new Date(`${valor.slice(0, 10)}T12:00:00`).getTime() : new Date(valor).getTime();

interface Evento {
  clave: string;
  momento: number;
  dia: string;
  titulo: string;
  detalle?: string | null;
  monto?: string;
  tipo: 'paso' | 'recibida' | 'pago' | 'alerta';
  extra?: ReactNode;
}

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
    'recibir' | 'pago' | 'baja' | 'editar' | 'aprobar' | 'rechazar' | null
  >(null);
  // Aprobar pide la contraseña, igual que una solicitud de pago (Ivan, 01/10).
  const [clave, setClave] = useState('');
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const valeRef = useRef<HTMLInputElement>(null);

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

  const mensajeDe = (e: unknown, otro: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? otro;

  const llamar = async (ruta: string, cuerpo?: unknown) => {
    setAccion(ruta);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${ordenId}/${ruta}`, cuerpo ?? {});
      refrescar();
      return true;
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo completar la acción'));
      return false;
    } finally {
      setAccion(null);
    }
  };

  /** Sube archivos a la orden; con `entregaId`, a su recepción (el vale). */
  const subirAdjuntos = async (archivos: FileList | File[], entregaId?: number) => {
    setSubiendo(true);
    setError(null);
    try {
      for (const archivo of Array.from(archivos)) {
        const fd = new FormData();
        fd.append('archivo', archivo);
        if (entregaId) {
          fd.append('entrega_id', String(entregaId));
          fd.append('descripcion', 'Vale de entrega');
        }
        await api.post(`/ordenes-compra/${ordenId}/adjuntos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo subir el archivo'));
    } finally {
      setSubiendo(false);
      void traer();
    }
  };

  const borrarAdjunto = async (adjuntoId: number) => {
    setError(null);
    try {
      await api.delete(`/ordenes-compra/${ordenId}/adjuntos/${adjuntoId}`);
    } catch {
      setError('No se pudo quitar el archivo');
    } finally {
      void traer();
    }
  };

  const abrirDocumento = async (adjuntoId: number) => {
    if (!(await abrirAdjunto(ordenId, adjuntoId))) setError('No se pudo abrir el archivo');
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
      setErrorClave(mensajeDe(e, 'No se pudo aprobar la orden'));
    } finally {
      setAccion(null);
    }
  };

  const rechazar = async () => {
    if (!comentario.trim()) return;
    const ok = await llamar('rechazar', { comentario: comentario.trim() });
    if (ok) {
      setDialogo(null);
      setComentario('');
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

  // ------------------------------------------------------------ lo que toca
  const estado = orden.estado_calculado;
  const recepcion = orden.entregas[0] ?? null;
  const recibida = recepcion !== null;
  const esAdmin = user?.rol === 'admin';
  const esAdminOCo = esAdmin || user?.rol === 'co-admin';
  const siguienteFirma = orden.aprobadores[orden.aprobaciones.length];
  const miTurno = orden.estado === 'pendiente' && siguienteFirma?.user_id === user?.id;
  const puedeRecibir = hasPermission('ordenes_entregas') && estado === 'enviada';
  const puedeActivar = recibida && Number(orden.disponible_para_activar) > 0;
  const yaSalio = orden.estado === 'enviada' || orden.estado === 'cerrada';
  const puedeEditar =
    !recibida &&
    (yaSalio ? esAdmin : orden.estado === 'pendiente' || orden.estado === 'por_enviar');
  const puedeDarDeBaja =
    esAdminOCo &&
    !recibida &&
    (orden.estado === 'pendiente' || orden.estado === 'por_enviar' || orden.estado === 'enviada');
  const vencida =
    estado === 'recibida' && !!orden.vence && Number(orden.por_pagar) > 0 && diasHasta(orden.vence) < 0;
  const enCamino = Math.max(
    0,
    Number(orden.recibido) - Number(orden.disponible_para_activar) - Number(orden.pagado),
  );

  const abrirPdf = () => {
    const token = localStorage.getItem('token');
    window.open(
      `${api.defaults.baseURL}/ordenes-compra/${orden.id}/pdf?token=${token ?? ''}`,
      '_blank',
    );
  };

  // El paso en que va: 0 aprobándose, 1 por enviar, 2 enviada, 3 recibida, 4 cerrada.
  const paso =
    estado === 'pendiente' ? 0 : estado === 'por_enviar' ? 1 : estado === 'enviada' ? 2 : estado === 'recibida' ? 3 : 4;
  const ultimaFirma = orden.aprobaciones.length
    ? orden.aprobaciones[orden.aprobaciones.length - 1].fecha
    : null;
  const notas = [
    paso === 0
      ? `${orden.aprobaciones.length} de ${orden.aprobadores.length} firmas`
      : ultimaFirma
        ? diaDe(ultimaFirma)
        : '',
    orden.enviada_at ? diaDe(orden.enviada_at) : '',
    recepcion ? fechaCorta(recepcion.fecha) : '',
    paso === 3 ? `${plata(orden.pagado)} de ${plata(orden.monto_total)}` : '',
  ];

  // ----------------------------------------------------- el siguiente paso
  let siguiente: { titulo: string; texto: ReactNode; botones?: ReactNode } | null = null;
  if (estado === 'pendiente') {
    siguiente = miTurno
      ? {
          titulo: 'Siguiente paso: tu firma',
          texto: (
            <span className="flex flex-wrap items-center gap-2">
              <span>Te toca aprobarla o rechazarla.</span>
              <ApprovalPillBar aprobadores={aprobadoresDe(orden)} />
            </span>
          ),
          botones: (
            <>
              <Button variant="outline" onClick={() => setDialogo('rechazar')} disabled={accion !== null}>
                Rechazar
              </Button>
              <Button
                onClick={() => {
                  setClave('');
                  setErrorClave(null);
                  setDialogo('aprobar');
                }}
                disabled={accion !== null}
              >
                <Check className="mr-2 h-4 w-4" />
                Aprobar
              </Button>
            </>
          ),
        }
      : {
          titulo: 'Siguiente paso: las firmas',
          texto: (
            <span className="flex flex-wrap items-center gap-2">
              {siguienteFirma ? (
                <span>
                  Falta la firma de{' '}
                  <strong className="font-semibold text-foreground">{siguienteFirma.nombre}</strong>.
                </span>
              ) : (
                <span>El proyecto no tiene aprobadores.</span>
              )}
              <ApprovalPillBar aprobadores={aprobadoresDe(orden)} />
            </span>
          ),
        };
  } else if (estado === 'por_enviar') {
    siguiente = {
      titulo: 'Siguiente paso: enviársela al proveedor',
      texto: (
        <>
          Baja el PDF, envíaselo por correo a{' '}
          <strong className="font-semibold text-foreground">{orden.proveedor}</strong> y, cuando
          se la hayas enviado, márcalo aquí.
        </>
      ),
      botones: (
        <>
          <Button variant="outline" onClick={abrirPdf}>
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
          <Button onClick={() => void llamar('marcar-enviada')} disabled={accion !== null}>
            <Send className="mr-2 h-4 w-4" />
            Marcar como enviada al proveedor
          </Button>
        </>
      ),
    };
  } else if (estado === 'enviada') {
    siguiente = {
      titulo: 'Siguiente paso: recibir el material',
      texto:
        orden.termino_dias === 0
          ? 'Cuando llegue, márcala como recibida. Se paga de contado.'
          : `Cuando llegue, márcala como recibida. Desde ese día corren los ${orden.termino_dias} días para pagarla.`,
      botones: puedeRecibir ? (
        <Button onClick={() => setDialogo('recibir')}>
          <PackageCheck className="mr-2 h-4 w-4" />
          Marcar como recibida
        </Button>
      ) : undefined,
    };
  } else if (estado === 'recibida') {
    siguiente = {
      titulo: 'Siguiente paso: pagarla',
      texto: (
        <>
          Llegó completa el {recepcion ? fechaCorta(recepcion.fecha) : '—'}. Se debe{' '}
          <strong className="font-semibold text-foreground">{plata(orden.por_pagar)}</strong>
          {enCamino > 0 && (
            <>
              ; ya hay solicitudes de pago por{' '}
              <strong className="font-semibold text-foreground">{plata(enCamino)}</strong> en
              camino
            </>
          )}
          .
          {!puedeActivar && ' Todo lo que se debe ya tiene su solicitud de pago.'}
        </>
      ),
      botones: puedeActivar ? (
        <Button onClick={() => setDialogo('pago')}>
          <Plus className="mr-2 h-4 w-4" />
          Activar solicitud de pago
        </Button>
      ) : undefined,
    };
  }

  // ------------------------------------------------------------ la historia
  const eventos: Evento[] = [];
  eventos.push({
    clave: 'creada',
    momento: momentoDe(orden.created_at, false),
    dia: diaDe(orden.created_at),
    titulo: 'Orden creada',
    detalle: orden.creado_por_nombre,
    tipo: 'paso',
  });
  for (const a of orden.aprobaciones) {
    eventos.push({
      clave: `ap-${a.orden}`,
      momento: momentoDe(a.fecha, false),
      dia: diaDe(a.fecha),
      titulo: a.accion === 'rechazado' ? `Rechazada por ${a.usuario_nombre ?? '—'}` : `Aprobada por ${a.usuario_nombre ?? '—'}`,
      detalle: a.comentario,
      tipo: a.accion === 'rechazado' ? 'alerta' : 'paso',
    });
  }
  if (orden.enviada_at) {
    eventos.push({
      clave: 'enviada',
      momento: momentoDe(orden.enviada_at, false),
      dia: diaDe(orden.enviada_at),
      titulo: 'Enviada al proveedor',
      detalle: orden.enviada_por_nombre,
      tipo: 'paso',
    });
  }
  for (const e of orden.entregas) {
    const valeDoc = e.adjuntos[0];
    eventos.push({
      clave: `rec-${e.id}`,
      momento: momentoDe(e.fecha, true),
      dia: fechaCorta(e.fecha),
      titulo: 'Recibida completa',
      detalle: [e.nota, `Vence el ${fechaCorta(e.vence)}`].filter(Boolean).join(' · '),
      tipo: 'recibida',
      extra: valeDoc ? (
        <button
          type="button"
          onClick={() => void abrirDocumento(valeDoc.id)}
          className="inline-flex items-center gap-1.5 rounded-md border border-navy/25 bg-navy/[0.06] px-2 py-0.5 text-xs font-semibold text-navy hover:bg-navy/10"
          title={valeDoc.nombre_original}
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          {valeDoc.descripcion || 'Vale de entrega'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => valeRef.current?.click()}
          disabled={subiendo}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning hover:bg-warning/15"
        >
          <Upload className="h-3.5 w-3.5" />
          {subiendo ? 'Subiendo...' : 'Sin vale · subirlo'}
        </button>
      ),
    });
  }
  for (const p of orden.pagos) {
    eventos.push({
      clave: `pago-${p.id}`,
      momento: momentoDe(p.fecha, true),
      dia: fechaCorta(p.fecha),
      titulo: `Solicitud de pago ${p.numero}`,
      detalle: ESTADO_SOLICITUD[p.estado] ?? p.estado,
      monto: plata(p.monto),
      tipo: 'pago',
    });
  }
  for (const c of orden.cambios) {
    eventos.push({
      clave: `cambio-${c.id}`,
      momento: momentoDe(c.created_at, false),
      dia: diaDe(c.created_at),
      titulo: `Editada por ${c.usuario_nombre ?? 'alguien'}`,
      detalle: `${c.cambios
        .map((x) => `${x.campo}: ${String(x.antes ?? '—')} → ${String(x.despues ?? '—')}`)
        .join(' · ')} · Motivo: ${c.motivo}`,
      tipo: 'paso',
    });
  }
  if (orden.estado === 'dada_de_baja' && orden.baja_at) {
    eventos.push({
      clave: 'baja',
      momento: momentoDe(orden.baja_at, false),
      dia: diaDe(orden.baja_at),
      titulo: 'Dada de baja',
      detalle: orden.baja_motivo,
      tipo: 'alerta',
    });
  }
  eventos.sort((a, b) => b.momento - a.momento);

  const rechazo = orden.aprobaciones.find((a) => a.accion === 'rechazado');

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

      {/* Encabezado: qué orden es. Las acciones del día a día van en el
          siguiente paso; aquí solo el papel y lo que se usa poco. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold text-foreground">{orden.numero}</h1>
            <EstadoOrdenBadge estado={estado} />
          </div>
          <p className="mt-1 text-sm text-slate-700">
            {orden.proveedor}
            <span className="text-muted-foreground"> · {orden.proyecto_nombre}</span>
          </p>
          {orden.descripcion && (
            <p className="mt-0.5 text-sm text-foreground">{orden.descripcion}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={abrirPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          {(puedeEditar || puedeDarDeBaja) && (
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

      {/* Dónde va la orden y qué toca ahora. Rechazada o dada de baja no va a
          ninguna parte: en su lugar, por qué. */}
      {orden.estado === 'rechazada' ? (
        <Alert
          variant="error"
          title={`Rechazada${rechazo?.usuario_nombre ? ` por ${rechazo.usuario_nombre}` : ''}`}
          description={rechazo?.comentario ?? undefined}
        />
      ) : orden.estado === 'dada_de_baja' ? (
        <Alert
          variant="warning"
          title="Esta orden está dada de baja"
          description={orden.baja_motivo ?? undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ol className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-4 md:gap-0">
            {PASOS.map((nombre, n) => {
              const hecho = n < paso;
              const ahora = n === paso;
              const nota = hecho || ahora ? notas[n] : '';
              return (
                <li
                  key={nombre}
                  className="relative flex items-center gap-3 md:flex-col md:gap-1.5 md:text-center"
                >
                  {n > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-1/2 top-[13px] hidden h-0.5 w-full md:block',
                        hecho || ahora ? 'bg-navy' : 'bg-border',
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                      hecho
                        ? 'border-navy bg-navy text-white'
                        : ahora
                          ? 'border-teal bg-card text-teal ring-4 ring-teal/10'
                          : 'border-slate-300 bg-card text-muted-foreground',
                    )}
                  >
                    {hecho ? <Check className="h-4 w-4" /> : n + 1}
                  </span>
                  <div>
                    <p
                      className={cn(
                        'text-sm',
                        hecho || ahora ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {nombre}
                    </p>
                    {nota && <p className="text-xs tabular-nums text-muted-foreground">{nota}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {siguiente && (
            <div className="flex flex-col gap-3 border-t border-border bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-teal">
                  {siguiente.titulo}
                </p>
                <div className="mt-0.5 text-sm text-slate-700">{siguiente.texto}</div>
              </div>
              {siguiente.botones && (
                <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">{siguiente.botones}</div>
              )}
            </div>
          )}
          {vencida && orden.vence && (
            <div className="flex items-center gap-2 border-t border-error/25 bg-error/[0.06] px-5 py-2.5 text-sm font-semibold text-error">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Vencida desde el {fechaCorta(orden.vence)} (hace {Math.abs(diasHasta(orden.vence))}{' '}
              {Math.abs(diasHasta(orden.vence)) === 1 ? 'día' : 'días'}).
            </div>
          )}
        </Card>
      )}

      {/* La orden, como el papel que recibe el proveedor. */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-1 divide-y divide-border border-b border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proveedor</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{orden.proveedor}</p>
            {orden.proveedor_ruc && (
              <p className="text-xs tabular-nums text-muted-foreground">RUC {orden.proveedor_ruc}</p>
            )}
          </div>
          <div className="px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proyecto · Fecha
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{orden.proyecto_nombre}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {fechaCorta(orden.fecha)}
              {orden.categoria_nombre ? ` · ${orden.categoria_nombre}` : ''}
            </p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Términos de pago
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {orden.termino_dias === 0 ? 'Contado' : `${orden.termino_dias} días desde que llega`}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {orden.entrega === 'sitio' ? 'Entrega en sitio' : 'Retiro en el local'}
              {recibida && orden.vence ? ` · vence ${fechaCorta(orden.vence)}` : ''}
            </p>
          </div>
        </div>

        {/* Teléfono: un bloque por renglón. */}
        <div className="divide-y divide-slate-100 md:hidden">
          {orden.items.map((i) => (
            <div key={i.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{i.descripcion}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{plata(i.precio_total)}</p>
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {Number(i.cantidad).toLocaleString('en-US')} {i.unidad} × {plata(i.precio_unitario)}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="w-[96px] px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cant.
                </TableHead>
                <TableHead className="w-[96px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Unidad
                </TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </TableHead>
                <TableHead className="w-[120px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  P. unit.
                </TableHead>
                <TableHead className="w-[132px] px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orden.items.map((i) => (
                <TableRow key={i.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="px-5 py-3 text-right text-sm tabular-nums text-slate-700">
                    {Number(i.cantidad).toLocaleString('en-US')}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{i.unidad}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">{i.descripcion}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {plata(i.precio_unitario)}
                  </TableCell>
                  <TableCell className="px-5 py-3 text-right text-sm tabular-nums text-slate-700">
                    {plata(i.precio_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:justify-between">
          <div className="max-w-md text-sm text-slate-700">
            {orden.condiciones && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Condiciones
                </p>
                <p className="mt-0.5">{orden.condiciones}</p>
              </>
            )}
          </div>
          <dl className="w-full space-y-1 text-sm sm:w-72">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sub total</dt>
              <dd className="tabular-nums text-slate-700">{plata(orden.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Descuento</dt>
              <dd className="tabular-nums text-slate-700">{plata(orden.descuento)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                ITBMS {(Number(orden.itbms_tasa) * 100).toFixed(0)}%
              </dt>
              <dd className="tabular-nums text-slate-700">{plata(orden.itbms)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-1.5 text-base font-bold text-foreground">
              <dt>Total</dt>
              <dd className="tabular-nums">{plata(orden.monto_total)}</dd>
            </div>
            {recibida && (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Pagado</dt>
                  <dd className="font-semibold tabular-nums text-success">{plata(orden.pagado)}</dd>
                </div>
                <div className="flex justify-between gap-3 text-base font-bold">
                  <dt className="text-foreground">Por pagar</dt>
                  <dd className={cn('tabular-nums', vencida ? 'text-error' : 'text-warning')}>
                    {plata(orden.por_pagar)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <SectionHeader title="Historia" />
          <Card className="px-5 py-1">
            {eventos.map((ev) => (
              <div
                key={ev.clave}
                className="grid grid-cols-[76px_12px_1fr] gap-3 border-b border-slate-100 py-3 last:border-0"
              >
                <span className="pt-px text-xs tabular-nums text-muted-foreground">{ev.dia}</span>
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 rounded-full',
                    ev.tipo === 'recibida'
                      ? 'bg-teal'
                      : ev.tipo === 'pago'
                        ? 'bg-success'
                        : ev.tipo === 'alerta'
                          ? 'bg-error'
                          : 'bg-slate-300',
                  )}
                />
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{ev.titulo}</p>
                    {ev.monto && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{ev.monto}</span>
                    )}
                  </div>
                  {ev.detalle && <p className="mt-0.5 text-xs text-muted-foreground">{ev.detalle}</p>}
                  {ev.extra && <div className="mt-1.5">{ev.extra}</div>}
                </div>
              </div>
            ))}
          </Card>
          {/* El vale que no se subió al recibirla, se sube desde aquí. */}
          <input
            ref={valeRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => {
              if (e.target.files?.length && recepcion) void subirAdjuntos(e.target.files, recepcion.id);
              e.target.value = '';
            }}
          />
        </div>

        <div className="space-y-3">
          <SectionHeader title="Documentos" />
          <Card className="p-5">
            <AdjuntosPreview
              adjuntos={orden.adjuntos}
              rutaUrls={`/ordenes-compra/${orden.id}/adjuntos/urls`}
              onUpload={(archivos) => void subirAdjuntos(archivos)}
              onDelete={(id) => void borrarAdjunto(id)}
              uploading={subiendo}
              title="Cotización y otros archivos"
            />
          </Card>
        </div>
      </div>

      <RecibirDialog
        orden={orden}
        open={dialogo === 'recibir'}
        onOpenChange={(v) => setDialogo(v ? 'recibir' : null)}
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
      <RechazarSolicitudDialog
        open={dialogo === 'rechazar'}
        onOpenChange={(v) => {
          setDialogo(v ? 'rechazar' : null);
          if (!v) setComentario('');
        }}
        comment={comentario}
        onCommentChange={setComentario}
        onConfirm={() => void rechazar()}
        title={`Rechazar ${orden.numero}`}
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
