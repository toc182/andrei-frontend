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
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import type { SolicitudPagoAdjunto } from '../types/api';
import SolicitudPagoForm from '../components/forms/SolicitudPagoForm';
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
import { RegistrarPagoDialog } from './solicitudes/dialogs/RegistrarPagoDialog';
import { RegistrarFacturaDialog } from './solicitudes/dialogs/RegistrarFacturaDialog';
import { RegistrarReembolsoPinellasDialog } from './solicitudes/dialogs/RegistrarReembolsoPinellasDialog';
import { RegistrarDevolucionDialog } from './solicitudes/dialogs/RegistrarDevolucionDialog';
import { ProjectSelectorDialog } from './solicitudes/dialogs/ProjectSelectorDialog';
import { SolicitudDetailDialog } from './solicitudes/dialogs/SolicitudDetailDialog';

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

      <ProjectSelectorDialog
        open={showProjectSelector}
        onOpenChange={(open) => {
          setShowProjectSelector(open);
          if (!open) setSelectorNoApprovers(false);
        }}
        proyectos={proyectos}
        onProjectSelected={handleProjectSelected}
        checkingApprovers={checkingApprovers}
        selectorNoApprovers={selectorNoApprovers}
        selectedProjectId={selectedProjectId}
        onNavigateToMiembros={(pid) => {
          setShowProjectSelector(false);
          onNavigate?.(`project-${pid}-miembros`);
        }}
      />

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

      {/* Detail Modal — extracted to shared SolicitudDetailDialog */}
      <SolicitudDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        solicitud={detailSolicitud}
        items={detailItems}
        ajustes={detailAjustes}
        aprobaciones={detailAprobaciones}
        aprobadores={detailAprobadores}
        adjuntos={detailAdjuntos}
        comprobante={detailComprobante}
        factura={detailFactura}
        reembolso={detailReembolso}
        devolucion={detailDevolucion}
        correcciones={detailCorrecciones}
        puedeEliminar={detailPuedeEliminar}
        revisada={detailRevisada}
        togglingRevisada={togglingRevisada}
        uploadingFiles={uploadingFiles}
        resubmitting={resubmitting}
        showProyectoField={true}
        currentUserId={user?.id}
        isAdminOrCoAdmin={isAdminOrCoAdmin}
        isAdmin={user?.rol === 'admin'}
        canManage={canManage}
        canManageSolicitud={canManageSolicitud}
        hasPermission={hasPermission}
        renderEstadoBadge={getEstadoBadge}
        onDownloadPDF={handleDownloadPDF}
        onOpenCorreccion={() => setShowCorreccionModal(true)}
        onOpenDevolucionForm={() => {
          setDevolucionFecha('');
          setDevolucionMotivo('');
          setDevolucionFile(null);
          setShowDevolucionModal(true);
        }}
        onEditSolicitud={openEditForm}
        onRequestEditConfirmation={(sol) => {
          setPendingEditSolicitud(sol);
          setShowEditConfirm(true);
        }}
        onUploadAdjuntos={handleUploadAdjuntos}
        onDeleteAdjunto={handleDeleteAdjunto}
        onPinellasPagaChange={(newValue) => {
          setPendingPinellasPaga(newValue);
          setShowPinellasPagaConfirm(true);
        }}
        onToggleRevisada={handleToggleRevisada}
        onAprobar={handleAprobar}
        onOpenRejectDialog={(id) => {
          setRejectingId(id);
          setRejectComment('');
          setShowRejectModal(true);
        }}
        onOpenRegistrarPagoDialog={() => {
          setRegistroPagoFecha('');
          setRegistroPagoFiles(null);
          setShowRegistrarPagoModal(true);
        }}
        onOpenRegistrarFacturaDialog={() => {
          setRegistroFacturaFecha('');
          setRegistroFacturaNumero('');
          setRegistroFacturaTipo('factura');
          setRegistroFacturaFiles(null);
          setShowRegistrarFacturaModal(true);
        }}
        onOpenRegistrarReembolsoPinellasDialog={() => {
          setReembolsoFecha('');
          setReembolsoFile(null);
          setShowReembolsoModal(true);
        }}
        onReenviar={handleReenviar}
        onOpenDeleteDialog={(id) => {
          setDeletingId(id);
          setShowDeleteModal(true);
        }}
      />

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
      <RegistrarPagoDialog
        open={showRegistrarPagoModal}
        onOpenChange={setShowRegistrarPagoModal}
        tipo={detailSolicitud?.tipo}
        fecha={registroPagoFecha}
        onFechaChange={setRegistroPagoFecha}
        files={registroPagoFiles}
        onFilesChange={setRegistroPagoFiles}
        loading={registrandoPago}
        onConfirm={() =>
          detailSolicitud && handleRegistrarPago(detailSolicitud.id)
        }
      />

      <RegistrarFacturaDialog
        open={showRegistrarFacturaModal}
        onOpenChange={setShowRegistrarFacturaModal}
        tipo={registroFacturaTipo}
        onTipoChange={setRegistroFacturaTipo}
        fecha={registroFacturaFecha}
        onFechaChange={setRegistroFacturaFecha}
        numero={registroFacturaNumero}
        onNumeroChange={setRegistroFacturaNumero}
        files={registroFacturaFiles}
        onFilesChange={setRegistroFacturaFiles}
        loading={registrandoFactura}
        onConfirm={() =>
          detailSolicitud && handleRegistrarFactura(detailSolicitud.id)
        }
      />

      <RegistrarReembolsoPinellasDialog
        open={showReembolsoModal}
        onOpenChange={setShowReembolsoModal}
        fecha={reembolsoFecha}
        onFechaChange={setReembolsoFecha}
        file={reembolsoFile}
        onFileChange={setReembolsoFile}
        loading={registrandoReembolso}
        onConfirm={() =>
          detailSolicitud && handleRegistrarReembolso(detailSolicitud.id)
        }
      />

      <RegistrarDevolucionDialog
        open={showDevolucionModal}
        onOpenChange={setShowDevolucionModal}
        fecha={devolucionFecha}
        onFechaChange={setDevolucionFecha}
        motivo={devolucionMotivo}
        onMotivoChange={setDevolucionMotivo}
        file={devolucionFile}
        onFileChange={setDevolucionFile}
        loading={registrandoDevolucion}
        onConfirm={() =>
          detailSolicitud && handleRegistrarDevolucion(detailSolicitud.id)
        }
      />

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
