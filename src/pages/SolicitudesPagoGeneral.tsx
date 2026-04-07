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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import type { SolicitudPagoAdjunto } from '../types/api';
import SolicitudPagoForm from '../components/forms/SolicitudPagoForm';
import AdjuntosPreview from '../components/AdjuntosPreview';
import CorreccionSolicitudModal from '../components/CorreccionSolicitudModal';
import { SortableHeader } from '@/components/SortableHeader';
import { getSortComparator, applyColumnFilters } from '@/components/sortableHeaderUtils';
import type { SortState, SortDirection, ColumnFilters } from '@/components/sortableHeaderUtils';
import type {
  SolicitudPago,
  SolicitudItem,
  SolicitudAjuste,
  ProjectOption,
  Aprobacion,
  AprobadorProyecto,
} from './solicitudes/types';
import { ESTADO_OPTIONS, ALL_ESTADOS } from './solicitudes/types';
import { smartDefaultSort } from './solicitudes/utils/solicitudSort';
import { EstadoBadge } from './solicitudes/components/EstadoBadge';
import { AprobadoresAvatars } from './solicitudes/components/AprobadoresAvatars';
import { DeleteSolicitudDialog } from './solicitudes/dialogs/DeleteSolicitudDialog';
import { RechazarSolicitudDialog } from './solicitudes/dialogs/RechazarSolicitudDialog';
import { BulkApprovalPasswordDialog } from './solicitudes/dialogs/BulkApprovalPasswordDialog';
import { EditConfirmDialog } from './solicitudes/dialogs/EditConfirmDialog';
import { PinellasPagaConfirmDialog } from './solicitudes/dialogs/PinellasPagaConfirmDialog';

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

// Backwards-compatible wrapper around <EstadoBadge /> so existing call sites
// don't change in this phase. Will be inlined in a later phase.
const getEstadoBadge = (estado: string, esMiTurno?: boolean): ReactNode => (
  <EstadoBadge estado={estado} esMiTurno={esMiTurno} />
);

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

  // Column sort & filter state
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  const handleSortChange = (column: string, direction: SortDirection | null) => {
    setSortState(direction ? { column, direction } : { column: null, direction: null });
  };

  const handleFilterChange = (column: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [column]: values }));
  };

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

  // Bulk approval success banner
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);

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

  // Correction mode
  const [showCorreccionModal, setShowCorreccionModal] = useState(false);
  const [detailPuedeEliminar, setDetailPuedeEliminar] = useState(false);
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

  // Resubmit
  const [resubmitting, setResubmitting] = useState(false);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination
  const PAGE_SIZE_OPTIONS = [25, 50, 100];
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = localStorage.getItem('solicitudes_page_size');
    const parsed = stored ? parseInt(stored, 10) : NaN;
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [filterEstados, filterMyApproval]);

  // Reset to page 1 whenever filters, search, sort or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterEstados,
    filterMyApproval,
    filterPinellasPaga,
    filterProyecto,
    searchTerm,
    sortState,
    columnFilters,
    pageSize,
  ]);

  // Persist page size
  useEffect(() => {
    localStorage.setItem('solicitudes_page_size', String(pageSize));
  }, [pageSize]);

  const loadData = async () => {
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

  // Filter by top-level controls first
  const preFiltered = solicitudes.filter((sol) => {
    if (filterPinellasPaga && !sol.pinellas_paga) return false;
    if (!filterEstados.includes(sol.estado)) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        sol.numero?.toLowerCase().includes(search) ||
        sol.proveedor?.toLowerCase().includes(search) ||
        sol.proyecto_nombre?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Unique values: apply all column filters EXCEPT the column itself
  // so each filter dropdown shows values available given the other active filters
  const getFilteredExcluding = (excludeColumn: string) => {
    const otherFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([key]) => key !== excludeColumn)
    );
    return applyColumnFilters(preFiltered, otherFilters);
  };

  const uniqueProyectos = [...new Set(getFilteredExcluding('proyecto_nombre').map((s) => s.proyecto_nombre || '').filter(Boolean))].sort();
  const uniqueProveedores = [...new Set(getFilteredExcluding('proveedor').map((s) => s.proveedor).filter(Boolean))].sort();
  const uniqueEstados = ['pendiente', 'aprobada', 'pagada', 'facturada', 'devolucion'];

  // Apply all column header filters + sort
  const afterColumnFilters = applyColumnFilters(preFiltered, columnFilters);

  const sortComparator = getSortComparator(sortState);
  const filteredSolicitudes = [...afterColumnFilters].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (sortComparator) return sortComparator(a as any, b as any);
    return smartDefaultSort(a, b);
  });

  // Pagination slice
  const totalItems = filteredSolicitudes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedSolicitudes = filteredSolicitudes.slice(startIdx, endIdx);
  const showingFrom = totalItems === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(endIdx, totalItems);

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
        setDetailDevolucion(response.data.devolucion || null);
        setDetailPuedeEliminar(!!response.data.puede_eliminar);
        setDetailRevisada(!!solicitud.revisada);
        // Load corrections
        const corrCount = response.data.solicitud?.correcciones_count || 0;
        if (corrCount > 0) {
          try {
            const corrResp = await api.get(`/solicitudes-pago/${solicitud.id}/correcciones`);
            if (corrResp.data.success) {
              setDetailCorrecciones(corrResp.data.data);
            }
          } catch {
            setDetailCorrecciones([]);
          }
        } else {
          setDetailCorrecciones([]);
        }
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
      await loadData();
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
        await loadData();
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
            <div className="text-base font-bold">
              {formatMoney(stats.montoTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                columnKey="numero"
                label="Numero"
                type="numeric"
                sortState={sortState}
                onSortChange={handleSortChange}
                className="w-[100px]"
              />
              <TableHead className="w-6 px-0"></TableHead>
              <SortableHeader
                columnKey="proyecto_nombre"
                label="Proyecto"
                type="discrete"
                sortState={sortState}
                onSortChange={handleSortChange}
                uniqueValues={uniqueProyectos}
                activeFilters={columnFilters.proyecto_nombre ?? uniqueProyectos}
                onFilterChange={handleFilterChange}
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
                className="hidden sm:table-cell"
              />
              <SortableHeader
                columnKey="monto_total"
                label="Total"
                type="numeric"
                sortState={sortState}
                onSortChange={handleSortChange}
                className="w-[100px]"
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
                className="w-[120px]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSolicitudes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No se encontraron solicitudes de pago
                </TableCell>
              </TableRow>
            ) : (
              paginatedSolicitudes.map((sol) => (
                <TableRow
                  key={sol.id}
                  className={`cursor-pointer hover:bg-muted/50 ${sol.es_mi_turno ? 'bg-yellow-50/50' : ''}`}
                  onClick={() => openDetail(sol)}
                >
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

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {totalItems === 0
              ? 'Sin resultados'
              : `Mostrando ${showingFrom}–${showingTo} de ${totalItems}`}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(parseInt(v, 10))}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden sm:inline">por página</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
            aria-label="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 min-w-[80px] text-center">
            Página {safePage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
            aria-label="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
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

              {/* Factura */}
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
                                {detailSolicitud.tipo === 'reembolso' ? 'Registrar Reembolso' : 'Registrar Pago'}
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

      {/* Delete Confirmation Modal */}
      <DeleteSolicitudDialog
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        solicitud={detailSolicitud}
        isAdmin={user?.rol === 'admin'}
        loading={deleteLoading}
        onConfirm={handleDelete}
      />

      {/* Reject Modal */}
      <RechazarSolicitudDialog
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
        comment={rejectComment}
        onCommentChange={setRejectComment}
        onConfirm={handleRechazar}
      />

      <BulkApprovalPasswordDialog
        open={showPasswordModal}
        onOpenChange={(open) => {
          setShowPasswordModal(open);
          if (!open) setPendingApprovalId(null);
        }}
        password={bulkPassword}
        onPasswordChange={setBulkPassword}
        pendingApprovalId={pendingApprovalId}
        reviewedCount={reviewedIds.length}
        loading={bulkApproving}
        error={bulkError}
        onConfirm={handleConfirmApproval}
      />

      {/* Registrar Pago/Reembolso Modal */}
      <Dialog
        open={showRegistrarPagoModal}
        onOpenChange={setShowRegistrarPagoModal}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {detailSolicitud?.tipo === 'reembolso' ? 'Registrar Reembolso' : 'Registrar Pago'}
            </DialogTitle>
            <DialogDescription>
              {detailSolicitud?.tipo === 'reembolso'
                ? 'Ingresa la fecha del reembolso y adjunta el comprobante.'
                : 'Ingresa la fecha de pago y adjunta el comprobante.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>{detailSolicitud?.tipo === 'reembolso' ? 'Fecha de reembolso' : 'Fecha de pago'}</Label>
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
              {registrandoPago
                ? 'Registrando...'
                : detailSolicitud?.tipo === 'reembolso'
                  ? 'Confirmar Reembolso'
                  : 'Confirmar Pago'}
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
                  <RadioGroupItem value="factura" id="tipo-factura" />
                  <Label htmlFor="tipo-factura" className="font-normal cursor-pointer">Factura</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="recibo" id="tipo-recibo" />
                  <Label htmlFor="tipo-recibo" className="font-normal cursor-pointer">Recibo</Label>
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

      {/* Correction Modal */}
      {detailSolicitud && (
        <CorreccionSolicitudModal
          open={showCorreccionModal}
          onClose={() => setShowCorreccionModal(false)}
          onSuccess={() => {
            openDetail(detailSolicitud);
            loadData();
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
          factura={detailFactura}
        />
      )}

      {/* AlertDialog para confirmar edición con aprobaciones parciales */}
      <EditConfirmDialog
        open={showEditConfirm}
        onOpenChange={setShowEditConfirm}
        onCancel={() => setPendingEditSolicitud(null)}
        onConfirm={() => {
          if (pendingEditSolicitud) {
            openEditForm(pendingEditSolicitud);
          }
          setPendingEditSolicitud(null);
          setShowEditConfirm(false);
        }}
      />

      <PinellasPagaConfirmDialog
        open={showPinellasPagaConfirm}
        onOpenChange={setShowPinellasPagaConfirm}
        pendingValue={pendingPinellasPaga}
        onConfirm={async () => {
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
      />
    </div>
  );
}
