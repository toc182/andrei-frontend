/**
 * Layout Principal de la Aplicación
 *
 * Uses shadcn SidebarProvider + AppSidebar for all navigation.
 * Topbar contains sidebar trigger, page title, and user dropdown.
 */

import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { getInitials } from '../../utils/formatters';

interface AppLayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  pageTitle?: string;
}

const viewTitles: Record<string, string> = {
  dashboard: 'Pinellas - Dashboard',
  projects: 'Pinellas - Proyectos',
  clientes: 'Pinellas - Clientes',
  requisiciones: 'Pinellas - Requisiciones',
  'solicitudes-pago': 'Pinellas - Solicitudes de Pago',
  'cajas-menudas': 'Pinellas - Cajas Menudas',
  equipos: 'Pinellas - Equipos',
  'equipos-informacion': 'Pinellas - Equipos',
  'equipos-status': 'Pinellas - Equipos',
  'equipos-asignaciones': 'Pinellas - Equipos',
  documentos: 'Pinellas - Documentos',
  usuarios: 'Pinellas - Administración',
  permisos: 'Pinellas - Administración',
  'mi-cuenta': 'Pinellas - Mi Cuenta',
};

function getViewTitle(currentView: string, pageTitle?: string): string {
  if (pageTitle) return pageTitle;
  if (currentView.startsWith('doc-')) return 'Pinellas - Documentos';
  return viewTitles[currentView] || 'Pinellas';
}

export function AppLayout({
  children,
  currentView,
  onNavigate,
  pageTitle,
}: AppLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onNavigate={onNavigate} />
      <SidebarInset>
        {/* Topbar */}
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
          <SidebarTrigger />
          <div className="flex-1">
            <h2 className="text-lg font-semibold truncate">
              {getViewTitle(currentView, pageTitle)}
            </h2>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
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
                  <p className="text-sm font-medium leading-none">
                    {user?.nombre}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNavigate('mi-cuenta')}>
                <User className="mr-2 h-4 w-4" />
                <span>Mi Cuenta</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background px-8 pt-6 pb-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
