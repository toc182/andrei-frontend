/**
 * SolicitudesPagoGeneral Component
 * Vista consolidada de todas las solicitudes de pago de todos los proyectos
 * Accesible desde el sidebar principal
 */

import { useState, useEffect, ReactNode } from "react"
import { Plus, Check, X, Clock, AlertCircle, Send, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import api from "../services/api"
import { formatMoney } from "../utils/formatters"
import SolicitudPagoForm from "../components/forms/SolicitudPagoForm"

// --- Types ---

interface SolicitudPago {
  id: number
  proyecto_id: number
  numero: string
  fecha: string
  proveedor: string
  preparado_por: number
  solicitado_por: number | null
  requisicion_id: number | null
  subtotal: number
  descuentos: number
  impuestos: number
  monto_total: number
  estado: string
  observaciones: string | null
  beneficiario: string | null
  banco: string | null
  tipo_cuenta: string | null
  numero_cuenta: string | null
  proyecto_nombre?: string
  preparado_nombre?: string
  solicitado_nombre?: string
}

interface SolicitudItem {
  id: number
  cantidad: number
  unidad: string
  descripcion: string
  descripcion_detallada: string | null
  precio_unitario: number
  precio_total: number
}

interface SolicitudAjuste {
  id: number
  tipo: string
  descripcion: string
  porcentaje: number | null
  monto: number
}

interface ProjectOption {
  id: number
  nombre: string
  nombre_corto?: string
  sp_prefijo?: string | null
}

interface BadgeConfig {
  variant: 'secondary' | 'outline' | 'default' | 'destructive'
  label: string
  icon: React.ComponentType<{ className?: string }>
}

// --- Helpers ---

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TRANSICIONES: Record<string, string[]> = {
  'borrador': ['pendiente', 'rechazada'],
  'pendiente': ['aprobada', 'rechazada'],
  'aprobada': ['pagada', 'rechazada'],
  'rechazada': ['borrador'],
  'pagada': []
}

const estadoLabels: Record<string, string> = {
  'borrador': 'Borrador',
  'pendiente': 'Pendiente',
  'aprobada': 'Aprobada',
  'rechazada': 'Rechazada',
  'pagada': 'Pagada'
}

const getEstadoBadge = (estado: string): ReactNode => {
  const variants: Record<string, BadgeConfig> = {
    'borrador': { variant: 'secondary', label: 'Borrador', icon: Clock },
    'pendiente': { variant: 'outline', label: 'Pendiente', icon: Send },
    'aprobada': { variant: 'default', label: 'Aprobada', icon: Check },
    'rechazada': { variant: 'destructive', label: 'Rechazada', icon: X },
    'pagada': { variant: 'default', label: 'Pagada', icon: CreditCard }
  }

  const config = variants[estado] || { variant: 'secondary' as const, label: estado, icon: Clock }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

export default function SolicitudesPagoGeneral() {
  const [solicitudes, setSolicitudes] = useState<SolicitudPago[]>([])
  const [proyectos, setProyectos] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterProyecto, setFilterProyecto] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  // Detail modal
  const [showDetail, setShowDetail] = useState(false)
  const [detailSolicitud, setDetailSolicitud] = useState<SolicitudPago | null>(null)
  const [detailItems, setDetailItems] = useState<SolicitudItem[]>([])
  const [detailAjustes, setDetailAjustes] = useState<SolicitudAjuste[]>([])

  // Estado change
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [estadoTarget, setEstadoTarget] = useState<SolicitudPago | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [changingEstado, setChangingEstado] = useState(false)

  useEffect(() => {
    loadData()
  }, [filterEstado])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = filterEstado !== 'all' ? `?estado=${filterEstado}` : ''
      const [solRes, projRes] = await Promise.all([
        api.get(`/solicitudes-pago${params}`),
        api.get('/projects')
      ])

      if (solRes.data.success) {
        setSolicitudes(solRes.data.solicitudes || [])
      }
      if (projRes.data.success) {
        setProyectos(projRes.data.proyectos || projRes.data.data || [])
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Error al cargar las solicitudes de pago')
    } finally {
      setLoading(false)
    }
  }

  // Filter
  const filteredSolicitudes = solicitudes.filter(sol => {
    if (filterProyecto !== 'all' && sol.proyecto_id !== parseInt(filterProyecto)) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        sol.numero?.toLowerCase().includes(search) ||
        sol.proveedor?.toLowerCase().includes(search) ||
        sol.proyecto_nombre?.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Stats
  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas: solicitudes.filter(s => s.estado === 'aprobada').length,
    montoTotal: solicitudes.reduce((sum, s) => sum + (parseFloat(String(s.monto_total)) || 0), 0)
  }

  // New solicitud: first select project
  const handleNewSolicitud = () => {
    setShowProjectSelector(true)
  }

  const handleProjectSelected = (projectIdStr: string) => {
    const pid = parseInt(projectIdStr)
    setSelectedProjectId(pid)
    setShowProjectSelector(false)
    setShowForm(true)
  }

  // Detail
  const openDetail = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`)
      if (response.data.success) {
        setDetailSolicitud(response.data.solicitud)
        setDetailItems(response.data.items || [])
        setDetailAjustes(response.data.ajustes || [])
        setShowDetail(true)
      }
    } catch (err) {
      console.error('Error loading detail:', err)
    }
  }

  // Estado change
  const handleChangeEstado = async () => {
    if (!nuevoEstado || !estadoTarget) return
    try {
      setChangingEstado(true)
      await api.patch(`/solicitudes-pago/${estadoTarget.id}/estado`, { estado: nuevoEstado })
      setShowEstadoModal(false)
      setShowDetail(false)
      await loadData()
    } catch (err) {
      console.error('Error changing estado:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al cambiar el estado')
    } finally {
      setChangingEstado(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando solicitudes de pago...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de Pago</h1>
          <p className="text-muted-foreground">Vista consolidada de todos los proyectos</p>
        </div>
        <Button onClick={handleNewSolicitud}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-600">{stats.pendientes}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{stats.aprobadas}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold whitespace-nowrap">{formatMoney(stats.montoTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Buscar por numero, proveedor, proyecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={filterProyecto} onValueChange={setFilterProyecto}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {proyectos.map(p => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.nombre_corto || p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(estadoLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Numero</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead className="hidden sm:table-cell">Proveedor</TableHead>
              <TableHead className="text-right w-[100px]">Total</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSolicitudes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No se encontraron solicitudes de pago
                </TableCell>
              </TableRow>
            ) : (
              filteredSolicitudes.map((sol) => (
                <TableRow
                  key={sol.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(sol)}
                >
                  <TableCell className="font-medium">
                    <div>{sol.numero}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(sol.fecha)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs bg-muted px-2 py-1 rounded w-fit">
                      {sol.proyecto_nombre || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                      {sol.proveedor}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{sol.proveedor}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(sol.monto_total)}
                  </TableCell>
                  <TableCell>{getEstadoBadge(sol.estado)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Project Selector Modal */}
      <Dialog open={showProjectSelector} onOpenChange={setShowProjectSelector}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Seleccionar Proyecto</DialogTitle>
            <DialogDescription>
              Selecciona el proyecto para la nueva solicitud de pago
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select onValueChange={handleProjectSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proyecto" />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.nombre_corto || p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Modal */}
      {showForm && selectedProjectId && (
        <SolicitudPagoForm
          projectId={selectedProjectId}
          isOpen={showForm}
          onClose={() => { setShowForm(false); setSelectedProjectId(null) }}
          onSave={() => loadData()}
        />
      )}

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Solicitud</DialogTitle>
            <DialogDescription>
              {detailSolicitud && <>{detailSolicitud.numero} - {detailSolicitud.proveedor}</>}
            </DialogDescription>
          </DialogHeader>

          {detailSolicitud && (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg text-sm">
                <div>
                  <div className="text-muted-foreground">Proyecto</div>
                  <div className="font-medium">{detailSolicitud.proyecto_nombre || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Fecha</div>
                  <div className="font-medium">{formatDate(detailSolicitud.fecha)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Preparado por</div>
                  <div className="font-medium">{detailSolicitud.preparado_nombre || '-'}</div>
                </div>
                {detailSolicitud.solicitado_nombre && (
                  <div>
                    <div className="text-muted-foreground">Solicitado por</div>
                    <div className="font-medium">{detailSolicitud.solicitado_nombre}</div>
                  </div>
                )}
              </div>

              {detailSolicitud.observaciones && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="text-muted-foreground mb-1">Observaciones</div>
                  <div>{detailSolicitud.observaciones}</div>
                </div>
              )}

              {/* Items */}
              {detailItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-sm">Items ({detailItems.length})</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Detalle</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">P.Unit</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell className="text-right">{item.cantidad} {item.unidad}</TableCell>
                            <TableCell className="text-right">{formatMoney(item.precio_unitario)}</TableCell>
                            <TableCell className="text-right">{formatMoney(item.precio_total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Ajustes */}
              {detailAjustes.length > 0 && (
                <div className="space-y-1">
                  {detailAjustes.map((ajuste) => (
                    <div key={ajuste.id} className="flex justify-between items-center text-sm p-2 border rounded">
                      <div>
                        <Badge variant={ajuste.tipo === 'impuesto' ? 'outline' : 'secondary'} className="mr-2 text-xs">
                          {ajuste.tipo === 'impuesto' ? 'Imp' : 'Desc'}
                        </Badge>
                        {ajuste.descripcion}
                      </div>
                      <span className={`font-medium ${ajuste.tipo === 'descuento' ? 'text-red-600' : ''}`}>
                        {ajuste.tipo === 'descuento' ? '-' : '+'}{formatMoney(ajuste.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatMoney(detailSolicitud.subtotal)}</span>
                </div>
                {parseFloat(String(detailSolicitud.descuentos)) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Descuentos:</span>
                    <span className="text-red-600">-{formatMoney(detailSolicitud.descuentos)}</span>
                  </div>
                )}
                {parseFloat(String(detailSolicitud.impuestos)) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuestos:</span>
                    <span>+{formatMoney(detailSolicitud.impuestos)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>TOTAL:</span>
                  <span>{formatMoney(detailSolicitud.monto_total)}</span>
                </div>
              </div>

              {/* Estado section */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>{getEstadoBadge(detailSolicitud.estado)}</div>
                {(TRANSICIONES[detailSolicitud.estado] || []).length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEstadoTarget(detailSolicitud)
                      setNuevoEstado('')
                      setShowEstadoModal(true)
                    }}
                  >
                    Cambiar Estado
                  </Button>
                )}
              </div>

              {/* Bank data */}
              {(detailSolicitud.beneficiario || detailSolicitud.banco) && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="font-medium mb-1">Datos Bancarios</div>
                  <div className="grid grid-cols-2 gap-2">
                    {detailSolicitud.beneficiario && <div><span className="text-muted-foreground">Beneficiario:</span> {detailSolicitud.beneficiario}</div>}
                    {detailSolicitud.banco && <div><span className="text-muted-foreground">Banco:</span> {detailSolicitud.banco}</div>}
                    {detailSolicitud.tipo_cuenta && <div><span className="text-muted-foreground">Tipo:</span> <span className="capitalize">{detailSolicitud.tipo_cuenta}</span></div>}
                    {detailSolicitud.numero_cuenta && <div><span className="text-muted-foreground">Cuenta:</span> {detailSolicitud.numero_cuenta}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Estado Change Modal */}
      <Dialog open={showEstadoModal} onOpenChange={setShowEstadoModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>
              {estadoTarget && <>Solicitud: <strong>{estadoTarget.numero}</strong></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Estado actual</Label>
              <div className="mt-1">{estadoTarget && getEstadoBadge(estadoTarget.estado)}</div>
            </div>
            <div>
              <Label>Nuevo estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {estadoTarget && (TRANSICIONES[estadoTarget.estado] || []).map(estado => (
                    <SelectItem key={estado} value={estado}>{estadoLabels[estado]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEstadoModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangeEstado} disabled={!nuevoEstado || changingEstado}>
              {changingEstado ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
