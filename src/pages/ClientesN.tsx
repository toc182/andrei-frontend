import { useState, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Pencil, Plus, Trash2, Loader2, Users } from 'lucide-react';

// Shell components
import { PageHeader } from '@/components/shell/PageHeader';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { EmptyState, TableSkeleton } from '@/components/shell/states';

// Shadcn Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface Cliente {
  id: number;
  nombre: string;
  abreviatura?: string;
  tipo?: 'privado' | 'estado';
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

/**
 * Schema de validación con Zod
 */
const clienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  abreviatura: z
    .string()
    .max(25, 'Máximo 25 caracteres')
    .optional()
    .or(z.literal('')),
  tipo: z.enum(['privado', 'estado']),
  contacto: z.string().optional().or(z.literal('')),
  telefono: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  direccion: z.string().optional().or(z.literal('')),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

const ClientesN = () => {
  const { hasPermission } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // React Hook Form
  const form: UseFormReturn<ClienteFormData> = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: '',
      abreviatura: '',
      tipo: 'privado',
      contacto: '',
      telefono: '',
      email: '',
      direccion: '',
    },
  });

  // Cargar clientes
  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clientes');
      if (response.data.success) {
        setClientes(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para nuevo cliente
  const handleNewCliente = () => {
    setEditingCliente(null);
    form.reset({
      nombre: '',
      abreviatura: '',
      tipo: 'privado',
      contacto: '',
      telefono: '',
      email: '',
      direccion: '',
    });
    setError('');
    setShowFormModal(true);
  };

  // Abrir modal para editar cliente
  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    form.reset({
      nombre: cliente.nombre,
      abreviatura: cliente.abreviatura || '',
      tipo: cliente.tipo || 'privado',
      contacto: cliente.contacto || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
    });
    setError('');
    setShowFormModal(true);
  };

  // Submit formulario
  const handleSubmit = async (data: ClienteFormData) => {
    try {
      setSubmitting(true);
      setError('');

      if (editingCliente) {
        await api.put(`/clientes/${editingCliente.id}`, data);
      } else {
        await api.post('/clientes', data);
      }

      loadClientes();
      setShowFormModal(false);
      form.reset();
    } catch (err: unknown) {
      console.error('Error guardando cliente:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message || 'Error al guardar el cliente',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar eliminación
  const handleDeleteConfirm = () => {
    if (!editingCliente) return;
    setShowFormModal(false);
    setShowDeleteConfirmation(true);
  };

  // Eliminar cliente
  const handleDelete = async () => {
    if (!editingCliente) return;

    try {
      setSubmitting(true);
      const response = await api.delete(`/clientes/${editingCliente.id}`);
      if (response.data.success) {
        loadClientes();
        setShowDeleteConfirmation(false);
        setEditingCliente(null);
      } else {
        setError(response.data.message || 'Error al eliminar el cliente');
      }
    } catch (err: unknown) {
      console.error('Error eliminando cliente:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message || 'Error al eliminar el cliente',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Ver detalles del cliente
  const handleRowClick = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowDetailsModal(true);
  };

  // Cerrar modal de detalles
  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedCliente(null);
  };

  // Obtener badge de tipo
  const getTipoBadge = (tipo?: string) => {
    return tipo === 'estado' ? (
      <Badge className="bg-info/10 text-info border-info/30 border">Estado</Badge>
    ) : (
      <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">Privado</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Administra la información de clientes y contactos"
      >
        {hasPermission('clientes_agregar') && (
          <Button onClick={handleNewCliente}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Cliente
          </Button>
        )}
      </PageHeader>

      {/* Error global */}
      {error && !showFormModal && !showDeleteConfirmation && (
        <Alert variant="error" title={error} />
      )}

      {/* Tabla de clientes */}
      <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-50 hover:bg-slate-50">
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</TableHead>
                <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abreviatura</TableHead>
                <TableHead className="w-[50px] px-4 py-2.5"></TableHead>
              </TableRow>
            </TableHeader>
            {loading ? (
              <TableSkeleton rows={5} columns={3} />
            ) : clientes.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={3} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="No hay clientes registrados"
                      description="Agrega el primer cliente para comenzar"
                      action={
                        hasPermission('clientes_agregar') ? (
                          <Button size="sm" onClick={handleNewCliente}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Cliente
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow
                    key={cliente.id}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                    onClick={() => handleRowClick(cliente)}
                  >
                    <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                      {cliente.nombre}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-sm text-slate-700">
                      {cliente.abreviatura}
                    </TableCell>
                    <TableCell>
                      {hasPermission('clientes_editar') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(cliente);
                          }}
                          title="Editar cliente"
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

      {/* Modal de formulario (crear/editar) */}
      <AppDialog
        open={showFormModal}
        onOpenChange={setShowFormModal}
        size="simple"
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        description={
          editingCliente
            ? 'Modifica los datos del cliente'
            : 'Completa los datos para crear un nuevo cliente'
        }
        footer={
          <>
            <div className="flex gap-2">
              {editingCliente && hasPermission('clientes_eliminar') && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteConfirm}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFormModal(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="cliente-form"
                disabled={submitting}
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {submitting
                  ? editingCliente
                    ? 'Actualizando...'
                    : 'Creando...'
                  : editingCliente
                    ? 'Actualizar'
                    : 'Crear'}
              </Button>
            </div>
          </>
        }
      >
        {/* Error en formulario */}
        {error && showFormModal && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <Form {...form}>
          <form
            id="cliente-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Constructora Panamá S.A."
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="abreviatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abreviatura</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: CONST_PAN"
                      maxLength={25}
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!editingCliente && (
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cliente *</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        disabled={submitting}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="privado">Privado</option>
                        <option value="estado">Estado</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="contacto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona de Contacto</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Juan Pérez"
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Ej: 6000-0000"
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="ejemplo@empresa.com"
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Dirección completa..."
                      rows={3}
                      disabled={submitting}
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

      {/* Modal de detalles */}
      <AppDialog
        open={showDetailsModal}
        onOpenChange={handleCloseDetailsModal}
        size="simple"
        title="Detalles del Cliente"
        footer={
          <Button
            onClick={() => {
              handleCloseDetailsModal();
              if (selectedCliente) {
                handleEdit(selectedCliente);
              }
            }}
          >
            Editar
          </Button>
        }
      >
        {selectedCliente && (
          <div className="space-y-4">
            <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
              <label className="font-medium text-sm text-muted-foreground">
                Nombre:
              </label>
              <span className="text-sm">{selectedCliente.nombre}</span>
            </div>

            {selectedCliente.abreviatura && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Abreviatura:
                </label>
                <span className="text-sm">{selectedCliente.abreviatura}</span>
              </div>
            )}

            {selectedCliente.tipo && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Tipo:
                </label>
                <div>{getTipoBadge(selectedCliente.tipo)}</div>
              </div>
            )}

            {selectedCliente.contacto && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Contacto:
                </label>
                <span className="text-sm">{selectedCliente.contacto}</span>
              </div>
            )}

            {selectedCliente.telefono && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Teléfono:
                </label>
                <span className="text-sm">{selectedCliente.telefono}</span>
              </div>
            )}

            {selectedCliente.email && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Email:
                </label>
                <span className="text-sm">{selectedCliente.email}</span>
              </div>
            )}

            {selectedCliente.direccion && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Dirección:
                </label>
                <span className="text-sm">{selectedCliente.direccion}</span>
              </div>
            )}
          </div>
        )}
      </AppDialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {editingCliente && (
                <>Esta acción no se puede deshacer. Se eliminará permanentemente a <strong>{editingCliente.nombre}</strong>.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientesN;
