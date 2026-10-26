/**
 * Las pantallas del sistema, cada una en su propio archivo.
 *
 * Hasta el 26/10/2026 todo el sistema era un solo archivo de 1,7 MB: para ver
 * el login había que bajar también el cronograma, las cuentas y los pagos, y
 * cada actualización —casi diaria— obligaba a bajarlo entero otra vez. Ahora
 * se baja primero lo que hace falta para la primera pantalla y el resto llega
 * por detrás (precargarPantallas), así que al abrir una sección su código ya
 * suele estar en el navegador.
 *
 * El riesgo de partirlo: quien tiene el sistema abierto mientras sale una
 * actualización pide un pedazo con el nombre viejo, que ya no existe. Entonces
 * se recarga la página UNA vez para traer la versión nueva. Si vuelve a fallar
 * enseguida (sin conexión, por ejemplo), no se recarga en bucle: sale el error
 * de siempre (AppErrorBoundary).
 */

import { lazy, type ComponentType } from 'react';

const RECARGA = 'pantallas-recargada-en';
const importadores: Array<() => Promise<unknown>> = [];

/** Recarga la página, salvo que ya se haya recargado por esto hace menos de un minuto. */
function recargarUnaVez(): boolean {
  try {
    const anterior = Number(sessionStorage.getItem(RECARGA) ?? 0);
    if (Date.now() - anterior < 60_000) return false;
    sessionStorage.setItem(RECARGA, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la misma restricción que pide lazy()
function pantalla<T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  importadores.push(importar);
  return lazy(() =>
    importar().catch((error: unknown) => {
      // Mientras la página se recarga no hay nada que pintar.
      if (recargarUnaVez()) return new Promise<{ default: T }>(() => {});
      throw error;
    }),
  );
}

/**
 * Baja por detrás el código de todas las pantallas. Si algo falla aquí no se
 * dice nada: el navegador recuerda el fallo, así que al abrir esa pantalla
 * vuelve a fallar y entonces sí se recarga la página (recargarUnaVez).
 */
export function precargarPantallas(): void {
  for (const importar of importadores) importar().catch(() => undefined);
}

// Secciones generales (DashboardNew)
export const ProjectsList = pantalla(() => import('../components/ProjectsList'));
export const ClientesN = pantalla(() => import('./ClientesN'));
export const DocumentosPage = pantalla(() => import('./DocumentosPage'));
export const EquiposPage = pantalla(() => import('./EquiposPage'));
export const ProjectDetailLayout = pantalla(() => import('./project/ProjectDetailLayout'));
export const RequisicionesGeneral = pantalla(() => import('./RequisicionesGeneral'));
export const AdministracionPage = pantalla(() => import('./AdministracionPage'));
export const PagosPage = pantalla(() => import('./PagosPage'));
export const MiCuentaPage = pantalla(() => import('./MiCuentaPage'));
export const CajasMenudasPage = pantalla(() => import('./CajasMenudasPage'));
export const CuentasGeneralPage = pantalla(() => import('./cuentas/CuentasGeneralPage'));
export const CotizacionesPage = pantalla(() => import('./cotizaciones/CotizacionesPage'));
export const CronogramasIndexPage = pantalla(() => import('./cronogramas/CronogramasIndexPage'));
export const CronogramaWorkspace = pantalla(() => import('./cronogramas/CronogramaWorkspace'));

// Secciones de un proyecto (ProjectDetailLayout)
export const ProjectInformacion = pantalla(() => import('./project/ProjectInformacion'));
export const ProjectSummary = pantalla(() => import('./project/ProjectSummary'));
export const ProjectControlCostos = pantalla(() => import('./project/ProjectControlCostos'));
export const ProjectRequisiciones = pantalla(() => import('./project/ProjectRequisiciones'));
export const ProjectMembers = pantalla(() => import('./project/ProjectMembers'));
export const ProjectTodos = pantalla(() => import('./project/ProjectTodos'));
export const ProjectReportes = pantalla(() => import('./project/ProjectReportes'));
export const ProjectPagos = pantalla(() => import('./project/ProjectPagos'));
export const CuentasProjectView = pantalla(() => import('./cuentas/CuentasProjectView'));
export const CuentaDetailPage = pantalla(() => import('./cuentas/CuentaDetailPage'));
