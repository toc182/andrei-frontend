import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import type { CajaMenudaDetail as CajaMenudaDetailType, CajaMenudaGasto, CajaMenudaAdjunto } from '../types/api';
import {
  ArrowLeft, Plus, Pencil, Trash2, Loader2, Upload, Download, FileText, Receipt, Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

// --- Zod schemas ---

const max2Decimals = (v: string) => {
  const parts = v.split('.');
  return parts.length < 2 || parts[1].length <= 2;
};

const gastoSchema = z.object({
  fecha: z.string().min(1, 'Fecha es obligatoria'),
  proveedor: z.string().min(1, 'Proveedor es obligatorio'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  monto: z.string().min(1, 'Monto es obligatorio')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Monto debe ser mayor a 0')
    .refine(max2Decimals, 'Máximo 2 decimales'),
  itbms: z.string().optional()
    .refine((v) => !v || max2Decimals(v), 'Máximo 2 decimales'),
  monto_total: z.string().min(1, 'Total es obligatorio')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Total debe ser mayor a 0')
    .refine(max2Decimals, 'Máximo 2 decimales'),
});

type GastoFormData = z.infer<typeof gastoSchema>;

// --- Props ---

interface CajaMenudaDetailProps {
  cajaId: number;
  onBack: () => void;
}

// --- Helpers ---

const formatMonto = (valor: string | number | undefined) => {
  const num = Number(valor || 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string) => {
  const clean = dateStr.split('T')[0];
  const d = new Date(clean + 'T00:00:00');
  return d.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// --- Component ---

const CajaMenudaDetail = ({ cajaId, onBack }: CajaMenudaDetailProps) => {
  // State
  const [caja, setCaja] = useState<CajaMenudaDetailType | null>(null);
  const [gastos, setGastos] = useState<CajaMenudaGasto[]>([]);
  const [adjuntos, setAdjuntos] = useState<CajaMenudaAdjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Gastos filter: 'pending' or a solicitud_reembolso_id
  const [gastosFilter, setGastosFilter] = useState<string>('pending');

  // Gasto form
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<CajaMenudaGasto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteGastoId, setDeleteGastoId] = useState<number | null>(null);

  // Adjunto upload
  const [uploading, setUploading] = useState(false);
  const [deleteAdjuntoId, setDeleteAdjuntoId] = useState<number | null>(null);
  const [showReembolsoConfirm, setShowReembolsoConfirm] = useState(false);
  const [reembolsoSubmitting, setReembolsoSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gastoForm = useForm<GastoFormData>({
    resolver: zodResolver(gastoSchema),
    defaultValues: { fecha: '', proveedor: '', descripcion: '', monto: '', itbms: '0', monto_total: '' },
  });

  // Watch monto and itbms to auto-calculate total
  const watchMonto = gastoForm.watch('monto');
  const watchItbms = gastoForm.watch('itbms');

  useEffect(() => {
    const monto = Number(watchMonto) || 0;
    const itbms = Number(watchItbms) || 0;
    if (monto > 0) {
      gastoForm.setValue('monto_total', (monto + itbms).toFixed(2));
    }
  }, [watchMonto, watchItbms, gastoForm]);

  // Load data
  useEffect(() => {
    loadCaja();
  }, [cajaId]);

  useEffect(() => {
    loadGastos();
    loadAdjuntos();
  }, [cajaId, gastosFilter]);

  const loadCaja = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/cajas-menudas/${cajaId}`);
      if (response.data.success) {
        setCaja(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando caja menuda:', err);
      setError('Error al cargar la caja menuda');
    } finally {
      setLoading(false);
    }
  };

  const loadGastos = async () => {
    try {
      const filter = gastosFilter === 'pending' ? 'null' : gastosFilter;
      const response = await api.get(`/cajas-menudas/${cajaId}/gastos?solicitud_reembolso_id=${filter}`);
      if (response.data.success) {
        setGastos(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando gastos:', err);
    }
  };

  const loadAdjuntos = async () => {
    try {
      const filter = gastosFilter === 'pending' ? 'null' : gastosFilter;
      const response = await api.get(`/cajas-menudas/${cajaId}/adjuntos?solicitud_reembolso_id=${filter}`);
      if (response.data.success) {
        setAdjuntos(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando adjuntos:', err);
    }
  };

  // --- Gasto handlers ---

  const handleNewGasto = () => {
    setEditingGasto(null);
    gastoForm.reset({ fecha: '', proveedor: '', descripcion: '', monto: '', itbms: '0', monto_total: '' });
    setError('');
    setShowGastoModal(true);
  };

  const handleEditGasto = (gasto: CajaMenudaGasto) => {
    setEditingGasto(gasto);
    gastoForm.reset({
      fecha: gasto.fecha.split('T')[0],
      proveedor: gasto.proveedor,
      descripcion: gasto.descripcion,
      monto: String(gasto.monto),
      itbms: String(gasto.itbms),
      monto_total: String(gasto.monto_total),
    });
    setError('');
    setShowGastoModal(true);
  };

  const handleSubmitGasto = async (data: GastoFormData) => {
    try {
      setSubmitting(true);
      setError('');

      const payload = {
        fecha: data.fecha,
        proveedor: data.proveedor,
        descripcion: data.descripcion,
        monto: Number(data.monto),
        itbms: Number(data.itbms || 0),
        monto_total: Number(data.monto_total),
      };

      if (editingGasto) {
        await api.put(`/cajas-menudas/${cajaId}/gastos/${editingGasto.id}`, payload);
      } else {
        await api.post(`/cajas-menudas/${cajaId}/gastos`, payload);
      }

      setShowGastoModal(false);
      gastoForm.reset();
      loadGastos();
      loadCaja(); // Refresh saldo
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al guardar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGasto = async () => {
    if (!deleteGastoId) return;
    try {
      setSubmitting(true);
      await api.delete(`/cajas-menudas/${cajaId}/gastos/${deleteGastoId}`);
      setDeleteGastoId(null);
      loadGastos();
      loadCaja();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al eliminar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Adjunto handlers ---

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');
      const formData = new FormData();
      formData.append('archivo', file);

      await api.post(`/cajas-menudas/${cajaId}/adjuntos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      loadAdjuntos();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al subir el archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (adjunto: CajaMenudaAdjunto) => {
    try {
      const response = await api.get(`/cajas-menudas/${cajaId}/adjuntos/${adjunto.id}/download`);
      if (response.data.success) {
        window.open(response.data.data.url, '_blank');
      }
    } catch (err) {
      console.error('Error descargando adjunto:', err);
    }
  };

  const handleDeleteAdjunto = async () => {
    if (!deleteAdjuntoId) return;
    try {
      setSubmitting(true);
      await api.delete(`/cajas-menudas/${cajaId}/adjuntos/${deleteAdjuntoId}`);
      setDeleteAdjuntoId(null);
      loadAdjuntos();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al eliminar el adjunto');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Reembolso handler ---

  const handleReembolso = async () => {
    try {
      setReembolsoSubmitting(true);
      setError('');
      const response = await api.post(`/cajas-menudas/${cajaId}/reembolso`);
      if (response.data.success) {
        setShowReembolsoConfirm(false);
        setGastosFilter('pending');
        loadCaja();
        loadGastos();
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al solicitar reembolso');
    } finally {
      setReembolsoSubmitting(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!caja) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Caja menuda no encontrada</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPending = gastosFilter === 'pending';
  const selectedReembolso = caja.reembolsos?.find((r) => String(r.id) === gastosFilter);
  const gastosTotal = gastos.reduce((sum, g) => sum + Number(g.monto_total), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{caja.nombre}</h2>
          <p className="text-muted-foreground text-sm">{caja.proyecto_nombre}</p>
        </div>
        <Badge
          variant={caja.estado === 'abierta' ? 'outline' : 'secondary'}
          className={caja.estado === 'abierta' ? 'bg-green-50 text-green-700 border-green-300' : ''}
        >
          {caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Monto Asignado</p>
            <p className="text-xl font-bold">{formatMonto(caja.monto_asignado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Saldo Disponible</p>
            <p className={`text-xl font-bold ${Number(caja.saldo) < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatMonto(caja.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Gastado</p>
            <p className="text-xl font-bold">{formatMonto(caja.total_gastado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Responsable</p>
            <p className="text-lg font-medium">{caja.responsable_nombre}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gastos Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Gastos</h3>
            <Select value={gastosFilter} onValueChange={setGastosFilter}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Gastos actuales (pendientes de reembolso)</SelectItem>
                {caja.reembolsos?.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    Reembolso #{r.numero} — {r.estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isPending && caja.estado === 'abierta' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleNewGasto}>
                <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
              </Button>
              {gastos.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowReembolsoConfirm(true)}>
                  <Send className="mr-2 h-4 w-4" /> Solicitar Reembolso
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Past reembolo badge */}
        {!isPending && selectedReembolso && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            Solicitud #{selectedReembolso.numero} —
            <Badge variant="outline">{selectedReembolso.estado}</Badge>
            — {formatMonto(selectedReembolso.monto_total)}
          </div>
        )}

        {gastos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">No hay gastos registrados</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
              {gastos.map((gasto) => (
                <Card key={gasto.id}>
                  <CardContent className="p-4 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{gasto.proveedor}</p>
                        <p className="text-sm text-muted-foreground">{gasto.descripcion}</p>
                      </div>
                      {isPending && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditGasto(gasto)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteGastoId(gasto.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(gasto.fecha)}</span>
                      <span className="font-medium">{formatMonto(gasto.monto_total)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">ITBMS</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {isPending && <TableHead className="w-[80px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((gasto) => (
                    <TableRow key={gasto.id}>
                      <TableCell>{formatDate(gasto.fecha)}</TableCell>
                      <TableCell>{gasto.proveedor}</TableCell>
                      <TableCell>{gasto.descripcion}</TableCell>
                      <TableCell className="text-right">{formatMonto(gasto.monto)}</TableCell>
                      <TableCell className="text-right">{formatMonto(gasto.itbms)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMonto(gasto.monto_total)}</TableCell>
                      {isPending && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditGasto(gasto)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteGastoId(gasto.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer total */}
            <div className="flex justify-end">
              <div className="text-sm text-muted-foreground">
                {isPending ? 'Total pendiente:' : 'Total reembolsado:'}{' '}
                <span className="font-bold text-foreground">{formatMonto(gastosTotal)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Adjuntos Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Adjuntos</h3>
          {isPending && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Subir archivo
              </Button>
            </div>
          )}
        </div>

        {adjuntos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay archivos adjuntos</p>
        ) : (
          <div className="space-y-2">
            {adjuntos.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{adj.nombre_original}</p>
                    <p className="text-xs text-muted-foreground">
                      {adj.subido_por_nombre} — {(adj.tamano / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(adj)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {isPending && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteAdjuntoId(adj.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gasto Form Dialog */}
      <Dialog open={showGastoModal} onOpenChange={setShowGastoModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGasto ? 'Editar Gasto' : 'Registrar Gasto'}</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...gastoForm}>
            <form onSubmit={gastoForm.handleSubmit(handleSubmitGasto)} className="space-y-4">
              <FormField
                control={gastoForm.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={gastoForm.control}
                name="proveedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del proveedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={gastoForm.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripción del gasto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={gastoForm.control}
                  name="monto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={gastoForm.control}
                  name="itbms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ITBMS</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={gastoForm.control}
                  name="monto_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} readOnly className="bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setShowGastoModal(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingGasto ? 'Actualizar' : 'Registrar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Gasto Confirmation */}
      <AlertDialog open={deleteGastoId !== null} onOpenChange={(open) => !open && setDeleteGastoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGasto}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Adjunto Confirmation */}
      <AlertDialog open={deleteAdjuntoId !== null} onOpenChange={(open) => !open && setDeleteAdjuntoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>El archivo será eliminado permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdjunto}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reembolso Confirmation */}
      <AlertDialog open={showReembolsoConfirm} onOpenChange={setShowReembolsoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Solicitar reembolso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará una solicitud de pago por {formatMonto(gastosTotal)} con {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} pendiente{gastos.length !== 1 ? 's' : ''}.
              Los gastos quedarán vinculados a la solicitud y no podrán ser editados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reembolsoSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReembolso} disabled={reembolsoSubmitting}>
              {reembolsoSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Reembolso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CajaMenudaDetail;
