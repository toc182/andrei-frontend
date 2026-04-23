/**
 * ProjectKPIsCards Component
 * Displays 4 key performance indicator cards for a project
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';
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

  // Calculate budget metrics
  const presupuesto = project?.monto_total || project?.presupuesto_base || 0;
  const gastado =
    (project?.datos_adicionales as { total_gastado?: number })?.total_gastado ||
    0;
  const disponible = presupuesto - gastado;
  const porcentajeGastado = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;

  // Calculate time metrics
  const fechaInicio = project?.fecha_inicio
    ? new Date(project.fecha_inicio)
    : null;
  const fechaFin = project?.fecha_fin_estimada
    ? new Date(project.fecha_fin_estimada)
    : null;
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

  // Get progress percentage
  const porcentajeAvance =
    (project?.datos_adicionales as { porcentaje_avance?: number })
      ?.porcentaje_avance || 0;

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
          <div className="text-2xl font-bold">
            {porcentajeAvance.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Progreso del proyecto
          </p>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div
              className="bg-success h-2 rounded-full"
              style={{ width: `${Math.min(porcentajeAvance, 100)}%` }}
            />
          </div>
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
            <p className="text-xs text-muted-foreground text-center truncate max-w-full">
              {project?.codigo_proyecto || 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
