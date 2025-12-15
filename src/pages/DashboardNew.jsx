/**
 * Dashboard Nuevo - Usando AppLayout con Shadcn
 * TEMPORAL - Para probar el nuevo layout antes de migrar todo
 */

import { useState, useEffect } from "react"
import { AppLayout } from "../components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Building2, Users, Truck, TrendingUp, AlertCircle } from "lucide-react"
import ProjectsList from "../components/ProjectsList"
import ClientesN from "./ClientesN"
import DocumentosHubN from "./DocumentosHubN"
import DocumentFormN from "../components/forms/DocumentFormN"
import EquiposInformacionN from "./equipos/EquiposInformacionN"
import EquiposStatusN from "./equipos/EquiposStatusN"
import AsignacionesEquiposN from "./equipos/AsignacionesEquiposN"
import ProjectDetailLayout from "./project/ProjectDetailLayout"
import RequisicionesGeneral from "./RequisicionesGeneral"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"

export default function DashboardNew() {
  const { user } = useAuth()
  const [currentView, setCurrentView] = useState("dashboard")
  const [stats, setStats] = useState({
    proyectos: null,
    clientes: null,
    equipos: null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pageTitle, setPageTitle] = useState(null)

  // Cargar estadísticas del dashboard
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // Llamadas en paralelo para mejor performance
        const [proyectosRes, clientesRes, equiposRes] = await Promise.all([
          api.get('/projects/stats/dashboard'),
          api.get('/clientes/stats/dashboard'),
          api.get('/equipos/')
        ])

        setStats({
          proyectos: proyectosRes.data.stats,
          clientes: clientesRes.data.stats,
          equipos: { total: equiposRes.data.total || equiposRes.data.data?.length || 0 }
        })
      } catch (err) {
        console.error('Error cargando estadísticas:', err)
        setError('Error al cargar las estadísticas del dashboard')
      } finally {
        setLoading(false)
      }
    }

    if (currentView === "dashboard") {
      fetchStats()
    }
  }, [currentView])

  const renderContent = () => {
    // Check if it's a project view (pattern: project-{id}-{subview})
    if (currentView.startsWith('project-')) {
      const parts = currentView.split('-')
      if (parts.length >= 3) {
        const projectId = parseInt(parts[1], 10)
        const subview = parts.slice(2).join('-') // Handle subviews with dashes
        return (
          <ProjectDetailLayout
            projectId={projectId}
            subview={subview}
            onNavigate={setCurrentView}
            onTitleChange={setPageTitle}
          />
        )
      }
    }

    switch (currentView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
              <p className="text-muted-foreground">
                Bienvenido al sistema Andrei - Gestión de Proyectos
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Proyectos Activos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Proyectos Activos</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats.proyectos?.proyectos_activos || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">En ejecución</p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* En Planificación */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Planificación</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats.proyectos?.proyectos_planificacion || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Por iniciar</p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Total Clientes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats.clientes?.total_clientes || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Registrados</p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Equipos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Equipos</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats.equipos?.total || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Disponibles</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Proyectos</CardTitle>
                  <CardDescription>
                    Administra todos los proyectos de construcción
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setCurrentView("projects")}>
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
                  <Button onClick={() => setCurrentView("clientes")}>
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
                  <Button onClick={() => setCurrentView("equipos")}>
                    Ver Equipos
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case "projects":
        return <ProjectsList activeTab="proyectos" onNavigate={setCurrentView} />

      case "projects-licitaciones":
        return <ProjectsList activeTab="licitaciones" />

      case "projects-oportunidades":
        return <ProjectsList activeTab="oportunidades" />

      case "clientes":
        return <ClientesN />

      case "requisiciones":
        return <RequisicionesGeneral />

      case "equipos":
      case "equipos-informacion":
        return <EquiposInformacionN />

      case "equipos-status":
        return <EquiposStatusN />

      case "equipos-asignaciones":
        return <AsignacionesEquiposN />

      case "documentos":
        return <DocumentosHubN onDocumentClick={(docId) => setCurrentView(docId)} />

      case "doc-acuerdo-consorcio":
        return <DocumentFormN documentType="acuerdo-consorcio" />

      case "doc-carta-adhesion":
        return <DocumentFormN documentType="carta-adhesion" />

      case "doc-medidas-retorsion":
        return <DocumentFormN documentType="medidas-retorsion" />

      case "doc-no-incapacidad":
        return <DocumentFormN documentType="no-incapacidad" />

      case "doc-pacto-integridad":
        return <DocumentFormN documentType="pacto-integridad" />

      case "doc-carta-compromiso-verde":
        return <DocumentFormN documentType="carta-compromiso-verde" />

      default:
        return <DocumentosHubN onDocumentClick={(docId) => setCurrentView(docId)} />
    }
  }

  return (
    <AppLayout currentView={currentView} onNavigate={setCurrentView} pageTitle={pageTitle}>
      {renderContent()}
    </AppLayout>
  )
}
