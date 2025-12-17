/**
 * ProjectSubMenu Component
 * Contextual navigation menu for project pages
 * Shows icon + text for active item, icons only for the rest
 */

import {
  LayoutDashboard,
  DollarSign,
  ClipboardList,
  CheckSquare,
  TrendingUp,
  Truck,
  FileText,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const MENU_ITEMS = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { key: 'costos', label: 'Costos', icon: DollarSign },
  { key: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
  { key: 'tareas', label: 'Tareas', icon: CheckSquare },
  { key: 'avance', label: 'Avance', icon: TrendingUp },
  { key: 'equipos', label: 'Equipos', icon: Truck },
  { key: 'adendas', label: 'Adendas', icon: FileText },
  { key: 'configuracion', label: 'Miembros', icon: Users },
]

export default function ProjectSubMenu({ projectId, currentSubview, onNavigate }) {
  return (
    <div className="border-b bg-muted/20">
      <nav className="flex items-center px-4 gap-1">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = currentSubview === item.key

          return (
            <Button
              key={item.key}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className={`
                flex items-center gap-2 rounded-none border-b-2 px-3 py-5
                ${isActive
                  ? 'border-primary'
                  : 'border-transparent hover:border-muted-foreground/20'
                }
              `}
              onClick={() => onNavigate(`project-${projectId}-${item.key}`)}
              title={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {isActive && <span className="whitespace-nowrap">{item.label}</span>}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
