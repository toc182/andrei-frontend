// The arithmetic of the «Pagos» part of «Corregir solicitud» (pagos parciales,
// migración 191): how the payments end up with the new total, and what goes to
// the server. Same rules as the server (services/pagosCorreccion.ts), which
// checks them all again; here they only show, before saving, what will happen.

import { formatMoney } from '@/utils/formatters';
import { parseMoney } from '@/lib/desglosePaste';
import type { PagoSolicitud } from '../types';

/** A payment as the window edits it. Amounts in whole cents. */
export interface PagoEditable {
  id: number;
  fechaOriginal: string;
  montoOriginal: number;
  fecha: string;
  montoTexto: string;
  anular: boolean;
  archivos: File[];
  /** The receipt files it has today, to show their names. */
  archivosActuales: string[];
}

const centavos = (valor: number | string) => Math.round(Number(valor) * 100);
/** Whole cents as money: 129375 → «B/. 1,293.75». */
export const dinero = (c: number) => formatMoney(c / 100);
/** Whole cents as the amount box writes it: 129375 → «1,293.75». */
export const escribirMonto = (c: number) =>
  (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The active payments, ready to edit. Cancelled ones are history, not editable. */
export function pagosEditables(pagos: PagoSolicitud[]): PagoEditable[] {
  return pagos
    .filter((p) => p.activo)
    .map((p) => ({
      id: p.id,
      fechaOriginal: p.fecha_pago.slice(0, 10),
      montoOriginal: centavos(p.monto),
      fecha: p.fecha_pago.slice(0, 10),
      montoTexto: escribirMonto(centavos(p.monto)),
      anular: false,
      archivos: [],
      archivosActuales: p.adjuntos.map((a) => a.nombre_original),
    }));
}

export interface PlanPagos {
  pagadoCentavos: number;
  saldoCentavos: number;
  estado: 'aprobada' | 'abonada' | 'pagada' | 'facturada';
  /** The last payment, moved by the system because only the total changed. */
  movido: { id: number; fecha: string; antes: number; despues: number } | null;
  error: string | null;
  /** What goes to the server in `pagos`: only what the admin changed. */
  pedido: { id: number; fecha_pago?: string; monto?: string; anular?: true }[];
}

export function planPagos(
  pagos: PagoEditable[],
  totalAntes: number,
  totalNuevo: number,
  conFactura: boolean,
): PlanPagos {
  let error: string | null = null;
  const montos = new Map<number, number>();
  for (const p of pagos) {
    if (p.anular) continue;
    const escrito = parseMoney(p.montoTexto);
    const c = escrito === null ? null : Math.round(escrito * 100);
    if (c === null || c <= 0) {
      error = 'Escriba el monto de cada pago (mayor que cero).';
      montos.set(p.id, p.montoOriginal);
    } else {
      montos.set(p.id, c);
    }
  }

  const tocaMontos = pagos.some(
    (p) => p.anular || montos.get(p.id) !== p.montoOriginal,
  );
  const pagadoAntes = pagos.reduce((s, p) => s + p.montoOriginal, 0);
  let movido: PlanPagos['movido'] = null;
  if (
    pagos.length > 0 &&
    pagadoAntes === totalAntes &&
    totalNuevo !== totalAntes &&
    !tocaMontos
  ) {
    const ultimo = [...pagos].sort((x, y) =>
      x.fecha === y.fecha ? y.id - x.id : x.fecha < y.fecha ? 1 : -1,
    )[0];
    const despues = ultimo.montoOriginal + (totalNuevo - totalAntes);
    movido = { id: ultimo.id, fecha: ultimo.fecha, antes: ultimo.montoOriginal, despues };
    montos.set(ultimo.id, despues);
    if (despues <= 0 && !error) {
      error = `Con el nuevo total (${dinero(totalNuevo)}) el último pago quedaría en cero o menos. Corrija o anule los pagos.`;
    }
  }

  const vigentes = pagos.filter((p) => !p.anular);
  const pagadoCentavos = vigentes.reduce((s, p) => s + (montos.get(p.id) ?? 0), 0);
  const saldoCentavos = totalNuevo - pagadoCentavos;
  if (saldoCentavos < 0 && !error) {
    error = `Lo pagado (${dinero(pagadoCentavos)}) pasa del total de la solicitud (${dinero(totalNuevo)}).`;
  }

  const estado: PlanPagos['estado'] =
    vigentes.length === 0
      ? 'aprobada'
      : saldoCentavos > 0
        ? 'abonada'
        : conFactura
          ? 'facturada'
          : 'pagada';

  const pedido: PlanPagos['pedido'] = [];
  for (const p of pagos) {
    if (p.anular) {
      pedido.push({ id: p.id, anular: true });
      continue;
    }
    const cambio: PlanPagos['pedido'][number] = { id: p.id };
    if (p.fecha !== p.fechaOriginal) cambio.fecha_pago = p.fecha;
    const escrito = parseMoney(p.montoTexto);
    const c = escrito === null ? null : Math.round(escrito * 100);
    if (c !== null && c > 0 && c !== p.montoOriginal) cambio.monto = (c / 100).toFixed(2);
    if (cambio.fecha_pago || cambio.monto) pedido.push(cambio);
  }

  return { pagadoCentavos, saldoCentavos, estado, movido, error, pedido };
}
