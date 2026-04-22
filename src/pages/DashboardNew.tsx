/**
 * Dashboard Nuevo - Usando AppLayout con Shadcn
 * Router central de la aplicación con sidebar contextual
 */

import { useState, useEffect, ReactNode } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { AppErrorBoundary } from '@/components/shell/AppErrorBoundary';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatCard } from '@/components/shell/StatCard';
import { Alert } from '@/components/shell/Alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Truck, TrendingUp } from 'lucide-react';
import ProjectsList from '../components/ProjectsList';
import ClientesN from './ClientesN';
import DocumentosPage from './DocumentosPage';
import EquiposPage from './EquiposPage';
import ProjectDetailLayout from './project/ProjectDetailLayout';
import RequisicionesGeneral from './RequisicionesGeneral';
import AdministracionPage from './AdministracionPage';
import SolicitudesPagoGeneral from './SolicitudesPagoGeneral';
import MiCuentaPage from './MiCuentaPage';
import CajasMenudasPage from './CajasMenudasPage';
import CuentasGeneralPage from './cuentas/CuentasGeneralPage';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface DashboardStats {
  proyectos: {
    proyectos_activos?: number;
    proyectos_planificacion?: number;
  } | null;
  clientes: {
    total_clientes?: number;
  } | null;
  equipos: {
    total?: number;
  } | null;
}

interface ProjectContext {
  id: number;
  name: string;
}

export default function DashboardNew() {
  const { isAdminOrCoAdmin } = useAuth();
  const [currentView, _setCurrentView] = useState('dashboard');
  const [navKey, setNavKey] = useState(0);
  const setCurrentView = (view: string) => {
    _setCurrentView(view);
    setNavKey((k) => k + 1);
  };
  const [stats, setStats] = useState<DashboardStats>({
    proyectos: null,
    clientes: null,
    equipos: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(
    null,
  );
  const [showProjectInfo, setShowProjectInfo] = useState(false);

  // Clear project context and pageTitle when leaving project views
  useEffect(() => {
    if (!currentView.startsWith('project-')) {
      setPageTitle(null);
      setProjectContext(null);
      setShowProjectInfo(false);
    }
  }, [currentView]);

  // Cargar estadísticas del dashboard
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const [proyectosRes, clientesRes, equiposRes] =
          await Promise.allSettled([
            api.get('/projects/stats/dashboard'),
            api.get('/clientes/stats/dashboard'),
            api.get('/equipos/'),
          ]);

        setStats({
          proyectos:
            proyectosRes.status === 'fulfilled'
              ? proyectosRes.value.data.stats
              : { proyectos_activos: 0, proyectos_planificacion: 0 },
          clientes:
            clientesRes.status === 'fulfilled'
              ? clientesRes.value.data.data
              : { total_clientes: 0 },
          equipos:
            equiposRes.status === 'fulfilled'
              ? {
                  total:
                    equiposRes.value.data.total ||
                    equiposRes.value.data.data?.length ||
                    0,
                }
              : { total: 0 },
        });
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
        setError('Error al cargar las estadísticas del dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (currentView === 'dashboard') {
      fetchStats();
    }
  }, [currentView]);

  const renderContent = (): ReactNode => {
    // Check if it's a project view (pattern: project-{id}-{subview})
    if (currentView.startsWith('project-')) {
      const parts = currentView.split('-');
      if (parts.length >= 3) {
        const projectId = parseInt(parts[1], 10);
        const subview = parts.slice(2).join('-');
        return (
          <ProjectDetailLayout
            projectId={projectId}
            subview={subview}
            navKey={navKey}
            onNavigate={setCurrentView}
            onTitleChange={setPageTitle}
            onProjectLoad={(ctx) => setProjectContext(ctx)}
            showInfo={showProjectInfo}
            onCloseInfo={() => setShowProjectInfo(false)}
          />
        );
      }
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <PageHeader
              title="Panel de Control"
              subtitle="Bienvenido al sistema Andrei - Gestión de Proyectos"
            />

            {error && (
              <Alert variant="error" title={error} />
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Proyectos Activos"
                value={loading ? '—' : String(stats.proyectos?.proyectos_activos || 0)}
                icon={Building2}
                accent="navy"
                onClick={() => setCurrentView('projects')}
              />
              <StatCard
                label="En Planificación"
                value={loading ? '—' : String(stats.proyectos?.proyectos_planificacion || 0)}
                icon={TrendingUp}
                accent="teal"
                onClick={() => setCurrentView('projects')}
              />
              <StatCard
                label="Total Clientes"
                value={loading ? '—' : String(stats.clientes?.total_clientes || 0)}
                icon={Users}
                accent="info"
                onClick={() => setCurrentView('clientes')}
              />
              <StatCard
                label="Equipos"
                value={loading ? '—' : String(stats.equipos?.total || 0)}
                icon={Truck}
                accent="warning"
                onClick={() => setCurrentView('equipos')}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Proyectos</CardTitle>
                  <CardDescription>
                    Administra todos los proyectos de construcción
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setCurrentView('projects')}>
                    Ver Proyectos
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Clientes</CardTitle>
                  <CardDescription>
                    Administrar información de clientes y contactos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setCurrentView('clientes')}>
                    Ver Clientes
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Equipos</CardTitle>
                  <CardDescription>
                    Administrar equipos y asignaciones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setCurrentView('equipos')}>
                    Ver Equipos
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'projects':
        return (
          <ProjectsList activeTab="proyectos" onNavigate={setCurrentView} />
        );

      case 'clientes':
        return <ClientesN />;

      case 'requisiciones':
        return <RequisicionesGeneral />;

      case 'solicitudes-pago':
        return <SolicitudesPagoGeneral onNavigate={setCurrentView} />;

      case 'cajas-menudas':
        return <CajasMenudasPage key={navKey} />;

      case 'cuentas':
        return (
          <CuentasGeneralPage
            key={navKey}
            onNavigateToProject={(projectId) => setCurrentView(`project-${projectId}-cuentas`)}
          />
        );

      case 'equipos':
      case 'equipos-informacion':
        return <EquiposPage defaultTab="informacion" onTabChange={(tab) => setCurrentView(`equipos-${tab}`)} />;

      case 'equipos-status':
        return <EquiposPage defaultTab="status" onTabChange={(tab) => setCurrentView(`equipos-${tab}`)} />;

      case 'equipos-asignaciones':
        return <EquiposPage defaultTab="asignaciones" onTabChange={(tab) => setCurrentView(`equipos-${tab}`)} />;

      case 'documentos':
      case 'doc-acuerdo-consorcio':
        return <DocumentosPage defaultTab="acuerdo-consorcio" onTabChange={(tab) => setCurrentView(`doc-${tab}`)} />;

      case 'doc-carta-adhesion':
        return <DocumentosPage defaultTab="carta-adhesion" onTabChange={(tab) => setCurrentView(`doc-${tab}`)} />;

      case 'doc-medidas-retorsion':
        return <DocumentosPage defaultTab="medidas-retorsion" onTabChange={(tab) => setCurrentView(`doc-${tab}`)} />;

      case 'doc-no-incapacidad':
        return <DocumentosPage defaultTab="no-incapacidad" onTabChange={(tab) => setCurrentView(`doc-${tab}`)} />;

      case 'doc-pacto-integridad':
        return <DocumentosPage defaultTab="pacto-integridad" onTabChange={(tab) => setCurrentView(`doc-${tab}`)} />;

      case 'doc-carta-compromiso-verde':
        return <DocumentosPage defaultTab="carta-compromiso-verde" onTabChange={(tab) => setCurrentView(`doc-${tab}`)} />;

      case 'usuarios':
        return isAdminOrCoAdmin ? <AdministracionPage defaultTab="usuarios" onTabChange={(tab) => setCurrentView(tab === 'permisos' ? 'permisos' : 'usuarios')} /> : null;

      case 'permisos':
        return isAdminOrCoAdmin ? <AdministracionPage defaultTab="permisos" onTabChange={(tab) => setCurrentView(tab === 'permisos' ? 'permisos' : 'usuarios')} /> : null;

      case 'mi-cuenta':
        return <MiCuentaPage />;

      default:
        return null;
    }
  };

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={setCurrentView}
      pageTitle={pageTitle ?? undefined}
    >
      <AppErrorBoundary>
        {renderContent()}
      </AppErrorBoundary>
    </AppLayout>
  );
}
