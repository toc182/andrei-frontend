// Shared date formatter used by the SolicitudDetailDialog sub-components.
// Uses the es-PA locale with day/month/year format — intentionally distinct
// from the global utils/dateUtils.ts formatter which uses es-ES.

export const formatDate = (
  dateString: string | null | undefined,
): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
