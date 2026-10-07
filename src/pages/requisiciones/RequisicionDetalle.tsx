/**
 * Una requisición por dentro.
 *
 * Copia la página de la orden de compra (OrdenDetalle), que Ivan aprobó: arriba
 * qué es y el papel; debajo el siguiente paso, con los botones de quien le
 * toca; luego la requisición como el papel, y al pie la historia y los
 * adjuntos. Lo que se ve depende de quién la abre y de en qué va — eso lo dice
 * el servidor en `puede`, que es quien decide de verdad.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Ban, Check, ChevronLeft, Download, Pencil, Settings } from 'lucide-react';
import api from '@/services/api';
import { Alert, ErrorState, SectionHeader, TableSkeleton } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import AdjuntosPreview from '@/components/AdjuntosPreview';
import { BulkApprovalPasswordDialog } from '@/pages/solicitudes/dialogs/BulkApprovalPasswordDialog';
import { useAuth } from '@/context/AuthContext';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { cn } from '@/lib/utils';
import RequisicionFormDialog from './RequisicionFormDialog';
import CotizacionesSeccion from './CotizacionesSeccion';
import { cantidadDe, diaDe, diaDeMomento, momentoCorto } from './formato';
import { EstadoBadge, MarcaBadge, MarcaSelector, PrioridadEtiqueta } from './etiquetas';
import type { CambioRequisicion, LineaRequisicion, Marca, RequisicionDetalle as Detalle } from './tipos';

interface Props {
  requisicionId: number;
  /** El texto del enlace de volver: «Requisiciones», «Requisiciones · Por aprobar». */
  volverA: string;
  onVolver: () => void;
  /** Algo cambió: la lista de atrás tiene que volver a pedir. */
  onCambio: () => void;
  /** Archivos que no subieron al guardarla, para avisar al abrir. */
  avisoInicial?: string[];
}

interface Evento {
  clave: string;
  momento: string;
  titulo: string;
  detalle: string;
  punto: string;
  cambios?: CambioRequisicion['cambios'];
}

/** Cómo se lee un valor de una corrección. */
function valorLegible(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'Fecha requerida' && typeof v === 'string') return diaDe(v);
  if (campo === 'Prioridad') return v === 'urgente' ? 'Urgente' : 'Normal';
  if (campo === 'Tipo de cuenta') return v === 'ahorro' ? 'Ahorro' : 'Corriente';
  if (typeof v === 'number') return cantidadDe(v);
  return String(v);
}

function Dato({ etiqueta, children, sub }: { etiqueta: string; children: ReactNode; sub?: string | null }) {
  return (
    <div className="px-5 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{children}</div>
      {sub && <p className="text-xs tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function RequisicionDetallePage({ requisicionId, volverA, onVolver, onCambio, avisoInicial }: Props) {
  const { user } = useAuth();
  const [req, setReq] = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const lenta = useCargaLenta(cargando);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(
    avisoInicial?.length ? `No se pudo subir: ${avisoInicial.join(', ')}` : null,
  );
  const [dialogo, setDialogo] = useState<null | 'editar' | 'aprobar' | 'anular'>(null);
  const [accion, setAccion] = useState(false);
  const [clave, setClave] = useState('');
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<number | null>(null);

  const traer = useCallback(async () => {
    try {
      const res = await api.get(`/requisiciones/${requisicionId}`);
      setReq(res.data.data as Detalle);
      setError(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'No se pudo cargar la requisición');
    } finally {
      setCargando(false);
    }
  }, [requisicionId]);

  useEffect(() => {
    void traer();
  }, [traer]);

  const refrescar = () => {
    void traer();
    onCambio();
  };

  if (cargando && !req) {
    return (
      <div className={cn('space-y-6', !lenta && 'invisible')}>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableSkeleton rows={6} columns={4} />
          </Table>
        </Card>
      </div>
    );
  }
  if (error && !req) {
    // Se puede llegar aquí desde Cotizaciones: sin el enlace de volver, la
    // persona quedaría encerrada en el error.
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {volverA}
        </button>
        <ErrorState description={error} onRetry={() => void traer()} />
      </div>
    );
  }
  if (!req) return null;

  const esAprobador = req.aprobador_id !== null && req.aprobador_id === user?.id;
  const pendientes = req.lineas.filter((l) => l.marca === 'pendiente').length;
  const adjuntosProyecto = req.adjuntos.filter((a) => a.tipo === 'adjunto');
  const cuadros = req.adjuntos.filter((a) => a.tipo === 'cuadro_comparativo');
  const datosBancarios = [req.beneficiario, req.banco, req.numero_cuenta].some((v) => v && v.trim());
  const aprobada = req.estado === 'aprobada';
  // Las cotizaciones se ven si hay alguna, o si quien la abre es Compras y
  // tiene que agregarlas.
  const conCotizaciones = aprobada && (req.puede.atender || req.cotizaciones.length > 0 || cuadros.length > 0);

  // La marca cambia en cuanto se escoge: se pinta ya y se guarda detrás. Si
  // el servidor no la acepta, vuelve lo que hay de verdad.
  const cambiarMarca = async (linea: LineaRequisicion, marca: Marca) => {
    setMarcando(linea.id);
    setReq((r) => (r ? { ...r, lineas: r.lineas.map((l) => (l.id === linea.id ? { ...l, marca } : l)) } : r));
    try {
      await api.patch(`/requisiciones/${req.id}/marcas`, { lineas: [{ id: linea.id, marca }] });
      setError(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'No se pudo cambiar la marca');
    } finally {
      setMarcando(null);
      refrescar();
    }
  };

  const marcaDe = (l: LineaRequisicion) =>
    req.puede.atender ? (
      <MarcaSelector
        marca={l.marca}
        ocupado={marcando === l.id}
        onCambiar={(m) => void cambiarMarca(l, m)}
        titulo={l.marca_por_nombre && l.marca_at ? `${l.marca_por_nombre} · ${diaDeMomento(l.marca_at)}` : undefined}
      />
    ) : (
      <MarcaBadge marca={l.marca} />
    );

  const abrirPdf = () => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/requisiciones/${req.id}/pdf?token=${token ?? ''}`, '_blank');
  };

  const aprobar = async () => {
    setAccion(true);
    setErrorClave(null);
    try {
      await api.post(`/requisiciones/${req.id}/aprobar`, { password: clave });
      setDialogo(null);
      refrescar();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      const msg = e.response?.data?.error ?? 'No se pudo aprobar';
      if (e.response?.status === 403 && /contraseña/i.test(msg)) setErrorClave(msg);
      else {
        setDialogo(null);
        setError(msg);
      }
    } finally {
      setAccion(false);
    }
  };

  const anular = async () => {
    setAccion(true);
    try {
      await api.post(`/requisiciones/${req.id}/anular`);
      setDialogo(null);
      refrescar();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setDialogo(null);
      setError(e.response?.data?.error ?? 'No se pudo anular');
    } finally {
      setAccion(false);
    }
  };

  // ------------------------------------------------------------ el siguiente paso
  let siguiente: { titulo: string; texto: string; botones?: ReactNode } | null = null;
  if (req.estado === 'por_aprobar' && req.puede.aprobar) {
    siguiente = {
      titulo: 'Siguiente paso: tu aprobación',
      texto: 'Apruébala tal como está, o corrígela y queda aprobada al guardar.',
      botones: (
        <>
          <Button variant="outline" onClick={() => setDialogo('editar')}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            onClick={() => {
              setClave('');
              setErrorClave(null);
              setDialogo('aprobar');
            }}
          >
            <Check className="mr-2 h-4 w-4" />
            Aprobar
          </Button>
        </>
      ),
    };
  } else if (req.estado === 'por_aprobar') {
    siguiente = {
      titulo: 'Siguiente paso: la aprobación',
      texto: req.aprobador_nombre ? `La aprueba ${req.aprobador_nombre}.` : 'Espera su aprobación.',
      botones: req.puede.editar ? (
        <Button variant="outline" onClick={() => setDialogo('editar')}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      ) : undefined,
    };
  } else if (req.estado === 'aprobada' && req.puede.atender) {
    siguiente = {
      titulo: 'Siguiente paso: atenderla',
      texto:
        pendientes === 0
          ? 'Todas las líneas están marcadas.'
          : `${pendientes} de ${req.lineas.length} ${req.lineas.length === 1 ? 'línea pendiente' : pendientes === 1 ? 'líneas pendiente' : 'líneas pendientes'}.`,
    };
  }

  // ------------------------------------------------------------------ la historia
  const eventos: Evento[] = [
    { clave: 'creada', momento: req.created_at, titulo: 'Creada', detalle: req.creado_por_nombre, punto: 'bg-slate-300' },
    ...req.cambios.map((c) => ({
      clave: `cambio-${c.id}`,
      momento: c.created_at,
      titulo: 'Corregida',
      detalle: c.user_nombre,
      punto: 'bg-slate-300',
      cambios: c.cambios,
    })),
  ];
  if (req.aprobada_at) {
    eventos.push({ clave: 'aprobada', momento: req.aprobada_at, titulo: 'Aprobada', detalle: req.aprobada_por_nombre ?? '', punto: 'bg-success' });
  }
  if (req.anulada_at) {
    eventos.push({ clave: 'anulada', momento: req.anulada_at, titulo: 'Anulada', detalle: req.anulada_por_nombre ?? '', punto: 'bg-error' });
  }
  for (const c of req.cotizaciones) {
    eventos.push({
      clave: `cotizacion-${c.id}`,
      momento: c.created_at,
      titulo: 'Cotización agregada',
      detalle: `${c.subido_por_nombre} · ${c.proveedor}`,
      punto: 'bg-slate-300',
    });
  }
  for (const a of cuadros) {
    eventos.push({
      clave: `cuadro-${a.id}`,
      momento: a.created_at,
      titulo: 'Cuadro comparativo agregado',
      detalle: a.subido_por_nombre,
      punto: 'bg-slate-300',
    });
  }
  // Lo más nuevo arriba; si dos pasan en el mismo instante (corregir y aprobar
  // al guardar), la aprobación va encima de la corrección.
  eventos.reverse().sort((a, b) => new Date(b.momento).getTime() - new Date(a.momento).getTime());

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {volverA}
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold text-foreground">{req.numero}</h1>
            <EstadoBadge estado={req.estado} />
          </div>
          <p className="mt-1 text-sm text-slate-700">{req.proyecto_nombre}</p>
          <p className="mt-0.5 text-sm text-foreground">{req.descripcion}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={abrirPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          {req.puede.anular && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" title="Más acciones" aria-label="Más acciones">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDialogo('anular')} className="text-error focus:text-error">
                  <Ban className="mr-2 h-4 w-4" />
                  Anular requisición
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}
      {aviso && <Alert variant="warning" title={aviso} dismissible onDismiss={() => setAviso(null)} />}

      {req.estado === 'anulada' ? (
        <Alert
          variant="warning"
          title="Esta requisición está anulada"
          description={
            req.anulada_por_nombre && req.anulada_at
              ? `La anuló ${req.anulada_por_nombre} el ${diaDeMomento(req.anulada_at)}.`
              : undefined
          }
        />
      ) : (
        siguiente && (
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-teal">{siguiente.titulo}</p>
                <p className="mt-0.5 text-sm text-slate-700">{siguiente.texto}</p>
              </div>
              {siguiente.botones && <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">{siguiente.botones}</div>}
            </div>
          </Card>
        )
      )}

      {/* La requisición, como el papel. */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-1 divide-y divide-border border-b border-border md:grid-cols-4 md:divide-x md:divide-y-0">
          <Dato etiqueta="Escrita por" sub={diaDeMomento(req.created_at)}>
            {req.creado_por_nombre}
          </Dato>
          {req.estado === 'aprobada' ? (
            <Dato etiqueta="Aprobada por" sub={req.aprobada_at ? diaDeMomento(req.aprobada_at) : null}>
              {req.aprobada_por_nombre}
            </Dato>
          ) : (
            <Dato etiqueta="La aprueba">{req.aprobador_nombre ?? '—'}</Dato>
          )}
          <Dato etiqueta="Fecha requerida">
            <span className="tabular-nums">{diaDe(req.fecha_requerida)}</span>
          </Dato>
          <Dato etiqueta="Prioridad">
            <PrioridadEtiqueta prioridad={req.prioridad} className="font-semibold text-foreground" />
          </Dato>
        </div>

        {/* Teléfono: un bloque por línea. */}
        <div className="divide-y divide-slate-100 md:hidden">
          {req.lineas.map((l, i) => (
            <div key={l.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">{i + 1}.</span> {l.descripcion}
                </p>
                {aprobada && marcaDe(l)}
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {cantidadDe(l.cantidad)} {l.unidad ?? ''}
                {l.renglon_desglose ? ` · desglose ${l.renglon_desglose}` : ''}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="w-[64px] px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">N°</TableHead>
                <TableHead className="w-[96px] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cant.</TableHead>
                <TableHead className="w-[110px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidad</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</TableHead>
                <TableHead className="w-[190px] px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Renglón del desglose</TableHead>
                {aprobada && (
                  <TableHead className="w-[150px] px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marca</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {req.lineas.map((l, i) => (
                <TableRow key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-transparent">
                  <TableCell className="px-5 py-3 text-center text-sm tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">{cantidadDe(l.cantidad)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{l.unidad ?? ''}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">{l.descripcion}</TableCell>
                  <TableCell className="px-4 py-3 text-center text-sm tabular-nums text-slate-700">
                    {l.renglon_desglose ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  {aprobada && <TableCell className="px-5 py-2.5">{marcaDe(l)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {(req.notas || datosBancarios) && (
          <div className="grid gap-4 border-t border-border px-5 py-4 sm:grid-cols-2">
            {req.notas && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{req.notas}</p>
              </div>
            )}
            {datosBancarios && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos bancarios</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{req.beneficiario}</p>
                <p className="text-sm tabular-nums text-slate-700">
                  {[req.banco, req.tipo_cuenta === 'ahorro' ? 'Ahorro' : req.tipo_cuenta === 'corriente' ? 'Corriente' : null, req.numero_cuenta]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {conCotizaciones && <CotizacionesSeccion requisicion={req} onCambio={refrescar} />}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <SectionHeader title="Historia" />
          <Card className="px-5 py-1">
            {eventos.map((ev) => (
              <div key={ev.clave} className="grid grid-cols-[100px_12px_1fr] gap-3 border-b border-slate-100 py-3 last:border-0">
                <span className="whitespace-nowrap pt-px text-xs tabular-nums text-muted-foreground">{momentoCorto(ev.momento)}</span>
                <span aria-hidden className={cn('mt-1.5 h-2.5 w-2.5 rounded-full', ev.punto)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{ev.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ev.detalle}</p>
                  {ev.cambios && ev.cambios.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-slate-700">
                      {ev.cambios.map((c, k) => (
                        <li key={k}>
                          <span className="text-muted-foreground">{c.campo}:</span> {valorLegible(c.campo, c.antes)} →{' '}
                          {valorLegible(c.campo, c.despues)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-3">
          <SectionHeader title="Adjuntos del proyecto" />
          <Card className="p-5">
            {adjuntosProyecto.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin adjuntos.</p>
            ) : (
              <AdjuntosPreview
                adjuntos={adjuntosProyecto}
                rutaUrls={`/requisiciones/${req.id}/archivos/urls`}
                readOnly
                title="Archivos del proyecto"
              />
            )}
          </Card>
        </div>
      </div>

      <RequisicionFormDialog
        open={dialogo === 'editar'}
        onOpenChange={(v) => setDialogo(v ? 'editar' : null)}
        proyectoId={req.proyecto_id}
        proyectoNombre={req.proyecto_nombre}
        requisicion={req}
        esAprobador={esAprobador}
        onListo={(_id, sinSubir) => {
          if (sinSubir.length) setAviso(`No se pudo subir: ${sinSubir.join(', ')}`);
          refrescar();
        }}
      />
      <BulkApprovalPasswordDialog
        open={dialogo === 'aprobar'}
        onOpenChange={(v) => !accion && setDialogo(v ? 'aprobar' : null)}
        password={clave}
        onPasswordChange={setClave}
        pendingApprovalId={req.id}
        reviewedCount={0}
        loading={accion}
        error={errorClave}
        onConfirm={() => void aprobar()}
        description={`Ingresa tu contraseña para aprobar la requisición ${req.numero}.`}
      />
      <AlertDialog open={dialogo === 'anular'} onOpenChange={(v) => !accion && setDialogo(v ? 'anular' : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular {req.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale de Por aprobar y no llega a Compras. Queda guardada en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void anular();
              }}
              disabled={accion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {accion ? 'Anulando...' : 'Anular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
