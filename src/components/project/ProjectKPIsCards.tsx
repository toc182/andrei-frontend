/**
 * ProjectKPIsCards Component
 * Displays 4 key performance indicator cards for a project
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';
import { fechaLocal } from '@/utils/dateUtils';
import type { Project } from '@/types';

const formatCurrency = (amount: number | null | undefined) => {
  if (!amount) return 'B/. 0.00';
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'PAB',
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace('PAB', 'B/.');
};

const getEstadoBadge = (estado: string | undefined) => {
  const variants: Record<string, { className: string; label: string }> = {
    planificacion: { className: 'bg-slate-100 text-slate-600 border-slate-200 border', label: 'Planificación' },
    en_curso: { className: 'bg-info/10 text-info border-info/30 border', label: 'En Curso' },
    pausado: { className: 'bg-warning/10 text-warning border-warning/30 border', label: 'Pausado' },
    completado: { className: 'bg-success/10 text-success border-success/30 border', label: 'Completado' },
    cancelado: { className: 'bg-error/10 text-error border-error/30 border', label: 'Cancelado' },
  };

  const config = estado
    ? variants[estado] || { className: 'bg-slate-100 text-slate-600 border-slate-200 border', label: estado }
    : { className: 'bg-slate-100 text-slate-600 border-slate-200 border', label: 'N/A' };
  return <Badge className={config.className}>{config.label}</Badge>;
};

interface ProjectKPIsCardsProps {
  project: Project | null;
}

export default function ProjectKPIsCards({ project }: ProjectKPIsCardsProps) {
  const { open: sidebarOpen } = useSidebar();

  // El monto de contrato vigente: con las adendas aprobadas.
  const presupuesto = Number(project?.monto_vigente ?? project?.monto_total ?? 0);
  const gastado =
    (project?.datos_adicionales as { total_gastado?: number })?.total_gastado ||
    0;
  const disponible = presupuesto - gastado;
  const porcentajeGastado = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;

  // Calculate time metrics
  const fechaInicio = project?.fecha_inicio ? fechaLocal(project.fecha_inicio) : null;
  // La terminación vigente: la de la última adenda aprobada que la cambió.
  const finVigente = project?.fecha_fin_vigente ?? project?.fecha_fin_estimada;
  const fechaFin = finVigente ? fechaLocal(finVigente) : null;
  const hoy = new Date();

  let diasTranscurridos = 0;
  let diasTotales = 0;
  let porcentajeTiempo = 0;

  if (fechaInicio && fechaFin) {
    const diffTranscurrido = hoy.getTime() - fechaInicio.getTime();
    const diffTotal = fechaFin.getTime() - fechaInicio.getTime();
    diasTranscurridos = Math.max(
      0,
      Math.floor(diffTranscurrido / (1000 * 60 * 60 * 24)),
    );
    diasTotales = Math.floor(diffTotal / (1000 * 60 * 60 * 24));
    porcentajeTiempo =
      diasTotales > 0 ? (diasTranscurridos / diasTotales) * 100 : 0;
  }

  // El avance físico es el de las cuentas, borradores incluidos (Ivan,
  // 2026-10-01); lo que está en borrador se pinta aparte y lleva nota.
  const porcentajeAvance = project?.avance_fisico ?? 0;
  const sinPresentar = project?.avance_sin_presentar ?? 0;
  const presentado = project?.avance_presentado ?? porcentajeAvance;
  const anchoPresentado = Math.min(100, Math.max(0, presentado));
  const anchoSinPresentar = Math.min(100 - anchoPresentado, Math.max(0, sinPresentar));
  const borradores = project?.avance_cuentas_sin_presentar ?? [];
  const listaCuentas =
    borradores.length > 1
      ? `${borradores.slice(0, -1).join(', ')} y ${borradores[borradores.length - 1]}`
      : String(borradores[0] ?? '');
  const notaBorrador =
    borradores.length > 1
      ? `* Incluye ${sinPresentar.toFixed(2)}% de las Cuentas ${listaCuentas}, todavía no presentadas.`
      : `* Incluye ${sinPresentar.toFixed(2)}% de la Cuenta ${listaCuentas}, todavía no presentada.`;

  return (
    <div
      className={`grid gap-4 ${sidebarOpen ? 'lg:grid-cols-2' : 'md:grid-cols-2'} ${sidebarOpen ? '2xl:grid-cols-4' : 'xl:grid-cols-4'}`}
    >
      {/* Monto de Contrato Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Monto de Contrato
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold truncate"
            title={formatCurrency(presupuesto)}
          >
            {formatCurrency(presupuesto)}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-xs text-muted-foreground truncate">
              Gastado: {formatCurrency(gastado)}
            </p>
            <p
              className={`text-xs font-medium shrink-0 ${porcentajeGastado > 90 ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {porcentajeGastado.toFixed(1)}%
            </p>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                porcentajeGastado > 90
                  ? 'bg-destructive'
                  : porcentajeGastado > 75
                    ? 'bg-warning'
                    : 'bg-primary'
              }`}
              style={{ width: `${Math.min(porcentajeGastado, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Avance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avance Físico</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {porcentajeAvance.toFixed(2)}%
            {sinPresentar > 0 && '*'}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {project?.avance_cuenta_numero != null
              ? `Hasta la Cuenta ${project.avance_cuenta_numero}`
              : 'Sin avance en cuentas'}
          </p>
          <div className="flex w-full overflow-hidden bg-secondary rounded-full h-2 mt-2">
            <div className="h-full bg-success" style={{ width: `${anchoPresentado}%` }} />
            {anchoSinPresentar > 0 && (
              <div className="h-full bg-success/30" style={{ width: `${anchoSinPresentar}%` }} />
            )}
          </div>
          {sinPresentar > 0 && borradores.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{notaBorrador}</p>
          )}
        </CardContent>
      </Card>

      {/* Tiempo Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tiempo</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {diasTranscurridos}/{diasTotales}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Días transcurridos
          </p>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                porcentajeTiempo > porcentajeAvance
                  ? 'bg-warning'
                  : 'bg-info'
              }`}
              style={{ width: `${Math.min(porcentajeTiempo, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Estado Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-y-2 flex-col">
            <div className="text-2xl font-bold">
              {getEstadoBadge(project?.estado)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
