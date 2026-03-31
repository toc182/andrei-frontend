import { useState, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { Plus, Pencil, Loader2, Wallet } from 'lucide-react';
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

// --- Zod schema ---

const cajaSchema = z.object({
  proyecto_id: z.string().min(1, 'Proyecto es obligatorio'),
  responsable_id: z.string().min(1, 'Responsable es obligatorio'),
  nombre: z.string().min(1, 'Nombre es obligatorio'),
  monto_asignado: z.string().min(1, 'Monto es obligatorio').refine(
    (v) => !isNaN(Number(v)) && Number(v) > 0,
    'Monto debe ser mayor a 0',
  ),
  estado: z.enum(['abierta', 'cerrada']).optional(),
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
  const [editingCaja, setEditingCaja] = useState<CajaMenuda | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedCajaId, setSelectedCajaId] = useState<number | null>(null);

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

  const loadCajas = async () => {
    try {
      setLoading(true);
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
        setProyectos(response.data.data);
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
    setEditingCaja(null);
    form.reset({
      proyecto_id: projectId ? String(projectId) : '',
      responsable_id: '',
      nombre: '',
      monto_asignado: '',
    });
    setError('');
    setShowFormModal(true);
  };

  const handleEdit = (caja: CajaMenuda) => {
    setEditingCaja(caja);
    form.reset({
      proyecto_id: String(caja.proyecto_id),
      responsable_id: String(caja.responsable_id),
      nombre: caja.nombre,
      monto_asignado: String(caja.monto_asignado),
      estado: caja.estado as 'abierta' | 'cerrada',
    });
    setError('');
    setShowFormModal(true);
  };

  const handleSubmit = async (data: CajaFormData) => {
    try {
      setSubmitting(true);
      setError('');

      if (editingCaja) {
        await api.put(`/cajas-menudas/${editingCaja.id}`, {
          nombre: data.nombre,
          responsable_id: Number(data.responsable_id),
          estado: data.estado,
        });
      } else {
        await api.post('/cajas-menudas', {
          proyecto_id: Number(data.proyecto_id),
          responsable_id: Number(data.responsable_id),
          nombre: data.nombre,
          monto_asignado: Number(data.monto_asignado),
        });
      }

      loadCajas();
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

  // Detail view
  if (selectedCajaId) {
    return (
      <CajaMenudaDetail
        cajaId={selectedCajaId}
        onBack={() => {
          setSelectedCajaId(null);
          loadCajas();
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
                      <p className="font-medium">{caja.nombre}</p>
                      {!projectId && <p className="text-sm text-muted-foreground">{caja.proyecto_nombre}</p>}
                    </div>
                    {estadoBadge(caja.estado)}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Asignado</span>
                    <span className="font-medium">{formatMonto(caja.monto_asignado)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-medium ${Number(caja.saldo) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMonto(caja.saldo)}
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
                    <TableCell className="font-medium">{caja.nombre}</TableCell>
                    {!projectId && <TableCell>{caja.proyecto_nombre}</TableCell>}
                    <TableCell>{caja.responsable_nombre}</TableCell>
                    <TableCell className="text-right">{formatMonto(caja.monto_asignado)}</TableCell>
                    <TableCell className={`text-right font-medium ${Number(caja.saldo) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMonto(caja.saldo)}
                    </TableCell>
                    <TableCell>{estadoBadge(caja.estado)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(caja);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCaja ? 'Editar Caja Menuda' : 'Nueva Caja Menuda'}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Proyecto (only on create, and only when not inside a project) */}
              {!editingCaja && !projectId && (
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

              {/* Monto asignado (only on create — editing uses PUT /:id/monto) */}
              {!editingCaja && (
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
              )}

              {/* Estado (only on edit) */}
              {editingCaja && (
                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="abierta">Abierta</SelectItem>
                          <SelectItem value="cerrada">Cerrada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
                  {editingCaja ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CajasMenudasPage;
