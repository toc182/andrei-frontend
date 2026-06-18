// Single source of truth for Cronograma feature visibility on the frontend (v1).
//
// Gated by EMAIL because admin/co-admin bypass the permission system on the backend, so
// a permission key can't make the feature visible to EXACTLY one person. Mirrors
// andrei-backend/src/middleware/cronogramaGate.ts.
//
// To open it up later, flip this single line to:
//   return !!user && (user.email === ... || !!user.permissions?.cronogramas_ver
//     || user.rol === 'admin' || user.rol === 'co-admin');
// and swap betaFeatureSingleUser -> checkPermission('cronogramas_ver') on the backend.

import type { User } from '@/types/api';

const ALLOWED_EMAILS = ['ivan@pinellaspanama.com'];

export function canUseCronogramas(user: User | null | undefined): boolean {
  return !!user && ALLOWED_EMAILS.includes(user.email);
}
