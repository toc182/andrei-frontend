// API client + wire types for the Cronograma feature. Mirrors the backend
// routes/cronogramas.ts shapes. The wire `tasks` are engine-ready (EngineTask),
// matching the standalone Gantto {project, tasks} format.

import api from '@/services/api';
import type { EngineTask } from './cronogramaEngine';

export interface CronogramaConfig {
  id: number;
  name: string;
  proyectoId: number | null;
  startDate: string; // YYYY-MM-DD
  workWeek: number; // 5 | 6 | 7
  holidays: string[];
  baseline: unknown | null;
  ajustesImpresion?: Partial<AjustesImpresion> | null; // saved print setup (missing/older keys tolerated)
  updatedAt?: string; // server version stamp; sent back as the save precondition
}

/** Logo slot choice: bundled key, none, or an uploaded image embedded as a data URL. */
export type LogoChoice = 'pinellas' | 'cocp' | 'none' | { dataUrl: string };

export type ColumnaImpresion = 'dur' | 'inicio' | 'fin' | 'pct' | 'pred';

/** Per-cronograma print setup, persisted server-side (cronogramas.ajustes_impresion). */
export interface AjustesImpresion {
  papel: 'letter' | 'legal' | 'a4' | 'a3' | 'tabloid' | 'custom';
  customWmm: number | null;
  customHmm: number | null;
  margenMM: number;
  letra: 'normal' | 'grande' | 'extra';
  paginasAncho: number;
  maxPaginasAlto: number;
  reducirLetra: boolean;
  columnas: ColumnaImpresion[]; // # y Nombre siempre van
  titulo: string;
  subtitulo: string;
  logoIzq: LogoChoice;
  logoDer: LogoChoice;
}

/** Thrown by saveCronograma when the backend rejects the save with 409 (another tab/device
 *  saved first). Distinct from transient/network errors so the caller can branch. */
export class CronogramaConflictError extends Error {
  constructor(message = 'Otra pestaña guardó cambios; recarga para combinar.') {
    super(message);
    this.name = 'CronogramaConflictError';
  }
}

export interface CronogramaListItem {
  id: number;
  nombre: string;
  proyectoId: number | null;
  proyectoNombre: string | null;
  fechaInicio: string;
  taskCount: number;
  updatedAt: string;
}

export interface CronogramaComputed {
  schedule: Record<string, { s: string; f: string }>;
  rollup: Record<string, number>;
  violations: (string | number)[];
  critical: (string | number)[];
  cycle: boolean;
}

export interface CronogramaDetail {
  project: CronogramaConfig;
  tasks: EngineTask[];
  computed: CronogramaComputed;
}

export interface CronogramaConfigInput {
  name: string;
  proyectoId?: number | null;
  startDate: string;
  workWeek: number;
  holidays?: string[];
  baseline?: unknown | null;
}

export interface SaveResult {
  idMap: Record<string, number>;
  project: CronogramaConfig;
  tasks: EngineTask[];
  computed: CronogramaComputed;
}

export async function listCronogramas(proyectoId?: number): Promise<CronogramaListItem[]> {
  const res = await api.get('/cronogramas', {
    params: proyectoId != null ? { proyecto_id: proyectoId } : undefined,
  });
  return res.data.data as CronogramaListItem[];
}

export async function getCronograma(id: number): Promise<CronogramaDetail> {
  const res = await api.get(`/cronogramas/${id}`);
  return res.data.data as CronogramaDetail;
}

export async function createCronograma(body: CronogramaConfigInput): Promise<number> {
  const res = await api.post('/cronogramas', body);
  return res.data.data.id as number;
}

export async function saveCronograma(
  id: number,
  body: { project: CronogramaConfigInput; tasks: EngineTask[]; baseUpdatedAt?: string | null },
): Promise<SaveResult> {
  try {
    const res = await api.put(`/cronogramas/${id}/save`, body);
    return res.data.data as SaveResult;
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } };
    if (err.response?.status === 409 || err.response?.data?.code === 'conflict') {
      throw new CronogramaConflictError(err.response?.data?.message);
    }
    throw e;
  }
}

export async function deleteCronograma(id: number): Promise<void> {
  await api.delete(`/cronogramas/${id}`);
}

export async function importCronograma(body: {
  project: { name?: string; startDate: string; workWeek?: number | string; holidays?: string[]; baseline?: unknown };
  tasks: EngineTask[];
  proyectoId?: number | null;
  nombre?: string;
}): Promise<number> {
  const res = await api.post('/cronogramas/import', body);
  return res.data.data.id as number;
}

/** Download the {project, tasks} JSON (sends auth header, then triggers a file save). */
export async function exportCronograma(id: number, filename = `cronograma-${id}.gantto.json`): Promise<void> {
  const res = await api.get(`/cronogramas/${id}/export`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Persist the print setup. Never bumps updated_at server-side, so it can't 409 a save. */
export async function saveAjustesImpresion(id: number, ajustes: AjustesImpresion): Promise<void> {
  await api.put(`/cronogramas/${id}/ajustes-impresion`, ajustes);
}
