/**
 * SolicitudesPagoGeneral Component
 * Vista consolidada de todas las solicitudes de pago de todos los proyectos
 * Accesible desde el sidebar principal
 */

import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
  Send,
  CreditCard,
  Banknote,
  Download,
  Pencil,
  Eye,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  Upload,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import type { SolicitudPagoAdjunto } from '../types/api';
import SolicitudPagoForm from '../components/forms/SolicitudPagoForm';
import AdjuntosPreview from '../components/AdjuntosPreview';

// --- Types ---

type EstadoSolicitud =
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
  estado: EstadoSolicitud;
  observaciones: string | null;
  beneficiario: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  urgente: boolean;
  pinellas_paga: boolean;
  revisada?: boolean;
  es_mi_turno?: boolean;
  aprobadores_estado?: { nombre: string; estado: string }[];
  reembolso_registrado?: boolean;
  proyecto_nombre?: string;
  preparado_nombre?: string;
  solicitado_nombre?: string;
  requisicion_numero?: string;
}

interface SolicitudItem {
  id: number;
  cantidad: number;
  unidad: string;
  descripcion: string;
  descripcion_detallada: string | null;
  precio_unitario: number;
  precio_total: number;
}

interface SolicitudAjuste {
  id: number;
  tipo: string;
  descripcion: string;
  porcentaje: number | null;
  monto: number;
}

interface ProjectOption {
  id: number;
  nombre: string;
  nombre_corto?: string;
  sp_prefijo?: string | null;
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

const ESTADO_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pagada', label: 'Pagada' },
  { value: 'facturada', label: 'Facturada' },
];

const ALL_ESTADOS = ESTADO_OPTIONS.map((e) => e.value);

const getEstadoBadge = (estado: string, esMiTurno?: boolean): ReactNode => {
  const variants: Record<string, BadgeConfig> = {
    borrador: { variant: 'secondary', label: 'Borrador', icon: Clock },
    pendiente: { variant: 'outline', label: 'Pendiente', icon: Send },
    aprobada: { variant: 'default', label: 'Aprobada', icon: Check },
    rechazada: { variant: 'destructive', label: 'Rechazada', icon: X },
    pagada: { variant: 'default', label: 'Pagada', icon: CreditCard },
    facturada: { variant: 'default', label: 'Facturada', icon: FileCheck },
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

interface SolicitudesPagoGeneralProps {
  onNavigate?: (view: string) => void;
}

export default function SolicitudesPagoGeneral({
  onNavigate,
}: SolicitudesPagoGeneralProps) {
  const { user, hasPermission, isAdminOrCoAdmin } = useAuth();
  const canManage = !!user;
  const canManageSolicitud = (sol: SolicitudPago) =>
    isAdminOrCoAdmin ||
    hasPermission('solicitudes_editar_todas') ||
    sol.preparado_por === user?.id;

  const [solicitudes, setSolicitudes] = useState<SolicitudPago[]>([]);
  const [proyectos, setProyectos] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterEstados, setFilterEstados] = useState<string[]>(ALL_ESTADOS);
  const [filterMyApproval, setFilterMyApproval] = useState(false);
  const [filterPinellasPaga, setFilterPinellasPaga] = useState(false);
  const [filterProyecto, setFilterProyecto] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoPopoverOpen, setEstadoPopoverOpen] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [selectorNoApprovers, setSelectorNoApprovers] = useState(false);
  const [checkingApprovers, setCheckingApprovers] = useState(false);
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

  // Adjuntos
  const [detailAdjuntos, setDetailAdjuntos] = useState<SolicitudPagoAdjunto[]>(
    [],
  );
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [detailRevisada, setDetailRevisada] = useState(false);
  const [togglingRevisada, setTogglingRevisada] = useState(false);

  // Selection for bulk approval
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Bulk approval
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(
    null,
  );
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Approve/Reject

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Registrar pago
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

  // Registrar factura
  const [showRegistrarFacturaModal, setShowRegistrarFacturaModal] =
    useState(false);
  const [registroFacturaFecha, setRegistroFacturaFecha] = useState('');
  const [registroFacturaNumero, setRegistroFacturaNumero] = useState('');
  const [registroFacturaFiles, setRegistroFacturaFiles] =
    useState<FileList | null>(null);
  const [registrandoFactura, setRegistrandoFactura] = useState(false);
  const [detailFactura, setDetailFactura] = useState<{
    fecha_factura: string;
    numero_factura?: string;
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

  // Edit confirmation (AlertDialog)
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [pendingEditSolicitud, setPendingEditSolicitud] =
    useState<SolicitudPago | null>(null);

  // Pinellas paga confirmation (AlertDialog)
  const [showPinellasPagaConfirm, setShowPinellasPagaConfirm] = useState(false);
  const [pendingPinellasPaga, setPendingPinellasPaga] =
    useState<boolean>(false);

  // Resubmit
  const [resubmitting, setResubmitting] = useState(false);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterEstados, filterMyApproval]);

  const loadData = async () => {
    try {
      setSelectedIds(new Set());
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
      const [solRes, projRes] = await Promise.all([
        api.get(`/solicitudes-pago${params}`),
        api.get('/projects'),
      ]);

      if (solRes.data.success) {
        setSolicitudes(solRes.data.solicitudes || []);
      }
      if (projRes.data.success) {
        setProyectos(projRes.data.proyectos || projRes.data.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar las solicitudes de pago');
    } finally {
      setLoading(false);
    }
  };

  // Filter
  const filteredSolicitudes = solicitudes
    .filter((sol) => {
      if (filterPinellasPaga && !sol.pinellas_paga) return false;
      if (
        filterProyecto !== 'all' &&
        sol.proyecto_id !== parseInt(filterProyecto)
      )
        return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          sol.numero?.toLowerCase().includes(search) ||
          sol.proveedor?.toLowerCase().includes(search) ||
          sol.proyecto_nombre?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (a.es_mi_turno && !b.es_mi_turno) return -1;
      if (!a.es_mi_turno && b.es_mi_turno) return 1;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });

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

  // New solicitud: first select project
  const handleNewSolicitud = () => {
    setShowProjectSelector(true);
  };

  const handleProjectSelected = async (projectIdStr: string) => {
    const pid = parseInt(projectIdStr);
    setSelectedProjectId(pid);
    setSelectorNoApprovers(false);
    setCheckingApprovers(true);
    try {
      const response = await api.get(`/approval-settings/project/${pid}`);
      if (response.data.success && response.data.approvers.length > 0) {
        setShowProjectSelector(false);
        setTimeout(() => setShowForm(true), 150);
      } else {
        setSelectorNoApprovers(true);
      }
    } catch {
      setSelectorNoApprovers(true);
    } finally {
      setCheckingApprovers(false);
    }
  };

  // Detail
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
        setDetailRevisada(!!solicitud.revisada);
        setShowDetail(true);
      }
    } catch (err) {
      console.error('Error loading detail:', err);
    }
  };

  const openEditForm = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`);
      if (response.data.success) {
        setEditingSolicitud(response.data.solicitud);
        setEditingItems(response.data.items || []);
        setEditingAjustes(response.data.ajustes || []);
        setSelectedProjectId(solicitud.proyecto_id);
        setShowDetail(false);
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error loading for edit:', err);
    }
  };

  // Approval actions
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
      await loadData();
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
      await loadData();
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
      await loadData();
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
      await loadData();
      if (detailSolicitud) await openDetail(detailSolicitud);
    } catch (err) {
      console.error('Error registering reembolso:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al registrar reembolso');
    } finally {
      setRegistrandoReembolso(false);
    }
  };

  const handleReenviar = async (solicitudId: number) => {
    try {
      setResubmitting(true);
      await api.patch(`/solicitudes-pago/${solicitudId}/estado`, {
        estado: 'pendiente',
      });
      setShowDetail(false);
      await loadData();
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

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        await loadData();
        window.dispatchEvent(new Event('solicitud-status-changed'));
      } else if (selectedIds.size > 0) {
        // Bulk approval
        const response = await api.post('/solicitudes-pago/aprobar-masivo', {
          ids: Array.from(selectedIds),
          password: bulkPassword,
        });
        if (response.data.success) {
          setShowPasswordModal(false);
          setBulkPassword('');
          setSelectedIds(new Set());
          alert(
            `${response.data.aprobadas} de ${response.data.total} solicitudes aprobadas`,
          );
          loadData();
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
      await loadData();
    } catch (err) {
      console.error('Error deleting:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError.response?.data?.message || 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">
          Cargando solicitudes de pago...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de Pago</h1>
          <p className="text-muted-foreground">
            Vista consolidada de todos los proyectos
          </p>
        </div>
        <Button onClick={handleNewSolicitud}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-600">
              {stats.pendientes}
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aprobadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {stats.aprobadas}
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monto Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold whitespace-nowrap">
              {formatMoney(stats.montoTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Popover open={estadoPopoverOpen} onOpenChange={setEstadoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-[220px] justify-between"
            >
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
        <Select value={filterProyecto} onValueChange={setFilterProyecto}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.nombre_corto || p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1">
          <Input
            placeholder="Buscar por numero, proveedor, proyecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-full"
          />
        </div>
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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {filterMyApproval && (
                <TableHead className="w-10 px-2"></TableHead>
              )}
              <TableHead className="w-[100px]">Numero</TableHead>
              <TableHead className="w-6 px-0"></TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead className="hidden sm:table-cell">Proveedor</TableHead>
              <TableHead className="text-right w-[100px]">Total</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSolicitudes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={filterMyApproval ? 7 : 6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No se encontraron solicitudes de pago
                </TableCell>
              </TableRow>
            ) : (
              filteredSolicitudes.map((sol) => (
                <TableRow
                  key={sol.id}
                  className={`cursor-pointer hover:bg-muted/50 ${sol.es_mi_turno ? 'bg-yellow-50/50' : ''}`}
                  onClick={() => openDetail(sol)}
                >
                  {filterMyApproval && (
                    <TableCell
                      className="px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(sol.id)}
                        onCheckedChange={() => toggleSelection(sol.id)}
                        disabled={!sol.revisada}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1">
                      {sol.numero}
                      {sol.revisada && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(sol.fecha)}
                    </div>
                  </TableCell>
                  <TableCell className="px-0 text-center">
                    {sol.urgente && (
                      <span className="text-red-600 font-bold">!</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div
                      className={`text-xs px-2 py-1 rounded w-fit ${sol.es_mi_turno ? 'bg-gray-200 text-gray-700' : 'bg-muted'}`}
                    >
                      {sol.proyecto_nombre || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                      {sol.proveedor}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {sol.proveedor}
                  </TableCell>
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
      </div>

      {/* Bulk Approval Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg">
          <div className="flex items-center justify-center gap-3 px-4 py-2.5">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
            </span>
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
              Aprobar seleccionadas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Project Selector Modal */}
      <Dialog
        open={showProjectSelector}
        onOpenChange={(open) => {
          setShowProjectSelector(open);
          if (!open) setSelectorNoApprovers(false);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Seleccionar Proyecto</DialogTitle>
            <DialogDescription>
              Selecciona el proyecto para la nueva solicitud de pago
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Select
              onValueChange={handleProjectSelected}
              disabled={checkingApprovers}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    checkingApprovers
                      ? 'Verificando...'
                      : 'Selecciona un proyecto'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.nombre_corto || p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectorNoApprovers && selectedProjectId && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs flex items-center gap-2">
                  Este proyecto no tiene aprobadores configurados. Configure los
                  aprobadores en la seccion Miembros del proyecto.
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      setShowProjectSelector(false);
                      onNavigate?.(`project-${selectedProjectId}-miembros`);
                    }}
                  >
                    Ir a Miembros
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Modal */}
      {selectedProjectId && (
        <SolicitudPagoForm
          projectId={selectedProjectId}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setSelectedProjectId(null);
            setEditingSolicitud(null);
            setEditingItems([]);
            setEditingAjustes([]);
          }}
          onSave={() => loadData()}
          editingSolicitud={editingSolicitud}
          existingItems={editingItems}
          existingAjustes={editingAjustes}
        />
      )}

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
            <div className="space-y-4">
              {/* Basic info */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
                <div>
                  <div className="text-muted-foreground">Fecha</div>
                  <div className="font-medium">
                    {formatDate(detailSolicitud.fecha)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Proyecto</div>
                  <div className="font-medium">
                    {detailSolicitud.proyecto_nombre || '-'}
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
              </div>

              {detailSolicitud.observaciones && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="text-muted-foreground mb-1">
                    Observaciones
                  </div>
                  <div>{detailSolicitud.observaciones}</div>
                </div>
              )}

              {/* Items + Totals */}
              <div className="border rounded-lg overflow-hidden">
                {detailItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Detalle</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">P.Unit</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.descripcion}</TableCell>
                          <TableCell className="text-right">
                            {item.cantidad} {item.unidad}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(item.precio_unitario)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(item.precio_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                        <span className="text-muted-foreground">
                          Beneficiario:
                        </span>{' '}
                        {detailSolicitud.beneficiario}
                      </div>
                    )}
                    {detailSolicitud.banco && (
                      <div>
                        <span className="text-muted-foreground">Banco:</span>{' '}
                        {detailSolicitud.banco}
                      </div>
                    )}
                    {detailSolicitud.tipo_cuenta && (
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>{' '}
                        <span className="capitalize">
                          {detailSolicitud.tipo_cuenta}
                        </span>
                      </div>
                    )}
                    {detailSolicitud.numero_cuenta && (
                      <div>
                        <span className="text-muted-foreground">Cuenta:</span>{' '}
                        {detailSolicitud.numero_cuenta}
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
                            detailComprobante.fecha_pago + 'T12:00:00',
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

              {/* Factura */}
              {detailSolicitud.estado === 'facturada' && detailFactura && (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                    <h4 className="font-medium text-emerald-900">Factura</h4>
                    <div className="text-sm text-emerald-800 space-y-1">
                      <div>
                        Fecha de factura:{' '}
                        {new Date(
                          detailFactura.fecha_factura + 'T12:00:00',
                        ).toLocaleDateString('es-PA')}
                      </div>
                      {detailFactura.numero_factura && (
                        <div>
                          Numero de factura: {detailFactura.numero_factura}
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
                        title="Facturas"
                      />
                    )}
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
                                  setRegistroFacturaFiles(null);
                                  setShowRegistrarFacturaModal(true);
                                }}
                                className="w-full"
                              >
                                <FileCheck className="h-4 w-4 mr-2" />
                                Registrar Factura
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
              {(user?.rol === 'admin' ||
                (canManage &&
                  detailSolicitud.estado === 'pendiente' &&
                  detailAprobaciones.length === 0 &&
                  canManageSolicitud(detailSolicitud))) && (
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

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="sm:max-w-[400px]">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={!rejectComment.trim()}
            >
              Rechazar
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
                : `Vas a aprobar ${selectedIds.size} solicitud${selectedIds.size > 1 ? 'es' : ''}. Ingresa tu contraseña para confirmar.`}
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
                autoComplete="off"
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

      {/* Registrar Factura Modal */}
      <Dialog
        open={showRegistrarFacturaModal}
        onOpenChange={setShowRegistrarFacturaModal}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Factura</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la factura del proveedor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Fecha de factura *</Label>
              <Input
                type="date"
                value={registroFacturaFecha}
                onChange={(e) => setRegistroFacturaFecha(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Numero de factura</Label>
              <Input
                type="text"
                value={registroFacturaNumero}
                onChange={(e) => setRegistroFacturaNumero(e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Archivo(s) de factura *</Label>
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
                    loadData();
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
