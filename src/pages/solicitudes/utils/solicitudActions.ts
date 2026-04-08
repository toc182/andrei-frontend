// Plain helper functions for solicitud-pago actions.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Each function takes its dependencies (state, setters, refresh callback)
// as an args object. The page components own all the state — these helpers
// just package the side-effect logic so the two pages can share it.

import type React from 'react';
import api from '../../../services/api';
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
    alert(apiError.response?.data?.message || 'Error al eliminar');
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
    alert(apiError.response?.data?.message || 'Error al rechazar');
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
    alert(
      apiError.response?.data?.message ||
        'Error al cambiar estado de revisión',
    );
  } finally {
    args.setTogglingRevisada(false);
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
    alert(apiError.response?.data?.message || 'Error al reenviar');
  } finally {
    args.setResubmitting(false);
  }
}
