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
  body: { project: CronogramaConfigInput; tasks: EngineTask[] },
): Promise<SaveResult> {
  const res = await api.put(`/cronogramas/${id}/save`, body);
  return res.data.data as SaveResult;
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
