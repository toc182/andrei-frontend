// Shared view-model helpers for the cronograma table + chart: flatten the WBS tree into
// ordered visible rows (honoring collapse), compute WBS numbers ("1.2.3"), and format
// predecessors in MS-Project row-number style ("4FS+2, 7SS").

import type { EngineTask, TaskId } from './cronogramaEngine';

export interface GanttRow {
  task: EngineTask;
  depth: number;
  wbs: string;
}

export function buildRows(tasks: EngineTask[], collapsed?: Set<TaskId>): GanttRow[] {
  const byParent = new Map<TaskId | null, EngineTask[]>();
  for (const t of tasks) {
    const k = (t.parentId ?? null) as TaskId | null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(t);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out: GanttRow[] = [];
  const walk = (parent: TaskId | null, depth: number, prefix: string) => {
    let n = 0;
    for (const t of byParent.get(parent) || []) {
      n++;
      const wbs = prefix ? `${prefix}.${n}` : `${n}`;
      out.push({ task: t, depth, wbs });
      if (!(collapsed && collapsed.has(t.id))) walk(t.id, depth + 1, wbs);
    }
  };
  walk(null, 0, '');
  return out;
}

/** Map task id -> 1-based visible row number (used for predecessor display). */
export function rowNumberMap(rows: GanttRow[]): Map<TaskId, number> {
  const m = new Map<TaskId, number>();
  rows.forEach((r, i) => m.set(r.task.id, i + 1));
  return m;
}

/** "4FS+2, 7SS-1" — predecessors as row numbers + type (+lag). FS lag 0 shows just the number. */
export function formatPredecessors(task: EngineTask, rowNum: Map<TaskId, number>): string {
  return (task.predecessors || [])
    .map((p) => {
      const n = rowNum.get(p.taskId);
      if (n == null) return '';
      const type = p.type && p.type !== 'FS' ? p.type : p.lag ? 'FS' : '';
      const lag = p.lag ? (p.lag > 0 ? `+${p.lag}` : `${p.lag}`) : '';
      return `${n}${type}${lag}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function hasChildren(task: EngineTask, tasks: EngineTask[]): boolean {
  return tasks.some((t) => t.parentId === task.id);
}
