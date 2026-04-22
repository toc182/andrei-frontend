/**
 * SolicitudesPagoGeneral Component
 * Vista consolidada de todas las solicitudes de pago de todos los proyectos
 * Accesible desde el sidebar principal
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatCard } from '@/components/shell/StatCard';
import { Alert } from '@/components/shell/Alert';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import type { SolicitudPagoAdjunto } from '../types/api';
import SolicitudPagoForm from '../components/forms/SolicitudPagoForm';
import CorreccionSolicitudModal from '../components/CorreccionSolicitudModal';
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
import { ALL_ESTADOS } from './solicitudes/types';
import { smartDefaultSort } from './solicitudes/utils/solicitudSort';
import { SolicitudesTable } from './solicitudes/components/SolicitudesTable';
import { SolicitudesPagination } from './solicitudes/components/SolicitudesPagination';
import {
  openSolicitudPDF,
  deleteSolicitud,
  reenviarSolicitud,
  rechazarSolicitud,
  toggleRevisadaSolicitud,
  uploadSolicitudAdjuntos,
  deleteSolicitudAdjunto,
  registrarPagoSolicitud,
  registrarFacturaSolicitud,
  registrarReembolsoSolicitud,
  registrarDevolucionSolicitud,
  confirmApprovalSolicitud,
} from './solicitudes/utils/solicitudActions';
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
import type { Correccion } from './solicitudes/dialogs/detail/SolicitudCorreccionesHistory';

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
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters — estado filtering is handled entirely by the column-header
  // filter in SolicitudesTable, so this page only owns the top-level toggles.
  const [filterMyApproval, setFilterMyApproval] = useState(false);
  const [filterPinellasPaga, setFilterPinellasPaga] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [detailCorrecciones, setDetailCorrecciones] = useState<Correccion[]>(
    [],
  );

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
  }, [filterMyApproval]);

  // Reset to page 1 whenever filters, search, sort or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterMyApproval,
    filterPinellasPaga,
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
  const uniqueEstados = ALL_ESTADOS;

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

  const handleRechazar = () =>
    rechazarSolicitud({
      rejectingId,
      rejectComment,
      setShowRejectModal,
      setRejectComment,
      setRejectingId,
      setShowDetail,
      refreshList: loadData,
      onError: setActionError,
    });

  const handleRegistrarPago = (solicitudId: number) =>
    registrarPagoSolicitud({
      solicitudId,
      fechaPago: registroPagoFecha,
      files: registroPagoFiles,
      setRegistrandoPago,
      setShowRegistrarPagoModal,
      setShowDetail,
      refreshList: loadData,
      onError: setActionError,
    });

  const handleRegistrarFactura = (solicitudId: number) =>
    registrarFacturaSolicitud({
      solicitudId,
      fechaFactura: registroFacturaFecha,
      tipo: registroFacturaTipo,
      numero: registroFacturaNumero,
      files: registroFacturaFiles,
      setRegistrandoFactura,
      setShowRegistrarFacturaModal,
      setShowDetail,
      refreshList: loadData,
      onError: setActionError,
    });

  const handleRegistrarReembolso = (solicitudId: number) =>
    registrarReembolsoSolicitud({
      solicitudId,
      fechaReembolso: reembolsoFecha,
      file: reembolsoFile,
      setRegistrandoReembolso,
      setShowReembolsoModal,
      refreshList: loadData,
      refreshDetail: async () => {
        if (detailSolicitud) await openDetail(detailSolicitud);
      },
      onError: setActionError,
    });

  const handleRegistrarDevolucion = (solicitudId: number) =>
    registrarDevolucionSolicitud({
      solicitudId,
      fechaDevolucion: devolucionFecha,
      motivo: devolucionMotivo,
      file: devolucionFile,
      setRegistrandoDevolucion,
      setShowDevolucionModal,
      setShowDetail,
      refreshList: loadData,
      onError: setActionError,
    });

  const handleReenviar = (solicitudId: number) =>
    reenviarSolicitud({
      solicitudId,
      setResubmitting,
      setShowDetail,
      refreshList: loadData,
      onError: setActionError,
    });

  const handleUploadAdjuntos = (files: FileList) => {
    if (!detailSolicitud) return;
    return uploadSolicitudAdjuntos({
      solicitudId: detailSolicitud.id,
      files,
      setUploadingFiles,
      setDetailAdjuntos,
      onError: setActionError,
    });
  };

  const handleDeleteAdjunto = (adjuntoId: number) =>
    deleteSolicitudAdjunto({ adjuntoId, setDetailAdjuntos, onError: setActionError });

  const handleToggleRevisada = (solicitudId: number) =>
    toggleRevisadaSolicitud({
      solicitudId,
      currentRevisada: detailRevisada,
      setTogglingRevisada,
      setDetailRevisada,
      setSolicitudes,
      onError: setActionError,
    });

  // Get IDs of reviewed solicitudes that are my turn to approve
  const reviewedIds = solicitudes
    .filter((s) => s.revisada && s.es_mi_turno)
    .map((s) => s.id);

  const handleConfirmApproval = () =>
    confirmApprovalSolicitud({
      bulkPassword,
      pendingApprovalId,
      reviewedIds,
      setBulkApproving,
      setBulkError,
      setShowPasswordModal,
      setBulkPassword,
      setPendingApprovalId,
      setShowDetail,
      setSearchTerm,
      setBulkSuccessMessage,
      refreshList: loadData,
    });

  const handleDelete = () =>
    deleteSolicitud({
      deletingId,
      setDeleteLoading,
      setShowDeleteModal,
      setShowDetail,
      refreshList: loadData,
      onError: setActionError,
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes de Pago"
        subtitle="Vista consolidada de todos los proyectos"
      >
        <Button onClick={handleNewSolicitud}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Solicitud
        </Button>
      </PageHeader>

      {error && <Alert variant="error" title={error} />}
      {actionError && <Alert variant="error" title={actionError} />}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={String(stats.total)} accent="navy" />
        <StatCard label="Pendientes" value={String(stats.pendientes)} accent="warning" />
        <StatCard label="Aprobadas" value={String(stats.aprobadas)} accent="success" />
        <StatCard label="Monto Total" value={formatMoney(stats.montoTotal)} accent="teal" />
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

      {/* Table + Mobile cards — extracted to SolicitudesTable */}
      <SolicitudesTable
        solicitudes={paginatedSolicitudes}
        showProyectoColumn={true}
        sortState={sortState}
        onSortChange={handleSortChange}
        columnFilters={columnFilters}
        onFilterChange={handleFilterChange}
        uniqueProveedores={uniqueProveedores}
        uniqueProyectos={uniqueProyectos}
        uniqueEstados={uniqueEstados}
        onRowClick={openDetail}
      />

      <SolicitudesPagination
        totalItems={totalItems}
        showingFrom={showingFrom}
        showingTo={showingTo}
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
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
        onDownloadPDF={openSolicitudPDF}
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
              setError(
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
