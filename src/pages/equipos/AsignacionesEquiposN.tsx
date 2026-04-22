/**
 * Página de Asignaciones de Equipos - Migrada a Shadcn/ui
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../../services/api';
import type {
  AsignacionExtended,
  EquipoExtended,
  Cliente,
  Project,
  RegistroUsoExtended,
  ApiResponse,
} from '@/types';

// Shell components
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';

import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Clock, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface AsignacionFormData {
  equipo_id: string;
  cliente_id: string;
  proyecto_id: string;
  responsable_id?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  tipo_uso: 'propio' | 'alquiler';
  tipo_cobro?: string;
  tarifa?: number | string;
  incluye_operador: boolean;
  costo_operador?: number | string;
  incluye_combustible: boolean;
  costo_combustible?: number | string;
  ajuste_monto?: number | string;
  motivo_ajuste?: string;
  observaciones?: string;
}

interface RegistroUsoFormData {
  fecha_inicio: string;
  fecha_fin?: string;
  cantidad: number;
  observaciones?: string;
}

const asignacionSchema = z.object({
  equipo_id: z.string().min(1, 'Equipo es obligatorio'),
  cliente_id: z.string().min(1, 'Cliente es obligatorio'),
  proyecto_id: z.string().min(1, 'Proyecto es obligatorio'),
  responsable_id: z.string().optional(),
  fecha_inicio: z.string().min(1, 'Fecha de inicio es obligatoria'),
  fecha_fin: z.string().optional(),
  tipo_uso: z.enum(['propio', 'alquiler']),
  tipo_cobro: z.string().optional(),
  tarifa: z.any().optional(),
  incluye_operador: z.boolean(),
  costo_operador: z.any().optional(),
  incluye_combustible: z.boolean(),
  costo_combustible: z.any().optional(),
  ajuste_monto: z.any().optional(),
  motivo_ajuste: z.string().optional(),
  observaciones: z.string().optional(),
});

const registroUsoSchema = z.object({
  fecha_inicio: z.string().min(1, 'Fecha es obligatoria'),
  fecha_fin: z.string().optional(),
  cantidad: z.number().min(0, 'Cantidad debe ser mayor a 0'),
  observaciones: z.string().optional(),
});

interface AsignacionesState {
  alquiler: AsignacionExtended[];
  propios: AsignacionExtended[];
}

export default function AsignacionesEquiposN() {
  const [asignaciones, setAsignaciones] = useState<AsignacionesState>({
    alquiler: [],
    propios: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [registroUsoOpen, setRegistroUsoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedAsignacion, setSelectedAsignacion] = useState<AsignacionExtended | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [equipos, setEquipos] = useState<EquipoExtended[]>([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState<EquipoExtended[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [registrosUso, setRegistrosUso] = useState<RegistroUsoExtended[]>([]);

  const asignacionForm = useForm<AsignacionFormData>({
    resolver: zodResolver(asignacionSchema) as any,
    defaultValues: {
      equipo_id: '',
      cliente_id: '',
      proyecto_id: '',
      responsable_id: '',
      fecha_inicio: '',
      fecha_fin: '',
      tipo_uso: 'propio',
      tipo_cobro: '',
      tarifa: '',
      incluye_operador: false,
      costo_operador: '',
      incluye_combustible: false,
      costo_combustible: '',
      ajuste_monto: '',
      motivo_ajuste: '',
      observaciones: '',
    },
  });

  const registroUsoForm = useForm<RegistroUsoFormData>({
    resolver: zodResolver(registroUsoSchema) as any,
    defaultValues: {
      fecha_inicio: '',
      fecha_fin: '',
      cantidad: 0,
      observaciones: '',
    },
  });

  const tipoUso = asignacionForm.watch('tipo_uso');
  const incluyeOperador = asignacionForm.watch('incluye_operador');
  const incluyeCombustible = asignacionForm.watch('incluye_combustible');

  const loadAsignaciones = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<AsignacionExtended[]>>('/asignaciones');
      if (response.data.success && response.data.data) {
        const all = response.data.data;
        setAsignaciones({
          alquiler: all.filter((a) => a.tipo_uso === 'alquiler'),
          propios: all.filter((a) => a.tipo_uso === 'propio'),
        });
      }
    } catch (err) {
      console.error('Error loading asignaciones:', err);
      setError('Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  };

  const loadFormData = async (editingAsignacion: AsignacionExtended | null = null) => {
    try {
      const [equiposRes, clientesRes, proyectosRes, asignacionesRes] = await Promise.all([
        api.get<ApiResponse<EquipoExtended[]>>('/equipos'),
        api.get<{ success: boolean; data: Cliente[] }>('/clientes'),
        api.get<{ success: boolean; proyectos: Project[] }>('/projects'),
        api.get<ApiResponse<AsignacionExtended[]>>('/asignaciones'),
      ]);

      if (equiposRes.data.success && equiposRes.data.data) {
        const todosEquipos = equiposRes.data.data;
        setEquipos(todosEquipos);
        if (asignacionesRes.data.success && asignacionesRes.data.data) {
          const equiposAsignadosIds = asignacionesRes.data.data
            .filter((a) => !editingAsignacion || a.id !== editingAsignacion.id)
            .map((a) => a.equipo_id);
          setEquiposDisponibles(todosEquipos.filter((e) => !equiposAsignadosIds.includes(e.id)));
        } else {
          setEquiposDisponibles(todosEquipos);
        }
      }
      if (clientesRes.data.success) setClientes(clientesRes.data.data);
      if (proyectosRes.data.success) setProyectos(proyectosRes.data.proyectos);
    } catch (err) {
      console.error('Error loading form data:', err);
      setError('Error al cargar datos del formulario');
    }
  };

  const loadRegistrosUso = async (asignacionId: number) => {
    try {
      const response = await api.get<ApiResponse<RegistroUsoExtended[]>>(
        `/registro-uso/asignacion/${asignacionId}`,
      );
      if (response.data.success && response.data.data) {
        setRegistrosUso(response.data.data);
      }
    } catch (err) {
      console.error('Error loading registros:', err);
    }
  };

  useEffect(() => {
    loadAsignaciones();
  }, []);

  const handleNewAsignacion = async () => {
    await loadFormData();
    setSelectedAsignacion(null);
    asignacionForm.reset({
      equipo_id: '', cliente_id: '', proyecto_id: '', responsable_id: '',
      fecha_inicio: '', fecha_fin: '', tipo_uso: 'propio', tipo_cobro: '',
      tarifa: '', incluye_operador: false, costo_operador: '',
      incluye_combustible: false, costo_combustible: '', observaciones: '',
    });
    setFormOpen(true);
  };

  const handleEditAsignacion = async (asignacion: AsignacionExtended) => {
    await loadFormData(asignacion);
    setSelectedAsignacion(asignacion);
    asignacionForm.reset({
      equipo_id: asignacion.equipo_id?.toString() || '',
      cliente_id: asignacion.cliente_id?.toString() || '',
      proyecto_id: asignacion.proyecto_id?.toString() || '',
      responsable_id: asignacion.responsable_id || '',
      fecha_inicio: asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '',
      fecha_fin: asignacion.fecha_fin ? asignacion.fecha_fin.split('T')[0] : '',
      tipo_uso: asignacion.tipo_uso || 'propio',
      tipo_cobro: asignacion.tipo_cobro || '',
      tarifa: asignacion.tarifa || '',
      incluye_operador: asignacion.incluye_operador || false,
      costo_operador: asignacion.costo_operador || '',
      incluye_combustible: asignacion.incluye_combustible || false,
      costo_combustible: asignacion.costo_combustible || '',
      observaciones: asignacion.observaciones || '',
    });
    setFormOpen(true);
  };

  const handleRegistroUso = async (asignacion: AsignacionExtended) => {
    setSelectedAsignacion(asignacion);
    await loadRegistrosUso(asignacion.id);
    registroUsoForm.reset({
      fecha_inicio: asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '',
      fecha_fin: '',
      cantidad: 0,
      observaciones: '',
    });
    setRegistroUsoOpen(true);
  };

  const handleAsignacionSubmit = async (data: AsignacionFormData) => {
    setIsSubmitting(true);
    try {
      let response;
      if (selectedAsignacion) {
        response = await api.put<ApiResponse<AsignacionExtended>>(
          `/asignaciones/${selectedAsignacion.id}`, data,
        );
      } else {
        response = await api.post<ApiResponse<AsignacionExtended>>('/asignaciones', data);
      }
      if (response.data.success) {
        await loadAsignaciones();
        setFormOpen(false);
        setSelectedAsignacion(null);
        asignacionForm.reset();
      } else {
        setError(response.data.message || 'Error al guardar la asignación');
      }
    } catch (err) {
      console.error('Error saving asignacion:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistroUsoSubmit = async (data: RegistroUsoFormData) => {
    if (!selectedAsignacion) return;
    setIsSubmitting(true);
    try {
      const dataToSend = {
        asignacion_id: selectedAsignacion.id,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: selectedAsignacion.tipo_cobro === 'hora' ? data.fecha_inicio : data.fecha_fin,
        cantidad: data.cantidad,
        observaciones: data.observaciones || null,
      };
      const response = await api.post<ApiResponse<RegistroUsoExtended>>('/registro-uso', dataToSend);
      if (response.data.success) {
        await loadRegistrosUso(selectedAsignacion.id);
        registroUsoForm.reset({
          fecha_inicio: selectedAsignacion.fecha_inicio
            ? selectedAsignacion.fecha_inicio.split('T')[0]
            : '',
          fecha_fin: '',
          cantidad: 0,
          observaciones: '',
        });
      }
    } catch (err) {
      console.error('Error saving registro uso:', err);
      setError('Error al guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAsignacion) return;
    setIsSubmitting(true);
    try {
      const response = await api.delete<ApiResponse<void>>(
        `/asignaciones/${selectedAsignacion.id}`,
      );
      if (response.data.success) {
        await loadAsignaciones();
        setDeleteOpen(false);
        setFormOpen(false);
        setSelectedAsignacion(null);
      }
    } catch (err) {
      console.error('Error deleting asignacion:', err);
      setError('Error al eliminar la asignación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTable = (
    asignacionesData: AsignacionExtended[],
    title: string,
    showRegistroBtn = false,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : asignacionesData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No hay asignaciones
                </TableCell>
              </TableRow>
            ) : (
              asignacionesData.map((asignacion) => (
                <TableRow
                  key={asignacion.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    showRegistroBtn
                      ? handleRegistroUso(asignacion)
                      : handleEditAsignacion(asignacion)
                  }
                >
                  <TableCell className="font-medium">
                    {asignacion.equipo_descripcion}
                  </TableCell>
                  <TableCell>{asignacion.cliente_nombre}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {showRegistroBtn && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegistroUso(asignacion);
                          }}
                          title="Registrar Uso"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAsignacion(asignacion);
                        }}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleNewAsignacion}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Asignación
        </Button>
      </div>

      {error && !formOpen && !registroUsoOpen && (
        <Alert variant="error" title={error} />
      )}

      {renderTable(asignaciones.alquiler, 'Equipos en Alquiler', true)}
      {renderTable(asignaciones.propios, 'Equipos en Proyectos Propios', false)}

      {/* Formulario de Asignación */}
      <AppDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        size="standard"
        title={selectedAsignacion ? 'Editar Asignación' : 'Nueva Asignación de Equipo'}
        footer={
          <>
            <div>
              {selectedAsignacion && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={isSubmitting}
                >
                  Eliminar
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
              <Button type="submit" form="asignacion-form" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : selectedAsignacion ? (
                  'Actualizar'
                ) : (
                  'Crear Asignación'
                )}
              </Button>
            </div>
          </>
        }
      >
        {error && formOpen && <Alert variant="error" title={error} className="mb-4" />}

        <Form {...asignacionForm}>
          <form
            id="asignacion-form"
            onSubmit={asignacionForm.handleSubmit(handleAsignacionSubmit)}
            className="space-y-4"
          >
            {!selectedAsignacion && (
              <FormField
                control={asignacionForm.control}
                name="equipo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar equipo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equiposDisponibles.map((equipo) => (
                          <SelectItem key={equipo.id} value={equipo.id.toString()}>
                            {equipo.codigo} - {equipo.descripcion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedAsignacion && (
              <div className="rounded-md bg-muted p-3 text-sm font-semibold">
                Equipo:{' '}
                {equipos.find((e) => e.id === selectedAsignacion.equipo_id)?.codigo} —{' '}
                {equipos.find((e) => e.id === selectedAsignacion.equipo_id)?.descripcion}
              </div>
            )}

            <FormField
              control={asignacionForm.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id.toString()}>
                          {cliente.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={asignacionForm.control}
              name="proyecto_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proyecto *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proyecto..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {proyectos.map((proyecto) => (
                        <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                          {proyecto.nombre_corto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={asignacionForm.control}
              name="responsable_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsable</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del responsable" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={asignacionForm.control}
              name="fecha_inicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Inicio *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={asignacionForm.control}
              name="tipo_uso"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Uso *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="propio">Propio</SelectItem>
                      <SelectItem value="alquiler">Alquiler</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipoUso === 'alquiler' && (
              <>
                <FormField
                  control={asignacionForm.control}
                  name="tipo_cobro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Cobro</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hora">Por Hora</SelectItem>
                          <SelectItem value="dia">Por Día</SelectItem>
                          <SelectItem value="semana">Por Semana</SelectItem>
                          <SelectItem value="mes">Por Mes</SelectItem>
                          <SelectItem value="costo_fijo">Costo Fijo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={asignacionForm.control}
                  name="tarifa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tarifa</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Ej: 100.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={asignacionForm.control}
              name="incluye_operador"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Incluye Operador</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {incluyeOperador && (
              <FormField
                control={asignacionForm.control}
                name="costo_operador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo Operador</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ej: 50.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={asignacionForm.control}
              name="incluye_combustible"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Incluye Combustible</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {incluyeCombustible && (
              <FormField
                control={asignacionForm.control}
                name="costo_combustible"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo Combustible</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ej: 25.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={asignacionForm.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Comentarios adicionales" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </AppDialog>

      {/* Formulario de Registro de Uso */}
      <AppDialog
        open={registroUsoOpen}
        onOpenChange={setRegistroUsoOpen}
        size="simple"
        title="Registrar Uso del Equipo"
        description={`${selectedAsignacion?.equipo_descripcion} — ${selectedAsignacion?.cliente_nombre}`}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegistroUsoOpen(false)}
              disabled={isSubmitting}
            >
              Cerrar
            </Button>
            <Button type="submit" form="registro-uso-form" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </>
        }
      >
        <Form {...registroUsoForm}>
          <form
            id="registro-uso-form"
            onSubmit={registroUsoForm.handleSubmit(handleRegistroUsoSubmit)}
            className="space-y-4"
          >
            <FormField
              control={registroUsoForm.control}
              name="fecha_inicio"
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

            {selectedAsignacion?.tipo_cobro !== 'hora' && (
              <FormField
                control={registroUsoForm.control}
                name="fecha_fin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Fin</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={registroUsoForm.control}
              name="cantidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Cantidad ({selectedAsignacion?.tipo_cobro || 'horas'}) *
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={registroUsoForm.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Comentarios..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {registrosUso.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Registros Anteriores</h4>
                <div className="rounded-md border max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrosUso.map((registro) => (
                        <TableRow key={registro.id}>
                          <TableCell className="text-sm">
                            {new Date(registro.fecha_inicio).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">{registro.cantidad}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </form>
        </Form>
      </AppDialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
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
