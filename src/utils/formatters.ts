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

/**
 * Parte un monto en su símbolo y su número, para poder alinearlos por separado:
 * el "B/." pegado a la izquierda de la celda y el número a la derecha, de modo
 * que el símbolo quede a plomo en toda la columna (decisión de Ivan,
 * 2026-09-10). Sin monto devuelve el guion como número y símbolo vacío, para
 * que la celda no pinte un "B/." suelto.
 */
export const partesMoney = (
  amount: number | string | null | undefined,
): { simbolo: string; numero: string } => {
  const texto = formatMoney(amount);
  if (texto === '-') return { simbolo: '', numero: '-' };
  const m = texto.match(/^(\D+?)\s*([\d.,]+)$/);
  return m ? { simbolo: m[1].trim(), numero: m[2] } : { simbolo: '', numero: texto };
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
