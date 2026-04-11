/**
 * ProjectDetailLayout Component
 * Main container for all project-specific views
 * Header and submenu removed — navigation is now in the sidebar
 */

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProjectInformacion from './ProjectInformacion';
import ProjectSummary from './ProjectSummary';
import ProjectCostos from './ProjectCostos';
import ProjectRequisiciones from './ProjectRequisiciones';
import ProjectMembers from './ProjectMembers';
import ProjectTodos from './ProjectTodos';
import ProjectBitacora from './ProjectBitacora';
import ProjectSolicitudesPago from './ProjectSolicitudesPago';
import ProjectAdendas from './ProjectAdendas';
import CajasMenudasPage from '../CajasMenudasPage';
import AdendaForm from '../../components/forms/AdendaForm';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/formatters';
import type { Project, Adenda } from '@/types';

interface ProjectDetailLayoutProps {
  projectId: number;
  subview: string;
  navKey?: number;
  onNavigate: (view: string) => void;
  onTitleChange?: (title: string) => void;
  onProjectLoad?: (ctx: { id: number; name: string }) => void;
  showInfo?: boolean;
  onCloseInfo?: () => void;
}

const getEstadoBadge = (estado: string) => {
  const variants: Record<string, { variant: string; label: string }> = {
    planificacion: { variant: 'secondary', label: 'Planificación' },
    en_curso: { variant: 'default', label: 'En Curso' },
    pausado: { variant: 'outline', label: 'Pausado' },
    completado: { variant: 'success', label: 'Completado' },
    cancelado: { variant: 'destructive', label: 'Cancelado' },
  };

  const config = variants[estado] || { variant: 'secondary', label: estado };
  return <Badge variant={config.variant as any}>{config.label}</Badge>;
};

export default function ProjectDetailLayout({
  projectId,
  subview,
  navKey,
  onNavigate,
  onTitleChange,
  onProjectLoad,
  showInfo = false,
  onCloseInfo,
}: ProjectDetailLayoutProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [projectAdendas, setProjectAdendas] = useState<Adenda[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdendaForm, setShowAdendaForm] = useState<boolean>(false);
  const [editingAdenda, setEditingAdenda] = useState<Adenda | null>(null);

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
          setProjectAdendas(adendasResponse.data.adendas || []);
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

  // Update page title when project or subview changes
  useEffect(() => {
    if (project && onTitleChange) {
      const subviewTitles: Record<string, string> = {
        resumen: 'Resumen',
        costos: 'Control de Costos',
        requisiciones: 'Requisiciones',
        'solicitudes-pago': 'Solicitudes de Pago',
        tareas: 'Tareas',
        bitacora: 'Bitácora',
        avance: 'Avance Fisico',
        equipos: 'Equipos',
        miembros: 'Miembros',
        adendas: 'Adendas',
        configuracion: 'Personal',
      };

      const subviewLabel = subviewTitles[subview] || 'Resumen';
      const projectName = project.nombre_corto || project.nombre;
      onTitleChange(`${projectName} > ${subviewLabel}`);
    }
  }, [project, subview, onTitleChange]);

  // Reload adendas after mutations
  const reloadAdendas = async () => {
    try {
      const response = await api.get(`/adendas/project/${projectId}`);
      if (response.data.success) {
        setProjectAdendas(response.data.adendas || []);
      }
    } catch (err) {
      console.error('Error reloading adendas:', err);
    }
  };

  // Handle adenda save (create or update)
  const handleAdendaSave = async (adendaData: Partial<Adenda>) => {
    try {
      setLoading(true);
      let response;

      if (editingAdenda) {
        response = await api.put(`/adendas/${editingAdenda.id}`, adendaData);
      } else {
        response = await api.post('/adendas', adendaData);
      }

      if (response.data.success) {
        await reloadAdendas();
        setShowAdendaForm(false);
        setEditingAdenda(null);
      }
    } catch (error) {
      console.error('Error guardando adenda:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle adenda delete
  const handleDeleteAdenda = async (adendaId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta adenda?')) return;

    try {
      setLoading(true);
      await api.delete(`/adendas/${adendaId}`);
      await reloadAdendas();
    } catch (error) {
      console.error('Error eliminando adenda:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render subview content
  const renderSubview = () => {
    if (!project) return null;

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
            onDeleteAdenda={handleDeleteAdenda}
          />
        );

      case 'resumen':
        return <ProjectSummary project={project} onNavigate={onNavigate} />;

      case 'costos':
        return <ProjectCostos projectId={projectId} onNavigate={onNavigate} />;

      case 'requisiciones':
        return <ProjectRequisiciones projectId={projectId} />;

      case 'solicitudes-pago':
        return (
          <ProjectSolicitudesPago
            projectId={projectId}
            onNavigate={onNavigate}
          />
        );

      case 'caja-menuda':
        return <CajasMenudasPage key={navKey} projectId={projectId} />;

      case 'tareas':
        return <ProjectTodos projectId={projectId} />;

      case 'bitacora':
        return <ProjectBitacora projectId={projectId} />;

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

      case 'adendas':
        return (
          <ProjectAdendas
            projectId={projectId}
            adendas={projectAdendas}
            onOpenForm={() => setShowAdendaForm(true)}
            onEditAdenda={(adenda) => {
              setEditingAdenda(adenda);
              setShowAdendaForm(true);
            }}
            onDeleteAdenda={handleDeleteAdenda}
          />
        );

      default:
        return <ProjectSummary project={project} onNavigate={onNavigate} />;
    }
  };

  if (loading && !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => onNavigate('projects')}
        >
          Volver a Proyectos
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <Alert>
          <AlertDescription>Proyecto no encontrado</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
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

      {/* Info Modal — triggered from sidebar (i) button */}
      <Dialog
        open={showInfo}
        onOpenChange={(open) => {
          if (!open) onCloseInfo?.();
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Información del Proyecto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
              <label className="font-medium text-sm text-muted-foreground">
                Nombre:
              </label>
              <span className="text-sm">{project.nombre}</span>
            </div>

            {project.nombre_corto && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Nombre Corto:
                </label>
                <span className="text-sm">{project.nombre_corto}</span>
              </div>
            )}

            {project.codigo_proyecto && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Código:
                </label>
                <span className="text-sm">{project.codigo_proyecto}</span>
              </div>
            )}

            {project.cliente_nombre && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Cliente:
                </label>
                <span className="text-sm">{project.cliente_nombre}</span>
              </div>
            )}

            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
              <label className="font-medium text-sm text-muted-foreground">
                Estado:
              </label>
              <div>{getEstadoBadge(project.estado)}</div>
            </div>

            {project.fecha_inicio && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Fecha de Inicio:
                </label>
                <span className="text-sm">
                  {formatDate(project.fecha_inicio)}
                </span>
              </div>
            )}

            {project.fecha_fin_estimada && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Fecha de Terminación:
                </label>
                <span className="text-sm">
                  {formatDate(project.fecha_fin_estimada)}
                </span>
              </div>
            )}

            {project.presupuesto_base && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Presupuesto Base:
                </label>
                <span className="text-sm">
                  {formatMoney(project.presupuesto_base)}
                </span>
              </div>
            )}

            {project.itbms && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  ITBMS (7%):
                </label>
                <span className="text-sm">{formatMoney(project.itbms)}</span>
              </div>
            )}

            {project.monto_total && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Monto Total:
                </label>
                <span className="text-sm">
                  {formatMoney(project.monto_total)}
                </span>
              </div>
            )}

            {project.contrato && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Número de Contrato:
                </label>
                <span className="text-sm">{project.contrato}</span>
              </div>
            )}

            {project.acto_publico && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Acto Público:
                </label>
                <span className="text-sm">{project.acto_publico}</span>
              </div>
            )}

            {project.datos_adicionales?.observaciones && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Observaciones:
                </label>
                <span className="text-sm">
                  {project.datos_adicionales.observaciones}
                </span>
              </div>
            )}

            {/* Adendas Section in Info Modal */}
            <div className="space-y-4 mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Adendas</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onCloseInfo?.();
                    setShowAdendaForm(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              {projectAdendas.map((adenda) => {
                const getAdendaStatusBadgeVariant = (estado: string) => {
                  const variants: Record<string, string> = {
                    en_proceso: 'secondary',
                    aprobada: 'default',
                    rechazada: 'destructive',
                  };
                  return variants[estado] || 'secondary';
                };

                const getAdendaStatusText = (estado: string) => {
                  const statusTexts: Record<string, string> = {
                    en_proceso: 'En Proceso',
                    aprobada: 'Aprobada',
                    rechazada: 'Rechazada',
                  };
                  return statusTexts[estado] || estado;
                };

                const getAdendaTypeText = (tipo: string) => {
                  const typeTexts: Record<string, string> = {
                    tiempo: 'Extensión de Tiempo',
                    costo: 'Modificación de Costo',
                    mixta: 'Tiempo y Costo',
                  };
                  return typeTexts[tipo] || tipo;
                };

                return (
                  <div
                    key={adenda.id}
                    className="space-y-3 p-4 bg-card border rounded-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="font-medium text-sm">
                          Adenda #{adenda.numero_adenda}
                        </label>
                        <Badge
                          variant={
                            getAdendaStatusBadgeVariant(adenda.estado) as any
                          }
                        >
                          {getAdendaStatusText(adenda.estado)}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingAdenda(adenda);
                            onCloseInfo?.();
                            setShowAdendaForm(true);
                          }}
                          title="Editar adenda"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAdenda(adenda.id)}
                          title="Eliminar adenda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                      <label className="font-medium text-sm text-muted-foreground">
                        Tipo:
                      </label>
                      <span className="text-sm">
                        {getAdendaTypeText(adenda.tipo)}
                      </span>
                    </div>

                    {adenda.nueva_fecha_fin && (
                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">
                          Nueva Fecha:
                        </label>
                        <span className="text-sm">
                          {formatDate(adenda.nueva_fecha_fin)}
                          {adenda.dias_extension && (
                            <span className="text-muted-foreground">
                              {' '}
                              (+{adenda.dias_extension} días)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {adenda.nuevo_monto && (
                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">
                          Nuevo Monto:
                        </label>
                        <span className="text-sm">
                          {formatMoney(adenda.nuevo_monto)}
                        </span>
                      </div>
                    )}

                    {adenda.monto_adicional && (
                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">
                          Monto Adicional:
                        </label>
                        <span className="text-sm">
                          {formatMoney(adenda.monto_adicional)}
                        </span>
                      </div>
                    )}

                    {adenda.observaciones && (
                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">
                          Observaciones:
                        </label>
                        <span className="text-sm">{adenda.observaciones}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                      <label className="font-medium text-sm text-muted-foreground">
                        Solicitada:
                      </label>
                      <span className="text-sm">
                        {formatDate(adenda.fecha_solicitud)}
                        {adenda.fecha_aprobacion && (
                          <span className="text-muted-foreground">
                            {' | Aprobada: '}
                            {formatDate(adenda.fecha_aprobacion)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adenda Form Modal */}
      <AdendaForm
        projectId={projectId}
        isOpen={showAdendaForm}
        onClose={() => {
          setShowAdendaForm(false);
          setEditingAdenda(null);
        }}
        onSave={handleAdendaSave}
        editingAdenda={editingAdenda}
      />
    </>
  );
}
