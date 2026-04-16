import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Upload, Download, Trash2, Loader2 } from 'lucide-react';
import api from '@/services/api';
import type { CuentaDetail, CuentaEstado } from '@/types/api';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import CuentaTimeline from './CuentaTimeline';
import AvanceBar from './AvanceBar';
import { formatMonto, formatDateExact, TRANSICIONES, getFlow } from './config';

interface Props {
  cuentaId: number;
  projectName?: string;
  onBack?: () => void;
}

export default function CuentaDetailPage({ cuentaId, projectName, onBack }: Props) {
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

  const flow = getFlow(cuenta.proyecto_tipo, cuenta.proyecto_tiene_ipt);
  const transitions = TRANSICIONES[flow][cuenta.estado as CuentaEstado] || [];

  const LOCKED = ['aprobada', 'pagada', 'aprobada_institucion', 'aprobada_contraloria'].includes(cuenta.estado);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        {onBack ? (
          <button onClick={onBack} className="hover:underline">{projectName || 'Proyecto'}</button>
        ) : (
          <span>{projectName || 'Proyecto'}</span>
        )}
        <span className="mx-1.5">›</span>
        {onBack && <button onClick={onBack} className="hover:underline">Cuentas</button>}
        {!onBack && <span>Cuentas</span>}
        <span className="mx-1.5">›</span>
        <span className="text-foreground">Cuenta {cuenta.numero}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Cuenta {cuenta.numero}</h2>
        <CuentaEstadoBadge estado={cuenta.estado} />
      </div>

      {/* Details card */}
      <Card className="relative">
        <CardContent className="p-5">
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!LOCKED && (
                  <DropdownMenuItem onClick={() => setShowEdit(true)}>
                    Editar cuenta
                  </DropdownMenuItem>
                )}
                {transitions.length > 0 && (
                  <DropdownMenuItem onClick={() => setShowTransition(true)}>
                    Cambiar estado
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Monto</div>
              <div className="font-mono font-medium">{formatMonto(cuenta.monto_total)}</div>
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

      {/* Adjuntos */}
      <AdjuntosSection cuentaId={cuentaId} adjuntos={cuenta.adjuntos} onChanged={load} />

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-4">Historial</h2>
          <CuentaTimeline cuentaId={cuentaId} eventos={cuenta.eventos} onChanged={load} />
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <EditCuentaDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        cuenta={cuenta}
        onSaved={() => { setShowEdit(false); load(); }}
      />

      {/* Transition dialog */}
      <TransitionDialog
        open={showTransition}
        onOpenChange={setShowTransition}
        cuentaId={cuentaId}
        transitions={transitions}
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
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    await api.post(`/cuentas/${cuentaId}/adjuntos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    onChanged();
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
        {adjuntos.length > 0 && (
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
          </div>
        )}
        <label className="flex items-center justify-center gap-2 p-3 border border-dashed rounded-md text-sm text-muted-foreground cursor-pointer hover:border-foreground/30 hover:text-foreground/60 transition-colors">
          <Upload className="h-4 w-4" />
          Subir archivo
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
      </CardContent>
    </Card>
  );
}

// ── Edit Dialog ─────────────────────────────────────────────────────────

function EditCuentaDialog({ open, onOpenChange, cuenta, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuenta: CuentaDetail;
  onSaved: () => void;
}) {
  const [monto, setMonto] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [avance, setAvance] = useState('');
  const [saving, setSaving] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar cuenta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Monto (B/.)</Label><Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Periodo inicio</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div><Label>Periodo fin</Label><Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
          </div>
          <div><Label>Avance (%)</Label><Input type="number" step="0.01" min="0" max="100" value={avance} onChange={(e) => setAvance(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Transition Dialog ───────────────────────────────────────────────────

function TransitionDialog({ open, onOpenChange, cuentaId, transitions, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuentaId: number;
  transitions: { to: CuentaEstado; label: string }[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<CuentaEstado | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setSelected(''); setComment(''); } }, [open]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(`/cuentas/${cuentaId}/transicion`, {
        estado_hacia: selected,
        comentario: comment || undefined,
      });
      onDone();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cambiar estado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {transitions.map((t) => (
              <label key={t.to} className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer transition-colors ${selected === t.to ? 'border-foreground bg-muted/50' : 'hover:border-border'}`}>
                <input type="radio" name="estado" checked={selected === t.to} onChange={() => setSelected(t.to)} className="accent-current" />
                <span className="text-sm">{t.label}</span>
              </label>
            ))}
          </div>
          <div>
            <Label>Comentario (opcional)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={!selected || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
