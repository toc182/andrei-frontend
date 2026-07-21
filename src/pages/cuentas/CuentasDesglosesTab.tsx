// CuentasDesglosesTab — pestaña "Desgloses" de la página de Cuentas del proyecto.
//
// Los desgloses de trabajo del proyecto (tipo='cuentas'): el detallado con el
// que se arman las cuentas, el que sale del diseño, el de sustento para la
// institución. Se crean en blanco o copiando uno existente; cada uno lleva su
// hilo de comentarios. El desglose OFICIAL no vive aquí — sigue en Información.
//
// Backend: routes/desgloses.ts (/proyecto/:id/cuentas), migración 142.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { DesgloseView } from '@/components/desglose/DesgloseView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { DatePicker } from '@/components/shell/DatePicker';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import {
  getDesglosesCuentas, getFuentesDesglose, crearDesgloseCuenta, agregarComentarioDesglose,
  type DesgloseCuenta, type DesgloseFuente,
} from '@/lib/desgloseApi';

const fmtFecha = (ymd: string | null) => {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const fmtFechaHora = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hoyYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// §10: banda de encabezado y filas de la tabla-en-tarjeta.
const HEADER_CELL = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const ROW = 'border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60';

interface Props {
  proyectoId: number;
  proyectoNombre?: string;
  /** El botón "Nuevo desglose" vive en el PageHeader, como en las demás páginas. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /** Con un desglose abierto el botón del PageHeader no aplica. */
  onAbiertoChange?: (abierto: boolean) => void;
}

export default function CuentasDesglosesTab({
  proyectoId, proyectoNombre, createOpen, onCreateOpenChange, onAbiertoChange,
}: Props) {
  /** Desglose abierto en el editor; null = viendo la lista. */
  const [editando, setEditando] = useState<DesgloseCuenta | null>(null);
  const [desgloses, setDesgloses] = useState<DesgloseCuenta[] | null>(null);
  /** De cuáles se puede copiar: el oficial + los de esta pestaña. */
  const [fuentes, setFuentes] = useState<DesgloseFuente[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const setCreateOpen = onCreateOpenChange;
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState(hoyYMD());
  /** 'blanco' o el id (como string) del desglose a copiar. */
  const [nuevoOrigen, setNuevoOrigen] = useState('blanco');
  /** id del desglose cuyos comentarios están abiertos. */
  const [comentariosDe, setComentariosDe] = useState<number | null>(null);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const lista = desgloses ?? [];
  const abierto = lista.find((d) => d.id === comentariosDe) ?? null;

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [lst, fts] = await Promise.all([
        getDesglosesCuentas(proyectoId),
        getFuentesDesglose(proyectoId),
      ]);
      setDesgloses(lst);
      setFuentes(fts);
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setLoadErr(status === 403
        ? 'No tienes permiso para ver los desgloses.'
        : 'No se pudieron cargar los desgloses.');
    }
  }, [proyectoId]);

  // Guarda contra respuestas viejas: si cambia el proyecto mientras una
  // petición viaja, la vieja no debe pintar.
  useEffect(() => {
    let vigente = true;
    setDesgloses(null);
    setFuentes([]);
    (async () => {
      try {
        const [lst, fts] = await Promise.all([
          getDesglosesCuentas(proyectoId),
          getFuentesDesglose(proyectoId),
        ]);
        if (!vigente) return;
        setDesgloses(lst);
        setFuentes(fts);
        setLoadErr(null);
      } catch (e) {
        if (!vigente) return;
        const status = (e as { response?: { status?: number } }).response?.status;
        setLoadErr(status === 403
          ? 'No tienes permiso para ver los desgloses.'
          : 'No se pudieron cargar los desgloses.');
      }
    })();
    return () => { vigente = false; };
  }, [proyectoId]);

  const mensajeError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;

  const crearDesglose = async () => {
    const descripcion = nuevaDescripcion.trim();
    if (!descripcion || busy) return;
    setBusy(true);
    setActionErr(null);
    try {
      setDesgloses(await crearDesgloseCuenta(proyectoId, {
        descripcion,
        fecha: nuevaFecha || null,
        copiarDeId: nuevoOrigen === 'blanco' ? null : Number(nuevoOrigen),
      }));
      // El nuevo desglose pasa a ser una fuente válida para el siguiente.
      setFuentes(await getFuentesDesglose(proyectoId));
      setCreateOpen(false);
      setNuevaDescripcion('');
      setNuevaFecha(hoyYMD());
      setNuevoOrigen('blanco');
    } catch (e) {
      setActionErr(mensajeError(e, 'No se pudo crear el desglose.'));
    } finally {
      setBusy(false);
    }
  };

  const agregarComentario = async () => {
    const texto = nuevoComentario.trim();
    if (!texto || comentariosDe == null || busy) return;
    setBusy(true);
    setActionErr(null);
    try {
      setDesgloses(await agregarComentarioDesglose(proyectoId, comentariosDe, texto));
      setNuevoComentario('');
    } catch (e) {
      setActionErr(mensajeError(e, 'No se pudo agregar el comentario.'));
    } finally {
      setBusy(false);
    }
  };

  // Con un desglose abierto, la pestaña ES el editor: mismo componente que
  // Información, apuntado a este desglose por id.
  if (editando) {
    return (
      <DesgloseView
        proyectoId={proyectoId}
        proyectoNombre={proyectoNombre}
        desgloseId={editando.id}
        titulo={editando.descripcion}
        onBack={() => { setEditando(null); onAbiertoChange?.(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Misma estructura que las demás tablas del ERP (CronogramasIndexPage,
          ClientesN, UsuariosPage): Card > Table, banda de encabezado, celdas
          px-4 py-2.5, sin toolbar ni pie. El botón vive en el PageHeader. */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
              <TableHead className={HEADER_CELL}>Descripción</TableHead>
              <TableHead className={`${HEADER_CELL} w-[1%] whitespace-nowrap`}>Fecha</TableHead>
              <TableHead className={`${HEADER_CELL} w-[1%] whitespace-nowrap text-center`}>
                Comentarios
              </TableHead>
            </TableRow>
          </TableHeader>
          {desgloses == null && !loadErr ? (
            <TableSkeleton rows={3} columns={3} />
          ) : (
          <TableBody>
            {loadErr ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <ErrorState description={loadErr} onRetry={load} />
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <EmptyState
                    title="Sin desgloses"
                    description="Agrega un desglose para empezar a construir las cuentas con él."
                  />
                </TableCell>
              </TableRow>
            ) : (
              lista.map((d) => (
                <TableRow
                  key={d.id}
                  className={`${ROW} cursor-pointer`}
                  onClick={() => { setEditando(d); onAbiertoChange?.(true); }}
                >
                  <TableCell className="px-4 py-2.5 font-medium">
                    {d.descripcion}
                    {d.copiadoDeId != null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        copiado de {fuentes.find((o) => o.id === d.copiadoDeId)?.descripcion
                          ?? lista.find((o) => o.id === d.copiadoDeId)?.descripcion
                          ?? 'un desglose eliminado'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap px-4 py-2.5 tabular-nums">
                    {fmtFecha(d.fecha)}
                  </TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap px-4 py-2.5 text-center">
                    <button
                      className="inline-flex items-center gap-1.5 rounded p-1.5 text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                      onClick={(e) => {
                        // La fila abre el desglose; este botón NO debe hacerlo.
                        e.stopPropagation();
                        setComentariosDe(d.id);
                        setNuevoComentario('');
                      }}
                      title="Comentarios"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="tabular-nums">{d.comentarios.length}</span>
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          )}
        </Table>
      </Card>

      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        size="simple"
        title="Nuevo desglose"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={crearDesglose} disabled={!nuevaDescripcion.trim() || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input
              value={nuevaDescripcion}
              onChange={(e) => setNuevaDescripcion(e.target.value)}
              placeholder="p. ej. Desglose detallado para cuentas"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <DatePicker value={nuevaFecha} onChange={setNuevaFecha} />
          </div>
          <div className="space-y-1.5">
            <Label>Crear desde</Label>
            <Select value={nuevoOrigen} onValueChange={setNuevoOrigen}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blanco">En blanco</SelectItem>
                {fuentes.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    Copia de: {f.descripcion}
                    {f.tipo === 'oficial' ? ' (oficial)' : ''} — {f.filas} fila{f.filas === 1 ? '' : 's'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Al copiar se duplican las filas del desglose elegido; después son independientes.
            </p>
          </div>

          {actionErr && <Alert variant="error" title={actionErr} />}
        </div>
      </AppDialog>

      <AppDialog
        open={abierto !== null}
        onOpenChange={(o) => { if (!o) setComentariosDe(null); }}
        size="simple"
        title="Comentarios"
        description={abierto?.descripcion}
        footer={<Button variant="outline" onClick={() => setComentariosDe(null)}>Cerrar</Button>}
      >
        <div className="space-y-4">
          {abierto && abierto.comentarios.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Todavía no hay comentarios.</p>
          ) : (
            <ul className="space-y-3">
              {abierto?.comentarios.map((c) => (
                <li key={c.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{c.autor}</span>
                    <span className="text-xs text-muted-foreground">{fmtFechaHora(c.creadoAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.texto}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <Label>Agregar comentario</Label>
            <Textarea
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              rows={3}
              placeholder="Escribe un comentario…"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={agregarComentario} disabled={!nuevoComentario.trim() || busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar comentario
              </Button>
            </div>
          </div>

          {actionErr && <Alert variant="error" title={actionErr} />}
        </div>
      </AppDialog>
    </div>
  );
}
