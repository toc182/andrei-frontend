/**
 * Página de Información de Equipos - Migrada a Shadcn/ui
 *
 * CRUD completo de equipos con:
 * - Dos tablas separadas (Pinellas y COCP)
 * - Modal de detalles
 * - Formulario crear/editar con validación Zod
 * - Modal de confirmación para eliminar
 * - Loading states
 * - Sin FontAwesome, sin CSS custom
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../utils/formatters';
import type { EquipoExtended, ApiResponse } from '@/types';

// Shell components
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { SectionHeader } from '@/components/shell/SectionHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Loader2 } from 'lucide-react';

// Type definition for form data
interface EquipoFormData {
  codigo?: string;
  descripcion: string;
  marca: string;
  modelo: string;
  ano: number;
  motor?: string;
  chasis?: string;
  costo?: number | string;
  valor_actual?: number | string;
  rata_mes?: number | string;
  observaciones?: string;
  owner: 'Pinellas' | 'COCP';
}

// Schema de validación con Zod
const equipoSchema = z.object({
  codigo: z.string().optional(),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  marca: z.string().min(1, 'Marca es obligatoria'),
  modelo: z.string().min(1, 'Modelo es obligatorio'),
  ano: z
    .number()
    .min(1900, 'Año debe ser mayor a 1900')
    .max(2030, 'Año debe ser menor a 2030'),
  motor: z.string().optional(),
  chasis: z.string().optional(),
  costo: z.any().optional(),
  valor_actual: z.any().optional(),
  rata_mes: z.any().optional(),
  observaciones: z.string().optional(),
  owner: z.enum(['Pinellas', 'COCP']),
});

interface EquiposInformacionProps {
  onRegisterAction?: (handler: (() => void) | null) => void;
}

export default function EquiposInformacionN({ onRegisterAction }: EquiposInformacionProps) {
  const { hasPermission } = useAuth();
  const [equiposPinellas, setEquiposPinellas] = useState<EquipoExtended[]>([]);
  const [equiposCOCP, setEquiposCOCP] = useState<EquipoExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para modales
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoExtended | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<EquipoExtended | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [equipoToDelete, setEquipoToDelete] = useState<EquipoExtended | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup
  const form = useForm<EquipoFormData>({
    resolver: zodResolver(equipoSchema) as any,
    defaultValues: {
      codigo: '',
      descripcion: '',
      marca: '',
      modelo: '',
      ano: new Date().getFullYear(),
      motor: '',
      chasis: '',
      costo: '',
      valor_actual: '',
      rata_mes: '',
      observaciones: '',
      owner: 'Pinellas',
    },
  });

  // Cargar equipos desde API
  const loadEquipos = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get<ApiResponse<EquipoExtended[]>>('/equipos');

      if (response.data.success && response.data.data) {
        const equipos = response.data.data;
        setEquiposPinellas(equipos.filter((e) => e.owner === 'Pinellas'));
        setEquiposCOCP(equipos.filter((e) => e.owner === 'COCP'));
      } else {
        setError('Error al cargar equipos');
      }
    } catch (err) {
      console.error('Error loading equipos:', err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipos();
  }, []);

  // Handlers
  const handleAddEquipo = () => {
    setEditingEquipo(null);
    form.reset({
      codigo: '',
      descripcion: '',
      marca: '',
      modelo: '',
      ano: new Date().getFullYear(),
      motor: '',
      chasis: '',
      costo: '',
      valor_actual: '',
      rata_mes: '',
      observaciones: '',
      owner: 'Pinellas',
    });
    setFormOpen(true);
  };

  useEffect(() => {
    if (onRegisterAction) {
      onRegisterAction(hasPermission('equipos_agregar') ? handleAddEquipo : null);
      return () => onRegisterAction(null);
    }
  }, [onRegisterAction]);

  const handleEditEquipo = (equipo: EquipoExtended, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEquipo(equipo);
    form.reset({
      codigo: equipo.codigo || '',
      descripcion: equipo.descripcion || '',
      marca: equipo.marca || '',
      modelo: equipo.modelo || '',
      ano: equipo.ano || new Date().getFullYear(),
      motor: equipo.motor || '',
      chasis: equipo.chasis || '',
      costo: equipo.costo || '',
      valor_actual: equipo.valor_actual || '',
      rata_mes: equipo.rata_mes || '',
      observaciones: equipo.observaciones || '',
      owner: equipo.owner || 'Pinellas',
    });
    setFormOpen(true);
  };

  const handleRowClick = (equipo: EquipoExtended) => {
    setSelectedEquipo(equipo);
    setDetailsOpen(true);
  };

  const handleSubmit = async (data: EquipoFormData) => {
    setIsSubmitting(true);
    try {
      const equipoData = {
        codigo: data.codigo || null,
        descripcion: data.descripcion,
        marca: data.marca,
        modelo: data.modelo,
        ano: Number(data.ano),
        motor: data.motor || null,
        chasis: data.chasis || null,
        costo:
          data.costo != null && String(data.costo) !== ''
            ? parseFloat(String(data.costo))
            : null,
        valor_actual:
          data.valor_actual != null && String(data.valor_actual) !== ''
            ? parseFloat(String(data.valor_actual))
            : null,
        rata_mes:
          data.rata_mes != null && String(data.rata_mes) !== ''
            ? parseFloat(String(data.rata_mes))
            : null,
        observaciones: data.observaciones || null,
        owner: data.owner,
      };

      if (editingEquipo) {
        await api.put(`/equipos/${editingEquipo.id}`, equipoData);
      } else {
        await api.post('/equipos', equipoData);
      }

      await loadEquipos();
      setFormOpen(false);
      setEditingEquipo(null);
      form.reset();
    } catch (err) {
      console.error('Error al guardar equipo:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message || 'Error al guardar el equipo',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    setEquipoToDelete(editingEquipo);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!equipoToDelete) return;

    setIsSubmitting(true);
    try {
      await api.delete(`/equipos/${equipoToDelete.id}`);
      await loadEquipos();
      setDeleteOpen(false);
      setFormOpen(false);
      setEquipoToDelete(null);
      setEditingEquipo(null);
      form.reset();
    } catch (err) {
      console.error('Error deleting equipo:', err);
      setError('Error al eliminar el equipo');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renderizar tabla de equipos
  const renderTable = (equipos: EquipoExtended[]) => (
    <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marca</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modelo</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Año</TableHead>
              <TableHead className="w-[50px] px-4 py-2.5"></TableHead>
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : equipos.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    title="No hay equipos registrados"
                    description="Agrega un equipo para comenzar"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {equipos.map((equipo) => (
                <TableRow
                  key={equipo.id}
                  className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                  onClick={() => handleRowClick(equipo)}
                >
                  <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                    {equipo.codigo || 'N/A'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{equipo.descripcion}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{equipo.marca}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{equipo.modelo}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{equipo.ano}</TableCell>
                  <TableCell className="px-4 py-3">
                    {hasPermission('equipos_editar') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleEditEquipo(equipo, e)}
                        title="Editar equipo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
    </Card>
  );

  // Error state (full section)
  if (error && !formOpen) {
    return (
      <ErrorState
        title="Error al cargar equipos"
        description={error}
        onRetry={loadEquipos}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Equipos Pinellas */}
      <div className="space-y-3">
        <SectionHeader title="Equipos Pinellas" count={equiposPinellas.length} />
        {renderTable(equiposPinellas)}
      </div>

      {/* Equipos COCP */}
      <div className="space-y-3">
        <SectionHeader title="Equipos COCP" count={equiposCOCP.length} />
        {renderTable(equiposCOCP)}
      </div>

      {/* Modal de Detalles */}
      <AppDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        size="simple"
        title="Detalles del Equipo"
      >
        <div className="space-y-3 text-sm">
          {[
            ['Código', selectedEquipo?.codigo || 'N/A'],
            ['Descripción', selectedEquipo?.descripcion],
            ['Marca', selectedEquipo?.marca],
            ['Modelo', selectedEquipo?.modelo],
            ['Año', selectedEquipo?.ano],
            ['# Motor', selectedEquipo?.motor || 'N/A'],
            ['# Chasis', selectedEquipo?.chasis || 'N/A'],
            ['Costo', selectedEquipo ? formatMoney(selectedEquipo.costo) : 'N/A'],
            ['Valor Actual', selectedEquipo ? formatMoney(selectedEquipo.valor_actual) : 'N/A'],
            ['Rata/Mes', selectedEquipo ? formatMoney(selectedEquipo.rata_mes) : 'N/A'],
            ['Propietario', selectedEquipo?.owner],
          ].map(([label, value]) => (
            <div key={String(label)} className="grid grid-cols-3 gap-2">
              <span className="font-medium text-muted-foreground">{label}:</span>
              <span className="col-span-2">{String(value ?? '')}</span>
            </div>
          ))}
          {selectedEquipo?.observaciones && (
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium text-muted-foreground">Observaciones:</span>
              <span className="col-span-2">{selectedEquipo.observaciones}</span>
            </div>
          )}
        </div>
      </AppDialog>

      {/* Formulario Crear/Editar */}
      <AppDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        size="standard"
        title={editingEquipo ? 'Editar Equipo' : 'Agregar Nuevo Equipo'}
        description={
          editingEquipo
            ? 'Modifica la información del equipo'
            : 'Completa los datos del nuevo equipo'
        }
        footer={
          <>
            <div>
              {editingEquipo && hasPermission('equipos_eliminar') && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteClick}
                  disabled={isSubmitting}
                >
                  Eliminar Equipo
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" form="equipo-form" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  `${editingEquipo ? 'Actualizar' : 'Guardar'} Equipo`
                )}
              </Button>
            </div>
          </>
        }
      >
        {error && formOpen && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <Form {...form}>
          <form
            id="equipo-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="owner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Propietario *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar propietario" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pinellas">Pinellas</SelectItem>
                      <SelectItem value="COCP">COCP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 01-19" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Retroexcavadora, Pala 21 Ton" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: John Deere" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 310K" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ano"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año *</FormLabel>
                  <FormControl>
                    <Input type="number" min="1900" max="2030" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="motor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel># Motor</FormLabel>
                    <FormControl>
                      <Input placeholder="Número de motor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel># Chasis</FormLabel>
                    <FormControl>
                      <Input placeholder="Número de chasis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="costo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_actual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Actual</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rata_mes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rata/Mes</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones adicionales..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </AppDialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente{' '}
              <strong>{equipoToDelete?.descripcion}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
