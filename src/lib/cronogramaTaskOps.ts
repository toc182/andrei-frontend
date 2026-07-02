// WBS tree operations — port of gantto's TaskOps (app.js §TaskOps), which is itself a 1:1
// port of the native TaskOps.swift. These MUTATE the passed `tasks` array in place, exactly
// like gantto; the React workspace clones the array first (inside its commit/undo wrapper)
// so the mutation lands on a throwaway copy and state stays immutable.
//
// One deliberate deviation from gantto: new ids. Gantto mints uuids; the ERP uses temporary
// NEGATIVE ids for unsaved rows (the backend swaps them for serials on save, per the save
// contract). So every op that creates rows takes a `newId: () => TaskId` generator.

import {
  computeSchedule,
  hasCycle,
  isWorkDay,
  parseDate,
  type EngineProject,
  type EngineTask,
  type Schedule,
  type TaskId,
} from './cronogramaEngine';
import {
  buildPasteCandidate,
  type PasteCandidateMeta,
  type PastePlacement,
  type ResolvedPasteRow,
} from './cronogramaPaste';

// gantto capped nesting at 3 levels (MAX_DEPTH = 2); removed here per the user's decision
// (2026-06-18) — the WBS may nest to any depth. The engine and renderer handle it fine.

export function childrenOf(parent: TaskId | null, tasks: EngineTask[]): EngineTask[] {
  return tasks
    .filter((t) => (t.parentId ?? null) === parent)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function hasChildren(id: TaskId, tasks: EngineTask[]): boolean {
  return tasks.some((t) => t.parentId === id);
}

export function normalizeOrders(parent: TaskId | null, tasks: EngineTask[]): void {
  childrenOf(parent, tasks).forEach((s, k) => {
    const t = tasks.find((x) => x.id === s.id);
    if (t) t.order = k;
  });
}

/** Insert a new row after `afterId` (or into it when it's a group); returns the new id. */
export function opAddTask(
  type: EngineTask['type'],
  name: string,
  afterId: TaskId | null,
  tasks: EngineTask[],
  newId: () => TaskId,
): TaskId {
  const id = newId();
  const after = afterId != null ? tasks.find((t) => t.id === afterId) : null;
  let parent: TaskId | null;
  let order: number;
  if (after && after.type === 'group') {
    parent = after.id; // group selected → insert INSIDE (as last child)
    const last = childrenOf(after.id, tasks).slice(-1)[0];
    order = (last ? last.order ?? 0 : -1) + 1;
  } else if (after) {
    parent = after.parentId ?? null;
    order = (after.order ?? 0) + 0.5;
  } else {
    parent = null;
    const last = childrenOf(null, tasks).slice(-1)[0];
    order = (last ? last.order ?? 0 : -1) + 1;
  }
  const t: EngineTask = {
    id,
    parentId: parent,
    type,
    milestoneType: type === 'milestone' ? 'calculated' : null,
    name,
    duration: type === 'task' ? 5 : 0,
    manualDate: null,
    percentComplete: 0,
    color: null,
    notes: null,
    predecessors: [],
    order,
  };
  tasks.push(t);
  normalizeOrders(parent, tasks);
  return id;
}

/** Delete a row and its whole subtree, and strip predecessors pointing into it. */
export function opDeleteSubtree(id: TaskId, tasks: EngineTask[]): void {
  const remove = new Set<TaskId>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (t.parentId != null && remove.has(t.parentId) && !remove.has(t.id)) {
        remove.add(t.id);
        changed = true;
      }
    }
  }
  const parent = tasks.find((t) => t.id === id)?.parentId ?? null;
  for (let i = tasks.length - 1; i >= 0; i--) if (remove.has(tasks[i].id)) tasks.splice(i, 1);
  for (const t of tasks) t.predecessors = (t.predecessors || []).filter((p) => !remove.has(p.taskId));
  normalizeOrders(parent, tasks);
}

/** Demote a row under its previous sibling (promoting that sibling to a group). */
export function opIndent(id: TaskId, tasks: EngineTask[]): boolean {
  const t = tasks.find((x) => x.id === id);
  if (!t) return false;
  const sibs = childrenOf(t.parentId ?? null, tasks);
  const pos = sibs.findIndex((s) => s.id === id);
  if (pos <= 0) return false;
  const newParent = sibs[pos - 1];
  const oldParent = t.parentId ?? null;
  const np = tasks.find((x) => x.id === newParent.id)!;
  if (np.type !== 'group') {
    // Promote to group: clear fields that no longer apply (groups only roll up).
    np.type = 'group';
    np.duration = 0;
    np.percentComplete = 0;
    np.manualDate = null;
    np.milestoneType = null;
    np.predecessors = [];
  }
  const last = childrenOf(newParent.id, tasks).slice(-1)[0];
  t.parentId = newParent.id;
  t.order = (last ? last.order ?? 0 : -1) + 1;
  normalizeOrders(oldParent, tasks);
  normalizeOrders(newParent.id, tasks);
  return true;
}

/** Promote a row up one level, just after its former parent. */
export function opOutdent(id: TaskId, tasks: EngineTask[]): boolean {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.parentId == null) return false;
  const parent = tasks.find((x) => x.id === t.parentId);
  if (!parent) return false;
  const oldParent = t.parentId;
  t.parentId = parent.parentId ?? null;
  t.order = (parent.order ?? 0) + 0.5;
  normalizeOrders(oldParent, tasks);
  normalizeOrders(parent.parentId ?? null, tasks);
  // Deliberate deviation from gantto: if outdenting empties the former parent, demote it back
  // to a task (in the user's WBS model a group exists only while it has children, so a
  // childless "group" shouldn't linger). gantto leaves it as an empty group; we don't. The
  // original duration was discarded when opIndent promoted it, so fall back to the task default.
  if (parent.type === 'group' && !hasChildren(parent.id, tasks)) {
    parent.type = 'task';
    parent.duration = 5;
  }
  return true;
}

/** Duplicate a row and its subtree (fresh ids, remapped internal predecessors). */
export function opDuplicate(id: TaskId, tasks: EngineTask[], newId: () => TaskId): TaskId | null {
  const root = tasks.find((t) => t.id === id);
  if (!root) return null;
  const idMap = new Map<TaskId, TaskId>();
  const collect = (tid: TaskId) => {
    idMap.set(tid, newId());
    for (const c of childrenOf(tid, tasks)) collect(c.id);
  };
  collect(id);
  const copies: EngineTask[] = [];
  for (const t of tasks) {
    if (!idMap.has(t.id)) continue;
    const c: EngineTask = structuredClone(t);
    c.id = idMap.get(t.id)!;
    if (c.parentId != null && idMap.has(c.parentId)) c.parentId = idMap.get(c.parentId)!;
    c.predecessors = (c.predecessors || []).map((p) =>
      idMap.has(p.taskId) ? { taskId: idMap.get(p.taskId)!, type: p.type, lag: p.lag } : p,
    );
    if (t.id === id) {
      c.order = (root.order ?? 0) + 0.5;
      c.name = `${t.name} (copia)`;
    }
    copies.push(c);
  }
  tasks.push(...copies);
  normalizeOrders(root.parentId ?? null, tasks);
  return idMap.get(id) ?? null;
}

// ---- bulk paste ("Pegar filas…") -------------------------------------------
//
// Shared work-day counter, lifted out of CronogramaWorkspace so the inline Fin editor and the
// paste importer invert a chosen finish date into a duration the exact same way. Inclusive of both
// endpoints, per gantto. `ww` is `string | number` and coerced like the engine (line 125) so a
// project workWeek of "6" behaves identically here. Callers must pass valid "YYYY-MM-DD" strings.
export function countWorkDays(s: string, f: string, ww: string | number, hol: Set<string>): number {
  const w = parseInt(String(ww), 10) || 5;
  let n = 0;
  const d = parseDate(s);
  const end = parseDate(f);
  while (d <= end) {
    if (isWorkDay(d, w, hol)) n++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, n);
}

export interface FinInversionResult {
  schedule: Schedule;
  skippedCycle: boolean; // a cycle in the merged tree -> no inversion at all
  skippedLeaves: TaskId[]; // a leaf with no schedule entry -> its Fin was skipped
  collapsed: TaskId[]; // Fin fell before the computed start -> duration collapsed to 1
}

/**
 * Turn each Fin-derived leaf's chosen finish into a duration, from ONE schedule pass over the
 * merged tree. Pasted rows carry no predecessors, so a row's start is independent of every other
 * row's duration — one pass is exact. GUARD (build-spec guarantee "Honest dates"): if the merged
 * tree has a cycle (computeSchedule returns an empty map) or a leaf has no entry, skip the
 * inversion for that leaf and keep its provisional duration rather than feeding an Invalid/199
 * date to countWorkDays. Mutates the durations of the affected leaves in `merged`.
 */
export function applyFinDurations(
  merged: EngineTask[],
  proj: EngineProject,
  finToInvert: Map<TaskId, string>,
): FinInversionResult {
  const schedule = computeSchedule(merged, proj);
  const hol = new Set<string>(proj.holidays || []);
  const skippedLeaves: TaskId[] = [];
  const collapsed: TaskId[] = [];

  if (hasCycle(merged)) {
    return { schedule, skippedCycle: true, skippedLeaves: [...finToInvert.keys()], collapsed: [] };
  }
  for (const [id, fin] of finToInvert) {
    const entry = schedule.get(id);
    if (!entry) {
      skippedLeaves.push(id);
      continue;
    }
    const end = fin < entry.s ? entry.s : fin;
    if (fin < entry.s) collapsed.push(id);
    const t = merged.find((x) => x.id === id);
    if (t) t.duration = countWorkDays(entry.s, end, proj.workWeek, hol);
  }
  return { schedule, skippedCycle: false, skippedLeaves, collapsed };
}

export interface PasteBatchReport {
  ids: TaskId[]; // minted ids in document order
  meta: PasteCandidateMeta[]; // per-row promotion / date-push-down / fin-derived info
  skippedCycle: boolean;
  skippedLeaves: TaskId[];
  collapsed: TaskId[];
  demoted: TaskId[]; // childless promoted groups demoted back to task (never schedule an empty group)
}

// Core insert used by both the live commit and the dialog's clone-based preview so the two are the
// same code path. Mutates `tasks` in place (like every other op); the caller clones first.
function insertPasteBatchCore(
  resolved: ResolvedPasteRow[],
  placement: PastePlacement,
  proj: EngineProject,
  tasks: EngineTask[],
  newId: () => TaskId,
): PasteBatchReport {
  const cand = buildPasteCandidate(resolved, tasks, placement, newId);
  tasks.push(...cand.tasks);
  const inv = applyFinDurations(tasks, proj, cand.finToInvert);

  // A promoted node whose children were all excluded upstream would be an empty group (the engine
  // schedules those to the project start) — demote it to a task so it never schedules silently.
  const demoted: TaskId[] = [];
  for (const m of cand.meta) {
    if (!m.promotedToGroup) continue;
    const t = tasks.find((x) => x.id === m.id);
    if (t && t.type === 'group' && !tasks.some((x) => x.parentId === t.id)) {
      t.type = 'task';
      t.duration = 5;
      demoted.push(t.id);
    }
  }

  const seen = new Set<string>();
  for (const p of cand.touchedParents) {
    const key = String(p);
    if (seen.has(key)) continue;
    seen.add(key);
    normalizeOrders(p, tasks);
  }

  return {
    ids: cand.ids,
    meta: cand.meta,
    skippedCycle: inv.skippedCycle,
    skippedLeaves: inv.skippedLeaves,
    collapsed: inv.collapsed,
    demoted,
  };
}

/**
 * Insert a whole pasted batch as ONE mutation (the workspace wraps this in a single `commit`, so it
 * is one undo / one autosave). Returns the minted ids in document order. Never emits a milestone.
 */
export function opInsertPasteBatch(
  resolved: ResolvedPasteRow[],
  placement: PastePlacement,
  proj: EngineProject,
  tasks: EngineTask[],
  newId: () => TaskId,
): TaskId[] {
  return insertPasteBatchCore(resolved, placement, proj, tasks, newId).ids;
}

/** Same insert as `opInsertPasteBatch`, but returns the full report for the dialog's preview. */
export function previewPasteBatch(
  resolved: ResolvedPasteRow[],
  placement: PastePlacement,
  proj: EngineProject,
  tasks: EngineTask[],
  newId: () => TaskId,
): PasteBatchReport {
  return insertPasteBatchCore(resolved, placement, proj, tasks, newId);
}
