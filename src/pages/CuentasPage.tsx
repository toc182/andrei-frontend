import { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import type { Cuenta, CuentaDetail, CuentaEstado } from '@/types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Plus,
  Download,
  Trash2,
  Upload,
  Loader2,
  MessageSquare,
} from 'lucide-react';

interface CuentasPageProps {
  proyectoIdFilter?: number;
}

const ESTADO_CONFIG: Record<CuentaEstado, { label: string; className: string }> = {
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  enviada: { label: 'Enviada', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  observaciones: { label: 'Observaciones', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  aprobada: { label: 'Aprobada', className: 'bg-green-50 text-green-700 border-green-300' },
  enviada_institucion: { label: 'Enviada a institución', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  observaciones_institucion: { label: 'Observaciones de institución', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  aprobada_institucion: { label: 'Aprobada por institución', className: 'bg-teal-50 text-teal-700 border-teal-300' },
  enviada_contraloria: { label: 'Enviada a Contraloría', className: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  observaciones_contraloria: { label: 'Observaciones de Contraloría', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  aprobada_contraloria: { label: 'Aprobada por Contraloría', className: 'bg-green-50 text-green-700 border-green-300' },
  pagada: { label: 'Pagada', className: 'bg-slate-200 text-slate-800 border-slate-400' },
};

type CuentaFlow = 'privado' | 'publico_normal' | 'publico_ipt';

const TRANSICIONES_BY_FLOW: Record<CuentaFlow, Partial<Record<CuentaEstado, { to: CuentaEstado; label: string }[]>>> = {
  privado: {
    borrador: [{ to: 'enviada', label: 'Enviar al cliente' }],
    enviada: [
      { to: 'observaciones', label: 'Registrar observaciones' },
      { to: 'aprobada', label: 'Marcar aprobada' },
    ],
    observaciones: [{ to: 'enviada', label: 'Reenviar al cliente' }],
    aprobada: [{ to: 'pagada', label: 'Marcar pagada' }],
  },
  publico_normal: {
    borrador: [{ to: 'enviada_institucion', label: 'Enviar a institución' }],
    enviada_institucion: [
      { to: 'observaciones_institucion', label: 'Registrar observaciones de institución' },
      { to: 'aprobada_institucion', label: 'Marcar aprobada por institución' },
    ],
    observaciones_institucion: [{ to: 'enviada_institucion', label: 'Reenviar a institución' }],
    aprobada_institucion: [{ to: 'enviada_contraloria', label: 'Enviar a Contraloría' }],
    enviada_contraloria: [
      { to: 'observaciones_contraloria', label: 'Registrar observaciones de Contraloría' },
      { to: 'aprobada_contraloria', label: 'Marcar aprobada por Contraloría' },
    ],
    observaciones_contraloria: [{ to: 'enviada_contraloria', label: 'Reenviar a Contraloría' }],
    aprobada_contraloria: [{ to: 'pagada', label: 'Marcar pagada' }],
  },
  publico_ipt: {}, // Phase 3
};

function getFlow(proyectoTipo?: string, tieneIpt?: boolean): CuentaFlow {
  if (proyectoTipo === 'privado') return 'privado';
  if (tieneIpt) return 'publico_ipt';
  return 'publico_normal';
}

function formatMonto(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EstadoBadge({ estado }: { estado: CuentaEstado }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

export default function CuentasPage({ proyectoIdFilter }: CuentasPageProps) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<'todas' | CuentaEstado>('todas');
  const [proyectos, setProyectos] = useState<{ id: number; nombre: string; tipo: string; tiene_ipt?: boolean }[]>([]);
  const [proyectoFilter, setProyectoFilter] = useState<string>(
    proyectoIdFilter ? String(proyectoIdFilter) : 'todos',
  );
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (proyectoIdFilter) params.proyecto_id = String(proyectoIdFilter);
      else if (proyectoFilter !== 'todos') params.proyecto_id = proyectoFilter;
      if (estadoFilter !== 'todas') params.estado = estadoFilter;
      const res = await api.get('/cuentas', { params });
      setCuentas(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  const loadProyectos = async () => {
    try {
      const res = await api.get('/projects');
      setProyectos(
        (res.data.data || res.data.projects || []).map(
          (p: { id: number; nombre: string; tipo: string; tiene_ipt?: boolean }) => ({
            id: p.id,
            nombre: p.nombre,
            tipo: p.tipo,
            tiene_ipt: p.tiene_ipt,
          }),
        ),
      );
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    loadProyectos();
  }, []);

  useEffect(() => {
    load();
  }, [estadoFilter, proyectoFilter, proyectoIdFilter]);

  // Phase 2: privado + publico (non-IPT). IPT comes in Phase 3.
  const filteredProyectos = useMemo(
    () => proyectos.filter((p) => p.tipo === 'privado' || (p.tipo === 'publico' && !p.tiene_ipt)),
    [proyectos],
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cuentas</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {!proyectoIdFilter && (
          <div className="min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Proyecto</Label>
            <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as typeof estadoFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="observaciones">Observaciones</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!proyectoIdFilter && <TableHead>Proyecto</TableHead>}
                <TableHead>Número</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Avance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>1a submisión</TableHead>
                <TableHead>Última resubmisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={proyectoIdFilter ? 7 : 8} className="text-center text-muted-foreground py-6">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : cuentas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={proyectoIdFilter ? 7 : 8} className="text-center text-muted-foreground py-6">
                    Sin cuentas
                  </TableCell>
                </TableRow>
              ) : (
                cuentas.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailId(c.id)}
                  >
                    {!proyectoIdFilter && <TableCell>{c.proyecto_nombre}</TableCell>}
                    <TableCell className="font-medium">
                      {c.es_final ? 'Cuenta Final' : `Cuenta ${c.numero}`}
                    </TableCell>
                    <TableCell className="text-right">{formatMonto(c.monto_total)}</TableCell>
                    <TableCell>
                      {c.periodo_inicio || c.periodo_fin
                        ? `${formatDate(c.periodo_inicio)} → ${formatDate(c.periodo_fin)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.avance_porcentaje ? `${Number(c.avance_porcentaje).toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={c.estado} />
                    </TableCell>
                    <TableCell>{formatDate(c.fecha_primera_submision)}</TableCell>
                    <TableCell>{formatDate(c.fecha_ultima_resubmision)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateCuentaDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        proyectos={filteredProyectos}
        defaultProyectoId={proyectoIdFilter}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />

      <CuentaDetailDialog
        cuentaId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Create dialog
// ────────────────────────────────────────────────────────────────────

function CreateCuentaDialog({
  open,
  onOpenChange,
  proyectos,
  defaultProyectoId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proyectos: { id: number; nombre: string; tipo: string; tiene_ipt?: boolean }[];
  defaultProyectoId?: number;
  onCreated: () => void;
}) {
  const [proyectoId, setProyectoId] = useState<string>('');
  const [monto, setMonto] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [avance, setAvance] = useState('');
  const [esFinal, setEsFinal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setProyectoId(defaultProyectoId ? String(defaultProyectoId) : '');
      setMonto('');
      setPeriodoInicio('');
      setPeriodoFin('');
      setAvance('');
      setEsFinal(false);
      setError('');
    }
  }, [open, defaultProyectoId]);

  const submit = async () => {
    setError('');
    if (!proyectoId || !monto) {
      setError('Proyecto y monto son requeridos');
      return;
    }
    setSaving(true);
    try {
      await api.post('/cuentas', {
        proyecto_id: Number(proyectoId),
        monto_total: Number(monto),
        periodo_inicio: periodoInicio || undefined,
        periodo_fin: periodoFin || undefined,
        avance_porcentaje: avance ? Number(avance) : undefined,
        es_final: esFinal,
      });
      onCreated();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error al crear cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Cuenta</DialogTitle>
          <DialogDescription>Proyectos privados y públicos sin IPT.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!defaultProyectoId && (
            <div>
              <Label>Proyecto</Label>
              <Select value={proyectoId} onValueChange={setProyectoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {proyectos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Monto total (B/.)</Label>
            <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodo inicio</Label>
              <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
            </div>
            <div>
              <Label>Periodo fin</Label>
              <Input type="date" value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Avance (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" value={avance} onChange={(e) => setAvance(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={esFinal} onChange={(e) => setEsFinal(e.target.checked)} />
            Cuenta Final
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────
// Detail dialog
// ────────────────────────────────────────────────────────────────────

function CuentaDetailDialog({
  cuentaId,
  onClose,
  onChanged,
}: {
  cuentaId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cuenta, setCuenta] = useState<CuentaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<CuentaEstado | null>(null);
  const [transitionComment, setTransitionComment] = useState('');
  const [savingTransition, setSavingTransition] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    if (!cuentaId) return;
    setLoading(true);
    try {
      const res = await api.get(`/cuentas/${cuentaId}`);
      setCuenta(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cuentaId) load();
    else setCuenta(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaId]);

  const doTransition = async () => {
    if (!cuenta || !transitionTarget) return;
    setSavingTransition(true);
    try {
      await api.post(`/cuentas/${cuenta.id}/transicion`, {
        estado_hacia: transitionTarget,
        comentario: transitionComment || undefined,
      });
      setTransitionTarget(null);
      setTransitionComment('');
      await load();
      onChanged();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setSavingTransition(false);
    }
  };

  const postComment = async () => {
    if (!cuenta || !commentText.trim()) return;
    setPostingComment(true);
    try {
      await api.post(`/cuentas/${cuenta.id}/comentario`, { comentario: commentText });
      setCommentText('');
      await load();
    } finally {
      setPostingComment(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!cuenta) return;
    const fd = new FormData();
    fd.append('file', file);
    await api.post(`/cuentas/${cuenta.id}/adjuntos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await load();
  };

  const downloadAdjunto = async (adjuntoId: number, nombre: string) => {
    if (!cuenta) return;
    const res = await api.get(`/cuentas/${cuenta.id}/adjuntos/${adjuntoId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const deleteAdjunto = async (adjuntoId: number) => {
    if (!cuenta) return;
    await api.delete(`/cuentas/${cuenta.id}/adjuntos/${adjuntoId}`);
    await load();
  };

  const deleteCuenta = async () => {
    if (!cuenta) return;
    await api.delete(`/cuentas/${cuenta.id}`);
    setConfirmDelete(false);
    onClose();
    onChanged();
  };

  const open = cuentaId !== null;
  const flow = cuenta ? getFlow(cuenta.proyecto_tipo, cuenta.proyecto_tiene_ipt) : 'privado';
  const transitionOptions = cuenta
    ? TRANSICIONES_BY_FLOW[flow][cuenta.estado] || []
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {loading || !cuenta ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {cuenta.es_final ? 'Cuenta Final' : `Cuenta ${cuenta.numero}`}
                <EstadoBadge estado={cuenta.estado} />
              </DialogTitle>
              <DialogDescription>{cuenta.proyecto_nombre}</DialogDescription>
            </DialogHeader>

            {/* Header info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Monto</div>
                <div className="font-medium">{formatMonto(cuenta.monto_total)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Avance</div>
                <div className="font-medium">
                  {cuenta.avance_porcentaje ? `${Number(cuenta.avance_porcentaje).toFixed(2)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Periodo</div>
                <div>
                  {cuenta.periodo_inicio || cuenta.periodo_fin
                    ? `${formatDate(cuenta.periodo_inicio)} → ${formatDate(cuenta.periodo_fin)}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">1a submisión</div>
                <div>{formatDate(cuenta.fecha_primera_submision)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Última resubmisión</div>
                <div>{formatDate(cuenta.fecha_ultima_resubmision)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pagada</div>
                <div>{formatDate(cuenta.fecha_pagada)}</div>
              </div>
            </div>

            <Separator />

            {/* Transitions */}
            {transitionOptions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Acciones</Label>
                <div className="flex flex-wrap gap-2">
                  {transitionOptions.map((t) => (
                    <Button
                      key={t.to}
                      variant="outline"
                      size="sm"
                      onClick={() => setTransitionTarget(t.to)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Adjuntos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Adjuntos</Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(f);
                      e.target.value = '';
                    }}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="mr-2 h-3 w-3" />
                      Subir
                    </span>
                  </Button>
                </label>
              </div>
              {cuenta.adjuntos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin adjuntos</p>
              ) : (
                <ul className="space-y-1">
                  {cuenta.adjuntos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                      <span className="truncate mr-2">{a.nombre_original}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => downloadAdjunto(a.id, a.nombre_original)}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteAdjunto(a.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            {/* Historial + comentarios */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Historial</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-2">
                {cuenta.eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin eventos</p>
                ) : (
                  cuenta.eventos.map((e) => (
                    <div key={e.id} className="text-sm border-b last:border-0 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(e.created_at)}</span>
                        <span className="text-xs text-muted-foreground">· {e.creado_por_nombre}</span>
                        {e.tipo === 'transicion' ? (
                          <span className="text-xs">
                            {e.estado_desde} → <strong>{e.estado_hacia}</strong>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            comentario
                          </span>
                        )}
                      </div>
                      {e.comentario && <div className="mt-1">{e.comentario}</div>}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={(ev) => setCommentText(ev.target.value)}
                  placeholder="Agregar comentario…"
                  rows={2}
                />
                <Button onClick={postComment} disabled={!commentText.trim() || postingComment}>
                  {postingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar
                </Button>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              {cuenta.estado === 'borrador' ? (
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-2 h-3 w-3" />
                  Eliminar
                </Button>
              ) : (
                <div />
              )}
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Transition confirm */}
        <Dialog
          open={transitionTarget !== null}
          onOpenChange={(v) => {
            if (!v) {
              setTransitionTarget(null);
              setTransitionComment('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Cambiar a {transitionTarget && ESTADO_CONFIG[transitionTarget].label}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Comentario (opcional)</Label>
              <Textarea
                value={transitionComment}
                onChange={(e) => setTransitionComment(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransitionTarget(null)} disabled={savingTransition}>
                Cancelar
              </Button>
              <Button onClick={doTransition} disabled={savingTransition}>
                {savingTransition && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción marcará la cuenta como inactiva. Solo se permite en borrador.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteCuenta}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
