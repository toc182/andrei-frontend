/**
 * Utilidades de formateo centralizadas
 * Creado como parte de la auditoría de código (2026-01-05)
 */

/**
 * Formatea un monto como moneda panameña (Balboas)
 * @param amount - El monto a formatear (número, string, null o undefined)
 * @returns String formateado como "B/. 1,234.56" o "-" si no hay valor
 */
export const formatMoney = (
  amount: number | string | null | undefined,
): string => {
  if (amount === null || amount === undefined || amount === '') {
    return '-';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '-';
  }

  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'PAB',
    minimumFractionDigits: 2,
  }).format(numAmount);
};

export function getInitials(name?: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
