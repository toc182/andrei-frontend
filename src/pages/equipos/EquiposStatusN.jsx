/**
 * Página de Status de Equipos - Migrada a Shadcn/ui
 *
 * Muestra el estado actual de cada equipo con:
 * - Dos tablas separadas (Pinellas y COCP)
 * - Badges de estado (En Operación, Standby, Mantenimiento, Fuera de Servicio)
 * - Modal de detalles del equipo
 * - Formulario para actualizar status
 * - Auto-refresh cada 5 minutos
 * - Refresh manual
 * - Sin FontAwesome, sin CSS custom
 */

import { useState, useEffect } from 'react'
import api from '../../services/api'
import logo from '../../assets/logo.png'
import cocpLogo from '../../assets/LogoCOCPfondoblanco.png'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function EquiposStatusN() {
  const [equiposPinellas, setEquiposPinellas] = useState([])
  const [equiposCOCP, setEquiposCOCP] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)

  // Estados para modales
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedEquipo, setSelectedEquipo] = useState(null)
  const [statusFormOpen, setStatusFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado del formulario
  const [formData, setFormData] = useState({
    estado: '',
    proyecto: '',
    responsable: '',
    rata_mes: '',
    observaciones_status: '',
  })

  // Mapeo de estados a badges
  const getEstadoBadgeVariant = (estado) => {
    const estadoLower = (estado || '').toLowerCase()

    if (estadoLower.includes('operacion') || estadoLower.includes('operativo')) {
      return { label: 'En Operación', variant: 'default' } // Verde
    }
    if (estadoLower.includes('standby')) {
      return { label: 'Standby', variant: 'secondary' } // Azul/Gris
    }
    if (estadoLower.includes('mantenimiento')) {
      return { label: 'En Mantenimiento', variant: 'outline' } // Amarillo
    }
    if (estadoLower.includes('fuera')) {
      return { label: 'Fuera de Servicio', variant: 'destructive' } // Rojo
    }

    return { label: 'En Operación', variant: 'default' }
  }

  // Cargar equipos y sus estados desde API
  const loadEquiposStatus = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/equipos')

      if (response.data.success) {
        // Mapear los datos
        const equiposConStatus = response.data.data.map((equipo) => ({
          ...equipo,
          ubicacion: equipo.proyecto || 'No especificada',
          ultima_revision: equipo.updated_at,
          estado: equipo.estado || 'en_operacion',
        }))

        // Separar equipos por propietario
        const pinellas = equiposConStatus.filter((equipo) => equipo.owner === 'Pinellas')
        const cocp = equiposConStatus.filter((equipo) => equipo.owner === 'COCP')

        setEquiposPinellas(pinellas)
        setEquiposCOCP(cocp)
        setLastUpdate(new Date())
      } else {
        setError('Error al cargar estatus de equipos')
      }
    } catch (error) {
      console.error('Error loading equipos status:', error)
      setError('Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEquiposStatus()

    // Auto-refresh cada 5 minutos
    const interval = setInterval(loadEquiposStatus, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // Formato de fecha
  const formatLastUpdate = (date) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .replace(/\s/g, '-')
      .replace('sept', 'sep')
  }

  // Handlers
  const handleRefresh = () => {
    loadEquiposStatus()
  }

  const handleRowClick = (equipo) => {
    setSelectedEquipo(equipo)
    setDetailsOpen(true)
  }

  const handleOpenStatusForm = () => {
    setFormData({
      estado: selectedEquipo?.estado || 'en_operacion',
      proyecto: selectedEquipo?.ubicacion || '',
      responsable: selectedEquipo?.responsable || '',
      rata_mes: selectedEquipo?.rata_mes || '',
      observaciones_status: selectedEquipo?.observaciones_status || '',
    })
    setStatusFormOpen(true)
    setDetailsOpen(false)
  }

  const handleFormChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await api.put(`/equipos/${selectedEquipo.id}/status`, formData)
      await loadEquiposStatus()
      setStatusFormOpen(false)
      setSelectedEquipo(null)
    } catch (error) {
      console.error('Error al actualizar status:', error)
      setError('Error al actualizar el status del equipo')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Renderizar tabla de equipos
  const renderTable = (equipos, emptyMessage) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="w-[150px]">Estado</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="w-[150px]">Última Act.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            equipos.map((equipo) => {
              const estadoInfo = getEstadoBadgeVariant(equipo.estado)
              return (
                <TableRow
                  key={equipo.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(equipo)}
                >
                  <TableCell className="font-medium">
                    {equipo.codigo || 'Sin código'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium">{equipo.descripcion}</div>
                      <div className="text-sm text-muted-foreground">
                        {equipo.marca} {equipo.modelo}
                      </div>
                      {equipo.ano && (
                        <div className="text-xs text-muted-foreground">{equipo.ano}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoInfo.variant}>{estadoInfo.label}</Badge>
                  </TableCell>
                  <TableCell>{equipo.ubicacion || 'No especificada'}</TableCell>
                  <TableCell className="text-sm">
                    {equipo.updated_at
                      ? formatLastUpdate(new Date(equipo.updated_at))
                      : formatLastUpdate(lastUpdate)}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando estados de equipos...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !statusFormOpen) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={loadEquiposStatus}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end">
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Tabla de Equipos de Pinellas */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <img src={logo} alt="Pinellas Logo" className="h-8 object-contain" />
        </div>
        {renderTable(equiposPinellas, 'No hay equipos de Pinellas disponibles')}
      </div>

      {/* Tabla de Equipos de COCP */}
      <div className="space-y-4 mt-8">
        <div className="flex justify-center">
          <img src={cocpLogo} alt="COCP Logo" className="h-8 object-contain" />
        </div>
        {renderTable(equiposCOCP, 'No hay equipos de COCP disponibles')}
      </div>

      {/* Modal de Detalles */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalles del Equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Descripción:</span>
              <span className="col-span-2">{selectedEquipo?.descripcion}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Marca:</span>
              <span className="col-span-2">{selectedEquipo?.marca}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Modelo:</span>
              <span className="col-span-2">{selectedEquipo?.modelo}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Año:</span>
              <span className="col-span-2">{selectedEquipo?.ano || 'No especificado'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Estado:</span>
              <span className="col-span-2">
                {selectedEquipo && (
                  <Badge variant={getEstadoBadgeVariant(selectedEquipo.estado).variant}>
                    {getEstadoBadgeVariant(selectedEquipo.estado).label}
                  </Badge>
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Ubicación:</span>
              <span className="col-span-2">
                {selectedEquipo?.ubicacion || 'No especificada'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Responsable:</span>
              <span className="col-span-2">
                {selectedEquipo?.responsable || 'No asignado'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Rata Mensual:</span>
              <span className="col-span-2">
                {selectedEquipo?.rata_mes
                  ? `$${parseFloat(selectedEquipo.rata_mes).toLocaleString()}`
                  : 'No especificado'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Propietario:</span>
              <span className="col-span-2">{selectedEquipo?.owner}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Observaciones:</span>
              <span className="col-span-2">
                {selectedEquipo?.observaciones || 'Sin observaciones'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Última Act.:</span>
              <span className="col-span-2">
                {selectedEquipo?.ultima_revision
                  ? formatLastUpdate(new Date(selectedEquipo.ultima_revision))
                  : 'Sin registro'}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleOpenStatusForm}>Actualizar Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Formulario de Status */}
      <Dialog open={statusFormOpen} onOpenChange={setStatusFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Actualizar Status del Equipo</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Info del equipo */}
            <div className="rounded-md bg-muted p-3">
              <span className="font-semibold">
                {selectedEquipo?.codigo || 'Sin código'} - {selectedEquipo?.descripcion}
              </span>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select
                value={formData.estado}
                onValueChange={(value) => handleFormChange('estado', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_operacion">En Operación</SelectItem>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                  <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación/Proyecto */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ubicación/Proyecto</label>
              <Input
                type="text"
                value={formData.proyecto}
                onChange={(e) => handleFormChange('proyecto', e.target.value)}
                placeholder="Proyecto donde se encuentra el equipo"
              />
            </div>

            {/* Responsable */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsable</label>
              <Input
                type="text"
                value={formData.responsable}
                onChange={(e) => handleFormChange('responsable', e.target.value)}
                placeholder="Persona responsable del equipo"
              />
            </div>

            {/* Rata Mensual */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rata Mensual</label>
              <Input
                type="number"
                step="0.01"
                value={formData.rata_mes}
                onChange={(e) => handleFormChange('rata_mes', e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Observaciones */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Observaciones</label>
              <Textarea
                rows={3}
                value={formData.observaciones_status}
                onChange={(e) =>
                  handleFormChange('observaciones_status', e.target.value)
                }
                placeholder="Observaciones sobre el status actual del equipo..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusFormOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
