/**
 * QuickActions Component
 * Quick action buttons for common project tasks
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, ShoppingCart, TrendingUp, Truck, FileText, Settings } from "lucide-react"
import { useSidebar } from "../layout/AppLayout"

export default function QuickActions({ projectId, onNavigate }) {
  const { sidebarOpen } = useSidebar()
  const actions = [
    {
      key: 'costos',
      label: 'Ver Costos',
      description: 'Control de presupuesto y gastos',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      key: 'compras',
      label: 'Gestión de Compras',
      description: 'Solicitudes y órdenes de compra',
      icon: ShoppingCart,
      color: 'text-blue-600'
    },
    {
      key: 'avance',
      label: 'Reportar Avance',
      description: 'Seguimiento de avance físico',
      icon: TrendingUp,
      color: 'text-purple-600'
    },
    {
      key: 'equipos',
      label: 'Ver Equipos',
      description: 'Equipos asignados al proyecto',
      icon: Truck,
      color: 'text-orange-600'
    },
    {
      key: 'documentos',
      label: 'Documentos',
      description: 'Generar y ver documentos',
      icon: FileText,
      color: 'text-indigo-600'
    },
    {
      key: 'configuracion',
      label: 'Configuración',
      description: 'Ajustes del proyecto',
      icon: Settings,
      color: 'text-gray-600'
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${sidebarOpen ? '2xl:grid-cols-3' : 'lg:grid-cols-3'} gap-3`}>
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.key}
                variant="outline"
                className="h-auto flex-col items-start p-4 hover:bg-accent w-full overflow-hidden"
                onClick={() => onNavigate(`project-${projectId}-${action.key}`)}
              >
                <div className="flex items-center gap-2 mb-2 w-full">
                  <Icon className={`h-5 w-5 shrink-0 ${action.color}`} />
                  <span className="font-semibold text-sm text-left truncate">{action.label}</span>
                </div>
                <p className="text-xs text-muted-foreground text-left w-full line-clamp-2" title={action.description}>
                  {action.description}
                </p>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
