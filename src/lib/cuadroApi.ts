// src/lib/cuadroApi.ts — API client del Cuadro de Cuenta. Mapea el wire
// snake_case del backend (routes/cuentas.ts) al modelo camelCase de cuadroModel.
import api from '@/services/api';
import type { CuadroLinea } from './cuadroModel';

export interface CuadroCuentaMeta {
  id: number;
  numero: number;
  estado: string;
  proyecto_id: number;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  desglose_id: number | null;
  itbms_tasa: number | null;
  proyecto_nombre: string;
  proyecto_monto_total: number | null;
  cliente_nombre: string | null;
  /** Fecha de la Orden de Proceder del proyecto (YYYY-MM-DD). */
  orden_proceder: string | null;
}

export interface CuadroDoc {
  cuenta: CuadroCuentaMeta;
  lineas: CuadroLinea[];
  /** Montaje de la hoja imprimible, guardado en el proyecto. null = todavía
   *  sin llenar; la pantalla arranca de los valores por defecto. */
  ajustesImpresion: unknown | null;
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

const toDoc = (d: {
  cuenta: CuadroCuentaMeta;
  lineas: CuadroLineaWire[];
  ajustes_impresion?: unknown | null;
}): CuadroDoc => ({
  cuenta: d.cuenta,
  lineas: d.lineas.map(wireToLinea),
  ajustesImpresion: d.ajustes_impresion ?? null,
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

/** Lo que la pantalla de Configurar Cuenta necesita del proyecto cuando no hay
 *  ninguna cuenta de la que leerlo. */
export interface ProyectoImpresion {
  nombre: string;
  clienteNombre: string | null;
  ordenProceder: string | null;
  ajustesImpresion: unknown | null;
}

export async function getProyectoImpresion(proyectoId: number): Promise<ProyectoImpresion> {
  const res = await api.get(`/projects/${proyectoId}`);
  const p = res.data.proyecto ?? {};
  return {
    nombre: p.nombre ?? '',
    clienteNombre: p.cliente_nombre ?? null,
    ordenProceder: p.orden_proceder ?? null,
    ajustesImpresion: p.ajustes_cuenta_impresion ?? null,
  };
}

/** El montaje de la hoja imprimible vive en el PROYECTO: se llena una vez y
 *  vale para todas sus cuentas. */
export async function guardarAjustesImpresion(
  proyectoId: number,
  ajustes: unknown,
): Promise<void> {
  await api.put(`/projects/${proyectoId}/ajustes-cuenta-impresion`, ajustes);
}

/** El inicio del periodo no se manda: lo calcula el servidor a partir de la
 *  Orden de Proceder del proyecto o del fin de la cuenta anterior. */
export async function crearCuentaDetalle(body: {
  proyecto_id: number;
  desglose_id: number;
  periodo_fin: string;
  es_final?: boolean;
}): Promise<{ id: number; numero: number }> {
  const res = await api.post('/cuentas/detalle', body);
  return res.data.data;
}
