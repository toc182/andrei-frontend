/**
 * ProjectSolicitudesPago Component
 * Solicitudes de pago within a project context
 * Features: Prefix config, list with filters, create/edit/detail modals, state changes
 */

import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Check,
  X,
  Clock,
  Pencil,
  Settings,
  Banknote,
  Send,
  CreditCard,
  AlertCircle,
  Download,
  Eye,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  Upload,
  ChevronsUpDown,
  Undo2,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import api from '../../services/api';
import { formatMoney } from '../../utils/formatters';
import type { SolicitudPagoAdjunto } from '../../types/api';
import SolicitudPagoForm from '../../components/forms/SolicitudPagoForm';
import AdjuntosPreview from '../../components/AdjuntosPreview';
import CorreccionSolicitudModal from '@/components/CorreccionSolicitudModal';
import { SortableHeader } from '@/components/SortableHeader';
import { getSortComparator, applyColumnFilters } from '@/components/sortableHeaderUtils';
import type { SortState, SortDirection, ColumnFilters } from '@/components/sortableHeaderUtils';

// --- Types ---

type EstadoSP =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada'
  | 'pagada'
  | 'facturada';

interface SolicitudPago {
  id: number;
  proyecto_id: number | null;
  numero: string;
  fecha: string;
  proveedor: string;
  preparado_por: number;
  solicitado_por: number | null;
  requisicion_id: number | null;
  subtotal: number;
  descuentos: number;
  impuestos: number;
  monto_total: number;
  estado: EstadoSP;
  observaciones: string | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  urgente: boolean;
  pinellas_paga: boolean;
  updated_at?: string;
  revisada?: boolean;
  es_mi_turno?: boolean;
  aprobadores_estado?: { nombre: string; estado: string }[];
  reembolso_registrado?: boolean;
  preparado_nombre?: string;
  solicitado_nombre?: string;
  requisicion_numero?: string;
}

interface SolicitudItem {
  id: number;
  solicitud_pago_id: number;
  cantidad: number;
  unidad: string;
  descripcion: string;
  descripcion_detallada: string | null;
  precio_unitario: number;
  precio_total: number;
}

interface SolicitudAjuste {
  id: number;
  solicitud_pago_id: number;
  tipo: string;
  descripcion: string;
  porcentaje: number | null;
  monto: number;
}

interface Aprobacion {
  id: number;
  solicitud_pago_id: number;
  user_id: number;
  orden: number;
  accion: 'aprobado' | 'rechazado';
  comentario: string | null;
  fecha: string;
  usuario_nombre: string;
}

interface AprobadorProyecto {
  user_id: number;
  orden: number;
  nombre: string;
  email: string;
}

interface BadgeConfig {
  variant: 'secondary' | 'outline' | 'default' | 'destructive';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ProjectSolicitudesPagoProps {
  projectId: number;
  onNavigate?: (view: string) => void;
}

// --- Helpers ---

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getEstadoBadge = (estado: string, esMiTurno?: boolean): ReactNode => {
  const variants: Record<string, BadgeConfig> = {
    borrador: { variant: 'secondary', label: 'Borrador', icon: Clock },
    pendiente: { variant: 'outline', label: 'Pendiente', icon: Send },
    aprobada: { variant: 'default', label: 'Aprobada', icon: Check },
    rechazada: { variant: 'destructive', label: 'Rechazada', icon: X },
    pagada: { variant: 'default', label: 'Pagada', icon: CreditCard },
    facturada: { variant: 'default', label: 'Facturada', icon: FileCheck },
    devolucion: { variant: 'outline', label: 'Devolución', icon: Ban },
  };

  const config = variants[estado] || {
    variant: 'secondary' as const,
    label: estado,
    icon: Clock,
  };
  const Icon = config.icon;

  const colorOverrides: Record<string, string> = {
    pendiente: ' bg-yellow-100 text-yellow-800 border border-yellow-300',
    pagada: ' bg-green-600 text-white',
    facturada: ' bg-blue-600 text-white',
    devolucion: ' bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
  };

  let extraClass = colorOverrides[estado] || '';
  if (estado === 'pendiente' && esMiTurno)
    extraClass = ' bg-white text-yellow-800 border border-yellow-300';

  return (
    <Badge
      variant={config.variant}
      className={`flex items-center gap-1 w-fit${extraClass}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const getInitials = (nombre: string): string => {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
};

const AprobadoresAvatars = ({
  aprobadores,
}: {
  aprobadores: { nombre: string; estado: string }[];
}) => {
  const colorMap: Record<string, string> = {
    aprobado: 'bg-green-500 text-white',
    pendiente: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    rechazado: 'bg-red-500 text-white',
  };
  return (
    <div className="flex items-center -space-x-1">
      {aprobadores.map((a, i) => (
        <div
          key={i}
          title={`${a.nombre}: ${a.estado}`}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${colorMap[a.estado] || colorMap['pendiente']}`}
        >
          {getInitials(a.nombre)}
        </div>
      ))}
    </div>
  );
};

const ESTADO_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pagada', label: 'Pagada' },
  { value: 'facturada', label: 'Facturada' },
  { value: 'devolucion', label: 'Devolución' },
];

const ALL_ESTADOS = ESTADO_OPTIONS.map((e) => e.value);

export default function ProjectSolicitudesPago({
  projectId,
  onNavigate,
}: ProjectSolicitudesPagoProps) {
  const { user, hasPermission, isAdminOrCoAdmin } = useAuth();
  const canManage = !!user;
  const canManageSolicitud = (sol: SolicitudPago) =>
    isAdminOrCoAdmin ||
    hasPermission('solicitudes_editar_todas') ||
    sol.preparado_por === user?.id;

  // Data
  const [solicitudes, setSolicitudes] = useState<SolicitudPago[]>([]);
  const [spPrefijo, setSpPrefijo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prefix config
  const [prefijoInput, setPrefijoInput] = useState('');
  const [savingPrefijo, setSavingPrefijo] = useState(false);

  // Filters
  const [filterEstados, setFilterEstados] = useState<string[]>(ALL_ESTADOS);
  const [filterMyApproval, setFilterMyApproval] = useState(false);
  const [filterPinellasPaga, setFilterPinellasPaga] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoPopoverOpen, setEstadoPopoverOpen] = useState(false);

  // Column sort & filter state
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingSolicitud, setEditingSolicitud] =
    useState<SolicitudPago | null>(null);
  const [editingItems, setEditingItems] = useState<SolicitudItem[]>([]);
  const [editingAjustes, setEditingAjustes] = useState<SolicitudAjuste[]>([]);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailSolicitud, setDetailSolicitud] = useState<SolicitudPago | null>(
    null,
  );
  const [detailItems, setDetailItems] = useState<SolicitudItem[]>([]);
  const [detailAjustes, setDetailAjustes] = useState<SolicitudAjuste[]>([]);

  // Approval data
  const [detailAprobaciones, setDetailAprobaciones] = useState<Aprobacion[]>(
    [],
  );
  const [detailAprobadores, setDetailAprobadores] = useState<
    AprobadorProyecto[]
  >([]);
  const [hasApprovers, setHasApprovers] = useState<boolean | null>(null);

  // Adjuntos
  const [detailAdjuntos, setDetailAdjuntos] = useState<SolicitudPagoAdjunto[]>(
    [],
  );
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [detailRevisada, setDetailRevisada] = useState(false);
  const [togglingRevisada, setTogglingRevisada] = useState(false);

  // Bulk approval success banner
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);

  // Bulk approval
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(
    null,
  );

  // Approve/Reject

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Marking as paid
  const [showRegistrarPagoModal, setShowRegistrarPagoModal] = useState(false);
  const [registroPagoFecha, setRegistroPagoFecha] = useState('');
  const [registroPagoFiles, setRegistroPagoFiles] = useState<FileList | null>(
    null,
  );
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [detailComprobante, setDetailComprobante] = useState<{
    fecha_pago: string;
    registrado_por_nombre: string;
    adjuntos: SolicitudPagoAdjunto[];
  } | null>(null);

  // Registrar factura/recibo
  const [showRegistrarFacturaModal, setShowRegistrarFacturaModal] =
    useState(false);
  const [registroFacturaFecha, setRegistroFacturaFecha] = useState('');
  const [registroFacturaNumero, setRegistroFacturaNumero] = useState('');
  const [registroFacturaTipo, setRegistroFacturaTipo] = useState<'factura' | 'recibo'>('factura');
  const [registroFacturaFiles, setRegistroFacturaFiles] =
    useState<FileList | null>(null);
  const [registrandoFactura, setRegistrandoFactura] = useState(false);
  const [detailFactura, setDetailFactura] = useState<{
    fecha_factura: string;
    numero_factura?: string;
    tipo?: string;
    registrado_por_nombre: string;
    adjuntos: SolicitudPagoAdjunto[];
  } | null>(null);

  // Reembolso Pinellas
  const [detailReembolso, setDetailReembolso] = useState<{
    id: number;
    comprobante_url: string | null;
    comprobante_nombre: string | null;
    fecha_reembolso: string;
    registrado_por_nombre: string;
  } | null>(null);
  const [showReembolsoModal, setShowReembolsoModal] = useState(false);
  const [reembolsoFecha, setReembolsoFecha] = useState('');
  const [reembolsoFile, setReembolsoFile] = useState<File | null>(null);
  const [registrandoReembolso, setRegistrandoReembolso] = useState(false);

  // Devolución
  const [detailDevolucion, setDetailDevolucion] = useState<{
    id: number;
    fecha_devolucion: string;
    motivo: string;
    comprobante_url: string;
    comprobante_nombre: string;
    registrado_por_nombre: string;
  } | null>(null);
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);
  const [devolucionFecha, setDevolucionFecha] = useState('');
  const [devolucionMotivo, setDevolucionMotivo] = useState('');
  const [devolucionFile, setDevolucionFile] = useState<File | null>(null);
  const [registrandoDevolucion, setRegistrandoDevolucion] = useState(false);

  const [detailPuedeEliminar, setDetailPuedeEliminar] = useState(false);

  // Corrección (admin)
  const [showCorreccionModal, setShowCorreccionModal] = useState(false);
  const [detailCorrecciones, setDetailCorrecciones] = useState<{
    id: number;
    motivo: string;
    cambios: unknown[];
    version_pdf: string | null;
    created_at: string;
    usuario_nombre: string;
  }[]>([]);

  // Edit confirmation (AlertDialog)
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [pendingEditSolicitud, setPendingEditSolicitud] =
    useState<SolicitudPago | null>(null);

  // Pinellas paga confirmation (AlertDialog)
  const [showPinellasPagaConfirm, setShowPinellasPagaConfirm] = useState(false);
  const [pendingPinellasPaga, setPendingPinellasPaga] =
    useState<boolean>(false);

  // Resubmit (rechazada -> pendiente)
  const [resubmitting, setResubmitting] = useState(false);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadSolicitudes();
    checkApprovers();
  }, [projectId, filterEstados, filterMyApproval]);

  const checkApprovers = async () => {
    try {
      const response = await api.get(`/approval-settings/project/${projectId}`);
      if (response.data.success) {
        setHasApprovers(response.data.approvers.length > 0);
      }
    } catch {
      setHasApprovers(false);
    }
  };

  const loadSolicitudes = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams: string[] = [];
      if (
        filterEstados.length > 0 &&
        filterEstados.length < ALL_ESTADOS.length
      ) {
        queryParams.push(`estado=${filterEstados.join(',')}`);
      }
      if (filterMyApproval) {
        queryParams.push('pending_my_approval=true');
      }
      const params = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const response = await api.get(
        `/solicitudes-pago/project/${projectId}${params}`,
      );
      if (response.data.success) {
        setSolicitudes(response.data.solicitudes || []);
        setSpPrefijo(response.data.sp_prefijo);
      }
    } catch (err) {
      console.error('Error loading solicitudes:', err);
      setError('Error al cargar las solicitudes de pago');
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (column: string, direction: SortDirection | null) => {
    setSortState(direction ? { column, direction } : { column: null, direction: null });
  };

  const handleFilterChange = (column: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [column]: values }));
  };

  // Client-side search filter
  const afterColumnFilters = applyColumnFilters(
    solicitudes
      .filter((sol) => {
        if (filterPinellasPaga && !sol.pinellas_paga) return false;
        if (!filterEstados.includes(sol.estado)) return false;
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            sol.numero?.toLowerCase().includes(search) ||
            sol.proveedor?.toLowerCase().includes(search)
          );
        }
        return true;
      }),
    columnFilters,
  );

  const sortComparator = getSortComparator(sortState);
  const filteredSolicitudes = afterColumnFilters.sort((a, b) => {
    if (sortComparator) return sortComparator(a as unknown as Record<string, any>, b as unknown as Record<string, any>);
    if (a.es_mi_turno && !b.es_mi_turno) return -1;
    if (!a.es_mi_turno && b.es_mi_turno) return 1;
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  });

  // Unique values for column filters
  const uniqueNumeros = [...new Set(solicitudes.map((s) => s.numero).filter(Boolean))].sort();
  const uniqueProveedores = [...new Set(solicitudes.map((s) => s.proveedor).filter(Boolean))].sort();
  const uniqueEstados = ['pendiente', 'aprobada', 'pagada', 'facturada', 'devolucion'];

  const handleSavePrefijo = async () => {
    if (!prefijoInput.trim()) return;
    try {
      setSavingPrefijo(true);
      await api.put(`/solicitudes-pago/project/${projectId}/prefijo`, {
        prefijo: prefijoInput.trim().toUpperCase(),
      });
      setSpPrefijo(prefijoInput.trim().toUpperCase());
      setPrefijoInput('');
    } catch (err) {
      console.error('Error saving prefijo:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al guardar el prefijo');
    } finally {
      setSavingPrefijo(false);
    }
  };

  const openDetail = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`);
      if (response.data.success) {
        setDetailSolicitud(response.data.solicitud);
        setDetailItems(response.data.items || []);
        setDetailAjustes(response.data.ajustes || []);
        setDetailAdjuntos(response.data.adjuntos || []);
        setDetailAprobaciones(response.data.aprobaciones || []);
        setDetailAprobadores(response.data.aprobadores_proyecto || []);
        setDetailComprobante(response.data.comprobante || null);
        setDetailFactura(response.data.factura || null);
        setDetailReembolso(response.data.reembolso || null);
        setDetailDevolucion(response.data.devolucion || null);
        setDetailPuedeEliminar(!!response.data.puede_eliminar);
        setDetailRevisada(!!solicitud.revisada);

        // Load corrections if any exist
        const corrCount = response.data.solicitud?.correcciones_count || 0;
        if (corrCount > 0) {
          try {
            const corrResp = await api.get(`/solicitudes-pago/${solicitud.id}/correcciones`);
            if (corrResp.data.success) {
              setDetailCorrecciones(corrResp.data.data);
            }
          } catch {
            // Non-critical
          }
        } else {
          setDetailCorrecciones([]);
        }

        setShowDetail(true);
      }
    } catch (err) {
      console.error('Error loading detail:', err);
      alert('Error al cargar el detalle');
    }
  };

  const openEditForm = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`);
      if (response.data.success) {
        setEditingSolicitud(response.data.solicitud);
        setEditingItems(response.data.items || []);
        setEditingAjustes(response.data.ajustes || []);
        setShowDetail(false);
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error loading for edit:', err);
    }
  };

  const handleAprobar = (solicitudId: number) => {
    setPendingApprovalId(solicitudId);
    setBulkError(null);
    setBulkPassword('');
    setShowPasswordModal(true);
  };

  const handleRechazar = async () => {
    if (!rejectingId || !rejectComment.trim()) return;
    try {
      await api.post(`/solicitudes-pago/${rejectingId}/rechazar`, {
        comentario: rejectComment,
      });
      setShowRejectModal(false);
      setRejectComment('');
      setRejectingId(null);
      setShowDetail(false);
      await loadSolicitudes();
      window.dispatchEvent(new Event('solicitud-status-changed'));
    } catch (err) {
      console.error('Error rejecting:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al rechazar');
    }
  };

  const handleRegistrarPago = async (solicitudId: number) => {
    if (
      !registroPagoFecha ||
      !registroPagoFiles ||
      registroPagoFiles.length === 0
    )
      return;
    try {
      setRegistrandoPago(true);
      const formData = new FormData();
      formData.append('fecha_pago', registroPagoFecha);
      for (let i = 0; i < registroPagoFiles.length; i++) {
        formData.append('archivos', registroPagoFiles[i]);
      }
      await api.post(
        `/solicitudes-pago/${solicitudId}/registrar-pago`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      setShowRegistrarPagoModal(false);
      setShowDetail(false);
      await loadSolicitudes();
      window.dispatchEvent(new Event('solicitud-status-changed'));
    } catch (err) {
      console.error('Error registering payment:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al registrar pago');
    } finally {
      setRegistrandoPago(false);
    }
  };

  const handleRegistrarFactura = async (solicitudId: number) => {
    if (
      !registroFacturaFecha ||
      !registroFacturaFiles ||
      registroFacturaFiles.length === 0
    )
      return;
    try {
      setRegistrandoFactura(true);
      const formData = new FormData();
      formData.append('fecha_factura', registroFacturaFecha);
      formData.append('tipo', registroFacturaTipo);
      if (registroFacturaNumero.trim()) {
        formData.append('numero_factura', registroFacturaNumero.trim());
      }
      for (let i = 0; i < registroFacturaFiles.length; i++) {
        formData.append('archivos', registroFacturaFiles[i]);
      }
      await api.post(
        `/solicitudes-pago/${solicitudId}/registrar-factura`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      setShowRegistrarFacturaModal(false);
      setShowDetail(false);
      await loadSolicitudes();
      window.dispatchEvent(new Event('solicitud-status-changed'));
    } catch (err) {
      console.error('Error registering invoice:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al registrar factura');
    } finally {
      setRegistrandoFactura(false);
    }
  };

  const handleRegistrarReembolso = async (solicitudId: number) => {
    if (!reembolsoFecha || !reembolsoFile) return;
    try {
      setRegistrandoReembolso(true);
      const formData = new FormData();
      formData.append('fecha_reembolso', reembolsoFecha);
      formData.append('comprobante', reembolsoFile);
      await api.post(`/solicitudes-pago/${solicitudId}/reembolso`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowReembolsoModal(false);
      // Reload list and detail to show reembolso data
      await loadSolicitudes();
      if (detailSolicitud) await openDetail(detailSolicitud);
    } catch (err) {
      console.error('Error registering reembolso:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al registrar reembolso');
    } finally {
      setRegistrandoReembolso(false);
    }
  };

  const handleRegistrarDevolucion = async (solicitudId: number) => {
    if (!devolucionFecha || !devolucionMotivo.trim() || !devolucionFile) return;
    try {
      setRegistrandoDevolucion(true);
      const formData = new FormData();
      formData.append('fecha_devolucion', devolucionFecha);
      formData.append('motivo', devolucionMotivo.trim());
      formData.append('comprobante', devolucionFile);
      await api.post(`/solicitudes-pago/${solicitudId}/devolucion`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowDevolucionModal(false);
      setShowDetail(false);
      await loadSolicitudes();
      window.dispatchEvent(new Event('solicitud-status-changed'));
    } catch (err) {
      console.error('Error registering devolucion:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al registrar devolución');
    } finally {
      setRegistrandoDevolucion(false);
    }
  };

  const handleReenviar = async (solicitudId: number) => {
    try {
      setResubmitting(true);
      await api.patch(`/solicitudes-pago/${solicitudId}/estado`, {
        estado: 'pendiente',
      });
      setShowDetail(false);
      await loadSolicitudes();
      window.dispatchEvent(new Event('solicitud-status-changed'));
    } catch (err) {
      console.error('Error resubmitting:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al reenviar');
    } finally {
      setResubmitting(false);
    }
  };

  const handleUploadAdjuntos = async (files: FileList) => {
    if (!detailSolicitud || files.length === 0) return;
    try {
      setUploadingFiles(true);
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('archivos', files[i]);
      }
      const response = await api.post(
        `/solicitudes-pago/${detailSolicitud.id}/adjuntos`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      if (response.data.success) {
        setDetailAdjuntos((prev) => [...response.data.adjuntos, ...prev]);
      }
    } catch (err) {
      console.error('Error uploading:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al subir archivos');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteAdjunto = async (adjuntoId: number) => {
    try {
      await api.delete(`/solicitudes-pago/adjuntos/${adjuntoId}`);
      setDetailAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId));
    } catch (err) {
      console.error('Error deleting adjunto:', err);
      alert('Error al eliminar el adjunto');
    }
  };

  const handleToggleRevisada = async (solicitudId: number) => {
    try {
      setTogglingRevisada(true);
      if (detailRevisada) {
        await api.delete(`/solicitudes-pago/${solicitudId}/revisar`);
        setDetailRevisada(false);
      } else {
        await api.post(`/solicitudes-pago/${solicitudId}/revisar`);
        setDetailRevisada(true);
      }
      setSolicitudes((prev) =>
        prev.map((s) =>
          s.id === solicitudId ? { ...s, revisada: !detailRevisada } : s,
        ),
      );
    } catch (err) {
      console.error('Error toggling review:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(
        apiError.response?.data?.message ||
          'Error al cambiar estado de revisión',
      );
    } finally {
      setTogglingRevisada(false);
    }
  };

  // Get IDs of reviewed solicitudes that are my turn to approve
  const reviewedIds = solicitudes
    .filter((s) => s.revisada && s.es_mi_turno)
    .map((s) => s.id);

  const handleConfirmApproval = async () => {
    if (!bulkPassword.trim()) return;
    try {
      setBulkApproving(true);
      setBulkError(null);
      if (pendingApprovalId) {
        // Individual approval
        await api.post(`/solicitudes-pago/${pendingApprovalId}/aprobar`, {
          password: bulkPassword,
        });
        setShowPasswordModal(false);
        setBulkPassword('');
        setPendingApprovalId(null);
        setShowDetail(false);
        setSearchTerm('');
        await loadSolicitudes();
        window.dispatchEvent(new Event('solicitud-status-changed'));
      } else if (reviewedIds.length > 0) {
        // Bulk approval of reviewed solicitudes
        const response = await api.post('/solicitudes-pago/aprobar-masivo', {
          ids: reviewedIds,
          password: bulkPassword,
        });
        if (response.data.success) {
          setShowPasswordModal(false);
          setBulkPassword('');
          setBulkSuccessMessage(
            `${response.data.aprobadas} de ${response.data.total} solicitudes aprobadas`,
          );
          setTimeout(() => setBulkSuccessMessage(null), 5000);
          loadSolicitudes();
          window.dispatchEvent(new Event('solicitud-status-changed'));
        }
      }
    } catch (err) {
      console.error('Error approving:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setBulkError(apiError.response?.data?.message || 'Error al aprobar');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleDownloadPDF = (solicitudId: number) => {
    const token = localStorage.getItem('token');
    window.open(
      `${api.defaults.baseURL}/solicitudes-pago/${solicitudId}/pdf?token=${token}`,
      '_blank',
    );
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/solicitudes-pago/${deletingId}`);
      setShowDeleteModal(false);
      setShowDetail(false);
      await loadSolicitudes();
    } catch (err) {
      console.error('Error deleting:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Stats
  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter((s) => s.estado === 'pendiente').length,
    aprobadas: solicitudes.filter((s) => s.estado === 'aprobada').length,
    montoTotal: solicitudes.reduce(
      (sum, s) => sum + (parseFloat(String(s.monto_total)) || 0),
      0,
    ),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-semibold">Cargando solicitudes...</div>
          <div className="text-sm text-muted-foreground mt-2">
            Por favor espere
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // If no prefix configured, show setup prompt
  if (!spPrefijo) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center">
              <Settings className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-lg font-semibold">Configurar Prefijo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Antes de crear solicitudes de pago, configure la abreviatura del
                proyecto para la numeracion automatica.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ejemplo: COCP, MOP, ALM (se generara COCP-001, COCP-002, etc.)
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: COCP"
                value={prefijoInput}
                onChange={(e) => setPrefijoInput(e.target.value.toUpperCase())}
                maxLength={20}
                className="uppercase"
              />
              <Button
                onClick={handleSavePrefijo}
                disabled={!prefijoInput.trim() || savingPrefijo}
              >
                {savingPrefijo ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">
              Total Solicitudes
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-yellow-600">
              {stats.pendientes}
            </div>
            <div className="text-sm text-muted-foreground">Pendientes</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-green-600">
              {stats.aprobadas}
            </div>
            <div className="text-sm text-muted-foreground">Aprobadas</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold whitespace-nowrap">
              {formatMoney(stats.montoTotal)}
            </div>
            <div className="text-sm text-muted-foreground">Monto Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <Popover open={estadoPopoverOpen} onOpenChange={setEstadoPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[220px] justify-between">
                {filterEstados.length === ALL_ESTADOS.length
                  ? 'Todos los estados'
                  : filterEstados.length === 0
                    ? 'Ningún estado'
                    : `${filterEstados.length} estado${filterEstados.length > 1 ? 's' : ''}`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-2">
              <div className="space-y-1">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={filterEstados.length === ALL_ESTADOS.length}
                    onCheckedChange={(checked) =>
                      setFilterEstados(checked ? [...ALL_ESTADOS] : [])
                    }
                  />
                  <span className="text-sm font-medium">Todos</span>
                </label>
                <div className="border-t my-1" />
                {ESTADO_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={filterEstados.includes(opt.value)}
                      onCheckedChange={(checked) => {
                        setFilterEstados((prev) =>
                          checked
                            ? [...prev, opt.value]
                            : prev.filter((e) => e !== opt.value),
                        );
                      }}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Buscar por numero, proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-[220px]"
          />
          <span className="text-xs text-muted-foreground">
            Prefijo: {spPrefijo}
          </span>
        </div>

        {canManage && hasApprovers === false && (
          <Alert className="flex-1 sm:flex-none">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs flex items-center gap-2">
              Para crear solicitudes de pago, primero configure los aprobadores
              del proyecto.
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => onNavigate?.(`project-${projectId}-miembros`)}
              >
                Ir a Miembros
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {canManage && hasApprovers && (
          <Button
            onClick={() => {
              setEditingSolicitud(null);
              setEditingItems([]);
              setEditingAjustes([]);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        )}
      </div>

      {/* Filter toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filterMyApproval}
            onCheckedChange={(checked) => setFilterMyApproval(!!checked)}
          />
          <span className="text-sm">
            Mostrar solo las que requieren mi aprobación
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filterPinellasPaga}
            onCheckedChange={(checked) => setFilterPinellasPaga(!!checked)}
          />
          <span className="text-sm">Mostrar solo Reembolso Pinellas</span>
        </label>
      </div>

      {/* Bulk approve reviewed button */}
      {reviewedIds.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setPendingApprovalId(null);
              setBulkError(null);
              setBulkPassword('');
              setShowPasswordModal(true);
            }}
            size="sm"
          >
            <Check className="h-4 w-4 mr-1" />
            Aprobar solicitudes revisadas ({reviewedIds.length})
          </Button>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredSolicitudes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay solicitudes de pago
            </CardContent>
          </Card>
        ) : (
          filteredSolicitudes.map((sol) => (
            <Card
              key={sol.id}
              className={`hover:bg-muted/50 ${sol.es_mi_turno ? 'bg-yellow-50/50' : ''}`}
            >
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => openDetail(sol)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold flex items-center gap-1">
                          {sol.numero}
                          {sol.revisada && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          )}
                          {sol.urgente && (
                            <span className="text-red-600 font-bold ml-1">
                              !
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {sol.proveedor}
                        </div>
                      </div>
                      <div className="space-y-1 flex flex-col items-end">
                        {sol.estado === 'pendiente' &&
                        sol.aprobadores_estado?.length ? (
                          <AprobadoresAvatars
                            aprobadores={sol.aprobadores_estado}
                          />
                        ) : (
                          getEstadoBadge(sol.estado)
                        )}
                        {sol.pinellas_paga && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 w-fit ${sol.reembolso_registrado ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-200 text-amber-900 border-amber-400'}`}
                          >
                            Reembolso
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-lg font-bold mb-1">
                      {formatMoney(sol.monto_total)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(sol.fecha)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    columnKey="numero"
                    label="Numero"
                    type="discrete"
                    sortState={sortState}
                    onSortChange={handleSortChange}
                    uniqueValues={uniqueNumeros}
                    activeFilters={columnFilters.numero ?? uniqueNumeros}
                    onFilterChange={handleFilterChange}
                  />
                  <TableHead className="w-6 px-0"></TableHead>
                  <SortableHeader
                    columnKey="fecha"
                    label="Fecha"
                    type="numeric"
                    sortState={sortState}
                    onSortChange={handleSortChange}
                  />
                  <SortableHeader
                    columnKey="proveedor"
                    label="Proveedor"
                    type="discrete"
                    sortState={sortState}
                    onSortChange={handleSortChange}
                    uniqueValues={uniqueProveedores}
                    activeFilters={columnFilters.proveedor ?? uniqueProveedores}
                    onFilterChange={handleFilterChange}
                  />
                  <SortableHeader
                    columnKey="monto_total"
                    label="Monto Total"
                    type="numeric"
                    sortState={sortState}
                    onSortChange={handleSortChange}
                    align="right"
                  />
                  <SortableHeader
                    columnKey="estado"
                    label="Estado"
                    type="discrete"
                    sortState={sortState}
                    onSortChange={handleSortChange}
                    uniqueValues={uniqueEstados}
                    activeFilters={columnFilters.estado ?? uniqueEstados}
                    onFilterChange={handleFilterChange}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSolicitudes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay solicitudes de pago
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSolicitudes.map((sol) => (
                    <TableRow
                      key={sol.id}
                      className={`cursor-pointer hover:bg-muted/50 ${sol.es_mi_turno ? 'bg-yellow-50/50' : ''}`}
                      onClick={() => openDetail(sol)}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1">
                          {sol.numero}
                          {sol.revisada && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-0 text-center">
                        {sol.urgente && (
                          <span className="text-red-600 font-bold">!</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(sol.fecha)}</TableCell>
                      <TableCell>{sol.proveedor}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(sol.monto_total)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {sol.estado === 'pendiente' &&
                          sol.aprobadores_estado?.length ? (
                            <AprobadoresAvatars
                              aprobadores={sol.aprobadores_estado}
                            />
                          ) : (
                            getEstadoBadge(sol.estado)
                          )}
                          {sol.pinellas_paga && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 w-fit ${sol.reembolso_registrado ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-200 text-amber-900 border-amber-400'}`}
                            >
                              Reembolso
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Approval Success Banner */}
      {bulkSuccessMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">{bulkSuccessMessage}</span>
          <button
            onClick={() => setBulkSuccessMessage(null)}
            className="ml-2 hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Form Modal */}
      <SolicitudPagoForm
        projectId={projectId}
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingSolicitud(null);
          setEditingItems([]);
          setEditingAjustes([]);
        }}
        onSave={() => loadSolicitudes()}
        editingSolicitud={editingSolicitud}
        existingItems={editingItems}
        existingAjustes={editingAjustes}
      />

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de Solicitud
              {detailSolicitud && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleDownloadPDF(detailSolicitud.id)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Descargar PDF
                </Button>
              )}
              {detailSolicitud &&
                (detailSolicitud.estado === 'pagada' ||
                  detailSolicitud.estado === 'facturada') &&
                (isAdminOrCoAdmin || hasPermission('registrar_pago')) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user?.rol === 'admin' && (detailSolicitud.estado === 'pagada' || detailSolicitud.estado === 'facturada') && (
                        <DropdownMenuItem
                          onClick={() => setShowCorreccionModal(true)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Corregir solicitud
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setDevolucionFecha('');
                          setDevolucionMotivo('');
                          setDevolucionFile(null);
                          setShowDevolucionModal(true);
                        }}
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Registrar Devolución
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              {canManage &&
                detailSolicitud &&
                detailSolicitud.estado === 'pendiente' &&
                canManageSolicitud(detailSolicitud) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const aprobadas = detailAprobaciones.filter(
                        (a) => a.accion === 'aprobado',
                      ).length;
                      if (aprobadas > 0) {
                        setPendingEditSolicitud(detailSolicitud);
                        setShowEditConfirm(true);
                        return;
                      }
                      openEditForm(detailSolicitud);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar Solicitud
                  </Button>
                )}
            </DialogTitle>
            <DialogDescription>{detailSolicitud?.numero}</DialogDescription>
          </DialogHeader>

          {detailSolicitud?.urgente && (
            <Badge variant="destructive" className="text-xs w-fit">
              Urgente
            </Badge>
          )}

          {detailSolicitud && (
            <div className="space-y-4 py-4">
              {/* Basic info */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
                <div>
                  <div className="text-muted-foreground">Fecha</div>
                  <div className="font-medium">
                    {formatDate(detailSolicitud.fecha)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground">Preparado por</div>
                    <div className="font-medium">
                      {detailSolicitud.preparado_nombre || '-'}
                    </div>
                  </div>
                  {detailSolicitud.solicitado_nombre && (
                    <div>
                      <div className="text-muted-foreground">
                        Solicitado por
                      </div>
                      <div className="font-medium">
                        {detailSolicitud.solicitado_nombre}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Proveedor</div>
                  <div className="font-medium">{detailSolicitud.proveedor}</div>
                </div>
                {detailSolicitud.requisicion_numero && (
                  <div>
                    <div className="text-muted-foreground">Requisicion</div>
                    <div className="font-medium">
                      {detailSolicitud.requisicion_numero}
                    </div>
                  </div>
                )}
              </div>

              {detailSolicitud.observaciones && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">
                    Observaciones
                  </div>
                  <div>{detailSolicitud.observaciones}</div>
                </div>
              )}

              {/* Items + Totals */}
              <div className="border rounded-lg overflow-hidden">
                {detailItems.length > 0 && (
                  <div className="divide-y">
                    {detailItems.map((item) => (
                      <div key={item.id} className="p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">
                              {item.descripcion}
                            </div>
                            {item.descripcion_detallada && (
                              <div className="text-muted-foreground text-xs mt-1">
                                {item.descripcion_detallada}
                              </div>
                            )}
                            <div className="text-muted-foreground">
                              {item.cantidad} {item.unidad} x{' '}
                              {formatMoney(item.precio_unitario)}
                            </div>
                          </div>
                          <div className="font-medium">
                            {formatMoney(item.precio_total)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 space-y-2 text-sm border-t">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatMoney(detailSolicitud.subtotal)}</span>
                  </div>
                  {detailAjustes.map((ajuste) => (
                    <div key={ajuste.id} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {ajuste.descripcion}:
                      </span>
                      <span
                        className={
                          ajuste.tipo === 'descuento' ? 'text-red-600' : ''
                        }
                      >
                        {ajuste.tipo === 'descuento' ? '-' : ''}
                        {formatMoney(ajuste.monto)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>TOTAL:</span>
                    <span>{formatMoney(detailSolicitud.monto_total)}</span>
                  </div>
                </div>
              </div>

              {/* Bank data */}
              {(detailSolicitud.beneficiario || detailSolicitud.banco) && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Datos Bancarios
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailSolicitud.beneficiario && (
                      <div>
                        <div className="text-muted-foreground">
                          Beneficiario
                        </div>
                        <div>{detailSolicitud.beneficiario}</div>
                      </div>
                    )}
                    {detailSolicitud.banco && (
                      <div>
                        <div className="text-muted-foreground">Banco</div>
                        <div>{detailSolicitud.banco}</div>
                      </div>
                    )}
                    {detailSolicitud.tipo_cuenta && (
                      <div>
                        <div className="text-muted-foreground">Tipo Cuenta</div>
                        <div className="capitalize">
                          {detailSolicitud.tipo_cuenta}
                        </div>
                      </div>
                    )}
                    {detailSolicitud.numero_cuenta && (
                      <div>
                        <div className="text-muted-foreground">
                          Numero Cuenta
                        </div>
                        <div>{detailSolicitud.numero_cuenta}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Adjuntos */}
              <AdjuntosPreview
                adjuntos={detailAdjuntos}
                solicitudPagoId={detailSolicitud.id}
                onUpload={handleUploadAdjuntos}
                onDelete={handleDeleteAdjunto}
                uploading={uploadingFiles}
              />

              {/* Comprobante de Pago */}
              {(detailSolicitud.estado === 'pagada' ||
                detailSolicitud.estado === 'facturada') &&
                detailComprobante && (
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                      <h4 className="font-medium text-blue-900">
                        Comprobante de Pago
                      </h4>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div>
                          Fecha de pago:{' '}
                          {new Date(
                            detailComprobante.fecha_pago.split('T')[0] + 'T12:00:00',
                          ).toLocaleDateString('es-PA')}
                        </div>
                        <div>
                          Registrado por:{' '}
                          {detailComprobante.registrado_por_nombre}
                        </div>
                      </div>
                      {detailComprobante.adjuntos.length > 0 && (
                        <AdjuntosPreview
                          adjuntos={detailComprobante.adjuntos}
                          solicitudPagoId={detailSolicitud.id}
                          readOnly
                          title="Comprobantes"
                        />
                      )}
                    </div>
                  </div>
                )}

              {/* Factura/Recibo */}
              {detailSolicitud.estado === 'facturada' && detailFactura && (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                    <h4 className="font-medium text-emerald-900">
                      {detailFactura.tipo === 'recibo' ? 'Recibo' : 'Factura'}
                    </h4>
                    <div className="text-sm text-emerald-800 space-y-1">
                      <div>
                        Fecha:{' '}
                        {new Date(
                          detailFactura.fecha_factura.split('T')[0] + 'T12:00:00',
                        ).toLocaleDateString('es-PA')}
                      </div>
                      {detailFactura.numero_factura && (
                        <div>
                          Número de factura: {detailFactura.numero_factura}
                        </div>
                      )}
                      <div>
                        Registrado por: {detailFactura.registrado_por_nombre}
                      </div>
                    </div>
                    {detailFactura.adjuntos.length > 0 && (
                      <AdjuntosPreview
                        adjuntos={detailFactura.adjuntos}
                        solicitudPagoId={detailSolicitud.id}
                        readOnly
                        title={detailFactura.tipo === 'recibo' ? 'Recibos' : 'Facturas'}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Devolución */}
              {detailSolicitud.estado === 'devolucion' && detailDevolucion && (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                    <h4 className="font-medium text-red-900">Devolución</h4>
                    <div className="text-sm text-red-800 space-y-1">
                      <div>
                        Fecha:{' '}
                        {new Date(
                          detailDevolucion.fecha_devolucion.split('T')[0] + 'T12:00:00',
                        ).toLocaleDateString('es-PA')}
                      </div>
                      <div>Motivo: {detailDevolucion.motivo}</div>
                      <div>
                        Registrado por: {detailDevolucion.registrado_por_nombre}
                      </div>
                    </div>
                    {detailDevolucion.comprobante_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const resp = await api.get(
                              `/solicitudes-pago/${detailSolicitud.id}/devolucion/comprobante`,
                            );
                            if (resp.data.success && resp.data.url) {
                              window.open(resp.data.url, '_blank');
                            }
                          } catch {
                            alert('Error al descargar comprobante');
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {detailDevolucion.comprobante_nombre}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Historial de Correcciones */}
              {detailCorrecciones.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700">Historial de Correcciones</h4>
                  <div className="space-y-2">
                    {detailCorrecciones.map((correccion) => {
                      const cambios = correccion.cambios as { campo: string; anterior?: string; nuevo?: string; cambios?: unknown[]; descripcion?: string }[];
                      return (
                        <details key={correccion.id} className="border border-gray-200 rounded-lg">
                          <summary className="px-4 py-3 bg-gray-50 cursor-pointer flex items-center justify-between rounded-lg hover:bg-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {new Date(correccion.created_at).toLocaleDateString('es-PA', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="text-sm text-gray-500">
                                — {correccion.usuario_nombre}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {cambios.length} cambio{cambios.length !== 1 ? 's' : ''}
                            </Badge>
                          </summary>
                          <div className="px-4 py-3 space-y-3">
                            <div className="text-sm text-gray-600 italic">
                              Motivo: {correccion.motivo}
                            </div>
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="pb-1 pr-3">Campo</th>
                                  <th className="pb-1 pr-3">Anterior</th>
                                  <th className="pb-1">Nuevo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cambios.map((cambio, idx) => {
                                  const labelMap: Record<string, string> = {
                                    proveedor: 'Proveedor', fecha: 'Fecha', observaciones: 'Observaciones',
                                    beneficiario: 'Beneficiario', banco: 'Banco', tipo_cuenta: 'Tipo de cuenta',
                                    numero_cuenta: 'Número de cuenta', fecha_pago: 'Fecha de pago',
                                    fecha_factura: 'Fecha de factura', numero_factura: 'Número de factura',
                                    tipo: 'Tipo', subtotal: 'Subtotal', monto_total: 'Monto total',
                                    comprobante: 'Comprobante', factura: 'Factura',
                                    descripcion: 'Descripción', cantidad: 'Cantidad', unidad: 'Unidad',
                                    precio_unitario: 'Precio unitario',
                                  };
                                  const label = (campo: string) => labelMap[campo] || campo;
                                  if (cambio.campo === 'item' && 'cambios' in cambio) {
                                    const itemCambios = cambio.cambios as { campo: string; anterior: string; nuevo: string }[];
                                    return itemCambios.map((ic, icIdx) => (
                                      <tr key={`${idx}-${icIdx}`} className="border-t border-gray-100">
                                        <td className="py-1.5 pr-3 text-gray-700">
                                          Item &quot;{cambio.descripcion}&quot; — {label(ic.campo)}
                                        </td>
                                        <td className="py-1.5 pr-3 text-red-600 line-through">{ic.anterior}</td>
                                        <td className="py-1.5 text-green-600">{ic.nuevo}</td>
                                      </tr>
                                    ));
                                  }
                                  if (cambio.campo === 'item_agregado') {
                                    return (
                                      <tr key={idx} className="border-t border-gray-100">
                                        <td className="py-1.5 pr-3 text-gray-700">Item agregado</td>
                                        <td className="py-1.5 pr-3 text-gray-400">—</td>
                                        <td className="py-1.5 text-green-600">{cambio.descripcion}</td>
                                      </tr>
                                    );
                                  }
                                  if (cambio.campo === 'item_eliminado') {
                                    return (
                                      <tr key={idx} className="border-t border-gray-100">
                                        <td className="py-1.5 pr-3 text-gray-700">Item eliminado</td>
                                        <td className="py-1.5 pr-3 text-red-600 line-through">{cambio.descripcion}</td>
                                        <td className="py-1.5 text-gray-400">—</td>
                                      </tr>
                                    );
                                  }
                                  return (
                                    <tr key={idx} className="border-t border-gray-100">
                                      <td className="py-1.5 pr-3 text-gray-700">{label(cambio.campo)}</td>
                                      <td className="py-1.5 pr-3 text-red-600 line-through">
                                        {typeof cambio.anterior === 'string' ? cambio.anterior : '—'}
                                      </td>
                                      <td className="py-1.5 text-green-600">
                                        {typeof cambio.nuevo === 'string' ? cambio.nuevo : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comprobante de Reembolso */}
              {detailSolicitud.pinellas_paga &&
                ['pagada', 'facturada'].includes(detailSolicitud.estado) && (
                  <div className="space-y-3">
                    {detailReembolso ? (
                      <div className="p-4 bg-yellow-50/50 border border-amber-200 rounded-lg space-y-3">
                        <h4 className="font-medium text-amber-900">
                          Comprobante de Reembolso
                        </h4>
                        <div className="text-sm text-amber-800 space-y-1">
                          <div>
                            Fecha de reembolso:{' '}
                            {new Date(
                              detailReembolso.fecha_reembolso + 'T12:00:00',
                            ).toLocaleDateString('es-PA')}
                          </div>
                          <div>
                            Registrado por:{' '}
                            {detailReembolso.registrado_por_nombre}
                          </div>
                          {detailReembolso.comprobante_nombre && (
                            <div>
                              Archivo: {detailReembolso.comprobante_nombre}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      (isAdminOrCoAdmin || hasPermission('registrar_pago')) && (
                        <div className="p-4 bg-yellow-50/50/50 border border-amber-200 border-dashed rounded-lg">
                          <div className="text-sm text-amber-700 mb-2">
                            Pinellas paga esta solicitud. Pendiente de registrar
                            reembolso.
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReembolsoFecha('');
                              setReembolsoFile(null);
                              setShowReembolsoModal(true);
                            }}
                            className="w-full border-amber-300 text-amber-700 hover:bg-yellow-50/50"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Registrar Reembolso
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}

              {/* Approval section */}
              <div className="space-y-3">
                <h4 className="font-medium">Estado y Aprobaciones</h4>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEstadoBadge(detailSolicitud.estado)}
                    {detailSolicitud.pinellas_paga && !detailReembolso && (
                      <Badge
                        variant="outline"
                        className="bg-yellow-50/50 text-amber-700 border-amber-300"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reembolso pendiente
                      </Badge>
                    )}
                    {detailSolicitud.pinellas_paga && detailReembolso && (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-300"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Reembolsada
                      </Badge>
                    )}
                  </div>

                  {(isAdminOrCoAdmin || detailSolicitud.preparado_por === user?.id) && (
                    <div>
                      <label className={`flex items-center gap-2 text-sm ${
                        !detailSolicitud.pinellas_paga &&
                        (detailSolicitud.estado === 'pagada' ||
                          detailSolicitud.estado === 'facturada')
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}>
                        <Checkbox
                          checked={detailSolicitud.pinellas_paga}
                          disabled={
                            !detailSolicitud.pinellas_paga &&
                            (detailSolicitud.estado === 'pagada' ||
                              detailSolicitud.estado === 'facturada')
                          }
                          onCheckedChange={(checked) => {
                            setPendingPinellasPaga(!!checked);
                            setShowPinellasPagaConfirm(true);
                          }}
                        />
                        Pinellas paga (reembolso)
                      </label>
                      {!detailSolicitud.pinellas_paga &&
                        (detailSolicitud.estado === 'pagada' ||
                          detailSolicitud.estado === 'facturada') && (
                          <p className="text-xs text-muted-foreground ml-6 mt-1">
                            No disponible después de pagada
                          </p>
                        )}
                    </div>
                  )}

                  {/* Show approval progress */}
                  {detailSolicitud.estado === 'pagada' ||
                  detailSolicitud.estado === 'facturada'
                    ? detailAprobaciones.length > 0 && (
                        <div className="space-y-2">
                          {detailAprobaciones.map((aprobacion, index) => (
                            <div
                              key={aprobacion.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              {aprobacion.accion === 'aprobado' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-600" />
                              )}
                              <span className="font-medium">
                                {index + 1}. {aprobacion.usuario_nombre}
                              </span>
                              <span className="text-muted-foreground">
                                —{' '}
                                {new Date(aprobacion.fecha).toLocaleDateString(
                                  'es-PA',
                                  {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  },
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    : detailAprobadores.length > 0 && (
                        <div className="space-y-2">
                          {detailAprobadores.map((aprobador) => {
                            const aprobacion = detailAprobaciones.find(
                              (a) => a.user_id === aprobador.user_id,
                            );
                            return (
                              <div
                                key={aprobador.user_id}
                                className="flex items-center gap-2 text-sm"
                              >
                                {aprobacion ? (
                                  aprobacion.accion === 'aprobado' ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <X className="h-4 w-4 text-red-600" />
                                  )
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">
                                  {aprobador.orden}. {aprobador.nombre}
                                </span>
                                {aprobacion ? (
                                  <span className="text-muted-foreground">
                                    —{' '}
                                    {new Date(
                                      aprobacion.fecha,
                                    ).toLocaleDateString('es-PA', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    (pendiente)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                  {/* Rejection comment */}
                  {detailSolicitud.estado === 'rechazada' &&
                    detailAprobaciones
                      .filter((a) => a.accion === 'rechazado')
                      .map((rechazo) => (
                        <div
                          key={rechazo.id}
                          className="p-3 bg-red-50 border border-red-200 rounded text-sm"
                        >
                          <div className="font-medium text-red-800">
                            Rechazada por {rechazo.usuario_nombre}
                          </div>
                          <div className="text-red-700 mt-1">
                            {rechazo.comentario}
                          </div>
                        </div>
                      ))}

                  {/* Action buttons */}
                  {(() => {
                    if (!user || !detailSolicitud) return null;
                    const aprobacionesHechas = detailAprobaciones.filter(
                      (a) => a.accion === 'aprobado',
                    ).length;
                    const siguienteAprobador =
                      detailAprobadores[aprobacionesHechas];
                    const esMiTurno =
                      detailSolicitud.estado === 'pendiente' &&
                      siguienteAprobador?.user_id === user.id;

                    return (
                      <>
                        {esMiTurno && (
                          <div className="space-y-2 pt-2">
                            <Button
                              variant={detailRevisada ? 'secondary' : 'outline'}
                              onClick={() =>
                                handleToggleRevisada(detailSolicitud.id)
                              }
                              disabled={togglingRevisada}
                              className="w-full"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {togglingRevisada
                                ? 'Procesando...'
                                : detailRevisada
                                  ? '✓ Revisada'
                                  : 'Marcar como Revisada'}
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                onClick={() =>
                                  handleAprobar(detailSolicitud.id)
                                }
                                className="flex-1"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Aprobar
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  setRejectingId(detailSolicitud.id);
                                  setRejectComment('');
                                  setShowRejectModal(true);
                                }}
                                className="flex-1"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Rechazar
                              </Button>
                            </div>
                          </div>
                        )}

                        {detailSolicitud.estado === 'aprobada' &&
                          (isAdminOrCoAdmin ||
                            hasPermission('registrar_pago')) && (
                            <div className="pt-2">
                              <Button
                                onClick={() => {
                                  setRegistroPagoFecha('');
                                  setRegistroPagoFiles(null);
                                  setShowRegistrarPagoModal(true);
                                }}
                                className="w-full"
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Registrar Pago
                              </Button>
                            </div>
                          )}

                        {detailSolicitud.estado === 'pagada' &&
                          (isAdminOrCoAdmin ||
                            hasPermission('registrar_pago')) && (
                            <div className="pt-2">
                              <Button
                                onClick={() => {
                                  setRegistroFacturaFecha('');
                                  setRegistroFacturaNumero('');
                                  setRegistroFacturaTipo('factura');
                                  setRegistroFacturaFiles(null);
                                  setShowRegistrarFacturaModal(true);
                                }}
                                className="w-full"
                              >
                                <FileCheck className="h-4 w-4 mr-2" />
                                Registrar Factura o Recibo
                              </Button>
                            </div>
                          )}

                        {detailSolicitud.estado === 'rechazada' &&
                          canManage && (
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                onClick={() =>
                                  handleReenviar(detailSolicitud.id)
                                }
                                disabled={resubmitting}
                                className="w-full"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {resubmitting
                                  ? 'Reenviando...'
                                  : 'Reenviar para Aprobacion'}
                              </Button>
                            </div>
                          )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Delete */}
              {detailPuedeEliminar && (
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                    onClick={() => {
                      setDeletingId(detailSolicitud.id);
                      setShowDeleteModal(true);
                    }}
                  >
                    Eliminar Solicitud
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
            <DialogDescription>Indique el motivo del rechazo</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Comentario *</Label>
            <Textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Motivo del rechazo..."
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter className="flex gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={!rejectComment.trim()}
              className="w-full sm:w-auto"
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Solicitud</DialogTitle>
            <DialogDescription>
              {user?.rol === 'admin' &&
              detailSolicitud &&
              detailSolicitud.estado !== 'pendiente'
                ? `Esta solicitud está marcada como ${detailSolicitud.estado.toUpperCase()}. ¿Está seguro que desea eliminarla? Esta acción no se puede deshacer.`
                : '¿Está seguro que desea eliminar esta solicitud? Esta acción no se puede deshacer.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Eliminando...' : 'Si, Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Modal */}
      <Dialog
        open={showPasswordModal}
        onOpenChange={(open) => {
          setShowPasswordModal(open);
          if (!open) setPendingApprovalId(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar Aprobacion</DialogTitle>
            <DialogDescription>
              {pendingApprovalId
                ? 'Ingresa tu contraseña para aprobar esta solicitud.'
                : `Vas a aprobar ${reviewedIds.length} solicitud${reviewedIds.length > 1 ? 'es' : ''} revisada${reviewedIds.length > 1 ? 's' : ''}. Ingresa tu contraseña para confirmar.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={bulkPassword}
                onChange={(e) => setBulkPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete="new-password"
                className="mt-1"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmApproval()}
              />
            </div>
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
              disabled={bulkApproving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmApproval}
              disabled={!bulkPassword.trim() || bulkApproving}
            >
              {bulkApproving ? 'Aprobando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar Pago Modal */}
      <Dialog
        open={showRegistrarPagoModal}
        onOpenChange={setShowRegistrarPagoModal}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Ingresa la fecha de pago y adjunta el comprobante.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={registroPagoFecha}
                onChange={(e) => setRegistroPagoFecha(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Comprobante(s)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => setRegistroPagoFiles(e.target.files)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRegistrarPagoModal(false)}
              disabled={registrandoPago}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                detailSolicitud && handleRegistrarPago(detailSolicitud.id)
              }
              disabled={
                !registroPagoFecha ||
                !registroPagoFiles ||
                registroPagoFiles.length === 0 ||
                registrandoPago
              }
            >
              {registrandoPago ? 'Registrando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar Factura/Recibo Modal */}
      <Dialog
        open={showRegistrarFacturaModal}
        onOpenChange={setShowRegistrarFacturaModal}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Factura o Recibo</DialogTitle>
            <DialogDescription>
              Ingresa los datos del documento del proveedor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Tipo de documento *</Label>
              <RadioGroup
                value={registroFacturaTipo}
                onValueChange={(v) => setRegistroFacturaTipo(v as 'factura' | 'recibo')}
                className="flex gap-4 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="factura" id="p-tipo-factura" />
                  <Label htmlFor="p-tipo-factura" className="font-normal cursor-pointer">Factura</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="recibo" id="p-tipo-recibo" />
                  <Label htmlFor="p-tipo-recibo" className="font-normal cursor-pointer">Recibo</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={registroFacturaFecha}
                onChange={(e) => setRegistroFacturaFecha(e.target.value)}
                className="mt-1"
              />
            </div>
            {registroFacturaTipo === 'factura' && (
              <div>
                <Label>Número de factura</Label>
                <Input
                  type="text"
                  value={registroFacturaNumero}
                  onChange={(e) => setRegistroFacturaNumero(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label>Archivo(s) *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => setRegistroFacturaFiles(e.target.files)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRegistrarFacturaModal(false)}
              disabled={registrandoFactura}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                detailSolicitud && handleRegistrarFactura(detailSolicitud.id)
              }
              disabled={
                !registroFacturaFecha ||
                !registroFacturaFiles ||
                registroFacturaFiles.length === 0 ||
                registrandoFactura
              }
            >
              {registrandoFactura ? 'Registrando...' : 'Confirmar Factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar Reembolso Modal */}
      <Dialog open={showReembolsoModal} onOpenChange={setShowReembolsoModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Reembolso</DialogTitle>
            <DialogDescription>
              Registra el comprobante del reembolso a Pinellas.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Fecha de reembolso *</Label>
              <Input
                type="date"
                value={reembolsoFecha}
                onChange={(e) => setReembolsoFecha(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Comprobante *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setReembolsoFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowReembolsoModal(false)}
              disabled={registrandoReembolso}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                detailSolicitud && handleRegistrarReembolso(detailSolicitud.id)
              }
              disabled={!reembolsoFecha || !reembolsoFile || registrandoReembolso}
            >
              {registrandoReembolso ? 'Registrando...' : 'Confirmar Reembolso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar Devolución Modal */}
      <Dialog open={showDevolucionModal} onOpenChange={setShowDevolucionModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Devolución</DialogTitle>
            <DialogDescription>
              Registra la devolución total del proveedor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Fecha de devolución *</Label>
              <Input
                type="date"
                value={devolucionFecha}
                onChange={(e) => setDevolucionFecha(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Motivo *</Label>
              <textarea
                value={devolucionMotivo}
                onChange={(e) => setDevolucionMotivo(e.target.value)}
                placeholder="Describe el motivo de la devolución..."
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
              />
            </div>
            <div>
              <Label>Comprobante de devolución *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDevolucionFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDevolucionModal(false)}
              disabled={registrandoDevolucion}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                detailSolicitud && handleRegistrarDevolucion(detailSolicitud.id)
              }
              disabled={
                !devolucionFecha ||
                !devolucionMotivo.trim() ||
                !devolucionFile ||
                registrandoDevolucion
              }
            >
              {registrandoDevolucion ? 'Registrando...' : 'Confirmar Devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Corrección Modal */}
      {detailSolicitud && (
        <CorreccionSolicitudModal
          open={showCorreccionModal}
          onClose={() => setShowCorreccionModal(false)}
          onSuccess={() => {
            openDetail(detailSolicitud);
            loadSolicitudes();
          }}
          solicitud={{
            id: detailSolicitud.id,
            estado: detailSolicitud.estado,
            proveedor: detailSolicitud.proveedor,
            fecha: detailSolicitud.fecha,
            observaciones: detailSolicitud.observaciones,
            beneficiario: detailSolicitud.beneficiario,
            banco: detailSolicitud.banco,
            tipo_cuenta: detailSolicitud.tipo_cuenta,
            numero_cuenta: detailSolicitud.numero_cuenta,
            updated_at: detailSolicitud.updated_at || '',
          }}
          items={detailItems}
          ajustes={detailAjustes}
          comprobante={detailComprobante}
          factura={detailFactura ? {
            fecha_factura: detailFactura.fecha_factura,
            numero_factura: detailFactura.numero_factura ?? null,
            tipo: detailFactura.tipo ?? 'factura',
          } : null}
        />
      )}

      {/* AlertDialog para confirmar edición con aprobaciones parciales */}
      <AlertDialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Editar solicitud con aprobaciones?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta solicitud tiene aprobaciones registradas. Al editarla, se
              anularán todas las aprobaciones y volverá a estado pendiente.
              ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEditSolicitud(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingEditSolicitud) {
                  openEditForm(pendingEditSolicitud);
                }
                setPendingEditSolicitud(null);
                setShowEditConfirm(false);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para confirmar cambio de pinellas_paga */}
      <AlertDialog
        open={showPinellasPagaConfirm}
        onOpenChange={setShowPinellasPagaConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPinellasPaga
                ? '¿Marcar esta solicitud como pago de Pinellas pendiente de reembolso?'
                : '¿Quitar la marca de reembolso Pinellas a esta solicitud?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (detailSolicitud) {
                  try {
                    await api.patch(
                      `/solicitudes-pago/${detailSolicitud.id}/pinellas-paga`,
                      { pinellas_paga: pendingPinellasPaga },
                    );
                    setDetailSolicitud({
                      ...detailSolicitud,
                      pinellas_paga: pendingPinellasPaga,
                    });
                    loadSolicitudes();
                  } catch (err) {
                    const apiError = err as {
                      response?: { data?: { message?: string } };
                    };
                    alert(
                      apiError.response?.data?.message ||
                        'Error al cambiar pinellas_paga',
                    );
                  }
                }
                setShowPinellasPagaConfirm(false);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
