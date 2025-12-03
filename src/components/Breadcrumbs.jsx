/**
 * Breadcrumbs Component
 * Displays navigation breadcrumbs (migas de pan)
 * Responsive: Dropdown en móvil, breadcrumbs normales en desktop
 */

import { ChevronRight, Home, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function Breadcrumbs({ items, onNavigate }) {
  if (!items || items.length === 0) return null

  const currentPage = items[items.length - 1]

  return (
    <nav className="py-3 px-6 border-b">
      {/* Mobile: Dropdown Menu */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-auto p-1">
              <Home className="h-4 w-4 mr-2" />
              <span className="font-medium truncate max-w-[200px]">
                {currentPage.label}
              </span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {items.slice(0, -1).map((item, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() => onNavigate(item.view)}
                className="cursor-pointer"
              >
                {index === 0 && <Home className="h-4 w-4 mr-2" />}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: Normal Breadcrumbs */}
      <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            {index > 0 && <ChevronRight className="h-4 w-4" />}

            {index === items.length - 1 ? (
              // Current page - not clickable
              <span className="font-medium text-foreground">
                {item.label}
              </span>
            ) : (
              // Clickable breadcrumb
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 hover:text-foreground"
                onClick={() => onNavigate(item.view)}
              >
                {index === 0 && <Home className="h-4 w-4 mr-1" />}
                {item.label}
              </Button>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
