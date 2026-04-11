import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import logo from '../../assets/logo.png';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import {
  Home,
  Building2,
  Info,
  Banknote,
  ClipboardList,
  Wallet,
  LayoutDashboard,
  DollarSign,
  CheckSquare,
  BookOpen,
  Users,
  Truck,
  Layers,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  User,
  FileText,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: number;
  nombre: string;
  nombre_corto?: string;
}

interface AppSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

// ---------------------------------------------------------------------------
// Menu definitions
// ---------------------------------------------------------------------------

const todosMenuItems: { label: string; icon: LucideIcon; view: string }[] = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Solicitudes de Pago', icon: Banknote, view: 'solicitudes-pago' },
  { label: 'Requisiciones', icon: ClipboardList, view: 'requisiciones' },
  { label: 'Cajas Menudas', icon: Wallet, view: 'cajas-menudas' },
];

const projectMenuItems: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { key: 'informacion', label: 'Información', icon: Info },
  { key: 'costos', label: 'Costos', icon: DollarSign },
  { key: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
  { key: 'solicitudes-pago', label: 'Solicitudes de Pago', icon: Banknote },
  { key: 'caja-menuda', label: 'Caja Menuda', icon: Wallet },
  { key: 'tareas', label: 'Tareas', icon: CheckSquare },
  { key: 'bitacora', label: 'Bitacora', icon: BookOpen },
  { key: 'miembros', label: 'Miembros', icon: Users },
  { key: 'equipos', label: 'Equipos', icon: Truck },
  { key: 'adendas', label: 'Adendas', icon: Layers },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name?: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const STORAGE_KEY = 'sidebar_selected_project';

function readPersistedProject(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistProject(id: number | null) {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  } catch {
    /* silencio */
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppSidebar({ currentView, onNavigate }: AppSidebarProps) {
  const { user, logout, hasPermission, isAdminOrCoAdmin } = useAuth();

  // Project list
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    readPersistedProject,
  );

  // Pending approval counts
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingByProject, setPendingByProject] = useState<
    Record<number, number>
  >({});

  // ── Fetch projects ──
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await api.get('/projects');
        if (res.data.success) {
          setProjectsList(res.data.proyectos ?? []);
        }
      } catch {
        /* silencio */
      }
    };
    if (user) loadProjects();
  }, [user]);

  // ── Pending approval polling ──
  useEffect(() => {
    const loadPendingCount = async () => {
      try {
        const res = await api.get('/solicitudes-pago/pending-approval-count');
        if (res.data.success) {
          setPendingApprovalCount(res.data.total);
          const byProject: Record<number, number> = {};
          for (const row of res.data.por_proyecto) {
            byProject[row.proyecto_id] = row.total;
          }
          setPendingByProject(byProject);
        }
      } catch {
        /* silencio */
      }
    };
    if (user) {
      loadPendingCount();
      const interval = setInterval(loadPendingCount, 30000);
      const handleStatusChange = () => loadPendingCount();
      window.addEventListener('solicitud-status-changed', handleStatusChange);
      return () => {
        clearInterval(interval);
        window.removeEventListener(
          'solicitud-status-changed',
          handleStatusChange,
        );
      };
    }
  }, [user]);

  // ── Sync switcher when currentView changes to project-{id}-* ──
  useEffect(() => {
    const match = currentView.match(/^project-(\d+)-/);
    if (match) {
      const id = Number(match[1]);
      if (id !== selectedProjectId) {
        setSelectedProjectId(id);
        persistProject(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // ── Handle project selection ──
  const handleSelectProject = useCallback(
    (id: number | null) => {
      setSelectedProjectId(id);
      persistProject(id);
      if (id === null) {
        onNavigate('dashboard');
      } else {
        onNavigate(`project-${id}-resumen`);
      }
    },
    [onNavigate],
  );

  // Derive selected project object
  const selectedProject = projectsList.find((p) => p.id === selectedProjectId) ?? null;

  // Derive active project subview key
  const activeProjectSubview = (() => {
    if (!selectedProjectId || !currentView.startsWith('project-')) return '';
    const parts = currentView.split('-');
    return parts.slice(2).join('-');
  })();

  // ── Pending badge helper ──
  const PendingBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;
    return (
      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white">
        {count}
      </span>
    );
  };

  // ── Determine which "Cajas Menudas" item to show in "Todos" ──
  const showCajasMenudas = hasPermission('caja_menuda');

  return (
    <Sidebar>
      {/* ── Header: Logo + Project Switcher ── */}
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-2">
          <img src={logo} alt="Pinellas" className="h-10 object-contain" />
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" isActive={selectedProjectId !== null} className="focus-visible:ring-0">
                  <span className="flex-1 truncate text-left font-semibold">
                    {selectedProject ? (selectedProject.nombre_corto || selectedProject.nombre) : 'Todos los proyectos'}
                  </span>
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem onClick={() => handleSelectProject(null)}>
                  Todos los proyectos
                </DropdownMenuItem>
                {projectsList.length > 0 && <DropdownMenuSeparator />}
                {projectsList.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                  >
                    {project.nombre_corto || project.nombre}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent>
        {/* ── Project Menu (contextual) ── */}
        {selectedProjectId === null ? (
          // "Todos los proyectos" menu
          <SidebarGroup>
            <SidebarGroupLabel>Navegacion</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {todosMenuItems
                  .filter((item) => {
                    if (item.view === 'cajas-menudas') return showCajasMenudas;
                    return true;
                  })
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.view}>
                        <SidebarMenuButton
                          isActive={currentView === item.view}
                          onClick={() => onNavigate(item.view)}
                          tooltip={item.label}
                        >
                          <Icon />
                          <span>{item.label}</span>
                          {item.view === 'solicitudes-pago' && (
                            <PendingBadge count={pendingApprovalCount} />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          // Specific project menu
          <SidebarGroup>
            <SidebarGroupLabel>Navegacion</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectMenuItems
                  .filter((item) => item.key !== 'caja-menuda' || hasPermission('caja_menuda'))
                  .map((item) => {
                  const Icon = item.icon;
                  const view = `project-${selectedProjectId}-${item.key}`;
                  const pendingCount =
                    item.key === 'solicitudes-pago'
                      ? pendingByProject[selectedProjectId] ?? 0
                      : 0;

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={activeProjectSubview === item.key}
                        onClick={() => onNavigate(view)}
                        tooltip={item.label}
                      >
                        <Icon />
                        <span>{item.label}</span>
                        {item.key === 'solicitudes-pago' && (
                          <PendingBadge count={pendingCount} />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>

      {/* ── General Section (sticky above footer) ── */}
      <div className="mt-auto border-t">
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Proyectos */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentView === 'projects'}
                  onClick={() => onNavigate('projects')}
                  tooltip="Proyectos"
                >
                  <Building2 />
                  <span>Proyectos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Clientes */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentView === 'clientes'}
                  onClick={() => onNavigate('clientes')}
                  tooltip="Clientes"
                >
                  <Users />
                  <span>Clientes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Equipos */}
              {hasPermission('equipos_ver') && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentView.startsWith('equipos')}
                    onClick={() => onNavigate('equipos')}
                    tooltip="Equipos"
                  >
                    <Truck />
                    <span>Equipos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Documentos */}
              {hasPermission('documentos_acceso') && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentView === 'documentos' || currentView.startsWith('doc-')}
                    onClick={() => onNavigate('documentos')}
                    tooltip="Documentos"
                  >
                    <FileText />
                    <span>Documentos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Administracion */}
              {isAdminOrCoAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentView === 'usuarios' || currentView === 'permisos'}
                    onClick={() => onNavigate('usuarios')}
                    tooltip="Administracion"
                  >
                    <UserCog />
                    <span>Administracion</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </div>

      {/* ── Footer: User Profile ── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(user?.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.nombre ?? 'Usuario'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? ''}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-popper-anchor-width]"
                side="top"
              >
                <DropdownMenuItem onClick={() => onNavigate('mi-cuenta')}>
                  <User className="mr-2 h-4 w-4" />
                  Mi Cuenta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
