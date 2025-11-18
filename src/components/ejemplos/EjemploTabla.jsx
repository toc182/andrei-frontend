/**
 * EJEMPLO DE TABLA - Shadcn Table Component
 *
 * Este componente demuestra:
 * - Table responsive de Shadcn
 * - Datos de ejemplo (proyectos)
 * - Badges para estados
 * - Botones de acciones
 * - Estilos profesionales
 *
 * USO:
 * import { EjemploTabla } from "@/components/ejemplos/EjemploTabla"
 *
 * <EjemploTabla />
 */

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// Datos de ejemplo - proyectos
const proyectosEjemplo = [
  {
    id: 1,
    nombre: "Proyecto Alpha",
    cliente: "Pinellas S.A.",
    estado: "activo",
    fecha: "2025-01-15",
    presupuesto: "$50,000"
  },
  {
    id: 2,
    nombre: "Proyecto Beta",
    cliente: "Tech Corp",
    estado: "en_progreso",
    fecha: "2025-02-01",
    presupuesto: "$75,000"
  },
  {
    id: 3,
    nombre: "Proyecto Gamma",
    cliente: "Innovation Ltd",
    estado: "completado",
    fecha: "2024-12-20",
    presupuesto: "$30,000"
  },
  {
    id: 4,
    nombre: "Proyecto Delta",
    cliente: "Future Systems",
    estado: "pausado",
    fecha: "2025-01-30",
    presupuesto: "$100,000"
  },
  {
    id: 5,
    nombre: "Proyecto Epsilon",
    cliente: "Global Services",
    estado: "activo",
    fecha: "2025-02-10",
    presupuesto: "$45,000"
  },
]

// Mapeo de estados a variantes de Badge
const estadoVariante = {
  activo: "default",        // Azul (primary)
  en_progreso: "secondary", // Gris
  completado: "outline",    // Verde outline
  pausado: "destructive",   // Rojo
}

const estadoTexto = {
  activo: "Activo",
  en_progreso: "En Progreso",
  completado: "Completado",
  pausado: "Pausado",
}

export function EjemploTabla() {
  const handleVer = (proyecto) => {
    alert(`Ver detalles de: ${proyecto.nombre}`)
  }

  const handleEditar = (proyecto) => {
    alert(`Editar: ${proyecto.nombre}`)
  }

  const handleEliminar = (proyecto) => {
    if (confirm(`¿Eliminar proyecto "${proyecto.nombre}"?`)) {
      alert("Proyecto eliminado (simulado)")
    }
  }

  return (
    <div className="w-full">
      <Table>
        <TableCaption>Lista de proyectos de ejemplo</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Nombre del Proyecto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Presupuesto</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proyectosEjemplo.map((proyecto) => (
            <TableRow key={proyecto.id}>
              <TableCell className="font-medium">#{proyecto.id}</TableCell>
              <TableCell className="font-semibold">{proyecto.nombre}</TableCell>
              <TableCell>{proyecto.cliente}</TableCell>
              <TableCell>
                <Badge variant={estadoVariante[proyecto.estado]}>
                  {estadoTexto[proyecto.estado]}
                </Badge>
              </TableCell>
              <TableCell>{proyecto.fecha}</TableCell>
              <TableCell className="text-right font-medium">
                {proyecto.presupuesto}
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVer(proyecto)}
                  >
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditar(proyecto)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleEliminar(proyecto)}
                  >
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
