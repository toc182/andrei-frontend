/**
 * Dashboard Nuevo - Usando AppLayout con Shadcn
 * TEMPORAL - Para probar el nuevo layout antes de migrar todo
 */

import { useState } from "react"
import { AppLayout } from "../components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TailwindTest } from "../components/TailwindTest"
import { Building2, Users, Truck, TrendingUp } from "lucide-react"
import ProjectsHub from "./ProjectsHub"
import ClientesN from "./ClientesN"
import DocumentosHubN from "./DocumentosHubN"

export default function DashboardNew() {
  const [currentView, setCurrentView] = useState("dashboard")

  const renderContent = () => {
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

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Proyectos Activos</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">En ejecución</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Planificación</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5</div>
                  <p className="text-xs text-muted-foreground">Por iniciar</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">48</div>
                  <p className="text-xs text-muted-foreground">Registrados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Equipos</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">Disponibles</p>
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

            {/* Demo de Componentes */}
            <Card>
              <CardHeader>
                <CardTitle>Demo de Componentes Shadcn</CardTitle>
                <CardDescription>
                  Ejemplos de botones, modales y tablas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TailwindTest />
              </CardContent>
            </Card>
          </div>
        )

      case "projects":
        return <ProjectsHub activeTab="proyectos" />

      case "projects-licitaciones":
        return <ProjectsHub activeTab="licitaciones" />

      case "projects-oportunidades":
        return <ProjectsHub activeTab="oportunidades" />

      case "clientes":
        return <ClientesN />

      case "equipos":
      case "equipos-informacion":
      case "equipos-status":
      case "equipos-asignaciones":
        return (
          <div>
            <h2 className="text-2xl font-bold">Equipos</h2>
            <p className="text-muted-foreground mt-2">
              Aquí irá el contenido de equipos (se migrará después)
            </p>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <p>Vista de {currentView}</p>
              </CardContent>
            </Card>
          </div>
        )

      case "documentos":
        return <DocumentosHubN onDocumentClick={(docId) => setCurrentView(docId)} />

      case "doc-acuerdo-consorcio":
      case "doc-carta-adhesion":
      case "doc-medidas-retorsion":
      case "doc-no-incapacidad":
      case "doc-pacto-integridad":
      case "doc-carta-compromiso-verde":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              {currentView === "doc-acuerdo-consorcio" && "Acuerdo de Consorcio"}
              {currentView === "doc-carta-adhesion" && "Carta de Adhesión a Principios de Sostenibilidad"}
              {currentView === "doc-medidas-retorsion" && "Declaración Jurada de Medidas de Retorsión"}
              {currentView === "doc-no-incapacidad" && "Declaración Jurada de No Incapacidad para Contratar"}
              {currentView === "doc-pacto-integridad" && "Pacto de Integridad"}
              {currentView === "doc-carta-compromiso-verde" && "Carta de Compromiso Verde"}
            </h2>
            <p className="text-muted-foreground">
              Formulario para generar este documento (se migrará después)
            </p>
          </div>
        )

      default:
        return <DocumentosHubN onDocumentClick={(docId) => setCurrentView(docId)} />
    }
  }

  return (
    <AppLayout currentView={currentView} onNavigate={setCurrentView}>
      {renderContent()}
    </AppLayout>
  )
}
