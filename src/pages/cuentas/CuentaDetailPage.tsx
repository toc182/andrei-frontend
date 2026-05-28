import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Settings, Upload, Download, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import api from '@/services/api';
import type { CuentaDetail, CuentaEstado } from '@/types/api';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import CuentaTimeline from './CuentaTimeline';
import AvanceBar from './AvanceBar';
import {
  formatMonto,
  formatDateExact,
  getFlow,
  getBuckets,
  bucketLabel,
  bucketToEstado,
  estadoToBucket,
  type Bucket,
} from './config';

interface Props {
  cuentaId: number;
  onBack?: () => void;
}

export default function CuentaDetailPage({ cuentaId, onBack }: Props) {
  const [cuenta, setCuenta] = useState<CuentaDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/cuentas/${cuentaId}`);
      setCuenta(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [cuentaId]);

  if (loading || !cuenta) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>;
  }

  const LOCKED = ['aprobada', 'pagada', 'aprobada_institucion', 'aprobada_contraloria'].includes(cuenta.estado);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            aria-label="Volver a cuentas"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <PageHeader title={`Cuenta ${cuenta.numero}`} />
        <CuentaEstadoBadge
          estado={cuenta.estado}
          clienteLabel={cuenta.cliente_abreviatura || cuenta.cliente_nombre}
        />
      </div>

      {/* Details card */}
      <Card className="relative">
        <CardContent className="p-5">
          {!LOCKED && (
            <div className="absolute top-4 right-4">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowEdit(true)}
                aria-label="Editar cuenta"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Monto</div>
              <div className="font-medium">{formatMonto(cuenta.monto_total)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Periodo inicio</div>
              <div className="font-medium">{formatDateExact(cuenta.periodo_inicio)  || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Periodo fin</div>
              <div className="font-medium">{formatDateExact(cuenta.periodo_fin) || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Avance</div>
              <AvanceBar value={cuenta.avance_porcentaje} width={60} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Historial</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTransition(true)}
            >
              Cambiar estado
            </Button>
          </div>
          <CuentaTimeline cuentaId={cuentaId} eventos={cuenta.eventos} onChanged={load} />
        </CardContent>
      </Card>

      {/* Adjuntos */}
      <AdjuntosSection cuentaId={cuentaId} adjuntos={cuenta.adjuntos} onChanged={load} />

      {/* Edit dialog */}
      <EditCuentaDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        cuenta={cuenta}
        onSaved={() => { setShowEdit(false); load(); }}
        onDeleted={() => { setShowEdit(false); onBack?.(); }}
      />

      {/* Transition dialog */}
      <TransitionDialog
        open={showTransition}
        onOpenChange={setShowTransition}
        cuenta={cuenta}
        onDone={() => { setShowTransition(false); load(); }}
      />
    </div>
  );
}

// ── Adjuntos Section ────────────────────────────────────────────────────

function AdjuntosSection({ cuentaId, adjuntos, onChanged }: {
  cuentaId: number;
  adjuntos: CuentaDetail['adjuntos'];
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState<File | null>(null);

  const upload = async (file: File) => {
    setUploading(file);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/cuentas/${cuentaId}/adjuntos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChanged();
    } finally {
      setUploading(null);
    }
  };

  const download = async (adjId: number, nombre: string) => {
    const res = await api.get(`/cuentas/${cuentaId}/adjuntos/${adjId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const remove = async (adjId: number) => {
    await api.delete(`/cuentas/${cuentaId}/adjuntos/${adjId}`);
    onChanged();
  };

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-sm font-semibold mb-3">Adjuntos</h2>
        {(adjuntos.length > 0 || uploading) && (
          <div className="space-y-1.5 mb-3">
            {adjuntos.map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-muted/40 border rounded-md px-3 py-2 text-sm">
                <span className="flex-1 truncate">{a.nombre_original}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(a.tamano / 1024).toFixed(0)} KB
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(a.id, a.nombre_original)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {uploading && (
              <div className="flex items-center gap-3 bg-muted/40 border rounded-md px-3 py-2 text-sm">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                <span className="flex-1 truncate">{uploading.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Subiendo...
                </span>
              </div>
            )}
          </div>
        )}
        <label
          className={
            uploading
              ? 'flex items-center justify-center gap-2 p-3 border border-dashed rounded-md text-sm text-muted-foreground/50 cursor-not-allowed'
              : 'flex items-center justify-center gap-2 p-3 border border-dashed rounded-md text-sm text-muted-foreground cursor-pointer hover:border-foreground/30 hover:text-foreground/60 transition-colors'
          }
        >
          <Upload className="h-4 w-4" />
          Subir archivo
          <input
            type="file"
            className="hidden"
            disabled={!!uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </label>
      </CardContent>
    </Card>
  );
}

// ── Edit Dialog ─────────────────────────────────────────────────────────

function EditCuentaDialog({ open, onOpenChange, cuenta, onSaved, onDeleted }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuenta: CuentaDetail;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [monto, setMonto] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [avance, setAvance] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = cuenta.estado === 'borrador';

  useEffect(() => {
    if (open) {
      setMonto(cuenta.monto_total || '');
      setInicio(cuenta.periodo_inicio?.split('T')[0] || '');
      setFin(cuenta.periodo_fin?.split('T')[0] || '');
      setAvance(cuenta.avance_porcentaje || '');
    }
  }, [open, cuenta]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/cuentas/${cuenta.id}`, {
        monto_total: Number(monto),
        periodo_inicio: inicio || null,
        periodo_fin: fin || null,
        avance_porcentaje: avance ? Number(avance) : null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/cuentas/${cuenta.id}`);
      setConfirmDelete(false);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="simple"
        title="Editar cuenta"
        footer={
          <>
            {canDelete ? (
              <Button
                variant="outline"
                className="text-error border-error/30 hover:bg-error/10 mr-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            ) : (
              <span className="mr-auto" />
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancelar</Button>
            <Button form="edit-cuenta-form" type="submit" disabled={saving || deleting}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </>
        }
      >
        <form id="edit-cuenta-form" onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
          <div><Label>Monto (B/.)</Label><Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Periodo inicio</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div><Label>Periodo fin</Label><Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
          </div>
          <div><Label>Avance (%)</Label><Input type="number" step="0.01" min="0" max="100" value={avance} onChange={(e) => setAvance(e.target.value)} /></div>
        </form>
      </AppDialog>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Cuenta {cuenta.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={deleting}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Transition Dialog ───────────────────────────────────────────────────

function TransitionDialog({ open, onOpenChange, cuenta, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuenta: CuentaDetail;
  onDone: () => void;
}) {
  const flow = getFlow(cuenta.proyecto_tipo, cuenta.proyecto_tiene_ipt);
  const clienteLabel =
    cuenta.cliente_abreviatura || cuenta.cliente_nombre || 'Cliente';
  const buckets = getBuckets(flow);
  const currentBucket = estadoToBucket(cuenta.estado as CuentaEstado);

  const [selected, setSelected] = useState<Bucket | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSelected('');
      setComment('');
      setError('');
    }
  }, [open]);

  const save = async () => {
    if (!selected) return;
    const targetEstado = bucketToEstado(
      selected,
      flow,
      cuenta.estado as CuentaEstado,
    );
    setSaving(true);
    try {
      await api.post(`/cuentas/${cuenta.id}/transicion`, {
        estado_hacia: targetEstado,
        comentario: comment || undefined,
      });
      onDone();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="simple"
      title="Cambiar estado"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button form="transition-cuenta-form" type="submit" disabled={!selected || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </>
      }
    >
      <form id="transition-cuenta-form" onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
        <RadioGroup
          value={selected}
          onValueChange={(v) => setSelected(v as Bucket)}
          className="space-y-2"
        >
          {buckets.map((b) => {
            const isCurrent = b === currentBucket;
            return (
              <label
                key={b}
                htmlFor={`bucket-${b}`}
                className={`flex items-center gap-3 border rounded-md p-3 transition-colors ${
                  isCurrent
                    ? 'border-border bg-muted/40 cursor-not-allowed opacity-60'
                    : selected === b
                      ? 'border-foreground bg-muted/50 cursor-pointer'
                      : 'cursor-pointer hover:border-border'
                }`}
              >
                <RadioGroupItem
                  id={`bucket-${b}`}
                  value={b}
                  disabled={isCurrent}
                />
                <span className="text-sm flex-1">{bucketLabel(b, clienteLabel)}</span>
                {isCurrent && (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Estado actual
                  </span>
                )}
              </label>
            );
          })}
        </RadioGroup>
        <div>
          <Label>Comentario (opcional)</Label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
      </form>
    </AppDialog>
  );
}
