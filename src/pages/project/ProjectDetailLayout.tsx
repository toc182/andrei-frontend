/**
 * ProjectDetailLayout Component
 * Main container for all project-specific views
 * Header and submenu removed — navigation is now in the sidebar
 */

import { useState, useEffect } from 'react';
import type { Crumb } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Alert } from '@/components/shell/Alert';
import { toast } from 'sonner';
import ProjectInformacion from './ProjectInformacion';
import ProjectSummary from './ProjectSummary';
import ProjectControlCostos from './ProjectControlCostos';
import ProjectRequisiciones from './ProjectRequisiciones';
import ProjectMembers from './ProjectMembers';
import ProjectTodos from './ProjectTodos';
import ProjectReportes from './ProjectReportes';
import ProjectPagos from './ProjectPagos';
import CajasMenudasPage from '../CajasMenudasPage';
import CuentasProjectView from '../cuentas/CuentasProjectView';
import CuentaDetailPage from '../cuentas/CuentaDetailPage';
import CronogramaWorkspace from '../cronogramas/CronogramaWorkspace';
import AdendaForm from '../../components/forms/AdendaForm';
import ProjectFormNew from '../../components/forms/ProjectFormNew';
import api from '../../services/api';
import { recordado, recordar } from '@/lib/recordados';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { cn } from '@/lib/utils';
import type { Project, Adenda } from '@/types';

interface ProyectoRecordado {
  project: Project;
  adendas: Adenda[];
}

interface ProjectDetailLayoutProps {
  projectId: number;
  subview: string;
  navKey?: number;
  onNavigate: (view: string) => void;
  onTitleChange?: (title: string) => void;
  onBreadcrumbsChange?: (crumbs: Crumb[]) => void;
  onProjectLoad?: (ctx: { id: number; name: string }) => void;
}

export default function ProjectDetailLayout({
  projectId,
  subview,
  navKey,
  onNavigate,
  onTitleChange,
  onBreadcrumbsChange,
  onProjectLoad,
}: ProjectDetailLayoutProps) {
  // Un proyecto ya abierto en la sesión sale al instante con lo que tenía y se
  // refresca por detrás; el esqueleto queda para la primera vez, y solo si
  // tarda más de 0.3 s (ver lib/recordados y useCargaLenta).
  const previo = recordado<ProyectoRecordado>(`proyecto:${projectId}`);
  const [proyectoVista, setProyectoVista] = useState(projectId);
  const [project, setProject] = useState<Project | null>(previo?.project ?? null);
  const [projectAdendas, setProjectAdendas] = useState<Adenda[]>(previo?.adendas ?? []);
  const [loading, setLoading] = useState<boolean>(!previo);
  const lenta = useCargaLenta(loading && !project);

  // Otro proyecto: lo del anterior no puede quedarse en pantalla mientras llega
  // el nuevo.
  if (proyectoVista !== projectId) {
    setProyectoVista(projectId);
    setProject(previo?.project ?? null);
    setProjectAdendas(previo?.adendas ?? []);
    setLoading(!previo);
  }

  // Lo que está en pantalla es lo que se recuerda, venga de la carga o de una
  // edición. El id se mira para no guardar bajo este proyecto lo que llegó
  // tarde de otro.
  useEffect(() => {
    if (project && project.id === projectId) {
      recordar(`proyecto:${projectId}`, { project, adendas: projectAdendas });
    }
  }, [project, projectAdendas, projectId]);

  const [error, setError] = useState<string | null>(null);
  const [cuentaNumero, setCuentaNumero] = useState<number | null>(null);
  const [showAdendaForm, setShowAdendaForm] = useState<boolean>(false);
  const [editingAdenda, setEditingAdenda] = useState<Adenda | null>(null);
  // La adenda que se va a borrar se queda aquí mientras la ventana se cierra:
  // así el título no pierde el número durante la animación de salida.
  const [adendaToDelete, setAdendaToDelete] = useState<Adenda | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const pedirBorrado = (adenda: Adenda) => {
    setAdendaToDelete(adenda);
    setConfirmarBorrado(true);
  };
  const [editingProject, setEditingProject] = useState<boolean>(false);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const [projectResponse, adendasResponse] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/adendas/project/${projectId}`),
        ]);

        if (projectResponse.data.success) {
          const proj = projectResponse.data.proyecto;
          setProject(proj);
          // Notify parent of project context
          const name = proj.nombre_corto || proj.nombre;
          onProjectLoad?.({ id: projectId, name });
        } else {
          setError('Error al cargar el proyecto');
        }

        if (adendasResponse.data.success) {
          setProjectAdendas(adendasResponse.data.data || []);
        }
      } catch (err) {
        console.error('Error loading project:', err);
        setError('Error de conexión al cargar el proyecto');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  // Update page title + breadcrumbs when project or subview changes
  useEffect(() => {
    if (!project) return;
    const subviewTitles: Record<string, string> = {
      resumen: 'Resumen',
      informacion: 'Información',
      presupuesto: 'Presupuesto',
      costos: 'Control de Costos',
      requisiciones: 'Requisiciones',
      'solicitudes-pago': 'Pagos',
      'caja-menuda': 'Caja Menuda',
      cuentas: 'Cuentas',
      tareas: 'Tareas',
      reportes: 'Reportes',
      avance: 'Avance Fisico',
      equipos: 'Equipos',
      miembros: 'Miembros',
      configuracion: 'Personal',
      cronograma: 'Cronograma',
    };

    const projectName = project.nombre_corto || project.nombre;
    const crumbs: Crumb[] = [
      { label: projectName, onClick: () => onNavigate(`project-${projectId}-resumen`) },
    ];
    if (subview.startsWith('cuenta-')) {
      crumbs.push({ label: 'Cuentas', onClick: () => onNavigate(`project-${projectId}-cuentas`) });
      crumbs.push({ label: cuentaNumero != null ? `Cuenta ${cuentaNumero}` : 'Cuenta' });
    } else {
      crumbs.push({ label: subviewTitles[subview] || 'Resumen' });
    }

    onBreadcrumbsChange?.(crumbs);
    onTitleChange?.(crumbs.map((c) => c.label).join(' > '));
  }, [project, subview, onTitleChange, onBreadcrumbsChange, onNavigate, projectId, cuentaNumero]);

  // Reset the cuenta number when leaving a cuenta detail view (avoids stale breadcrumb)
  useEffect(() => {
    if (!subview.startsWith('cuenta-')) setCuentaNumero(null);
  }, [subview]);

  // Reload the project after editing it. Se vuelve a pedir en vez de coger lo
  // que devuelve el formulario: la ficha muestra campos que salen de un join
  // (el nombre del cliente) y la respuesta del guardado no los trae.
  const reloadProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      if (response.data.success) {
        const proj = response.data.proyecto;
        setProject(proj);
        onProjectLoad?.({ id: projectId, name: proj.nombre_corto || proj.nombre });
      }
    } catch (err) {
      console.error('Error reloading project:', err);
    }
  };

  // Después de tocar una adenda se recargan las dos cosas: la lista y el
  // proyecto, cuyo monto y terminación vigentes dependen de las aprobadas.
  const reloadAdendas = async () => {
    try {
      const response = await api.get(`/adendas/project/${projectId}`);
      if (response.data.success) {
        setProjectAdendas(response.data.data || []);
      }
    } catch (err) {
      console.error('Error reloading adendas:', err);
    }
    await reloadProject();
  };

  // Guardar una adenda (nueva o editada). Devuelve el mensaje de error para que
  // el formulario lo enseñe y no se cierre; null si se guardó.
  const handleAdendaSave = async (adendaData: Record<string, unknown>): Promise<string | null> => {
    try {
      const response = editingAdenda
        ? await api.put(`/adendas/project/${projectId}/${editingAdenda.id}`, adendaData)
        : await api.post(`/adendas/project/${projectId}`, adendaData);
      if (!response.data.success) return response.data.message || 'No se pudo guardar la adenda';
      await reloadAdendas();
      setShowAdendaForm(false);
      setEditingAdenda(null);
      return null;
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } }).response?.data;
      return data?.message || 'No se pudo guardar la adenda';
    }
  };

  // Borrar una adenda: la esconde y deja de contar para el contrato.
  const confirmDeleteAdenda = async () => {
    if (!adendaToDelete) return;
    try {
      await api.delete(`/adendas/project/${projectId}/${adendaToDelete.id}`);
      await reloadAdendas();
    } catch (err) {
      console.error('Error eliminando adenda:', err);
      const data = (err as { response?: { data?: { message?: string } } }).response?.data;
      toast.error('No se pudo eliminar la adenda', { description: data?.message });
    } finally {
      setConfirmarBorrado(false);
    }
  };

  // Render subview content
  const renderSubview = () => {
    if (!project) return null;

    // Handle cuenta detail: subview = "cuenta-{id}"
    if (subview.startsWith('cuenta-')) {
      const cuentaId = parseInt(subview.replace('cuenta-', ''), 10);
      if (!isNaN(cuentaId)) {
        return (
          <CuentaDetailPage
            cuentaId={cuentaId}
            onBack={() => onNavigate(`project-${projectId}-cuentas`)}
            onCuentaLoaded={setCuentaNumero}
          />
        );
      }
    }

    switch (subview) {
      case 'informacion':
        return (
          <ProjectInformacion
            project={project}
            adendas={projectAdendas}
            onOpenAdendaForm={() => setShowAdendaForm(true)}
            onEditAdenda={(adenda) => {
              setEditingAdenda(adenda);
              setShowAdendaForm(true);
            }}
            onDeleteAdenda={pedirBorrado}
            onEditProject={() => setEditingProject(true)}
          />
        );

      case 'resumen':
        return <ProjectSummary project={project} onNavigate={onNavigate} />;

      // 'presupuesto' ya no esta en el menu: Presupuestos es una pestana de
      // Control de Costos. Se mantiene como atajo para que un enlace viejo
      // caiga en la pestana correcta y no en una pantalla en blanco.
      case 'presupuesto':
        return (
          <ProjectControlCostos
            projectId={projectId}
            tabInicial="presupuestos"
            onNavigate={onNavigate}
          />
        );

      case 'costos':
        return <ProjectControlCostos projectId={projectId} onNavigate={onNavigate} />;

      case 'requisiciones':
        return <ProjectRequisiciones projectId={projectId} />;

      case 'solicitudes-pago':
        return (
          <ProjectPagos
            // Otro proyecto es otra pantalla: nada del anterior (filas, filtros,
            // lo recordado) puede asomarse mientras carga el nuevo.
            key={projectId}
            projectId={projectId}
            projectName={project.nombre_corto || project.nombre}
            onNavigate={onNavigate}
          />
        );

      case 'caja-menuda':
        return <CajasMenudasPage key={navKey} projectId={projectId} />;

      case 'cuentas':
        return (
          <CuentasProjectView
            key={navKey}
            projectId={projectId}
            onCuentaClick={(cuentaId) => onNavigate(`project-${projectId}-cuenta-${cuentaId}`)}
          />
        );

      case 'tareas':
        return <ProjectTodos projectId={projectId} />;

      case 'reportes':
        return <ProjectReportes projectId={projectId} />;

      case 'avance':
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Avance Físico</p>
            <p className="text-sm mt-2">
              Esta funcionalidad se implementará en la Fase 4
            </p>
          </div>
        );

      case 'equipos':
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Equipos Asignados</p>
            <p className="text-sm mt-2">
              Vista filtrada de equipos del proyecto
            </p>
          </div>
        );

      case 'miembros':
      case 'configuracion':
        return <ProjectMembers projectId={projectId} />;

      case 'cronograma':
        return <CronogramaWorkspace projectId={projectId} embedded onNavigate={onNavigate} />;

      default:
        return <ProjectSummary project={project} onNavigate={onNavigate} />;
    }
  };

  if (loading && !project) {
    return (
      <div className={cn('space-y-4', !lenta && 'invisible')}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title={error} />
        <Button
          variant="outline"
          onClick={() => onNavigate('projects')}
        >
          Volver a Proyectos
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Proyecto no encontrado" />
        <Button
          variant="outline"
          onClick={() => onNavigate('projects')}
        >
          Volver a Proyectos
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Content — no header, no submenu */}
      {renderSubview()}

      {/* Delete Adenda Confirmation */}
      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar la Adenda #{adendaToDelete?.numero_adenda}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deja de contar para el monto y la fecha de terminación vigentes del contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAdenda}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adenda Form Modal */}
      <AdendaForm
        project={project}
        adendas={projectAdendas}
        isOpen={showAdendaForm}
        onClose={() => {
          setShowAdendaForm(false);
          setEditingAdenda(null);
        }}
        onSave={handleAdendaSave}
        editingAdenda={editingAdenda}
      />

      {/* Editar el proyecto desde la ficha. Es el mismo formulario de la tabla
          de Proyectos, pero SIN onDelete: borrar el proyecto estando parado
          dentro de él dejaría al usuario en una pantalla sin datos. */}
      <ProjectFormNew
        projectId={projectId}
        isOpen={editingProject}
        onClose={() => setEditingProject(false)}
        onSave={() => {
          setEditingProject(false);
          reloadProject();
        }}
      />
    </>
  );
}
