/**
 * ProjectTimeline Component
 * Displays project timeline with key dates
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Flag, Clock } from "lucide-react"

const formatDate = (dateString) => {
  if (!dateString) return 'No definida'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

const calculateDaysRemaining = (fechaFin) => {
  if (!fechaFin) return null
  const hoy = new Date()
  const fin = new Date(fechaFin)
  const diff = fin - hoy
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return dias
}

export default function ProjectTimeline({ project }) {
  const diasRestantes = calculateDaysRemaining(project?.fecha_fin_estimada)

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
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Fecha de Inicio</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(project?.fecha_inicio)}
              </p>
            </div>
          </div>

          {/* Vertical line */}
          <div className="ml-1 h-6 w-0.5 bg-border" />

          {/* Hoy */}
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Hoy</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(new Date().toISOString())}
              </p>
              {diasRestantes !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {diasRestantes > 0
                    ? `${diasRestantes} días restantes`
                    : diasRestantes === 0
                    ? 'Finaliza hoy'
                    : `${Math.abs(diasRestantes)} días de retraso`
                  }
                </p>
              )}
            </div>
          </div>

          {/* Vertical line */}
          <div className="ml-1 h-6 w-0.5 bg-border" />

          {/* Fecha de Fin Estimada */}
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Flag className={`h-4 w-4 ${
                diasRestantes !== null && diasRestantes < 0
                  ? 'text-red-500'
                  : 'text-orange-500'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Fecha de Fin Estimada</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(project?.fecha_fin_estimada)}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {project?.fecha_inicio && project?.fecha_fin_estimada && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Progreso temporal</span>
              <span className="text-xs font-medium">
                {(() => {
                  const inicio = new Date(project.fecha_inicio)
                  const fin = new Date(project.fecha_fin_estimada)
                  const hoy = new Date()
                  const total = fin - inicio
                  const transcurrido = hoy - inicio
                  const porcentaje = Math.max(0, Math.min(100, (transcurrido / total) * 100))
                  return `${porcentaje.toFixed(0)}%`
                })()}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${(() => {
                    const inicio = new Date(project.fecha_inicio)
                    const fin = new Date(project.fecha_fin_estimada)
                    const hoy = new Date()
                    const total = fin - inicio
                    const transcurrido = hoy - inicio
                    return Math.max(0, Math.min(100, (transcurrido / total) * 100))
                  })()}%`
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
