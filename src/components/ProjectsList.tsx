import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectFormNew from './forms/ProjectFormNew';
import AdendaForm from './forms/AdendaForm';
import LicitacionForm from './forms/LicitacionForm';
import OportunidadForm from './forms/OportunidadForm';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import { formatMoney } from '../utils/formatters';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { Project, Adenda } from '@/types';
// Shadcn Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProjectsListProps {
  activeTab?: string;
  onStatsUpdate?: () => void;
  onNavigate?: (view: string) => void;
}

interface Pagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

const tabConfig: Record<
  string,
  {
    labelNuevo: string;
    labelVacio: string;
    formType: 'project' | 'licitacion' | 'oportunidad';
  }
> = {
  proyectos: {
    labelNuevo: 'Nuevo Proyecto',
    labelVacio: 'No hay proyectos disponibles',
    formType: 'project',
  },
  licitaciones: {
    labelNuevo: 'Nueva Licitación',
    labelVacio: 'No hay licitaciones disponibles',
    formType: 'licitacion',
  },
  oportunidades: {
    labelNuevo: 'Nueva Oportunidad',
    labelVacio: 'No hay oportunidades disponibles',
    formType: 'oportunidad',
  },
};

const ProjectsList: React.FC<ProjectsListProps> = ({
  activeTab = 'proyectos',
  onStatsUpdate,
  onNavigate,
}) => {
  const config = tabConfig[activeTab] || tabConfig.proyectos;
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setPagination] = useState<Pagination>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [projectAdendas, setProjectAdendas] = useState<Adenda[]>([]);
  const [showAdendaForm, setShowAdendaForm] = useState(false);
  const [editingAdenda, setEditingAdenda] = useState<Adenda | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [adendaToDelete, setAdendaToDelete] = useState<number | null>(null);

  // Cargar datos según tab activo
  const loadProjects = async () => {
    try {
      setLoading(true);
      let items: Project[];
      let paginationData = {};

      if (activeTab === 'licitaciones') {
        const response = await api.get('/licitaciones');
        if (!response.data.success) {
          setError('Error cargando licitaciones');
          return;
        }
        items = response.data.licitaciones.map(
          (l: Record<string, unknown>) =>
            ({
              id: l.id,
              nombre_corto: l.nombre,
              cliente_abreviatura: l.entidad_licitante,
              estado: l.estado_licitacion,
              monto_total: l.presupuesto_referencial || 0,
            }) as unknown as Project,
        );
        paginationData = response.data.pagination;
      } else if (activeTab === 'oportunidades') {
        const response = await api.get('/oportunidades');
        if (!response.data.success) {
          setError('Error cargando oportunidades');
          return;
        }
        items = response.data.oportunidades.map(
          (o: Record<string, unknown>) =>
            ({
              id: o.id,
              nombre_corto: o.nombre_oportunidad,
              cliente_abreviatura: o.cliente_potencial,
              estado: o.estado_oportunidad,
              monto_total: o.valor_estimado || 0,
            }) as unknown as Project,
        );
        paginationData = response.data.pagination;
      } else {
        const response = await api.get('/projects', {
          params: { tipo_origen: 'directo' },
        });
        if (!response.data.success) {
          setError('Error cargando proyectos');
          return;
        }
        items = response.data.proyectos;
        paginationData = response.data.pagination;
      }

      setProjects(items);
      setPagination(paginationData);
      setError('');
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar proyectos al montar o cambiar de tab
  useEffect(() => {
    loadProjects();
  }, [activeTab]);

  // Manejar guardado de proyecto
  const handleProjectSave = () => {
    // Recargar la lista
    loadProjects();
    // Actualizar estadísticas del dashboard
    if (onStatsUpdate) {
      onStatsUpdate();
    }
    setShowCreateForm(false);
    setEditingProject(null);
  };

  // Manejar visualización de detalles del proyecto
  const _handleViewProject = async (projectId: number) => {
    try {
      setLoading(true);
      const [projectResponse, adendasResponse] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/adendas/project/${projectId}`),
      ]);

      if (projectResponse.data.success) {
        setViewingProject(projectResponse.data.proyecto);
      } else {
        setError('Error al cargar los detalles del proyecto');
      }

      if (adendasResponse.data.success) {
        setProjectAdendas(adendasResponse.data.adendas);
      } else {
        setProjectAdendas([]);
      }
    } catch (err) {
      console.error('Error cargando proyecto:', err);
      setError('Error de conexión al cargar el proyecto');
      setProjectAdendas([]);
    } finally {
      setLoading(false);
    }
  };

  // Manejar edición
  const handleEditProject = (project: Project) => {
    setEditingProject(project);
  };

  // Manejar eliminación
  const handleDeleteProject = (projectId: number) => {
    setProjectToDelete(projectId);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const endpoint =
        config.formType === 'licitacion'
          ? `/licitaciones/${projectToDelete}`
          : config.formType === 'oportunidad'
            ? `/oportunidades/${projectToDelete}`
            : `/projects/${projectToDelete}`;
      const response = await api.delete(endpoint);

      if (response.data.success) {
        loadProjects();
        if (onStatsUpdate) {
          onStatsUpdate();
        }
      } else {
        setError('Error al eliminar el proyecto');
      }
    } catch (err) {
      console.error('Error eliminando proyecto:', err);
      setError('Error de conexión al eliminar el proyecto');
    } finally {
      setProjectToDelete(null);
    }
  };

  // Obtener variante de badge para estado (Shadcn)
  const getStatusBadgeClassName = (estado: string): string => {
    const variants: Record<string, string> = {
      // Proyectos
      planificacion: 'bg-slate-100 text-slate-600 border-slate-200 border',
      en_curso: 'bg-info/10 text-info border-info/30 border',
      pausado: 'bg-warning/10 text-warning border-warning/30 border',
      completado: 'bg-success/10 text-success border-success/30 border',
      cancelado: 'bg-error/10 text-error border-error/30 border',
      // Licitaciones
      activa: 'bg-info/10 text-info border-info/30 border',
      presentada: 'bg-slate-100 text-slate-600 border-slate-200 border',
      ganada: 'bg-success/10 text-success border-success/30 border',
      perdida: 'bg-error/10 text-error border-error/30 border',
      sin_interes: 'bg-slate-100 text-slate-600 border-slate-200 border',
      cancelada: 'bg-error/10 text-error border-error/30 border',
      // Oportunidades
      prospecto: 'bg-slate-100 text-slate-600 border-slate-200 border',
      calificada: 'bg-info/10 text-info border-info/30 border',
      propuesta: 'bg-warning/10 text-warning border-warning/30 border',
      negociacion: 'bg-info/10 text-info border-info/30 border',
      cerrada: 'bg-success/10 text-success border-success/30 border',
    };
    return variants[estado] || 'bg-slate-100 text-slate-600 border-slate-200 border';
  };

  // Obtener texto del estado
  const getStatusText = (estado: string) => {
    const statusTexts: Record<string, string> = {
      // Proyectos
      planificacion: 'Planificación',
      en_curso: 'En Curso',
      pausado: 'Pausado',
      completado: 'Completado',
      cancelado: 'Cancelado',
      // Licitaciones
      activa: 'Activa',
      presentada: 'Presentada',
      ganada: 'Ganada',
      perdida: 'Perdida',
      sin_interes: 'Sin Interés',
      cancelada: 'Cancelada',
      // Oportunidades
      prospecto: 'Prospecto',
      calificada: 'Calificada',
      propuesta: 'En Propuesta',
      negociacion: 'En Negociación',
      cerrada: 'Cerrada',
    };
    return statusTexts[estado] || estado;
  };

  // Funciones para adendas
  const getAdendaStatusClassName = (estado: string): string => {
    const variants: Record<string, string> = {
      en_proceso: 'bg-info/10 text-info border-info/30 border',
      aprobada: 'bg-success/10 text-success border-success/30 border',
      rechazada: 'bg-error/10 text-error border-error/30 border',
    };
    return variants[estado] || 'bg-slate-100 text-slate-600 border-slate-200 border';
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

  // Manejar adendas
  const handleAdendaSave = async (adendaData: Partial<Adenda>) => {
    try {
      setLoading(true);
      let response;

      if (editingAdenda) {
        response = await api.put(`/adendas/${editingAdenda.id}`, adendaData);
      } else {
        response = await api.post('/adendas', adendaData);
      }

      if (response.data.success && viewingProject) {
        // Recargar adendas del proyecto
        const adendasResponse = await api.get(
          `/adendas/project/${viewingProject.id}`,
        );
        if (adendasResponse.data.success) {
          setProjectAdendas(adendasResponse.data.adendas);
        }
        setShowAdendaForm(false);
        setEditingAdenda(null);
      }
    } catch (err) {
      console.error('Error guardando adenda:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdenda = (adendaId: number) => {
    setAdendaToDelete(adendaId);
  };

  const confirmDeleteAdenda = async () => {
    if (!adendaToDelete) return;
    try {
      setLoading(true);
      await api.delete(`/adendas/${adendaToDelete}`);

      if (viewingProject) {
        const adendasResponse = await api.get(
          `/adendas/project/${viewingProject.id}`,
        );
        if (adendasResponse.data.success) {
          setProjectAdendas(adendasResponse.data.adendas);
        }
      }
    } catch (err) {
      console.error('Error eliminando adenda:', err);
    } finally {
      setLoading(false);
      setAdendaToDelete(null);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="section-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón de acción */}
      {hasPermission('proyectos_crear') && (
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {config.labelNuevo}
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadProjects}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {/* Modal para crear */}
      {config.formType === 'project' && (
        <ProjectFormNew
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSave={handleProjectSave}
        />
      )}
      {config.formType === 'licitacion' && (
        <LicitacionForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSave={handleProjectSave}
        />
      )}
      {config.formType === 'oportunidad' && (
        <OportunidadForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSave={handleProjectSave}
        />
      )}

      {/* Modal para editar */}
      {config.formType === 'project' && (
        <ProjectFormNew
          projectId={editingProject?.id}
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleProjectSave}
          onDelete={handleDeleteProject}
        />
      )}
      {config.formType === 'licitacion' && (
        <LicitacionForm
          licitacionId={editingProject?.id}
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleProjectSave}
        />
      )}
      {config.formType === 'oportunidad' && (
        <OportunidadForm
          oportunidadId={editingProject?.id}
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleProjectSave}
        />
      )}

      {/* Modal para ver detalles del proyecto - Shadcn Dialog */}
      <Dialog
        open={!!viewingProject}
        onOpenChange={() => setViewingProject(null)}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingProject?.nombre_corto || 'Detalles del Proyecto'}
            </DialogTitle>
          </DialogHeader>

          {viewingProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Proyecto:
                </label>
                <span className="text-sm">{viewingProject.nombre}</span>
              </div>

              {viewingProject.codigo_proyecto && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Código:
                  </label>
                  <span className="text-sm">
                    {viewingProject.codigo_proyecto}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">
                  Estado:
                </label>
                <div>
                  <Badge className={getStatusBadgeClassName(viewingProject.estado)}>
                    {getStatusText(viewingProject.estado)}
                  </Badge>
                </div>
              </div>

              {viewingProject.cliente_nombre && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Cliente:
                  </label>
                  <span className="text-sm">
                    {viewingProject.cliente_nombre}
                  </span>
                </div>
              )}

              {viewingProject.cliente_abreviatura && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Abreviatura:
                  </label>
                  <span className="text-sm">
                    {viewingProject.cliente_abreviatura}
                  </span>
                </div>
              )}

              {viewingProject.cliente_contacto && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Contacto:
                  </label>
                  <span className="text-sm">
                    {viewingProject.cliente_contacto}
                  </span>
                </div>
              )}

              {viewingProject.cliente_telefono && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Teléfono:
                  </label>
                  <span className="text-sm">
                    {viewingProject.cliente_telefono}
                  </span>
                </div>
              )}

              {viewingProject.cliente_email && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Email:
                  </label>
                  <span className="text-sm">
                    {viewingProject.cliente_email}
                  </span>
                </div>
              )}

              {viewingProject.contratista && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Contratista:
                  </label>
                  <span className="text-sm">{viewingProject.contratista}</span>
                </div>
              )}

              {viewingProject.ingeniero_residente && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Ingeniero Residente:
                  </label>
                  <span className="text-sm">
                    {viewingProject.ingeniero_residente}
                  </span>
                </div>
              )}

              {/* Fecha de Inicio */}
              {viewingProject.fecha_inicio && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Fecha de Inicio:
                  </label>
                  <span className="text-sm">
                    {formatDate(viewingProject.fecha_inicio)}
                  </span>
                </div>
              )}

              {/* Fecha de Terminación */}
              {viewingProject.fecha_fin_estimada && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Fecha de Terminación:
                  </label>
                  <span className="text-sm">
                    {formatDate(viewingProject.fecha_fin_estimada)}
                  </span>
                </div>
              )}

              {/* Presupuesto Base */}
              {viewingProject.presupuesto_base && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Presupuesto Base:
                  </label>
                  <span className="text-sm">
                    {formatMoney(viewingProject.presupuesto_base)}
                  </span>
                </div>
              )}

              {/* ITBMS */}
              {viewingProject.itbms && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    ITBMS (7%):
                  </label>
                  <span className="text-sm">
                    {formatMoney(viewingProject.itbms)}
                  </span>
                </div>
              )}

              {/* Monto Total */}
              {viewingProject.monto_total && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Monto Total:
                  </label>
                  <span className="text-sm">
                    {formatMoney(viewingProject.monto_total)}
                  </span>
                </div>
              )}

              {/* Monto del Contrato (alternativo) */}
              {!viewingProject.monto_total &&
                viewingProject.monto_contrato_original && (
                  <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                    <label className="font-medium text-sm text-muted-foreground">
                      Monto del Contrato:
                    </label>
                    <span className="text-sm">
                      {formatMoney(viewingProject.monto_contrato_original)}
                    </span>
                  </div>
                )}

              {/* Número de Contrato */}
              {viewingProject.contrato && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Número de Contrato:
                  </label>
                  <span className="text-sm">{viewingProject.contrato}</span>
                </div>
              )}

              {/* Acto Público */}
              {viewingProject.acto_publico && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Acto Público:
                  </label>
                  <span className="text-sm">{viewingProject.acto_publico}</span>
                </div>
              )}

              {/* Observaciones */}
              {viewingProject.datos_adicionales?.observaciones && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <label className="font-medium text-sm text-muted-foreground">
                    Observaciones:
                  </label>
                  <span className="text-sm">
                    {viewingProject.datos_adicionales.observaciones}
                  </span>
                </div>
              )}

              {/* Adendas */}
              {projectAdendas.length > 0 && (
                <div className="space-y-6 mt-6 pt-6 border-t">
                  <h3 className="font-semibold text-base">
                    Adendas del Proyecto
                  </h3>
                  {projectAdendas.map((adenda) => (
                    <div
                      key={adenda.id}
                      className="space-y-3 p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">
                          Adenda #{adenda.numero_adenda}:
                        </label>
                        <div className="flex items-center gap-3">
                          <Badge
                            className={getAdendaStatusClassName(adenda.estado)}
                          >
                            {getAdendaStatusText(adenda.estado)}
                          </Badge>
                          {hasPermission('proyectos_editar') && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingAdenda(adenda);
                                  setShowAdendaForm(true);
                                }}
                                className="inline-flex items-center justify-center p-0 border-0 bg-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                title="Editar adenda"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteAdenda(adenda.id)}
                                className="inline-flex items-center justify-center p-0 border-0 bg-transparent text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                title="Eliminar adenda"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
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
                            Nueva Fecha de Terminación:
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
                          <span className="text-sm">
                            {adenda.observaciones}
                          </span>
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
                              {' '}
                              | Aprobada: {formatDate(adenda.fecha_aprobacion)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer con botón de agregar adenda */}
          {hasPermission('proyectos_editar') && (
            <DialogFooter>
              <Button onClick={() => setShowAdendaForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Adenda
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para crear/editar adenda */}
      <AdendaForm
        projectId={viewingProject?.id}
        isOpen={showAdendaForm}
        onClose={() => {
          setShowAdendaForm(false);
          setEditingAdenda(null);
        }}
        onSave={handleAdendaSave}
        editingAdenda={editingAdenda}
      />

      {/* ===== CARDS MÓVIL ===== */}
      <div className="md:hidden space-y-3">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {config.labelVacio}
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                if (activeTab === 'proyectos') {
                  if (onNavigate) onNavigate(`project-${project.id}-resumen`);
                } else {
                  handleEditProject(project);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {project.nombre_corto}
                  </CardTitle>
                  {hasPermission('proyectos_editar') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProject(project);
                      }}
                      title="Editar proyecto"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">
                    {project.cliente_abreviatura}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge className={getStatusBadgeClassName(project.estado)}>
                    {getStatusText(project.estado)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monto:</span>
                  <span className="font-medium">
                    {formatMoney(
                      project.monto_total ||
                        project.monto_contrato_original ||
                        0,
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ===== TABLA DE PROYECTOS DESKTOP (Shadcn Table) ===== */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              {hasPermission('proyectos_editar') && (
                <TableHead className="w-[50px]"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {config.labelVacio}
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    if (activeTab === 'proyectos') {
                      if (onNavigate)
                        onNavigate(`project-${project.id}-resumen`);
                    } else {
                      handleEditProject(project);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {project.nombre_corto}
                  </TableCell>
                  <TableCell>{project.cliente_abreviatura}</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeClassName(project.estado)}>
                      {getStatusText(project.estado)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(
                      project.monto_total ||
                        project.monto_contrato_original ||
                        0,
                    )}
                  </TableCell>
                  {hasPermission('proyectos_editar') && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProject(project);
                        }}
                        title="Editar proyecto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete project confirmation */}
      <AlertDialog open={projectToDelete !== null} onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProject}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete adenda confirmation */}
      <AlertDialog open={adendaToDelete !== null} onOpenChange={(open) => { if (!open) setAdendaToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta adenda?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAdenda}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsList;
