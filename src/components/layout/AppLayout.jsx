/**
 * Layout Principal de la Aplicación - Shadcn/ui + Tailwind
 *
 * Incluye:
 * - Sidebar colapsable con navegación
 * - Topbar con usuario y logout
 * - Responsive (Sheet para mobile)
 * - Submenús colapsables
 */

import { useState, useEffect, createContext, useContext } from "react"
import { useAuth } from "../../context/AuthContext"

// Create SidebarContext
const SidebarContext = createContext({ sidebarOpen: true })

// Custom hook to use sidebar context
export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarContext.Provider')
  }
  return context
}
import logo from "../../assets/logo.png"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Home,
  Building2,
  Users,
  Truck,
  FileText,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
  User
} from "lucide-react"

export function AppLayout({ children, currentView, onNavigate, pageTitle }) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({})

  // Close mobile sheet when screen becomes desktop size
  useEffect(() => {
    const handleResize = () => {
      // md breakpoint is 768px
      if (window.innerWidth >= 768 && mobileSheetOpen) {
        setMobileSheetOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileSheetOpen])

  // Configuración del menú
  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Home,
      view: "dashboard"
    },
    {
      id: "proyectos",
      label: "Proyectos",
      icon: Building2,
      view: "projects",
      submenu: [
        { id: "projects", label: "Proyectos", view: "projects" },
        { id: "licitaciones", label: "Licitaciones", view: "projects-licitaciones" },
        { id: "oportunidades", label: "Oportunidades", view: "projects-oportunidades" }
      ]
    },
    {
      id: "clientes",
      label: "Clientes",
      icon: Users,
      view: "clientes"
    },
    {
      id: "equipos",
      label: "Equipos",
      icon: Truck,
      view: "equipos",
      submenu: [
        { id: "equipos-info", label: "Información de Equipos", view: "equipos-informacion" },
        { id: "equipos-status", label: "Status de Equipos", view: "equipos-status" },
        { id: "equipos-asig", label: "Asignaciones", view: "equipos-asignaciones" }
      ]
    },
    {
      id: "documentos",
      label: "Documentos",
      icon: FileText,
      view: "documentos",
      submenu: [
        { id: "doc-hub", label: "Ver Todos", view: "documentos" },
        { id: "doc-consorcio", label: "Acuerdo Consorcio", view: "doc-acuerdo-consorcio" },
        { id: "doc-adhesion", label: "Carta Adhesión", view: "doc-carta-adhesion" },
        { id: "doc-retorsion", label: "Medidas Retorsión", view: "doc-medidas-retorsion" },
        { id: "doc-incapacidad", label: "No Incapacidad", view: "doc-no-incapacidad" },
        { id: "doc-integridad", label: "Pacto Integridad", view: "doc-pacto-integridad" }
      ]
    }
  ]

  const toggleSubmenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }))
  }

  const handleNavigation = (view) => {
    onNavigate(view)
    // Auto-close mobile sidebar
    if (window.innerWidth < 768) {
      // En mobile usamos Sheet, no necesitamos cerrar manualmente
    }
  }

  const isActive = (item) => {
    if (item.submenu) {
      return item.submenu.some(sub => sub.view === currentView) || item.view === currentView
    }
    return item.view === currentView
  }

  const getInitials = (name) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Componente de navegación (reutilizable para desktop y mobile)
  const Navigation = ({ onItemClick }) => (
    <ScrollArea className="flex-1 px-3">
      <div className="space-y-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          const hasSubmenu = item.submenu && item.submenu.length > 0
          const expanded = expandedMenus[item.id]

          return (
            <div key={item.id}>
              <Button
                variant={active ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  if (hasSubmenu) {
                    toggleSubmenu(item.id)
                    handleNavigation(item.view)
                  } else {
                    handleNavigation(item.view)
                    onItemClick?.()
                  }
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {hasSubmenu && (
                  expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              {hasSubmenu && expanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.submenu.map((subItem) => (
                    <Button
                      key={subItem.id}
                      variant={currentView === subItem.view ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        handleNavigation(subItem.view)
                        onItemClick?.()
                      }}
                    >
                      {subItem.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex flex-col border-r bg-background transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
      >
        {sidebarOpen && (
          <>
            {/* Logo */}
            <div className="flex h-16 items-center justify-center border-b px-6">
              <img src={logo} alt="Pinellas" className="h-10 object-contain" />
            </div>

            {/* Navigation */}
            <Navigation />
          </>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
          {/* Desktop Sidebar Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobile Menu */}
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
              <div className="flex h-16 items-center justify-center border-b px-6">
                <img src={logo} alt="Pinellas" className="h-10 object-contain" />
              </div>
              <Navigation onItemClick={() => setMobileSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold truncate">
              {pageTitle || menuItems.find(item =>
                item.view === currentView ||
                item.submenu?.some(sub => sub.view === currentView)
              )?.label || "Dashboard"}
            </h2>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(user?.nombre)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.nombre}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-muted/10 p-6">
          <SidebarContext.Provider value={{ sidebarOpen }}>
            {children}
          </SidebarContext.Provider>
        </main>
      </div>
    </div>
  )
}
