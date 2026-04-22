// Plain helper functions for solicitud-pago actions.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Each function takes its dependencies (state, setters, refresh callback)
// as an args object. The page components own all the state — these helpers
// just package the side-effect logic so the two pages can share it.

import type React from 'react';
import api from '../../../services/api';
import type { SolicitudPagoAdjunto } from '../../../types/api';
import type { SolicitudPago } from '../types';

/**
 * Opens the PDF for a solicitud in a new tab. The token is appended as a
 * query parameter so the browser's GET to the PDF endpoint is authenticated
 * without needing the axios interceptor (window.open does not pass headers).
 */
export function openSolicitudPDF(solicitudId: number): void {
  const token = localStorage.getItem('token');
  window.open(
    `${api.defaults.baseURL}/solicitudes-pago/${solicitudId}/pdf?token=${token}`,
    '_blank',
  );
}

/**
 * Deletes a solicitud and closes the relevant dialogs. Refreshes the list
 * via the page-supplied callback.
 */
export async function deleteSolicitud(args: {
  deletingId: number | null;
  setDeleteLoading: (loading: boolean) => void;
  setShowDeleteModal: (open: boolean) => void;
  setShowDetail: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!args.deletingId) return;
  try {
    args.setDeleteLoading(true);
    await api.delete(`/solicitudes-pago/${args.deletingId}`);
    args.setShowDeleteModal(false);
    args.setShowDetail(false);
    await args.refreshList();
  } catch (err) {
    console.error('Error deleting:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al eliminar');
  } finally {
    args.setDeleteLoading(false);
  }
}

/**
 * Rejects a solicitud with a required comment, closes both the reject
 * dialog and the detail dialog, and refreshes the list. Also fires the
 * solicitud-status-changed window event.
 */
export async function rechazarSolicitud(args: {
  rejectingId: number | null;
  rejectComment: string;
  setShowRejectModal: (open: boolean) => void;
  setRejectComment: (comment: string) => void;
  setRejectingId: (id: number | null) => void;
  setShowDetail: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!args.rejectingId || !args.rejectComment.trim()) return;
  try {
    await api.post(`/solicitudes-pago/${args.rejectingId}/rechazar`, {
      comentario: args.rejectComment,
    });
    args.setShowRejectModal(false);
    args.setRejectComment('');
    args.setRejectingId(null);
    args.setShowDetail(false);
    await args.refreshList();
    window.dispatchEvent(new Event('solicitud-status-changed'));
  } catch (err) {
    console.error('Error rejecting:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al rechazar');
  }
}

/**
 * Toggles the "revisada" mark on a solicitud. The current state is read from
 * `currentRevisada`; the helper flips it via the API and updates both the
 * detail-view flag and the row in the list.
 */
export async function toggleRevisadaSolicitud(args: {
  solicitudId: number;
  currentRevisada: boolean;
  setTogglingRevisada: (loading: boolean) => void;
  setDetailRevisada: (revisada: boolean) => void;
  setSolicitudes: React.Dispatch<React.SetStateAction<SolicitudPago[]>>;
  onError?: (msg: string) => void;
}): Promise<void> {
  try {
    args.setTogglingRevisada(true);
    if (args.currentRevisada) {
      await api.delete(`/solicitudes-pago/${args.solicitudId}/revisar`);
      args.setDetailRevisada(false);
    } else {
      await api.post(`/solicitudes-pago/${args.solicitudId}/revisar`);
      args.setDetailRevisada(true);
    }
    args.setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === args.solicitudId ? { ...s, revisada: !args.currentRevisada } : s,
      ),
    );
  } catch (err) {
    console.error('Error toggling review:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(
      apiError.response?.data?.message ||
        'Error al cambiar estado de revisión',
    );
  } finally {
    args.setTogglingRevisada(false);
  }
}

/**
 * Registers the payment of a solicitud. Uploads the payment date and one
 * or more comprobante files, closes the registrar-pago modal and the
 * detail dialog, refreshes the list, and fires the status-changed event.
 */
export async function registrarPagoSolicitud(args: {
  solicitudId: number;
  fechaPago: string;
  files: FileList | null;
  setRegistrandoPago: (loading: boolean) => void;
  setShowRegistrarPagoModal: (open: boolean) => void;
  setShowDetail: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!args.fechaPago || !args.files || args.files.length === 0) return;
  try {
    args.setRegistrandoPago(true);
    const formData = new FormData();
    formData.append('fecha_pago', args.fechaPago);
    for (let i = 0; i < args.files.length; i++) {
      formData.append('archivos', args.files[i]);
    }
    await api.post(
      `/solicitudes-pago/${args.solicitudId}/registrar-pago`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    args.setShowRegistrarPagoModal(false);
    args.setShowDetail(false);
    await args.refreshList();
    window.dispatchEvent(new Event('solicitud-status-changed'));
  } catch (err) {
    console.error('Error registering payment:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al registrar pago');
  } finally {
    args.setRegistrandoPago(false);
  }
}

/**
 * Registers an invoice (factura) for a solicitud. Uploads the invoice
 * date, tipo, optional numero, and one or more comprobante files. Closes
 * the modal and detail dialog, refreshes the list, and fires the
 * status-changed event.
 */
export async function registrarFacturaSolicitud(args: {
  solicitudId: number;
  fechaFactura: string;
  tipo: string;
  numero: string;
  files: FileList | null;
  setRegistrandoFactura: (loading: boolean) => void;
  setShowRegistrarFacturaModal: (open: boolean) => void;
  setShowDetail: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!args.fechaFactura || !args.files || args.files.length === 0) return;
  try {
    args.setRegistrandoFactura(true);
    const formData = new FormData();
    formData.append('fecha_factura', args.fechaFactura);
    formData.append('tipo', args.tipo);
    if (args.numero.trim()) {
      formData.append('numero_factura', args.numero.trim());
    }
    for (let i = 0; i < args.files.length; i++) {
      formData.append('archivos', args.files[i]);
    }
    await api.post(
      `/solicitudes-pago/${args.solicitudId}/registrar-factura`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    args.setShowRegistrarFacturaModal(false);
    args.setShowDetail(false);
    await args.refreshList();
    window.dispatchEvent(new Event('solicitud-status-changed'));
  } catch (err) {
    console.error('Error registering invoice:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al registrar factura');
  } finally {
    args.setRegistrandoFactura(false);
  }
}

/**
 * Registers the reembolso (refund) of a solicitud that Pinellas had paid.
 * Uploads the reembolso date and a single comprobante file, closes the
 * reembolso modal, refreshes the list, and reopens the detail dialog so
 * the user sees the updated reembolso data. Does NOT close the detail
 * or fire status-changed — the solicitud stays in the same state.
 */
export async function registrarReembolsoSolicitud(args: {
  solicitudId: number;
  fechaReembolso: string;
  file: File | null;
  setRegistrandoReembolso: (loading: boolean) => void;
  setShowReembolsoModal: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  refreshDetail: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!args.fechaReembolso || !args.file) return;
  try {
    args.setRegistrandoReembolso(true);
    const formData = new FormData();
    formData.append('fecha_reembolso', args.fechaReembolso);
    formData.append('comprobante', args.file);
    await api.post(
      `/solicitudes-pago/${args.solicitudId}/reembolso`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    args.setShowReembolsoModal(false);
    // Reload list and detail to show reembolso data
    await args.refreshList();
    await args.refreshDetail();
  } catch (err) {
    console.error('Error registering reembolso:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al registrar reembolso');
  } finally {
    args.setRegistrandoReembolso(false);
  }
}

/**
 * Registers a devolución (reversal) on a solicitud. Uploads the date,
 * motivo, and a single comprobante file. Closes the modal and detail
 * dialog, refreshes the list, and fires the status-changed event.
 */
export async function registrarDevolucionSolicitud(args: {
  solicitudId: number;
  fechaDevolucion: string;
  motivo: string;
  file: File | null;
  setRegistrandoDevolucion: (loading: boolean) => void;
  setShowDevolucionModal: (open: boolean) => void;
  setShowDetail: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!args.fechaDevolucion || !args.motivo.trim() || !args.file) return;
  try {
    args.setRegistrandoDevolucion(true);
    const formData = new FormData();
    formData.append('fecha_devolucion', args.fechaDevolucion);
    formData.append('motivo', args.motivo.trim());
    formData.append('comprobante', args.file);
    await api.post(
      `/solicitudes-pago/${args.solicitudId}/devolucion`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    args.setShowDevolucionModal(false);
    args.setShowDetail(false);
    await args.refreshList();
    window.dispatchEvent(new Event('solicitud-status-changed'));
  } catch (err) {
    console.error('Error registering devolucion:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al registrar devolución');
  } finally {
    args.setRegistrandoDevolucion(false);
  }
}

/**
 * Handles the "confirm approval" flow triggered by the password dialog.
 *
 * Two branches:
 * - Individual: if `pendingApprovalId` is set, approves that one solicitud.
 *   Closes the detail dialog, clears the search term, and refreshes.
 * - Bulk: if `pendingApprovalId` is null but `reviewedIds` has entries,
 *   approves all of them via the masivo endpoint and shows a success
 *   message that auto-clears after 5s.
 *
 * Either branch closes the password modal and clears the password on
 * success. Errors are surfaced via setBulkError rather than alert() so
 * the password dialog can display them inline.
 */
export async function confirmApprovalSolicitud(args: {
  bulkPassword: string;
  pendingApprovalId: number | null;
  reviewedIds: number[];
  setBulkApproving: (loading: boolean) => void;
  setBulkError: (error: string | null) => void;
  setShowPasswordModal: (open: boolean) => void;
  setBulkPassword: (password: string) => void;
  setPendingApprovalId: (id: number | null) => void;
  setShowDetail: (open: boolean) => void;
  setSearchTerm: (term: string) => void;
  setBulkSuccessMessage: (msg: string | null) => void;
  refreshList: () => void | Promise<void>;
}): Promise<void> {
  if (!args.bulkPassword.trim()) return;
  try {
    args.setBulkApproving(true);
    args.setBulkError(null);
    if (args.pendingApprovalId) {
      // Individual approval
      await api.post(
        `/solicitudes-pago/${args.pendingApprovalId}/aprobar`,
        { password: args.bulkPassword },
      );
      args.setShowPasswordModal(false);
      args.setBulkPassword('');
      args.setPendingApprovalId(null);
      args.setShowDetail(false);
      args.setSearchTerm('');
      await args.refreshList();
      window.dispatchEvent(new Event('solicitud-status-changed'));
    } else if (args.reviewedIds.length > 0) {
      // Bulk approval of reviewed solicitudes
      const response = await api.post('/solicitudes-pago/aprobar-masivo', {
        ids: args.reviewedIds,
        password: args.bulkPassword,
      });
      if (response.data.success) {
        args.setShowPasswordModal(false);
        args.setBulkPassword('');
        args.setBulkSuccessMessage(
          `${response.data.aprobadas} de ${response.data.total} solicitudes aprobadas`,
        );
        setTimeout(() => args.setBulkSuccessMessage(null), 5000);
        args.refreshList();
        window.dispatchEvent(new Event('solicitud-status-changed'));
      }
    }
  } catch (err) {
    console.error('Error approving:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.setBulkError(apiError.response?.data?.message || 'Error al aprobar');
  } finally {
    args.setBulkApproving(false);
  }
}

/**
 * Uploads one or more attachment files to the solicitud currently open in
 * the detail dialog. Prepends the newly-uploaded adjuntos to the local list
 * so they appear at the top of the preview without a full refetch.
 */
export async function uploadSolicitudAdjuntos(args: {
  solicitudId: number;
  files: FileList;
  setUploadingFiles: (loading: boolean) => void;
  setDetailAdjuntos: React.Dispatch<React.SetStateAction<SolicitudPagoAdjunto[]>>;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (args.files.length === 0) return;
  try {
    args.setUploadingFiles(true);
    const formData = new FormData();
    for (let i = 0; i < args.files.length; i++) {
      formData.append('archivos', args.files[i]);
    }
    const response = await api.post(
      `/solicitudes-pago/${args.solicitudId}/adjuntos`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    if (response.data.success) {
      args.setDetailAdjuntos((prev) => [...response.data.adjuntos, ...prev]);
    }
  } catch (err) {
    console.error('Error uploading:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al subir archivos');
  } finally {
    args.setUploadingFiles(false);
  }
}

/**
 * Deletes a single adjunto from a solicitud and removes it from the local
 * detail-view list.
 */
export async function deleteSolicitudAdjunto(args: {
  adjuntoId: number;
  setDetailAdjuntos: React.Dispatch<React.SetStateAction<SolicitudPagoAdjunto[]>>;
  onError?: (msg: string) => void;
}): Promise<void> {
  try {
    await api.delete(`/solicitudes-pago/adjuntos/${args.adjuntoId}`);
    args.setDetailAdjuntos((prev) =>
      prev.filter((a) => a.id !== args.adjuntoId),
    );
  } catch (err) {
    console.error('Error deleting adjunto:', err);
    args.onError?.('Error al eliminar el adjunto');
  }
}

/**
 * Resubmits a previously-rejected solicitud back to "pendiente" state.
 * Closes the detail dialog and refreshes the list. Also fires a window
 * event so other components can react to the status change.
 */
export async function reenviarSolicitud(args: {
  solicitudId: number;
  setResubmitting: (loading: boolean) => void;
  setShowDetail: (open: boolean) => void;
  refreshList: () => void | Promise<void>;
  onError?: (msg: string) => void;
}): Promise<void> {
  try {
    args.setResubmitting(true);
    await api.patch(`/solicitudes-pago/${args.solicitudId}/estado`, {
      estado: 'pendiente',
    });
    args.setShowDetail(false);
    await args.refreshList();
    window.dispatchEvent(new Event('solicitud-status-changed'));
  } catch (err) {
    console.error('Error resubmitting:', err);
    const apiError = err as { response?: { data?: { message?: string } } };
    args.onError?.(apiError.response?.data?.message || 'Error al reenviar');
  } finally {
    args.setResubmitting(false);
  }
}
