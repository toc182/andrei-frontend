import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Key } from 'lucide-react'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'

const rolLabels: Record<string, string> = {
  admin: 'Administrador',
  'co-admin': 'Co-Administrador',
  usuario: 'Usuario',
}

export default function MiCuentaPage() {
  const { user } = useAuth()
  const [showChangePassword, setShowChangePassword] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Cuenta</h1>
        <p className="text-muted-foreground">Información de tu cuenta</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Datos del usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Nombre</p>
            <p className="text-base font-medium">{user?.nombre}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-base font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rol</p>
            <p className="text-base font-medium">{rolLabels[user?.rol ?? ''] ?? user?.rol}</p>
          </div>
          <div className="pt-2">
            <Button onClick={() => setShowChangePassword(true)}>
              <Key className="mr-2 h-4 w-4" />
              Cambiar Contraseña
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordModal
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </div>
  )
}
