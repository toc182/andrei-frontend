import { useState, useEffect, useRef } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api, { usuariosAPI } from '../services/api';
import { Plus, Pencil, Loader2, Wallet, Upload, AlertCircle, Settings, Minus, Lock, Trash2 } from 'lucide-react';
import type { CajaMenuda, CajaMenudaEliminacion, UsuarioSeleccionable } from '../types/api';
import CajaMenudaDetail from './CajaMenudaDetail';
import { useAuth } from '@/context/AuthContext';

// Shadcn Components
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Shell Components
import { PageHeader } from '@/components/shell/PageHeader';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { EmptyState, TableSkeleton } from '@/components/shell/states';

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

const estadoBadge = (estado: string) => {
  if (estado === 'abierta') {
    return <Badge className="min-w-[4.5rem] justify-center bg-success/10 text-success border-success/30 border">Abierta</Badge>;
  }
  if (estado === 'cancelada') {
    return <Badge className="min-w-[4.5rem] justify-center bg-error/10 text-error border-error/30 border">Cancelada</Badge>;
  }
  return <Badge className="min-w-[4.5rem] justify-center bg-slate-100 text-slate-600 border-slate-200 border">Cerrada</Badge>;
};

const ComprobanteAlertIcon = ({ caja }: { caja: CajaMenuda }) => {
  // Una caja cancelada no espera ningún comprobante: su apertura fue rechazada.
  if (caja.estado === 'cancelada') return null;
  const faltaApertura = caja.solicitud_apertura_id
    ? caja.solicitud_apertura_estado !== 'transferida'
    : caja.tiene_comprobante_apertura === false;
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
          <AlertCircle className="h-4 w-4 text-error" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="top">
        <p className="font-medium text-error mb-1">Comprobantes pendientes</p>
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

// La apertura todavía no se ha transferido: bajar el monto la reemplaza por una
// solicitud nueva por el monto nuevo (Ivan, 2026-11-19).
const aperturaSinTransferir = (caja: CajaMenuda) =>
  caja.solicitud_apertura_estado === 'pendiente' || caja.solicitud_apertura_estado === 'aprobada';

// «a, b y c»
const enumerar = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

// «Se eliminarán la caja, sus 3 gastos y la solicitud de apertura CSIPIN-002A.»
const queSeVa = (e: CajaMenudaEliminacion) => {
  const partes = ['la caja'];
  if (e.gastos === 1) partes.push('su gasto');
  else if (e.gastos > 1) partes.push(`sus ${e.gastos} gastos`);
  const apertura = e.solicitudes.find((s) => s.es_apertura);
  const otras = e.solicitudes.filter((s) => !s.es_apertura).map((s) => s.numero);
  if (apertura) partes.push(`la solicitud de apertura ${apertura.numero}`);
  if (otras.length === 1) partes.push(`la solicitud ${otras[0]}`);
  else if (otras.length > 1) partes.push(`las solicitudes ${enumerar(otras)}`);
  return `Se eliminarán ${enumerar(partes)}. Esta acción no se puede deshacer.`;
};

// --- Component ---

interface CajasMenudasPageProps {
  projectId?: number;
}

const CajasMenudasPage = ({ projectId }: CajasMenudasPageProps = {}) => {
  const [cajas, setCajas] = useState<CajaMenuda[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSeleccionable[]>([]);
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

  // Eliminar una caja abierta por error: solo administración y gerencia
  const { isAdminOrCoAdmin } = useAuth();
  const [eliminarCaja, setEliminarCaja] = useState<CajaMenuda | null>(null);
  const [eliminacion, setEliminacion] = useState<CajaMenudaEliminacion | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // «Activas» son las abiertas; «Inactivas», las cerradas y las canceladas
  const [pestana, setPestana] = useState<'activas' | 'inactivas'>('activas');

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
        const sorted = [...(response.data.data as CajaMenuda[])].sort((a, b) => {
          if (a.estado === 'abierta' && b.estado !== 'abierta') return -1;
          if (a.estado !== 'abierta' && b.estado === 'abierta') return 1;
          return 0;
        });
        setCajas(sorted);
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
      setUsuarios(await usuariosAPI.listSeleccionables());
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
      // Con la apertura sin transferir no se devuelve dinero: no hay comprobante
      if (comprobanteFile && !aperturaSinTransferir(bajarMontoModalCaja)) {
        formData.append('comprobante', comprobanteFile);
      }
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

  // La confirmación pregunta al servidor qué se va con la caja
  const abrirEliminar = async (caja: CajaMenuda) => {
    setError('');
    setEliminacion(null);
    setEliminarCaja(caja);
    try {
      const response = await api.get(`/cajas-menudas/${caja.id}/eliminacion`);
      setEliminacion(response.data.data as CajaMenudaEliminacion);
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setEliminarCaja(null);
      setError(apiErr.response?.data?.error || 'Error al preparar la eliminación');
    }
  };

  const handleEliminar = async () => {
    if (!eliminarCaja) return;
    try {
      setEliminando(true);
      await api.delete(`/cajas-menudas/${eliminarCaja.id}`);
      setEliminarCaja(null);
      loadCajas(false);
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setEliminarCaja(null);
      setError(apiErr.response?.data?.error || 'Error al eliminar la caja');
      loadCajas(false);
    } finally {
      setEliminando(false);
    }
  };

  // Una caja abierta tiene su menú completo; una cancelada, solo «Eliminar
  // caja», y solo para administración y gerencia.
  const tieneMenu = (caja: CajaMenuda) =>
    caja.estado === 'abierta' || (caja.estado === 'cancelada' && isAdminOrCoAdmin);

  const GearDropdown = ({ caja }: { caja: CajaMenuda }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {caja.estado === 'abierta' && (
          <>
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
              className="text-success"
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
              className="text-destructive"
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
            {caja.tiene_reembolso_pendiente ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem
                        disabled
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Cerrar caja
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Tiene solicitud de reembolso pendiente
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setComprobanteFile(null);
                  setError('');
                  setCerrarModalCaja(caja);
                }}
              >
                <Lock className="mr-2 h-4 w-4" />
                Cerrar caja
              </DropdownMenuItem>
            )}
          </>
        )}
        {isAdminOrCoAdmin && (
          <>
            {caja.estado === 'abierta' && <DropdownMenuSeparator />}
            {caja.motivo_no_eliminar ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem
                        disabled
                        className="text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar caja
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {caja.motivo_no_eliminar}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => abrirEliminar(caja)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar caja
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const visibles = cajas.filter((c) => (pestana === 'activas') === (c.estado === 'abierta'));
  const vacio =
    pestana === 'activas'
      ? { title: 'No hay cajas menudas abiertas', description: 'Registra la primera caja menuda de un proyecto' }
      : { title: 'No hay cajas menudas inactivas', description: 'Aquí aparecen las cajas cerradas y las canceladas' };

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cajas Menudas"
        subtitle="Gestión de fondos de caja menuda por proyecto"
      >
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Caja Menuda
        </Button>
      </PageHeader>

      {error && !showFormModal && !editModalCaja && !subirMontoModalCaja && !bajarMontoModalCaja && !cerrarModalCaja && (
        <Alert variant="error" title={error} />
      )}

      <Tabs value={pestana} onValueChange={(v) => setPestana(v as 'activas' | 'inactivas')}>
        <TabsList className="mb-6 w-full justify-center">
          <TabsTrigger value="activas">Activas</TabsTrigger>
          <TabsTrigger value="inactivas">Inactivas</TabsTrigger>
        </TabsList>
        <TabsContent value={pestana}>
          {/* Desktop: Table */}
          <div className="hidden md:block">
            <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                      <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</TableHead>
                      {!projectId && <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyecto</TableHead>}
                      <TableHead className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asignado / Saldo</TableHead>
                      <TableHead className="w-[100px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</TableHead>
                      <TableHead className="w-10 px-2 py-2.5"></TableHead>
                    </TableRow>
                  </TableHeader>
                  {loading ? (
                    <TableSkeleton columns={projectId ? 4 : 5} rows={4} />
                  ) : visibles.length === 0 ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={projectId ? 4 : 5} className="p-0">
                          <EmptyState
                            icon={Wallet}
                            title={vacio.title}
                            description={vacio.description}
                            action={
                              pestana === 'activas' ? (
                                <Button size="sm" onClick={handleNew}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Nueva Caja Menuda
                                </Button>
                              ) : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <TableBody>
                      {visibles.map((caja) => (
                        <TableRow key={caja.id} className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60" onClick={() => setSelectedCajaId(caja.id)}>
                          <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {caja.nombre}
                              <ComprobanteAlertIcon caja={caja} />
                            </div>
                          </TableCell>
                          {!projectId && <TableCell className="px-4 py-3 text-sm text-slate-700">{caja.proyecto_nombre}</TableCell>}
                          <TableCell className="px-4 py-3 text-right text-sm tabular-nums">
                            <div className="text-slate-700">{formatMonto(caja.monto_asignado)}</div>
                            <div className={`text-xs font-medium ${caja.estado !== 'abierta' ? 'text-slate-400' : Number(caja.saldo) < 0 ? 'text-error' : 'text-success'}`}>
                              {caja.estado !== 'abierta' ? '-' : formatMonto(caja.saldo)}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">{estadoBadge(caja.estado)}</TableCell>
                          <TableCell className="px-2 py-3">
                            {tieneMenu(caja) && <GearDropdown caja={caja} />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>
            </Card>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : visibles.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={vacio.title}
                description={vacio.description}
                action={
                  pestana === 'activas' ? (
                    <Button onClick={handleNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva Caja Menuda
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              visibles.map((caja) => (
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
                        {tieneMenu(caja) && <GearDropdown caja={caja} />}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Asignado</span>
                      <span className="font-medium tabular-nums">{formatMonto(caja.monto_asignado)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo</span>
                      <span className={`font-medium tabular-nums ${caja.estado !== 'abierta' ? '' : Number(caja.saldo) < 0 ? 'text-error' : 'text-success'}`}>
                        {caja.estado !== 'abierta' ? '-' : formatMonto(caja.saldo)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Responsable: {caja.responsable_nombre}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <AppDialog
        open={showFormModal}
        onOpenChange={setShowFormModal}
        size="standard"
        title="Nueva Caja Menuda"
        description="Registra una nueva caja menuda para un proyecto"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowFormModal(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" form="create-caja-form" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </>
        }
      >
        {error && showFormModal && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <Form {...form}>
          <form id="create-caja-form" onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
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
          </form>
        </Form>
      </AppDialog>

      {/* Edit Dialog */}
      <AppDialog
        open={!!editModalCaja}
        onOpenChange={(open) => { if (!open) setEditModalCaja(null); }}
        size="simple"
        title="Editar Caja Menuda"
        description="Modifica los datos de la caja menuda"
        footer={
          <>
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
          </>
        }
      >
        {error && !!editModalCaja && (
          <Alert variant="error" title={error} className="mb-4" />
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
      </AppDialog>

      {/* Subir Monto Dialog */}
      <AppDialog
        open={!!subirMontoModalCaja}
        onOpenChange={(open) => { if (!open) setSubirMontoModalCaja(null); }}
        size="simple"
        title="Subir Monto Asignado"
        footer={
          <>
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
          </>
        }
      >
        {error && !!subirMontoModalCaja && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Monto actual: <span className="font-medium text-foreground tabular-nums">{formatMonto(subirMontoModalCaja?.monto_asignado)}</span>
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
      </AppDialog>

      {/* Bajar Monto Dialog */}
      <AppDialog
        open={!!bajarMontoModalCaja}
        onOpenChange={(open) => { if (!open) { setBajarMontoModalCaja(null); setComprobanteFile(null); } }}
        size="simple"
        title="Bajar Monto Asignado"
        footer={
          <>
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
          </>
        }
      >
        {error && !!bajarMontoModalCaja && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Monto actual: <span className="font-medium text-foreground tabular-nums">{formatMonto(bajarMontoModalCaja?.monto_asignado)}</span>
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
          {bajarMontoModalCaja && aperturaSinTransferir(bajarMontoModalCaja) ? (
            <Alert
              variant="info"
              title={`La apertura ${bajarMontoModalCaja.solicitud_apertura_numero} aún no se ha transferido.`}
              description={`Al confirmar, la solicitud ${bajarMontoModalCaja.solicitud_apertura_numero} por ${formatMonto(bajarMontoModalCaja.monto_asignado)} se eliminará y se creará una nueva solicitud de apertura por el nuevo monto, que pasará por aprobación.`}
            />
          ) : (
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
          )}
        </div>
      </AppDialog>

      {/* Cerrar Caja Dialog */}
      <AppDialog
        open={!!cerrarModalCaja}
        onOpenChange={(open) => { if (!open) { setCerrarModalCaja(null); setComprobanteFile(null); } }}
        size="simple"
        title="Cerrar Caja"
        description="Esta acción no se puede deshacer"
        footer={
          <>
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
          </>
        }
      >
        {error && !!cerrarModalCaja && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Caja: <span className="font-medium text-foreground">{cerrarModalCaja?.nombre}</span>
          </p>

          {Number(cerrarModalCaja?.saldo) === 0 ? (
            <Alert
              variant="info"
              title="El saldo es cero"
              description="Se generará automáticamente una constancia de cierre."
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Saldo pendiente: <span className="font-medium text-foreground tabular-nums">{formatMonto(cerrarModalCaja?.saldo)}</span>
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
      </AppDialog>

      {/* Eliminar Caja Confirmation */}
      <AlertDialog
        open={!!eliminarCaja}
        onOpenChange={(open) => { if (!open && !eliminando) setEliminarCaja(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {eliminarCaja?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              {!eliminacion ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Revisando lo que se elimina con ella…
                </span>
              ) : eliminacion.motivo ? (
                `No se puede eliminar: ${eliminacion.motivo.toLowerCase()}. Ciérrela de la forma normal.`
              ) : (
                queSeVa(eliminacion)
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleEliminar(); }}
              disabled={!eliminacion || !!eliminacion.motivo || eliminando}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {eliminando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar caja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CajasMenudasPage;
