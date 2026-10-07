/**
 * ProjectTimeline Component
 * Displays project timeline with key dates
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Flag, Clock } from 'lucide-react';
import { fechaLocal } from '@/utils/dateUtils';
import type { Project } from '@/types';

const formatDate = (date: Date | null) => {
  if (!date) return 'No definida';
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

interface ProjectTimelineProps {
  project: Project | null;
}

export default function ProjectTimeline({ project }: ProjectTimelineProps) {
  const inicio = project?.fecha_inicio ? fechaLocal(project.fecha_inicio) : null;
  // La terminación vigente: la de la última adenda aprobada que la cambió.
  const finVigente = project?.fecha_fin_vigente ?? project?.fecha_fin_estimada;
  const fin = finVigente ? fechaLocal(finVigente) : null;
  const finOriginal = project?.fecha_fin_estimada ? fechaLocal(project.fecha_fin_estimada) : null;
  const porAdenda = project?.adenda_fecha_numero != null;
  const hoy = new Date();

  const diasRestantes = fin ? Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const porcentaje =
    inicio && fin
      ? Math.max(0, Math.min(100, ((hoy.getTime() - inicio.getTime()) / (fin.getTime() - inicio.getTime())) * 100))
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Timeline del Proyecto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Fecha de Inicio */}
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <div className="h-2 w-2 rounded-full bg-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Fecha de Inicio</p>
              <p className="text-sm text-muted-foreground">{formatDate(inicio)}</p>
            </div>
          </div>

          {/* Vertical line */}
          <div className="ml-1 h-6 w-0.5 bg-border" />

          {/* Hoy */}
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Clock className="h-4 w-4 text-info" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Hoy</p>
              <p className="text-sm text-muted-foreground">{formatDate(hoy)}</p>
              {diasRestantes !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {diasRestantes > 0
                    ? `${diasRestantes} días restantes`
                    : diasRestantes === 0
                      ? 'Finaliza hoy'
                      : `${Math.abs(diasRestantes)} días de retraso`}
                </p>
              )}
            </div>
          </div>

          {/* Vertical line */}
          <div className="ml-1 h-6 w-0.5 bg-border" />

          {/* Fecha de Fin Estimada */}
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Flag
                className={`h-4 w-4 ${
                  diasRestantes !== null && diasRestantes < 0
                    ? 'text-error'
                    : 'text-warning'
                }`}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Fecha de Fin Estimada</p>
              <p className="text-sm text-muted-foreground">{formatDate(fin)}</p>
              {porAdenda && finOriginal && (
                <p className="text-xs text-muted-foreground mt-1">
                  Original: {formatDate(finOriginal)} · Adenda #{project?.adenda_fecha_numero}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {porcentaje !== null && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Progreso temporal
              </span>
              <span className="text-xs font-medium">{porcentaje.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-info h-2 rounded-full" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
