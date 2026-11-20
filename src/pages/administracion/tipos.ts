import type { Llave } from './catalogo';

export type Rol = 'admin' | 'co-admin' | 'usuario';

/** Una cuenta, como la da GET /users. */
export interface Persona {
  id: number;
  nombre: string;
  email: string | null;
  rol: Rol;
  tipo_usuario: 'interno' | 'externo';
  activo: boolean;
  /** Como lo manda Meta: solo dígitos y con código de país. */
  whatsapp: string | null;
}

/** Lo que da GET /permissions/users de cada cuenta que no es admin. */
export type PermisosDePersona = {
  id: number;
  permission_profile_id: number | null;
  proyectos: number[];
} & Partial<Record<Llave, boolean | null>>;

/** Un perfil, como lo da GET /permission-profiles. */
export interface Perfil {
  id: number;
  nombre: string;
  descripcion: string | null;
  llaves: Llave[];
  personas: { id: number; nombre: string; activo: boolean }[];
}

export interface ProyectoOpcion {
  id: number;
  nombre: string;
}

/**
 * El perfil que se elige en la ficha. Gerencia es el rol co-admin y
 * Personalizado, ningún perfil: no son filas de permission_profiles.
 */
export type EleccionPerfil = number | 'gerencia' | 'personalizado';

/** El mensaje que manda el servidor, o el de respaldo. */
export function mensajeDeError(err: unknown, respaldo: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e.response?.data?.message || respaldo;
}
