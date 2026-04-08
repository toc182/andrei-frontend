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
  Settings,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import api from '../../services/api';
import { formatMoney } from '../../utils/formatters';
import type { SolicitudPagoAdjunto } from '../../types/api';
import SolicitudPagoForm from '../../components/forms/SolicitudPagoForm';
import CorreccionSolicitudModal from '@/components/CorreccionSolicitudModal';
import { getSortComparator, applyColumnFilters } from '@/components/sortableHeaderUtils';
import type { SortState, SortDirection, ColumnFilters } from '@/components/sortableHeaderUtils';
import type {
  SolicitudPago,
  SolicitudItem,
  SolicitudAjuste,
  Aprobacion,
  AprobadorProyecto,
} from '../solicitudes/types';
import { ALL_ESTADOS } from '../solicitudes/types';
import { smartDefaultSort } from '../solicitudes/utils/solicitudSort';
import { EstadoBadge } from '../solicitudes/components/EstadoBadge';
import { SolicitudesTable } from '../solicitudes/components/SolicitudesTable';
import { DeleteSolicitudDialog } from '../solicitudes/dialogs/DeleteSolicitudDialog';
import { RechazarSolicitudDialog } from '../solicitudes/dialogs/RechazarSolicitudDialog';
import { BulkApprovalPasswordDialog } from '../solicitudes/dialogs/BulkApprovalPasswordDialog';
import { EditConfirmDialog } from '../solicitudes/dialogs/EditConfirmDialog';
import { PinellasPagaConfirmDialog } from '../solicitudes/dialogs/PinellasPagaConfirmDialog';
import { RegistrarPagoDialog } from '../solicitudes/dialogs/RegistrarPagoDialog';
import { RegistrarFacturaDialog } from '../solicitudes/dialogs/RegistrarFacturaDialog';
import { RegistrarReembolsoPinellasDialog } from '../solicitudes/dialogs/RegistrarReembolsoPinellasDialog';
import { RegistrarDevolucionDialog } from '../solicitudes/dialogs/RegistrarDevolucionDialog';
import { SolicitudDetailDialog } from '../solicitudes/dialogs/SolicitudDetailDialog';

interface ProjectSolicitudesPagoProps {
  projectId: number;
  onNavigate?: (view: string) => void;
}

// Backwards-compatible wrapper around <EstadoBadge /> so existing call sites
// don't change in this phase. Will be inlined in a later phase.
const getEstadoBadge = (estado: string, esMiTurno?: boolean): ReactNode => (
  <EstadoBadge estado={estado} esMiTurno={esMiTurno} />
);

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

  // Filters — filterEstados is kept as a constant (ALL_ESTADOS) since the
  // column-header filter in the table is the only estado filter UI.
  // The popover was removed during the #26 refactor.
  const [filterEstados] = useState<string[]>(ALL_ESTADOS);
  const [filterMyApproval, setFilterMyApproval] = useState(false);
  const [filterPinellasPaga, setFilterPinellasPaga] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Filter by top-level controls first
  const preFiltered = solicitudes.filter((sol) => {
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
  });

  // Unique values: apply all column filters EXCEPT the column itself
  const getFilteredExcluding = (excludeColumn: string) => {
    const otherFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([key]) => key !== excludeColumn)
    );
    return applyColumnFilters(preFiltered, otherFilters);
  };

  const uniqueProveedores = [...new Set(getFilteredExcluding('proveedor').map((s) => s.proveedor).filter(Boolean))].sort();
  const uniqueEstados = ['pendiente', 'aprobada', 'pagada', 'facturada', 'reembolsada', 'devolucion'];

  // Apply all column header filters + sort
  const afterColumnFilters = applyColumnFilters(preFiltered, columnFilters);

  const sortComparator = getSortComparator(sortState);
  const filteredSolicitudes = [...afterColumnFilters].sort((a, b) => {
    if (sortComparator) return sortComparator(a as unknown as Record<string, any>, b as unknown as Record<string, any>);
    return smartDefaultSort(a, b);
  });

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

      {/* Table + Mobile cards — extracted to SolicitudesTable */}
      <SolicitudesTable
        solicitudes={filteredSolicitudes}
        showProyectoColumn={false}
        sortState={sortState}
        onSortChange={handleSortChange}
        columnFilters={columnFilters}
        onFilterChange={handleFilterChange}
        uniqueProveedores={uniqueProveedores}
        uniqueProyectos={[]}
        uniqueEstados={uniqueEstados}
        onRowClick={openDetail}
        renderEstadoBadge={getEstadoBadge}
      />

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
        showProyectoField={false}
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

      {/* Reject Modal */}
      <RechazarSolicitudDialog
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
        comment={rejectComment}
        onCommentChange={setRejectComment}
        onConfirm={handleRechazar}
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
      />
    </div>
  );
}
