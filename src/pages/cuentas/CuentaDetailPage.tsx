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
import { DatePicker } from '@/components/shell/DatePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Plus, Upload, Download, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import api from '@/services/api';
import type { CuentaDetail, CuentaEstado, CuentaAjuste, CuentaAjusteOpcion, CuentaAjusteTipo } from '@/types/api';
import { cn } from '@/lib/utils';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import CuentaTimeline from './CuentaTimeline';
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

function calcMontoAPagar(monto: string, ajustes: CuentaAjuste[]): number {
  const base = Number(monto) || 0;
  return ajustes.reduce((acc, aj) => {
    const m = Number(aj.monto) || 0;
    return acc + (aj.tipo === 'aumento' ? m : -m);
  }, base);
}

function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!s || !e) return null;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
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
        {!LOCKED && (
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="ml-auto">
            <Pencil className="mr-2 h-4 w-4" />
            Editar cuenta
          </Button>
        )}
      </div>

      {/* Details + Monto cards — side by side on md+, stacked on narrow screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="text-right text-muted-foreground">Estado:</span>
              <CuentaEstadoBadge
                estado={cuenta.estado}
                clienteLabel={cuenta.cliente_abreviatura || cuenta.cliente_nombre}
                className="justify-self-start"
              />

              <span className="text-right text-muted-foreground">Periodo inicio:</span>
              <span className="tabular-nums">{formatDateExact(cuenta.periodo_inicio) || '—'}</span>

              <span className="text-right text-muted-foreground">Periodo fin:</span>
              <span className="tabular-nums">{formatDateExact(cuenta.periodo_fin) || '—'}</span>

              <span className="text-right text-muted-foreground">Cantidad de días:</span>
              <span className="tabular-nums">
                {(() => {
                  const d = daysBetween(cuenta.periodo_inicio, cuenta.periodo_fin);
                  return d != null ? `${d}` : '—';
                })()}
              </span>

              <span className="text-right text-muted-foreground">Avance:</span>
              <span className="tabular-nums">
                {cuenta.avance_porcentaje != null && cuenta.avance_porcentaje !== ''
                  ? `${Number(cuenta.avance_porcentaje).toFixed(2)}%`
                  : '—'}
              </span>

              <span className="text-right text-muted-foreground">Avance total hasta esta cuenta:</span>
              <span className="tabular-nums">{Number(cuenta.avance_acumulado).toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monto bruto:</span>
              <span className="tabular-nums">{formatMonto(cuenta.monto_total)}</span>
            </div>

            {cuenta.ajustes.length > 0 && (
              <>
                <div className="mt-2 space-y-1.5">
                  {cuenta.ajustes.map((aj) => (
                    <div key={aj.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{aj.descripcion}:</span>
                      <span className={cn('tabular-nums', aj.tipo === 'disminucion' && 'text-error')}>
                        {aj.tipo === 'disminucion' ? '-' : ''}{formatMonto(aj.monto)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-3">
                  <span>Monto a pagar:</span>
                  <span className="tabular-nums">{formatMonto(calcMontoAPagar(cuenta.monto_total, cuenta.ajustes))}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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

interface AjusteFormItem {
  tipo: 'aumento' | 'disminucion';
  descripcion: string;
  monto: string;
}

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
  const [ajustes, setAjustes] = useState<AjusteFormItem[]>([]);
  const [opciones, setOpciones] = useState<CuentaAjusteOpcion[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create-new-opcion sub-dialog state. createOpcionForRow holds the index
  // of the ajuste row that triggered the create flow, so we can auto-select
  // the new opcion for that row after it's saved.
  const [createOpcionForRow, setCreateOpcionForRow] = useState<number | null>(null);
  const [newOpcionTipo, setNewOpcionTipo] = useState<CuentaAjusteTipo>('disminucion');
  const [newOpcionDescripcion, setNewOpcionDescripcion] = useState('');
  const [savingOpcion, setSavingOpcion] = useState(false);

  const canDelete = cuenta.estado === 'borrador';

  useEffect(() => {
    if (open) {
      setMonto(cuenta.monto_total || '');
      setInicio(cuenta.periodo_inicio?.split('T')[0] || '');
      setFin(cuenta.periodo_fin?.split('T')[0] || '');
      setAvance(cuenta.avance_porcentaje || '');
      setAjustes(
        (cuenta.ajustes ?? []).map((a) => ({
          tipo: a.tipo,
          descripcion: a.descripcion,
          monto: a.monto,
        })),
      );
      setOpciones(cuenta.ajuste_opciones ?? []);
    }
  }, [open, cuenta]);

  // Combined option list shown in each row's Select: real project opciones,
  // plus any legacy ajuste combos that aren't yet in the project's options
  // (those appear as session-only "ghost" entries so the Select can match
  // their current value — without auto-persisting them as new options).
  const allOpciones: CuentaAjusteOpcion[] = (() => {
    const seen = new Set(opciones.map((o) => `${o.tipo}|${o.descripcion}`));
    const ghosts: CuentaAjusteOpcion[] = [];
    ajustes.forEach((aj, idx) => {
      if (!aj.descripcion) return;
      const key = `${aj.tipo}|${aj.descripcion}`;
      if (!seen.has(key)) {
        seen.add(key);
        ghosts.push({
          id: -1 - idx,
          tipo: aj.tipo,
          descripcion: aj.descripcion,
          orden: 9999 + idx,
        });
      }
    });
    return [...opciones, ...ghosts];
  })();

  const addAjuste = () =>
    setAjustes((prev) => [...prev, { tipo: 'disminucion', descripcion: '', monto: '' }]);
  const selectAjusteOpcion = (i: number, tipo: CuentaAjusteTipo, descripcion: string) =>
    setAjustes((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, tipo, descripcion } : a)),
    );
  const updateAjuste = (i: number, field: 'descripcion' | 'monto', value: string) =>
    setAjustes((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    );
  const removeAjuste = (i: number) =>
    setAjustes((prev) => prev.filter((_, idx) => idx !== i));

  const openCreateOpcion = (rowIndex: number) => {
    setCreateOpcionForRow(rowIndex);
    setNewOpcionTipo(ajustes[rowIndex]?.tipo || 'disminucion');
    setNewOpcionDescripcion('');
  };

  const saveNewOpcion = async () => {
    if (createOpcionForRow === null) return;
    const trimmed = newOpcionDescripcion.trim();
    if (!trimmed) return;
    setSavingOpcion(true);
    try {
      const res = await api.post(`/cuentas/${cuenta.id}/ajuste-opciones`, {
        tipo: newOpcionTipo,
        descripcion: trimmed,
      });
      const created: CuentaAjusteOpcion = res.data.data;
      setOpciones((prev) => [...prev, created]);
      selectAjusteOpcion(createOpcionForRow, created.tipo, created.descripcion);
      setCreateOpcionForRow(null);
    } finally {
      setSavingOpcion(false);
    }
  };

  const montoAPagarLive =
    (Number(monto) || 0) +
    ajustes.reduce(
      (acc, a) => acc + (a.tipo === 'aumento' ? Number(a.monto) || 0 : -(Number(a.monto) || 0)),
      0,
    );

  const save = async () => {
    setSaving(true);
    try {
      const ajustesPayload = ajustes
        .filter((a) => a.descripcion.trim() && a.monto !== '')
        .map((a, i) => ({
          tipo: a.tipo,
          descripcion: a.descripcion.trim(),
          monto: Number(a.monto),
          orden: i,
        }));
      await api.put(`/cuentas/${cuenta.id}`, {
        monto_total: Number(monto),
        periodo_inicio: inicio || null,
        periodo_fin: fin || null,
        avance_porcentaje: avance ? Number(avance) : null,
        ajustes: ajustesPayload,
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
                variant="destructive"
                className="mr-auto"
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
        <form id="edit-cuenta-form" onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="flex-1">Monto bruto (B/.)</Label>
            <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-40 tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <span className="h-9 w-9 shrink-0" aria-hidden />
          </div>

          {/* Ajustes — rows (if any) followed by the Agregar Ajuste button */}
          <div className="space-y-2">
            {ajustes.length > 0 && (
              <div className="space-y-2">
                {ajustes.map((aj, index) => {
                  const selectedKey = aj.descripcion ? `${aj.tipo}|${aj.descripcion}` : '';
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-9 w-9 inline-flex items-center justify-center rounded-md border font-bold text-base shrink-0',
                          !aj.descripcion
                            ? 'text-muted-foreground border-border'
                            : aj.tipo === 'aumento'
                              ? 'text-success border-success/30'
                              : 'text-error border-error/30',
                        )}
                        aria-hidden
                      >
                        {!aj.descripcion ? '' : aj.tipo === 'aumento' ? '+' : '−'}
                      </span>
                      <Select
                        value={selectedKey}
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            openCreateOpcion(index);
                            return;
                          }
                          const sep = value.indexOf('|');
                          const tipo = value.slice(0, sep) as CuentaAjusteTipo;
                          const descripcion = value.slice(sep + 1);
                          selectAjusteOpcion(index, tipo, descripcion);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Seleccionar ajuste" />
                        </SelectTrigger>
                        <SelectContent>
                          {allOpciones.map((o) => (
                            <SelectItem
                              key={`${o.tipo}|${o.descripcion}`}
                              value={`${o.tipo}|${o.descripcion}`}
                            >
                              <span
                                className={cn(
                                  'font-bold mr-2',
                                  o.tipo === 'aumento' ? 'text-success' : 'text-error',
                                )}
                              >
                                {o.tipo === 'aumento' ? '+' : '−'}
                              </span>
                              {o.descripcion}
                            </SelectItem>
                          ))}
                          {allOpciones.length > 0 && <SelectSeparator />}
                          <SelectItem value="__new__">
                            <span className="inline-flex items-center">
                              <Plus className="h-3 w-3 mr-1" />
                              Crear nueva opción
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={aj.monto}
                        onChange={(e) => updateAjuste(index, 'monto', e.target.value)}
                        className="w-40 tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAjuste(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAjuste}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar Ajuste
            </Button>
          </div>

          {/* Auto-calculated total */}
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <span className="flex-1 font-semibold">Total a cobrar</span>
            <span className="w-40 text-right font-semibold tabular-nums pr-3">
              B/. {montoAPagarLive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="w-9 shrink-0" aria-hidden />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Periodo inicio</Label><DatePicker value={inicio} onChange={setInicio} /></div>
            <div><Label>Periodo fin</Label><DatePicker value={fin} onChange={setFin} /></div>
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

      {/* Create-new-opcion sub-dialog */}
      <AppDialog
        open={createOpcionForRow !== null}
        onOpenChange={(v) => { if (!v) setCreateOpcionForRow(null); }}
        size="confirm"
        title="Nueva opción de ajuste"
        description="Esta opción quedará disponible para futuras cuentas de este proyecto."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpcionForRow(null)} disabled={savingOpcion}>Cancelar</Button>
            <Button onClick={saveNewOpcion} disabled={savingOpcion || !newOpcionDescripcion.trim()}>
              {savingOpcion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={newOpcionTipo} onValueChange={(v) => setNewOpcionTipo(v as CuentaAjusteTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disminucion">
                  <span className="text-error font-bold mr-2">−</span>
                  Disminución
                </SelectItem>
                <SelectItem value="aumento">
                  <span className="text-success font-bold mr-2">+</span>
                  Aumento
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input
              value={newOpcionDescripcion}
              onChange={(e) => setNewOpcionDescripcion(e.target.value)}
              placeholder="Ej: Retención 5%"
              autoFocus
            />
          </div>
        </div>
      </AppDialog>
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
