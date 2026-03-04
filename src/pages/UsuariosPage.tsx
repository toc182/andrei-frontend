import { useState, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Pencil, Plus, Loader2, UserX, UserCheck } from 'lucide-react';

// Shadcn Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Usuario {
    id: number;
    nombre: string;
    email: string;
    rol: 'admin' | 'co-admin' | 'usuario';
    activo: boolean;
    created_at: string;
    updated_at: string;
}

// Schema para crear usuario
const createSchema = z.object({
    nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
    rol: z.enum(['admin', 'co-admin', 'usuario']),
});

// Schema para editar usuario (sin contraseña)
const editSchema = z.object({
    nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    rol: z.enum(['admin', 'co-admin', 'usuario']),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

const UsuariosPage = () => {
    const { user: currentUser } = useAuth();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showToggleConfirm, setShowToggleConfirm] = useState(false);
    const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
    const [togglingUsuario, setTogglingUsuario] = useState<Usuario | null>(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const createForm: UseFormReturn<CreateFormData> = useForm<CreateFormData>({
        resolver: zodResolver(createSchema),
        defaultValues: {
            nombre: '',
            email: '',
            password: '',
            rol: 'usuario',
        },
    });

    const editForm: UseFormReturn<EditFormData> = useForm<EditFormData>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            nombre: '',
            email: '',
            rol: 'usuario',
        },
    });

    useEffect(() => {
        loadUsuarios();
    }, []);

    const loadUsuarios = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users');
            if (response.data.success) {
                setUsuarios(response.data.users);
            }
        } catch (err) {
            console.error('Error cargando usuarios:', err);
            setError('Error al cargar los usuarios');
        } finally {
            setLoading(false);
        }
    };

    // Abrir modal crear
    const handleNew = () => {
        createForm.reset({ nombre: '', email: '', password: '', rol: 'usuario' });
        setError('');
        setShowCreateModal(true);
    };

    // Abrir modal editar
    const handleEdit = (usuario: Usuario) => {
        setEditingUsuario(usuario);
        editForm.reset({
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
        });
        setError('');
        setShowEditModal(true);
    };

    // Crear usuario
    const handleCreate = async (data: CreateFormData) => {
        try {
            setSubmitting(true);
            setError('');
            await api.post('/users', data);
            loadUsuarios();
            setShowCreateModal(false);
            createForm.reset();
        } catch (err: unknown) {
            console.error('Error creando usuario:', err);
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Error al crear el usuario');
        } finally {
            setSubmitting(false);
        }
    };

    // Editar usuario
    const handleUpdate = async (data: EditFormData) => {
        if (!editingUsuario) return;
        try {
            setSubmitting(true);
            setError('');
            await api.put(`/users/${editingUsuario.id}`, data);
            loadUsuarios();
            setShowEditModal(false);
        } catch (err: unknown) {
            console.error('Error actualizando usuario:', err);
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Error al actualizar el usuario');
        } finally {
            setSubmitting(false);
        }
    };

    // Confirmar toggle activo
    const handleToggleConfirm = (usuario: Usuario) => {
        setTogglingUsuario(usuario);
        setError('');
        setShowToggleConfirm(true);
    };

    // Ejecutar toggle
    const handleToggle = async () => {
        if (!togglingUsuario) return;
        try {
            setSubmitting(true);
            await api.delete(`/users/${togglingUsuario.id}`);
            loadUsuarios();
            setShowToggleConfirm(false);
            setTogglingUsuario(null);
        } catch (err: unknown) {
            console.error('Error toggling usuario:', err);
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Error al cambiar estado del usuario');
        } finally {
            setSubmitting(false);
        }
    };

    const getRolBadge = (rol: string) => {
        if (rol === 'admin') return <Badge variant="destructive">Admin</Badge>;
        if (rol === 'co-admin') return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Co-Admin</Badge>;
        return <Badge variant="secondary">Usuario</Badge>;
    };

    // Co-admin no puede editar/desactivar admins
    const canManageUser = (usuario: Usuario): boolean => {
        if (currentUser?.rol === 'admin') return true;
        if (currentUser?.rol === 'co-admin' && usuario.rol === 'admin') return false;
        return true;
    };

    const getEstadoBadge = (activo: boolean) => {
        return activo
            ? <Badge variant="default">Activo</Badge>
            : <Badge variant="outline">Inactivo</Badge>;
    };

    if (loading && usuarios.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">Cargando usuarios...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-end">
                <Button onClick={handleNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            </div>

            {/* Error global */}
            {error && !showCreateModal && !showEditModal && !showToggleConfirm && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Tabla desktop */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-center">Rol</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usuarios.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No hay usuarios registrados
                                </TableCell>
                            </TableRow>
                        ) : (
                            usuarios.map((usuario) => (
                                <TableRow key={usuario.id}>
                                    <TableCell className="font-medium">{usuario.nombre}</TableCell>
                                    <TableCell className="text-muted-foreground">{usuario.email}</TableCell>
                                    <TableCell className="text-center">{getRolBadge(usuario.rol)}</TableCell>
                                    <TableCell className="text-center">{getEstadoBadge(usuario.activo)}</TableCell>
                                    <TableCell>
                                        {canManageUser(usuario) && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(usuario)}
                                                title="Editar usuario"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleConfirm(usuario)}
                                                title={usuario.activo ? 'Desactivar' : 'Activar'}
                                                className={usuario.activo ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
                                            >
                                                {usuario.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Cards mobile */}
            <div className="md:hidden space-y-3">
                {usuarios.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No hay usuarios registrados
                        </CardContent>
                    </Card>
                ) : (
                    usuarios.map((usuario) => (
                        <Card key={usuario.id}>
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="font-medium">{usuario.nombre}</div>
                                        <div className="text-sm text-muted-foreground">{usuario.email}</div>
                                        <div className="flex gap-2 pt-1">
                                            {getRolBadge(usuario.rol)}
                                            {getEstadoBadge(usuario.activo)}
                                        </div>
                                    </div>
                                    {canManageUser(usuario) && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(usuario)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleConfirm(usuario)}
                                            className={usuario.activo ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
                                        >
                                            {usuario.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal crear usuario */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Crea una nueva cuenta de usuario para el sistema
                        </DialogDescription>
                    </DialogHeader>

                    {error && showCreateModal && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Form {...createForm}>
                        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                            <FormField
                                control={createForm.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nombre completo" disabled={submitting} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={createForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email *</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="correo@ejemplo.com" disabled={submitting} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={createForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contraseña *</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="Mínimo 6 caracteres" disabled={submitting} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={createForm.control}
                                name="rol"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rol *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={submitting}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar rol" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="usuario">Usuario</SelectItem>
                                                <SelectItem value="co-admin">Co-Admin</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter className="gap-2">
                                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {submitting ? 'Creando...' : 'Crear Usuario'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal editar usuario */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>
                            Modifica los datos del usuario
                        </DialogDescription>
                    </DialogHeader>

                    {error && showEditModal && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                            <FormField
                                control={editForm.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nombre completo" disabled={submitting} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={editForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email *</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="correo@ejemplo.com" disabled={submitting} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={editForm.control}
                                name="rol"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rol *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={submitting}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar rol" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="usuario">Usuario</SelectItem>
                                                <SelectItem value="co-admin">Co-Admin</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter className="gap-2">
                                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={submitting}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal confirmar activar/desactivar */}
            <Dialog open={showToggleConfirm} onOpenChange={setShowToggleConfirm}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>
                            {togglingUsuario?.activo ? 'Desactivar Usuario' : 'Activar Usuario'}
                        </DialogTitle>
                        <DialogDescription>
                            {togglingUsuario?.activo
                                ? 'El usuario no podrá acceder al sistema'
                                : 'El usuario podrá volver a acceder al sistema'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {error && showToggleConfirm && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {togglingUsuario && (
                        <Alert>
                            <AlertDescription>
                                <strong>{togglingUsuario.nombre}</strong> ({togglingUsuario.email})
                            </AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowToggleConfirm(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant={togglingUsuario?.activo ? 'destructive' : 'default'}
                            onClick={handleToggle}
                            disabled={submitting}
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {togglingUsuario?.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UsuariosPage;
