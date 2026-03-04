import { useState, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';

// Shadcn Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    abreviatura: z.string().max(25, 'Máximo 25 caracteres').optional().or(z.literal('')),
    tipo: z.enum(['privado', 'estado']),
    contacto: z.string().optional().or(z.literal('')),
    telefono: z.string().optional().or(z.literal('')),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    direccion: z.string().optional().or(z.literal(''))
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
            direccion: ''
        }
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
            direccion: ''
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
            direccion: cliente.direccion || ''
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
            setError(apiError.response?.data?.message || 'Error al guardar el cliente');
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
            setError(apiError.response?.data?.message || 'Error al eliminar el cliente');
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
            <Badge variant="secondary">Estado</Badge>
        ) : (
            <Badge variant="outline">Privado</Badge>
        );
    };

    if (loading && clientes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">Cargando clientes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header con botón */}
            {hasPermission('clientes_agregar') && (
            <div className="flex justify-end">
                <Button onClick={handleNewCliente}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Cliente
                </Button>
            </div>
            )}

            {/* Error global */}
            {error && !showFormModal && !showDeleteConfirmation && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Tabla de clientes */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="text-center">Abreviatura</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clientes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No hay clientes registrados
                                </TableCell>
                            </TableRow>
                        ) : (
                            clientes.map((cliente) => (
                                <TableRow
                                    key={cliente.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRowClick(cliente)}
                                >
                                    <TableCell className="font-medium">{cliente.nombre}</TableCell>
                                    <TableCell className="text-center">{cliente.abreviatura}</TableCell>
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal de formulario (crear/editar) */}
            <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCliente
                                ? 'Modifica los datos del cliente'
                                : 'Completa los datos para crear un nuevo cliente'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {/* Error en formulario */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Formulario */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            {/* Nombre */}
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

                            {/* Abreviatura */}
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

                            {/* Tipo - Solo al crear */}
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

                            {/* Contacto */}
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

                            {/* Teléfono */}
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

                            {/* Email */}
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

                            {/* Dirección */}
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

                            {/* Footer */}
                            <DialogFooter className="gap-2">
                                {editingCliente && hasPermission('clientes_eliminar') && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteConfirm}
                                        disabled={submitting}
                                        className="mr-auto"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                    </Button>
                                )}
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
                                    {submitting
                                        ? (editingCliente ? 'Actualizando...' : 'Creando...')
                                        : (editingCliente ? 'Actualizar' : 'Crear')
                                    }
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal de detalles */}
            <Dialog open={showDetailsModal} onOpenChange={handleCloseDetailsModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Detalles del Cliente</DialogTitle>
                    </DialogHeader>

                    {selectedCliente && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Nombre:</label>
                                <span className="text-sm">{selectedCliente.nombre}</span>
                            </div>

                            {selectedCliente.abreviatura && (
                                <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                    <label className="font-medium text-sm text-muted-foreground">Abreviatura:</label>
                                    <span className="text-sm">{selectedCliente.abreviatura}</span>
                                </div>
                            )}

                            {selectedCliente.tipo && (
                                <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                    <label className="font-medium text-sm text-muted-foreground">Tipo:</label>
                                    <div>{getTipoBadge(selectedCliente.tipo)}</div>
                                </div>
                            )}

                            {selectedCliente.contacto && (
                                <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                    <label className="font-medium text-sm text-muted-foreground">Contacto:</label>
                                    <span className="text-sm">{selectedCliente.contacto}</span>
                                </div>
                            )}

                            {selectedCliente.telefono && (
                                <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                    <label className="font-medium text-sm text-muted-foreground">Teléfono:</label>
                                    <span className="text-sm">{selectedCliente.telefono}</span>
                                </div>
                            )}

                            {selectedCliente.email && (
                                <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                    <label className="font-medium text-sm text-muted-foreground">Email:</label>
                                    <span className="text-sm">{selectedCliente.email}</span>
                                </div>
                            )}

                            {selectedCliente.direccion && (
                                <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                                    <label className="font-medium text-sm text-muted-foreground">Dirección:</label>
                                    <span className="text-sm">{selectedCliente.direccion}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
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
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación de eliminación */}
            <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Eliminar Cliente
                        </DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="font-semibold">
                            ¿Estás seguro de que quieres eliminar este cliente?
                        </p>
                        {editingCliente && (
                            <Alert>
                                <AlertDescription>
                                    <strong>Cliente:</strong> {editingCliente.nombre}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowDeleteConfirmation(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={submitting}
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sí, Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ClientesN;
