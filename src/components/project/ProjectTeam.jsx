/**
 * ProjectTeam Component
 * Displays team members assigned to the project
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Mail, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// This will be populated from backend in future phases
// For now, showing placeholder structure
export default function ProjectTeam({ project }) {
  // Placeholder team data - will come from backend later
  const team = project?.datos_adicionales?.team || []

  const getRoleBadge = (role) => {
    const variants = {
      'admin': { variant: 'destructive', label: 'Administrador' },
      'project_manager': { variant: 'default', label: 'Gerente de Proyecto' },
      'supervisor': { variant: 'secondary', label: 'Supervisor' },
      'operario': { variant: 'outline', label: 'Operario' }
    }

    const config = variants[role] || { variant: 'outline', label: role }
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Equipo del Proyecto
        </CardTitle>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No hay miembros asignados aún</p>
            <p className="text-xs mt-1">
              La asignación de equipo se implementará en las próximas fases
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {team.map((member, index) => (
              <div key={index} className="flex items-start justify-between p-3 rounded-lg border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{member.nombre}</p>
                    {getRoleBadge(member.rol)}
                  </div>
                  {member.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.email}
                    </p>
                  )}
                  {member.telefono && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {member.telefono}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
