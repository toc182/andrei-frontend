import { useEffect, useState } from 'react';
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
}

const TYPE_STYLES: Record<string, { dot: string }> = {
  creacion: { dot: 'border-teal' },
  transicion: { dot: 'border-info' },
  comentario: { dot: 'border-slate-300' },
  edicion: { dot: 'border-warning' },
};

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

export default function CuentaTimeline({ cuentaId, eventos, onChanged }: Props) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState<CuentaEvento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const postUpdate = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post(`/cuentas/${cuentaId}/comentario`, { comentario: text });
      setText('');
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
    <div>
      {/* Timeline */}
      <div className="relative pl-6">
        {eventos.map((ev, i) => {
          const style = TYPE_STYLES[ev.tipo] || TYPE_STYLES.comentario;
          const isLast = i === eventos.length - 1;
          return (
            <div key={ev.id} className="relative pb-5 last:pb-0">
              {/* Dot */}
              <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white ${style.dot}`} />
              {/* Connector line to next event */}
              {!isLast && (
                <div className="absolute -left-[17px] top-5 -bottom-1 w-0.5 bg-border" />
              )}

              {/* Meta */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-medium">{ev.creado_por_nombre}</span>
                <span className="text-xs text-muted-foreground">{formatEventDate(ev.created_at)}</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar evento"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditing(ev)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar evento"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingId(ev.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="text-sm text-muted-foreground leading-relaxed">
                {ev.tipo === 'transicion' && (
                  <span>
                    {estadoLabel(ev.estado_desde)} → <strong className="text-foreground">{estadoLabel(ev.estado_hacia)}</strong>
                  </span>
                )}
                {ev.comentario && (
                  <span className={ev.tipo === 'transicion' ? 'block mt-1' : ''}>
                    {ev.comentario}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add update */}
      <div className="mt-4">
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Agregar actualización..."
            rows={2}
            className="flex-1 text-sm"
          />
          <Button onClick={postUpdate} disabled={!text.trim() || posting} size="sm" className="self-end">
            {posting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Enviar
          </Button>
        </div>
      </div>

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
