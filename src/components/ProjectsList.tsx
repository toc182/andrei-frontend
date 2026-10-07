import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectFormNew from './forms/ProjectFormNew';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import { Pencil, Plus } from 'lucide-react';
import type { Project } from '@/types';
// Shadcn Components
import { Button, buttonVariants } from '@/components/ui/button';
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
  onStatsUpdate?: () => void;
  onNavigate?: (view: string) => void;
}

interface Pagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

const ProjectsList: React.FC<ProjectsListProps> = ({
  onStatsUpdate,
  onNavigate,
}) => {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setPagination] = useState<Pagination>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  // Cargar proyectos
  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/projects', {
        params: { tipo_origen: 'directo' },
      });
      if (!response.data.success) {
        setError('Error cargando proyectos');
        return;
      }
      setProjects(response.data.proyectos);
      setPagination(response.data.pagination);
      setError('');
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

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
      const response = await api.delete(`/projects/${projectToDelete}`);

      if (response.data.success) {
        loadProjects();
        // Avisar al switcher del sidebar que el proyecto ya no existe.
        window.dispatchEvent(new Event('projects-changed'));
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
      planificacion: 'bg-navy/10 text-navy border-navy/30 border',
      en_curso: 'bg-info/10 text-info border-info/30 border',
      pausado: 'bg-warning/10 text-warning border-warning/30 border',
      completado: 'bg-success/10 text-success border-success/30 border',
      cancelado: 'bg-error/10 text-error border-error/30 border',
    };
    return variants[estado] || 'bg-slate-100 text-slate-600 border-slate-200 border';
  };

  // Obtener texto del estado
  const getStatusText = (estado: string) => {
    const statusTexts: Record<string, string> = {
      planificacion: 'Planificación',
      en_curso: 'En Curso',
      pausado: 'Pausado',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };
    return statusTexts[estado] || estado;
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
            Nuevo Proyecto
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
      <ProjectFormNew
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSave={handleProjectSave}
      />

      {/* Modal para editar */}
      <ProjectFormNew
        projectId={editingProject?.id}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSave={handleProjectSave}
        onDelete={handleDeleteProject}
      />

      {/* ===== CARDS MÓVIL ===== */}
      <div className="md:hidden space-y-3">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay proyectos disponibles
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                if (onNavigate) onNavigate(`project-${project.id}-resumen`);
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
                    {formatMoney(project.monto_vigente ?? 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ===== TABLA DE PROYECTOS DESKTOP (Shadcn Table) ===== */}
      <Card className="hidden md:block overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyecto</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</TableHead>
              <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</TableHead>
              <TableHead className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto</TableHead>
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
                  No hay proyectos disponibles
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    if (onNavigate) onNavigate(`project-${project.id}-resumen`);
                  }}
                >
                  <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                    {project.nombre_corto}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{project.cliente_abreviatura}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge className={`min-w-[5.5rem] justify-center ${getStatusBadgeClassName(project.estado)}`}>
                      {getStatusText(project.estado)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {formatMoney(project.monto_vigente ?? 0)}
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
      </Card>

      {/* Delete project confirmation */}
      <AlertDialog open={projectToDelete !== null} onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default ProjectsList;
