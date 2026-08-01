import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DatePicker } from '@/components/shell/DatePicker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { AppDialog } from '@/components/shell/AppDialog';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CuentaEstado, CuentaEvento } from '@/types/api';
import api from '@/services/api';
import { ESTADO_CONFIG } from './config';

const ESTADO_KEYS = Object.keys(ESTADO_CONFIG) as CuentaEstado[];

const estadoLabel = (estado: string | null | undefined): string => {
  if (!estado) return '—';
  return ESTADO_CONFIG[estado as CuentaEstado]?.label ?? estado;
};

interface Props {
  cuentaId: number;
  eventos: CuentaEvento[];
  onChanged: () => void;
  /** El campo para escribir se abre desde el menú de la card, no vive aquí. */
  agregando?: boolean;
  onAgregandoChange?: (v: boolean) => void;
}

/** Titular de una línea del historial: lo que se lee sin abrirla. */
function tituloEvento(ev: CuentaEvento): string {
  if (ev.tipo === 'transicion') return estadoLabel(ev.estado_hacia);
  if (ev.tipo === 'creacion') return ev.comentario?.split('\n')[0] || 'Cuenta creada';
  if (ev.tipo === 'edicion') return ev.comentario?.split('\n')[0] || 'Cuenta editada';
  return ev.comentario?.split('\n')[0] || 'Actualización';
}

function formatEventDate(s: string): string {
  const d = new Date(s);
  const dd = String(d.getDate()).padStart(2, '0');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${dd}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function toDateInputValue(iso: string): string {
  // The created_at string is "YYYY-MM-DD HH:MM:SS" (TIMESTAMP without TZ).
  // Take its first 10 chars so we don't shift days via timezone math.
  return iso.slice(0, 10);
}

/** Acción de una línea abierta del historial: texto pequeño, sin relleno,
 *  para que no compita con el titular del evento. Frena el clic porque la
 *  fila entera es un botón que abre y cierra. */
function EventoAccion({
  icon: Icon, destructiva, onClick, children,
}: {
  icon: LucideIcon;
  destructiva?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'h-auto gap-1.5 px-0 py-0 text-xs font-medium text-muted-foreground hover:bg-transparent',
        destructiva ? 'hover:text-error' : 'hover:text-navy',
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </Button>
  );
}

export default function CuentaTimeline({
  cuentaId, eventos, onChanged, agregando = false, onAgregandoChange,
}: Props) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState<CuentaEvento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Evento abierto; solo uno a la vez. */
  const [expandido, setExpandido] = useState<number | null>(null);

  const postUpdate = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post(`/cuentas/${cuentaId}/comentario`, { comentario: text });
      setText('');
      onAgregandoChange?.(false);
      onChanged();
    } finally {
      setPosting(false);
    }
  };

  const confirmDelete = async () => {
    if (deletingId == null) return;
    setDeleting(true);
    try {
      await api.delete(`/cuentas/${cuentaId}/evento/${deletingId}`);
      setDeletingId(null);
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Lista compacta con scroll propio: la card vive en una fila de tres
          tercios y no debe estirarse con el largo del historial. Cada línea
          se abre al hacer clic para ver el detalle completo. */}
      <div className="-mr-1.5 max-h-[200px] flex-1 space-y-0.5 overflow-y-auto pr-1.5">
        {eventos.map((ev, i) => {
          const abierto = expandido === ev.id;
          const detalle = ev.tipo === 'transicion' || !!ev.comentario;
          return (
            <div
              key={ev.id}
              className={cn(
                'grid grid-cols-[auto_1fr] items-start gap-x-2.5 rounded-md py-1.5 pl-1 pr-1.5',
                'cursor-pointer transition-colors hover:bg-slate-50',
                abierto && 'bg-slate-50',
              )}
              role="button"
              tabIndex={0}
              aria-expanded={abierto}
              onClick={() => setExpandido(abierto ? null : ev.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandido(abierto ? null : ev.id); }
              }}
            >
              <span
                className={cn(
                  'mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full',
                  i === 0 ? 'bg-navy' : 'bg-slate-300',
                )}
                aria-hidden
              />

              <div className="min-w-0">
                <p className={cn('text-[13px] font-medium leading-5', !abierto && 'truncate')}>
                  {tituloEvento(ev)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatEventDate(ev.created_at)} · {ev.creado_por_nombre}
                </p>

                {abierto && detalle && (
                  <div className="mt-1.5 space-y-1 border-l-2 border-border pl-2.5 text-xs text-muted-foreground">
                    {ev.tipo === 'transicion' && (
                      <p>
                        {estadoLabel(ev.estado_desde)} →{' '}
                        <strong className="font-medium text-foreground">{estadoLabel(ev.estado_hacia)}</strong>
                      </p>
                    )}
                    {ev.comentario && <p className="whitespace-pre-line">{ev.comentario}</p>}
                  </div>
                )}

                {/* Editar y eliminar viven dentro de la línea abierta: la card
                    ya tiene su propio menú ⋯ arriba y un segundo disparador
                    idéntico por fila se leía como un error. */}
                {abierto && (
                  <div className="mt-2 flex gap-3.5 pl-2.5">
                    <EventoAccion icon={Pencil} onClick={() => setEditing(ev)}>
                      Editar
                    </EventoAccion>
                    <EventoAccion icon={Trash2} destructiva onClick={() => setDeletingId(ev.id)}>
                      Eliminar
                    </EventoAccion>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agregar actualización — el campo aparece solo cuando se pide, desde
          el menú de la card; con la lista siempre visible no cabe. */}
      {agregando && (
        <div className="mt-2.5 shrink-0 border-t border-border pt-2.5">
          <Textarea
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe una actualización…"
            rows={2}
            className="text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setText(''); onAgregandoChange?.(false); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={postUpdate} disabled={!text.trim() || posting}>
              {posting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Agregar
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <EditEventoDialog
        open={!!editing}
        evento={editing}
        cuentaId={cuentaId}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        onSaved={() => { setEditing(null); onChanged(); }}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El evento desaparecerá del historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {deleting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Edit Evento Dialog ─────────────────────────────────────────────────

function EditEventoDialog({
  open,
  evento,
  cuentaId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  evento: CuentaEvento | null;
  cuentaId: number;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [fecha, setFecha] = useState('');
  const [comentario, setComentario] = useState('');
  const [estadoDesde, setEstadoDesde] = useState<string>('');
  const [estadoHacia, setEstadoHacia] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && evento) {
      setFecha(toDateInputValue(evento.created_at));
      setComentario(evento.comentario ?? '');
      setEstadoDesde(evento.estado_desde ?? '');
      setEstadoHacia(evento.estado_hacia ?? '');
      setError('');
    }
  }, [open, evento]);

  if (!evento) return null;

  const isTransicion = evento.tipo === 'transicion';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Only send fields that actually changed.
      const payload: Record<string, unknown> = {};
      const origFecha = toDateInputValue(evento.created_at);
      if (fecha !== origFecha) payload.fecha = fecha;

      const trimmed = comentario.trim();
      const origComentario = evento.comentario ?? '';
      if (trimmed !== origComentario.trim()) {
        payload.comentario = trimmed || null;
      }

      if (isTransicion) {
        const origDesde = evento.estado_desde ?? '';
        const origHacia = evento.estado_hacia ?? '';
        if (estadoDesde !== origDesde) {
          payload.estado_desde = estadoDesde || null;
        }
        if (estadoHacia !== origHacia) {
          payload.estado_hacia = estadoHacia || null;
        }
      }

      if (Object.keys(payload).length === 0) {
        onOpenChange(false);
        return;
      }

      await api.patch(`/cuentas/${cuentaId}/evento/${evento.id}`, payload);
      onSaved();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error al guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="simple"
      title="Editar evento"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button form="edit-evento-form" type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="edit-evento-form"
        onSubmit={(e) => { e.preventDefault(); save(); }}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="evento-fecha">Fecha</Label>
          <DatePicker value={fecha} onChange={setFecha} />
        </div>

        {isTransicion && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado desde</Label>
              <Select
                value={estadoDesde || 'none'}
                onValueChange={(v) => setEstadoDesde(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ESTADO_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ESTADO_CONFIG[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado hacia</Label>
              <Select
                value={estadoHacia || 'none'}
                onValueChange={(v) => setEstadoHacia(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ESTADO_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ESTADO_CONFIG[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="evento-comentario">Comentario</Label>
          <Textarea
            id="evento-comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
      </form>
    </AppDialog>
  );
}
