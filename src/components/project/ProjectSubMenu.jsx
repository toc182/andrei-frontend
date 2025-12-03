/**
 * ProjectSubMenu Component
 * Contextual navigation menu for project pages
 * Features adaptive overflow menu with "+" button
 */

import { useState, useEffect, useRef } from "react"
import {
  LayoutDashboard,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Truck,
  FileText,
  Settings,
  MoreHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const MENU_ITEMS = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { key: 'costos', label: 'Costos', icon: DollarSign },
  { key: 'compras', label: 'Compras', icon: ShoppingCart },
  { key: 'avance', label: 'Avance Físico', icon: TrendingUp },
  { key: 'equipos', label: 'Equipos', icon: Truck },
  { key: 'adendas', label: 'Adendas', icon: FileText },
  { key: 'configuracion', label: 'Configuración', icon: Settings },
]

export default function ProjectSubMenu({ projectId, currentSubview, onNavigate }) {
  const containerRef = useRef(null)
  const itemRefs = useRef([])
  const [visibleCount, setVisibleCount] = useState(MENU_ITEMS.length)

  useEffect(() => {
    const calculateVisibleItems = () => {
      if (!containerRef.current) return

      const container = containerRef.current
      const containerWidth = container.offsetWidth
      const padding = 48 // px-6 = 24px each side
      const spacing = 4 // space-x-1 = 4px between items
      const moreButtonWidth = 60 // Approximate width of "..." button
      const availableWidth = containerWidth - padding

      // Get real widths of each button
      const buttonWidths = itemRefs.current.map(ref => {
        if (!ref) return 0
        return ref.getBoundingClientRect().width
      })

      // Calculate how many items can fit
      let totalWidth = 0
      let maxVisible = 0

      for (let i = 0; i < buttonWidths.length; i++) {
        const buttonWidth = buttonWidths[i] || 0
        const newTotalWidth = totalWidth + buttonWidth + (i > 0 ? spacing : 0)

        // Check if we need the "..." button
        const needsMoreButton = i < buttonWidths.length - 1
        const widthWithMoreButton = newTotalWidth + (needsMoreButton ? spacing + moreButtonWidth : 0)

        if (widthWithMoreButton <= availableWidth) {
          totalWidth = newTotalWidth
          maxVisible = i + 1
        } else {
          break
        }
      }

      // Ensure at least 1 item is visible and active item is always visible
      const activeIndex = MENU_ITEMS.findIndex(item => item.key === currentSubview)
      if (activeIndex !== -1 && activeIndex >= maxVisible) {
        // Force active item to be visible by showing up to active item + 1
        maxVisible = Math.max(activeIndex + 1, 1)
      }

      setVisibleCount(Math.max(1, Math.min(maxVisible, MENU_ITEMS.length)))
    }

    // Initial calculation with a small delay to ensure buttons are rendered
    const timer = setTimeout(calculateVisibleItems, 50)

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(calculateVisibleItems, 50)
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [currentSubview])

  const visibleItems = MENU_ITEMS.slice(0, visibleCount)
  const overflowItems = MENU_ITEMS.slice(visibleCount)

  const renderMenuItem = (item, index, inDropdown = false) => {
    const Icon = item.icon
    const isActive = currentSubview === item.key

    if (inDropdown) {
      return (
        <DropdownMenuItem
          key={item.key}
          onClick={() => onNavigate(`project-${projectId}-${item.key}`)}
          className={`flex items-center gap-2 cursor-pointer ${
            isActive ? 'bg-accent' : ''
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </DropdownMenuItem>
      )
    }

    return (
      <Button
        key={item.key}
        ref={(el) => (itemRefs.current[index] = el)}
        variant={isActive ? "default" : "ghost"}
        size="sm"
        className={`
          flex items-center gap-2 rounded-none border-b-2 px-4 py-5 shrink-0
          ${isActive
            ? 'border-primary'
            : 'border-transparent hover:border-muted-foreground/20'
          }
        `}
        onClick={() => onNavigate(`project-${projectId}-${item.key}`)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">{item.label}</span>
      </Button>
    )
  }

  return (
    <div className="border-b bg-muted/20 overflow-x-hidden">
      <nav ref={containerRef} className="flex space-x-1 px-6">
        {/* Render all items invisibly first to measure them */}
        <div className="absolute opacity-0 pointer-events-none flex space-x-1">
          {MENU_ITEMS.map((item, index) => renderMenuItem(item, index))}
        </div>

        {/* Render visible items */}
        {visibleItems.map((item, index) => renderMenuItem(item, index))}

        {overflowItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 rounded-none border-b-2 px-4 py-5 shrink-0 border-transparent hover:border-muted-foreground/20"
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowItems.map((item, index) => renderMenuItem(item, visibleCount + index, true))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </div>
  )
}
