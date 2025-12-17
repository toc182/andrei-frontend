/**
 * ProjectDetailLayout Component
 * Main container for all project-specific views
 */

import { useState, useEffect } from "react"
import { Info, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import ProjectSubMenu from "../../components/project/ProjectSubMenu"
import ProjectSummary from "./ProjectSummary"
import ProjectAdendas from "./ProjectAdendas"
import ProjectCostos from "./ProjectCostos"
import ProjectRequisiciones from "./ProjectRequisiciones"
import ProjectMembers from "./ProjectMembers"
import ProjectTodos from "./ProjectTodos"
import ProjectBitacora from "./ProjectBitacora"
import AdendaForm from "../../components/forms/AdendaForm"
import api from "../../services/api"
import { formatDate } from "../../utils/dateUtils"

const formatMoney = (amount) => {
  if (!amount) return '$0.00'
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

const getEstadoBadge = (estado) => {
  const variants = {
    'planificacion': { variant: 'secondary', label: 'Planificación' },
    'en_curso': { variant: 'default', label: 'En Curso' },
    'pausado': { variant: 'outline', label: 'Pausado' },
    'completado': { variant: 'success', label: 'Completado' },
    'cancelado': { variant: 'destructive', label: 'Cancelado' }
  }

  const config = variants[estado] || { variant: 'secondary', label: estado }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export default function ProjectDetailLayout({ projectId, subview, onNavigate, onTitleChange }) {
  const [project, setProject] = useState(null)
  const [projectAdendas, setProjectAdendas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showAdendaForm, setShowAdendaForm] = useState(false)
  const [editingAdenda, setEditingAdenda] = useState(null)

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true)
        setError(null)

        const [projectResponse, adendasResponse] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/adendas/project/${projectId}`)
        ])

        if (projectResponse.data.success) {
          setProject(projectResponse.data.proyecto)
        } else {
          setError('Error al cargar el proyecto')
        }

        if (adendasResponse.data.success) {
          setProjectAdendas(adendasResponse.data.adendas || [])
        }
      } catch (err) {
        console.error('Error loading project:', err)
        setError('Error de conexión al cargar el proyecto')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  // Update page title when project or subview changes
  useEffect(() => {
    if (project && onTitleChange) {
      const subviewTitles = {
        'resumen': 'Resumen',
        'costos': 'Control de Costos',
        'requisiciones': 'Requisiciones',
        'tareas': 'Tareas',
        'bitacora': 'Bitácora',
        'avance': 'Avance Fisico',
        'equipos': 'Equipos',
        'adendas': 'Adendas',
        'configuracion': 'Miembros'
      }

      const subviewLabel = subviewTitles[subview] || 'Resumen'
      const projectName = project.nombre_corto || project.nombre
      onTitleChange(`${projectName} > ${subviewLabel}`)
    }
  }, [project, subview, onTitleChange])

  // Reload adendas after mutations
  const reloadAdendas = async () => {
    try {
      const response = await api.get(`/adendas/project/${projectId}`)
      if (response.data.success) {
        setProjectAdendas(response.data.adendas || [])
      }
    } catch (err) {
      console.error('Error reloading adendas:', err)
    }
  }

  // Handle adenda save (create or update)
  const handleAdendaSave = async (adendaData) => {
    try {
      setLoading(true)
      let response

      if (editingAdenda) {
        response = await api.put(`/adendas/${editingAdenda.id}`, adendaData)
      } else {
        response = await api.post('/adendas', adendaData)
      }

      if (response.data.success) {
        await reloadAdendas()
        setShowAdendaForm(false)
        setEditingAdenda(null)
      }
    } catch (error) {
      console.error('Error guardando adenda:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle adenda delete
  const handleDeleteAdenda = async (adendaId) => {
    if (!confirm('¿Estás seguro de eliminar esta adenda?')) return

    try {
      setLoading(true)
      await api.delete(`/adendas/${adendaId}`)
      await reloadAdendas()
    } catch (error) {
      console.error('Error eliminando adenda:', error)
    } finally {
      setLoading(false)
    }
  }

  // Render subview content
  const renderSubview = () => {
    if (!project) return null

    switch (subview) {
      case 'resumen':
        return <ProjectSummary project={project} onNavigate={onNavigate} />

      case 'costos':
        return <ProjectCostos projectId={projectId} onNavigate={onNavigate} />

      case 'requisiciones':
        return <ProjectRequisiciones projectId={projectId} />

      case 'tareas':
        return <ProjectTodos projectId={projectId} />

      case 'bitacora':
        return <ProjectBitacora projectId={projectId} />

      case 'avance':
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Avance Físico</p>
            <p className="text-sm mt-2">Esta funcionalidad se implementará en la Fase 4</p>
          </div>
        )

      case 'equipos':
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Equipos Asignados</p>
            <p className="text-sm mt-2">Vista filtrada de equipos del proyecto</p>
          </div>
        )

      case 'adendas':
        return (
          <ProjectAdendas
            projectId={projectId}
            adendas={projectAdendas}
            onOpenForm={() => setShowAdendaForm(true)}
            onEditAdenda={(adenda) => {
              setEditingAdenda(adenda)
              setShowAdendaForm(true)
            }}
            onDeleteAdenda={handleDeleteAdenda}
          />
        )

      case 'configuracion':
        return <ProjectMembers projectId={projectId} />

      default:
        return <ProjectSummary project={project} onNavigate={onNavigate} />
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => onNavigate('projects')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Proyectos
        </Button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Proyecto no encontrado</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => onNavigate('projects')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Proyectos
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Project Header */}
      <div className="border-b bg-background px-6 py-4 overflow-x-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold truncate">
                {project.nombre_corto || project.nombre}
              </h1>
              {getEstadoBadge(project.estado)}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInfoModal(true)}
                title="Ver información completa del proyecto"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {project.cliente_nombre && (
                <span>Cliente: {project.cliente_nombre}</span>
              )}
              {project.codigo_proyecto && (
                <span>Código: {project.codigo_proyecto}</span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('projects')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>

      {/* Project SubMenu */}
      <ProjectSubMenu
        projectId={projectId}
        currentSubview={subview}
        onNavigate={onNavigate}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-muted/20">
        {renderSubview()}
      </div>

      {/* Info Modal */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Información del Proyecto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
              <label className="font-medium text-sm text-muted-foreground">Nombre:</label>
              <span className="text-sm">{project.nombre}</span>
            </div>

            {project.nombre_corto && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Nombre Corto:</label>
                <span className="text-sm">{project.nombre_corto}</span>
              </div>
            )}

            {project.codigo_proyecto && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Código:</label>
                <span className="text-sm">{project.codigo_proyecto}</span>
              </div>
            )}

            {project.cliente_nombre && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Cliente:</label>
                <span className="text-sm">{project.cliente_nombre}</span>
              </div>
            )}

            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
              <label className="font-medium text-sm text-muted-foreground">Estado:</label>
              <div>{getEstadoBadge(project.estado)}</div>
            </div>

            {project.fecha_inicio && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Fecha de Inicio:</label>
                <span className="text-sm">{formatDate(project.fecha_inicio)}</span>
              </div>
            )}

            {project.fecha_fin_estimada && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Fecha de Terminación:</label>
                <span className="text-sm">{formatDate(project.fecha_fin_estimada)}</span>
              </div>
            )}

            {project.presupuesto_base && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Presupuesto Base:</label>
                <span className="text-sm">{formatMoney(project.presupuesto_base)}</span>
              </div>
            )}

            {project.itbms && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">ITBMS (7%):</label>
                <span className="text-sm">{formatMoney(project.itbms)}</span>
              </div>
            )}

            {project.monto_total && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Monto Total:</label>
                <span className="text-sm">{formatMoney(project.monto_total)}</span>
              </div>
            )}

            {project.contrato && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Número de Contrato:</label>
                <span className="text-sm">{project.contrato}</span>
              </div>
            )}

            {project.acto_publico && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Acto Público:</label>
                <span className="text-sm">{project.acto_publico}</span>
              </div>
            )}

            {project.datos_adicionales?.observaciones && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <label className="font-medium text-sm text-muted-foreground">Observaciones:</label>
                <span className="text-sm">{project.datos_adicionales.observaciones}</span>
              </div>
            )}

            {/* Adendas Section */}
            {projectAdendas.length > 0 && (
              <div className="space-y-4 mt-6 pt-6 border-t">
                <h3 className="font-semibold text-base">Adendas del Proyecto</h3>
                {projectAdendas.map(adenda => {
                  // Helper functions for adenda display
                  const getAdendaStatusBadgeVariant = (estado) => {
                    const variants = {
                      'en_proceso': 'secondary',
                      'aprobada': 'default',
                      'rechazada': 'destructive'
                    }
                    return variants[estado] || 'secondary'
                  }

                  const getAdendaStatusText = (estado) => {
                    const statusTexts = {
                      'en_proceso': 'En Proceso',
                      'aprobada': 'Aprobada',
                      'rechazada': 'Rechazada'
                    }
                    return statusTexts[estado] || estado
                  }

                  const getAdendaTypeText = (tipo) => {
                    const typeTexts = {
                      'tiempo': 'Extensión de Tiempo',
                      'costo': 'Modificación de Costo',
                      'mixta': 'Tiempo y Costo'
                    }
                    return typeTexts[tipo] || tipo
                  }

                  return (
                    <div key={adenda.id} className="space-y-3 p-4 bg-muted/50 rounded-lg">
                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">Adenda #{adenda.numero_adenda}:</label>
                        <div>
                          <Badge variant={getAdendaStatusBadgeVariant(adenda.estado)}>
                            {getAdendaStatusText(adenda.estado)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">Tipo:</label>
                        <span className="text-sm">{getAdendaTypeText(adenda.tipo)}</span>
                      </div>

                      {adenda.nueva_fecha_fin && (
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                          <label className="font-medium text-sm text-muted-foreground">Nueva Fecha:</label>
                          <span className="text-sm">
                            {formatDate(adenda.nueva_fecha_fin)}
                            {adenda.dias_extension && (
                              <span className="text-muted-foreground"> (+{adenda.dias_extension} días)</span>
                            )}
                          </span>
                        </div>
                      )}

                      {adenda.nuevo_monto && (
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                          <label className="font-medium text-sm text-muted-foreground">Nuevo Monto:</label>
                          <span className="text-sm">{formatMoney(adenda.nuevo_monto)}</span>
                        </div>
                      )}

                      {adenda.monto_adicional && (
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                          <label className="font-medium text-sm text-muted-foreground">Monto Adicional:</label>
                          <span className="text-sm">{formatMoney(adenda.monto_adicional)}</span>
                        </div>
                      )}

                      {adenda.observaciones && (
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                          <label className="font-medium text-sm text-muted-foreground">Observaciones:</label>
                          <span className="text-sm">{adenda.observaciones}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                        <label className="font-medium text-sm text-muted-foreground">Solicitada:</label>
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
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Adenda Form Modal */}
      <AdendaForm
        projectId={projectId}
        isOpen={showAdendaForm}
        onClose={() => {
          setShowAdendaForm(false)
          setEditingAdenda(null)
        }}
        onSave={handleAdendaSave}
        editingAdenda={editingAdenda}
      />
    </div>
  )
}
