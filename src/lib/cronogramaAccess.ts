// Single source of truth for Cronograma feature visibility on the frontend.
//
// Mirrors the backend gate (routes/cronogramas.ts uses checkPermission('cronogramas_ver')):
// admin/co-admin always see it (they bypass granular permissions and the backend never
// sends them a permissions object), and a 'usuario' sees it when granted `cronogramas_ver`
// from the Permisos page.

import type { User } from '@/types/api';

export function canUseCronogramas(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.rol === 'admin' || user.rol === 'co-admin') return true;
  return user.permissions?.cronogramas_ver === true;
}
