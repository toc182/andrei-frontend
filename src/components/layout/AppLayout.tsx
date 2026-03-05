/* eslint-disable react-refresh/only-export-components */
/**
 * Layout Principal de la Aplicación - Shadcn/ui + Tailwind
 *
 * Sidebar contextual:
 * - General: Dashboard, Proyectos, Oportunidades, Clientes, etc.
 * - Proyecto: se transforma mostrando subvistas del proyecto
 */

import { useState, useEffect, createContext, useContext, ReactNode } from "react"
import { useAuth } from "../../context/AuthContext"
import { LucideIcon } from "lucide-react"

interface SidebarContextType {
  sidebarOpen: boolean
}

// Create SidebarContext
const SidebarContext = createContext<SidebarContextType>({ sidebarOpen: true })

// Custom hook to use sidebar context
export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarContext.Provider')
  }
  return context
}

import logo from "../../assets/logo.png"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import api from "../../services/api"
import {
  Home,
  Building2,
  Target,
  Users,
  Truck,
  FileText,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
  User,
  ClipboardList,
  Banknote,
  UserCog,
  ArrowLeft,
  Info,
  LayoutDashboard,
  DollarSign,
  CheckSquare,
  BookOpen,
  Layers,
} from "lucide-react"

interface SubMenuItem {
  id: string
  label: string
  view: string
}

interface MenuItem {
  id: string
  label: string
  icon: LucideIcon
  view: string
  submenu?: SubMenuItem[]
}

interface ProjectContext {
  id: number
  name: string
}

interface AppLayoutProps {
  children: ReactNode
  currentView: string
  onNavigate: (view: string) => void
  pageTitle?: string
  projectContext?: ProjectContext | null
  onShowProjectInfo?: () => void
}

interface NavigationProps {
  onItemClick?: () => void
}

export function AppLayout({ children, currentView, onNavigate, pageTitle, projectContext, onShowProjectInfo }: AppLayoutProps) {
  const { user, logout, hasPermission, isAdminOrCoAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [pendingByProject, setPendingByProject] = useState<Record<number, number>>({})

  // Close mobile sheet when screen becomes desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileSheetOpen) {
        setMobileSheetOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileSheetOpen])

  useEffect(() => {
    const loadPendingCount = async () => {
      try {
        const res = await api.get('/solicitudes-pago/pending-approval-count')
        if (res.data.success) {
          setPendingApprovalCount(res.data.total)
          const byProject: Record<number, number> = {}
          for (const row of res.data.por_proyecto) {
            byProject[row.proyecto_id] = row.total
          }
          setPendingByProject(byProject)
        }
      } catch { /* silencio */ }
    }
    if (user) {
      loadPendingCount()
      const interval = setInterval(loadPendingCount, 30000)
      const handleStatusChange = () => loadPendingCount()
      window.addEventListener('solicitud-status-changed', handleStatusChange)
      return () => {
        clearInterval(interval)
        window.removeEventListener('solicitud-status-changed', handleStatusChange)
      }
    }
  }, [user, currentView])

  // ── General menu items ──
  const generalMenuItems: MenuItem[] = [
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
      view: "projects"
    },
    // Oportunidades oculto temporalmente
    // ...(hasPermission('oportunidades_ver') ? [{
    //   id: "oportunidades",
    //   label: "Oportunidades",
    //   icon: Target as LucideIcon,
    //   view: "oportunidades"
    // }] : []),
    {
      id: "clientes",
      label: "Clientes",
      icon: Users,
      view: "clientes"
    },
    {
      id: "requisiciones",
      label: "Requisiciones",
      icon: ClipboardList,
      view: "requisiciones"
    },
    {
      id: "solicitudes-pago",
      label: "Solicitudes de Pago",
      icon: Banknote,
      view: "solicitudes-pago"
    },
    ...(hasPermission('equipos_ver') ? [{
      id: "equipos",
      label: "Equipos",
      icon: Truck as LucideIcon,
      view: "equipos",
      submenu: [
        { id: "equipos-info", label: "Información de Equipos", view: "equipos-informacion" },
        { id: "equipos-status", label: "Status de Equipos", view: "equipos-status" },
        { id: "equipos-asig", label: "Asignaciones", view: "equipos-asignaciones" }
      ]
    }] : []),
    ...(hasPermission('documentos_acceso') ? [{
      id: "documentos",
      label: "Documentos",
      icon: FileText as LucideIcon,
      view: "documentos",
      submenu: [
        { id: "doc-hub", label: "Ver Todos", view: "documentos" },
        { id: "doc-consorcio", label: "Acuerdo Consorcio", view: "doc-acuerdo-consorcio" },
        { id: "doc-adhesion", label: "Carta Adhesión", view: "doc-carta-adhesion" },
        { id: "doc-retorsion", label: "Medidas Retorsión", view: "doc-medidas-retorsion" },
        { id: "doc-incapacidad", label: "No Incapacidad", view: "doc-no-incapacidad" },
        { id: "doc-integridad", label: "Pacto Integridad", view: "doc-pacto-integridad" }
      ]
    }] : []),
    ...(isAdminOrCoAdmin ? [{
      id: "administracion",
      label: "Administración",
      icon: UserCog as LucideIcon,
      view: "usuarios",
      submenu: [
        { id: "admin-usuarios", label: "Usuarios", view: "usuarios" },
        { id: "admin-permisos", label: "Permisos", view: "permisos" }
      ]
    }] : [])
  ]

  // ── Project submenu items ──
  const projectMenuItems: { key: string; label: string; icon: LucideIcon }[] = [
    { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { key: 'costos', label: 'Costos', icon: DollarSign },
    { key: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
    { key: 'solicitudes-pago', label: 'Solicitudes de Pago', icon: Banknote },
    { key: 'tareas', label: 'Tareas', icon: CheckSquare },
    { key: 'bitacora', label: 'Bitácora', icon: BookOpen },
    { key: 'miembros', label: 'Miembros', icon: Users },
    { key: 'equipos', label: 'Equipos', icon: Truck },
    { key: 'adendas', label: 'Adendas', icon: Layers },
  ]

  const toggleSubmenu = (menuId: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }))
  }

  const handleNavigation = (view: string, closeSheet?: boolean) => {
    onNavigate(view)
    if (closeSheet) {
      setMobileSheetOpen(false)
    }
  }

  const isGeneralActive = (item: MenuItem): boolean => {
    if (item.submenu) {
      return item.submenu.some(sub => sub.view === currentView) || item.view === currentView
    }
    return item.view === currentView
  }

  // Get active project subview from currentView
  const getActiveProjectSubview = (): string => {
    if (!projectContext || !currentView.startsWith('project-')) return ''
    const parts = currentView.split('-')
    return parts.slice(2).join('-')
  }

  const getInitials = (name?: string): string => {
    if (!name) return "U"
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // ── General Navigation (no project context) ──
  const GeneralNavigation = ({ onItemClick }: NavigationProps) => (
    <ScrollArea className="flex-1 px-3">
      <div className="space-y-1 py-4">
        {generalMenuItems.map((item) => {
          const Icon = item.icon
          const active = isGeneralActive(item)
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
                {item.id === 'solicitudes-pago' && pendingApprovalCount > 0 && (
                  <span className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-semibold bg-red-500 text-white rounded-full flex items-center justify-center leading-none pb-px">
                    {pendingApprovalCount}
                  </span>
                )}
                {hasSubmenu && (
                  expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              {hasSubmenu && expanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.submenu?.map((subItem) => (
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

  // ── Project Navigation (inside a project) ──
  // Three visual zones: general nav (white), project title (strong), subviews (tinted)
  const ProjectNavigation = ({ onItemClick }: NavigationProps) => {
    const activeSubview = getActiveProjectSubview()

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Zone 1: Back buttons — white/clear background */}
        <div className="px-3 py-3 space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              handleNavigation("dashboard")
              onItemClick?.()
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              handleNavigation("projects")
              onItemClick?.()
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Proyectos
          </Button>
        </div>

        {/* Zone 2: Project name — strong primary background */}
        <div className="bg-primary px-4 py-3 flex items-center gap-2">
          <span className="flex-1 text-sm font-semibold truncate text-primary-foreground">
            {projectContext?.name || 'Proyecto'}
          </span>
          {onShowProjectInfo && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                onShowProjectInfo()
                onItemClick?.()
              }}
              title="Ver información del proyecto"
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Zone 3: Project subviews — tinted background */}
        <ScrollArea className="flex-1 bg-primary/10">
          <div className="px-3 py-3 space-y-1">
            {projectMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSubview === item.key

              return (
                <Button
                  key={item.key}
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    handleNavigation(`project-${projectContext!.id}-${item.key}`)
                    onItemClick?.()
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === 'solicitudes-pago' && projectContext && pendingByProject[projectContext.id] > 0 && (
                    <span className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-semibold bg-red-500 text-white rounded-full flex items-center justify-center leading-none pb-px">
                      {pendingByProject[projectContext.id]}
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // Choose which navigation to render based on context
  const Navigation = ({ onItemClick }: NavigationProps) => {
    if (projectContext) {
      return <ProjectNavigation onItemClick={onItemClick} />
    }
    return <GeneralNavigation onItemClick={onItemClick} />
  }

  // Compute topbar title
  const getTopbarTitle = (): string => {
    if (pageTitle) return pageTitle
    if (projectContext) return projectContext.name
    const found = generalMenuItems.find(item =>
      item.view === currentView ||
      item.submenu?.some(sub => sub.view === currentView)
    )
    return found?.label || "Dashboard"
  }

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
              {getTopbarTitle()}
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
