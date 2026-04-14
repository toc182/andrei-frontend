import { useState, useEffect, useRef } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { Plus, Pencil, Loader2, Wallet, Upload, AlertCircle, Settings, Minus, Lock } from 'lucide-react';
import type { CajaMenuda } from '../types/api';
import CajaMenudaDetail from './CajaMenudaDetail';

// Shadcn Components
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
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// --- Zod schema ---

const cajaSchema = z.object({
  proyecto_id: z.string().min(1, 'Proyecto es obligatorio'),
  responsable_id: z.string().min(1, 'Responsable es obligatorio'),
  nombre: z.string().min(1, 'Nombre es obligatorio'),
  monto_asignado: z.string().min(1, 'Monto es obligatorio')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Monto debe ser mayor a 0')
    .refine((v) => { const parts = v.split('.'); return parts.length < 2 || parts[1].length <= 2; }, 'Máximo 2 decimales'),
});

type CajaFormData = z.infer<typeof cajaSchema>;

// --- Helpers ---

interface Proyecto {
  id: number;
  nombre: string;
  nombre_corto?: string;
}

interface Usuario {
  id: number;
  nombre: string;
}

const estadoBadge = (estado: string) => {
  if (estado === 'abierta') {
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Abierta</Badge>;
  }
  return <Badge variant="secondary">Cerrada</Badge>;
};

const ComprobanteAlertIcon = ({ caja }: { caja: CajaMenuda }) => {
  // For new cajas (with solicitud): check if apertura solicitud is not yet transferred
  const faltaApertura = caja.solicitud_apertura_id
    ? caja.solicitud_apertura_estado !== 'transferida'
    : caja.tiene_comprobante_apertura === false; // Legacy cajas: check comprobante file
  const faltaHistorial = caja.historial_sin_comprobante === true;
  const faltaTransferencia = caja.historial_pendiente_transferencia === true;

  if (!faltaApertura && !faltaHistorial && !faltaTransferencia) return null;

  const messages: string[] = [];
  if (faltaApertura) {
    messages.push(
      caja.solicitud_apertura_id
        ? `Solicitud de apertura ${caja.solicitud_apertura_numero || ''} pendiente de transferencia.`
        : 'No tiene comprobante de apertura cargado.'
    );
  }
  if (faltaHistorial) messages.push('Uno o más cambios de monto no tienen comprobante.');
  if (faltaTransferencia) messages.push('Uno o más aumentos de monto pendientes de transferencia.');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex"
          onClick={(e) => e.stopPropagation()}
          aria-label="Comprobantes faltantes"
        >
          <AlertCircle className="h-4 w-4 text-red-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="top">
        <p className="font-medium text-red-600 mb-1">Comprobantes pendientes</p>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          {messages.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const formatMonto = (valor: string | number | undefined) => {
  const num = Number(valor || 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Component ---

interface CajasMenudasPageProps {
  projectId?: number;
}

const CajasMenudasPage = ({ projectId }: CajasMenudasPageProps = {}) => {
  const [cajas, setCajas] = useState<CajaMenuda[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedCajaId, setSelectedCajaId] = useState<number | null>(null);

  // Action modal states — null means closed, CajaMenuda means open for that caja
  const [editModalCaja, setEditModalCaja] = useState<CajaMenuda | null>(null);
  const [subirMontoModalCaja, setSubirMontoModalCaja] = useState<CajaMenuda | null>(null);
  const [bajarMontoModalCaja, setBajarMontoModalCaja] = useState<CajaMenuda | null>(null);
  const [cerrarModalCaja, setCerrarModalCaja] = useState<CajaMenuda | null>(null);

  // Edit form
  const [editNombre, setEditNombre] = useState('');
  const [editResponsableId, setEditResponsableId] = useState('');

  // Monto form
  const [nuevoMonto, setNuevoMonto] = useState('');

  // Cerrar/Bajar comprobante
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const comprobanteRef = useRef<HTMLInputElement>(null);

  const form: UseFormReturn<CajaFormData> = useForm<CajaFormData>({
    resolver: zodResolver(cajaSchema),
    defaultValues: {
      proyecto_id: '',
      responsable_id: '',
      nombre: '',
      monto_asignado: '',
    },
  });

  // Load data
  useEffect(() => {
    loadCajas();
    loadProyectos();
    loadUsuarios();
  }, []);

  const loadCajas = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const url = projectId ? `/cajas-menudas/proyecto/${projectId}` : '/cajas-menudas';
      const response = await api.get(url);
      if (response.data.success) {
        setCajas(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando cajas menudas:', err);
      setError('Error al cargar las cajas menudas');
    } finally {
      setLoading(false);
    }
  };

  const loadProyectos = async () => {
    try {
      const response = await api.get('/projects');
      if (response.data.success) {
        setProyectos(response.data.proyectos || response.data.data || []);
      }
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    }
  };

  const loadUsuarios = async () => {
    try {
      const response = await api.get('/users');
      if (response.data.success) {
        setUsuarios(response.data.data || response.data.users);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
  };

  // Handlers
  const handleNew = () => {
    form.reset({
      proyecto_id: projectId ? String(projectId) : '',
      responsable_id: '',
      nombre: '',
      monto_asignado: '',
    });
    setError('');
    setShowFormModal(true);
  };

  const handleCreateSubmit = async (data: CajaFormData) => {
    try {
      setSubmitting(true);
      setError('');
      await api.post('/cajas-menudas', {
        proyecto_id: data.proyecto_id,
        responsable_id: data.responsable_id,
        nombre: data.nombre,
        monto_asignado: data.monto_asignado,
      });
      loadCajas(false);
      setShowFormModal(false);
      form.reset();
    } catch (err: unknown) {
      console.error('Error guardando caja menuda:', err);
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al guardar la caja menuda');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editModalCaja) return;
    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      formData.append('nombre', editNombre);
      formData.append('responsable_id', editResponsableId);
      await api.put(`/cajas-menudas/${editModalCaja.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditModalCaja(null);
      loadCajas();
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubirMontoSubmit = async () => {
    if (!subirMontoModalCaja) return;
    const monto = Number(nuevoMonto);
    if (isNaN(monto) || monto <= Number(subirMontoModalCaja.monto_asignado)) {
      setError('El monto debe ser mayor al actual');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await api.put(`/cajas-menudas/${subirMontoModalCaja.id}/monto`, {
        monto_asignado: monto,
      });
      setSubirMontoModalCaja(null);
      loadCajas();
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Error al subir monto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBajarMontoSubmit = async () => {
    if (!bajarMontoModalCaja) return;
    const monto = Number(nuevoMonto);
    if (isNaN(monto) || monto >= Number(bajarMontoModalCaja.monto_asignado) || monto <= 0) {
      setError('El monto debe ser menor al actual y mayor que cero');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      formData.append('monto_asignado', String(monto));
      if (comprobanteFile) formData.append('comprobante', comprobanteFile);
      await api.put(`/cajas-menudas/${bajarMontoModalCaja.id}/monto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBajarMontoModalCaja(null);
      setComprobanteFile(null);
      loadCajas();
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Error al bajar monto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCerrarSubmit = async () => {
    if (!cerrarModalCaja) return;
    const saldo = Number(cerrarModalCaja.saldo);
    if (saldo > 0 && !comprobanteFile) {
      setError('Se requiere un comprobante de cierre para cajas con saldo pendiente');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      formData.append('estado', 'cerrada');
      if (comprobanteFile) formData.append('comprobante_cierre', comprobanteFile);
      await api.put(`/cajas-menudas/${cerrarModalCaja.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCerrarModalCaja(null);
      setComprobanteFile(null);
      loadCajas();
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Error al cerrar caja');
    } finally {
      setSubmitting(false);
    }
  };

  // Gear dropdown for open cajas
  const GearDropdown = ({ caja }: { caja: CajaMenuda }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={() => {
            setEditNombre(caja.nombre);
            setEditResponsableId(String(caja.responsable_id));
            setError('');
            setEditModalCaja(caja);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-green-600"
          onClick={() => {
            setNuevoMonto('');
            setError('');
            setSubirMontoModalCaja(caja);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Subir monto
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => {
            setNuevoMonto('');
            setComprobanteFile(null);
            setError('');
            setBajarMontoModalCaja(caja);
          }}
        >
          <Minus className="mr-2 h-4 w-4" />
          Bajar monto
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={caja.tiene_reembolso_pendiente === true}
          title={caja.tiene_reembolso_pendiente ? 'Tiene solicitud de reembolso pendiente' : undefined}
          onClick={() => {
            setComprobanteFile(null);
            setError('');
            setCerrarModalCaja(caja);
          }}
        >
          <Lock className="mr-2 h-4 w-4" />
          Cerrar caja
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Detail view
  if (selectedCajaId) {
    return (
      <CajaMenudaDetail
        cajaId={selectedCajaId}
        onBack={() => {
          setSelectedCajaId(null);
          loadCajas(false);
        }}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cajas Menudas</h2>
          <p className="text-muted-foreground text-sm">
            Gestión de fondos de caja menuda por proyecto
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Caja Menuda
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cajas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay cajas menudas registradas</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {cajas.map((caja) => (
              <Card key={caja.id} className="cursor-pointer" onClick={() => setSelectedCajaId(caja.id)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {caja.nombre}
                        <ComprobanteAlertIcon caja={caja} />
                      </p>
                      {!projectId && <p className="text-sm text-muted-foreground">{caja.proyecto_nombre}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {estadoBadge(caja.estado)}
                      {caja.estado === 'abierta' && <GearDropdown caja={caja} />}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Asignado</span>
                    <span className="font-medium">{formatMonto(caja.monto_asignado)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-medium ${caja.estado === 'cerrada' ? '' : Number(caja.saldo) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {caja.estado === 'cerrada' ? '-' : formatMonto(caja.saldo)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Responsable: {caja.responsable_nombre}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  {!projectId && <TableHead>Proyecto</TableHead>}
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Monto Asignado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cajas.map((caja) => (
                  <TableRow key={caja.id} className="cursor-pointer" onClick={() => setSelectedCajaId(caja.id)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {caja.nombre}
                        <ComprobanteAlertIcon caja={caja} />
                      </div>
                    </TableCell>
                    {!projectId && <TableCell>{caja.proyecto_nombre}</TableCell>}
                    <TableCell>{caja.responsable_nombre}</TableCell>
                    <TableCell className="text-right">{formatMonto(caja.monto_asignado)}</TableCell>
                    <TableCell className={`text-right font-medium ${caja.estado === 'cerrada' ? '' : Number(caja.saldo) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {caja.estado === 'cerrada' ? '-' : formatMonto(caja.saldo)}
                    </TableCell>
                    <TableCell>{estadoBadge(caja.estado)}</TableCell>
                    <TableCell>
                      {caja.estado === 'abierta' && <GearDropdown caja={caja} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva Caja Menuda</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              {/* Proyecto (only when not inside a project) */}
              {!projectId && (
                <FormField
                  control={form.control}
                  name="proyecto_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proyecto *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proyecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {proyectos.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nombre_corto || p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Nombre */}
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Caja Menuda #1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Responsable */}
              <FormField
                control={form.control}
                name="responsable_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar responsable" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Monto asignado */}
              <FormField
                control={form.control}
                name="monto_asignado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto Asignado *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFormModal(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editModalCaja} onOpenChange={(open) => { if (!open) setEditModalCaja(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Caja Menuda</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                placeholder="Nombre de la caja"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Responsable *</label>
              <Select value={editResponsableId} onValueChange={setEditResponsableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar responsable" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditModalCaja(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subir Monto Dialog */}
      <Dialog open={!!subirMontoModalCaja} onOpenChange={(open) => { if (!open) setSubirMontoModalCaja(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Subir Monto Asignado</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Monto actual: <span className="font-medium text-foreground">{formatMonto(subirMontoModalCaja?.monto_asignado)}</span>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuevo monto *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={nuevoMonto}
                onChange={(e) => setNuevoMonto(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Debe ser mayor al monto actual. Se creará una solicitud de apertura automática por la diferencia.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSubirMontoModalCaja(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubirMontoSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bajar Monto Dialog */}
      <Dialog open={!!bajarMontoModalCaja} onOpenChange={(open) => { if (!open) { setBajarMontoModalCaja(null); setComprobanteFile(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Bajar Monto Asignado</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Monto actual: <span className="font-medium text-foreground">{formatMonto(bajarMontoModalCaja?.monto_asignado)}</span>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuevo monto *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={nuevoMonto}
                onChange={(e) => setNuevoMonto(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Debe ser menor al monto actual y mayor que cero.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comprobante de devolución</label>
              <div className="flex items-center gap-2">
                <input
                  ref={comprobanteRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => comprobanteRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {comprobanteFile ? comprobanteFile.name : 'Seleccionar archivo'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Comprobante de la devolución de fondos (opcional).</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setBajarMontoModalCaja(null); setComprobanteFile(null); }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleBajarMontoSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cerrar Caja Dialog */}
      <Dialog open={!!cerrarModalCaja} onOpenChange={(open) => { if (!open) { setCerrarModalCaja(null); setComprobanteFile(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Caja: <span className="font-medium text-foreground">{cerrarModalCaja?.nombre}</span>
            </p>

            {Number(cerrarModalCaja?.saldo) === 0 ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                El saldo es cero — se generará automáticamente una constancia de cierre.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Saldo pendiente: <span className="font-medium text-foreground">{formatMonto(cerrarModalCaja?.saldo)}</span>
                </p>
                <label className="text-sm font-medium">Comprobante de cierre *</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={comprobanteRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => comprobanteRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {comprobanteFile ? comprobanteFile.name : 'Seleccionar archivo'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Documento firmado de devolución del saldo.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setCerrarModalCaja(null); setComprobanteFile(null); }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCerrarSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CajasMenudasPage;
