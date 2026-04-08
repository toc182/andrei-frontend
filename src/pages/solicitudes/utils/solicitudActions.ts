// Plain helper functions for solicitud-pago actions.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Each function takes its dependencies (state, setters, refresh callback)
// as an args object. The page components own all the state — these helpers
// just package the side-effect logic so the two pages can share it.

import api from '../../../services/api';

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
