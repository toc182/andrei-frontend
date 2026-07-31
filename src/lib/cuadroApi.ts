// src/lib/cuadroApi.ts — API client del Cuadro de Cuenta. Mapea el wire
// snake_case del backend (routes/cuentas.ts) al modelo camelCase de cuadroModel.
import api from '@/services/api';
import type { CuadroLinea } from './cuadroModel';

export interface CuadroCuentaMeta {
  id: number;
  numero: number;
  estado: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  desglose_id: number | null;
  itbms_tasa: number | null;
}

export interface CuadroDoc {
  cuenta: CuadroCuentaMeta;
  lineas: CuadroLinea[];
}

interface CuadroLineaWire {
  row_uid: string;
  parent_row_uid: string | null;
  tipo: 'grupo' | 'item';
  item: string;
  descripcion: string;
  unidad: string | null;
  cantidad_presupuesto: number | null;
  precio_unitario: number | null;
  cantidad_ejecutada: number;
  cantidad_anterior: number;
}

const wireToLinea = (w: CuadroLineaWire): CuadroLinea => ({
  rowUid: w.row_uid,
  parentRowUid: w.parent_row_uid,
  tipo: w.tipo,
  item: w.item,
  descripcion: w.descripcion,
  unidad: w.unidad,
  cantidadPresupuesto: w.cantidad_presupuesto,
  precioUnitario: w.precio_unitario,
  cantidadEjecutada: w.cantidad_ejecutada,
  cantidadAnterior: w.cantidad_anterior,
});

const toDoc = (d: { cuenta: CuadroCuentaMeta; lineas: CuadroLineaWire[] }): CuadroDoc => ({
  cuenta: d.cuenta,
  lineas: d.lineas.map(wireToLinea),
});

export async function getCuadro(cuentaId: number): Promise<CuadroDoc> {
  const res = await api.get(`/cuentas/${cuentaId}/cuadro`);
  return toDoc(res.data.data);
}

export async function saveCuadro(
  cuentaId: number,
  lineas: { rowUid: string; cantidadEjecutada: number }[],
): Promise<CuadroDoc> {
  const res = await api.put(`/cuentas/${cuentaId}/cuadro`, {
    lineas: lineas.map((l) => ({ row_uid: l.rowUid, cantidad_ejecutada: l.cantidadEjecutada })),
  });
  return toDoc(res.data.data);
}

export async function crearCuentaDetalle(body: {
  proyecto_id: number;
  desglose_id: number;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
  es_final?: boolean;
}): Promise<{ id: number; numero: number }> {
  const res = await api.post('/cuentas/detalle', body);
  return res.data.data;
}
