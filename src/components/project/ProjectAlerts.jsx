/**
 * ProjectAlerts Component
 * Displays active alerts for the project
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, AlertCircle, Info, Bell } from "lucide-react"

// Placeholder alerts - will come from backend in Phase 2
export default function ProjectAlerts({ project }) {
  const alerts = project?.datos_adicionales?.alerts || []

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getAlertVariant = (severity) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'default'
      default:
        return 'default'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alertas Activas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No hay alertas activas</p>
            <p className="text-xs mt-1">
              El sistema de alertas automáticas se implementará en la Fase 2
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <Alert key={index} variant={getAlertVariant(alert.severity)}>
                {getAlertIcon(alert.severity)}
                <AlertDescription className="ml-2">
                  {alert.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
