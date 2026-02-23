/**
 * ProjectSolicitudesPago Component
 * Solicitudes de pago within a project context
 * Features: Prefix config, list with filters, create/edit/detail modals, state changes
 */

import { useState, useEffect, ReactNode } from "react"
import { useAuth } from "../../context/AuthContext"
import { Plus, Check, X, Clock, Settings, Banknote, Send, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
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
import api from "../../services/api"
import { formatMoney } from "../../utils/formatters"
import SolicitudPagoForm from "../../components/forms/SolicitudPagoForm"

// --- Types ---

type EstadoSP = 'borrador' | 'pendiente' | 'aprobada' | 'rechazada' | 'pagada'

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
  estado: EstadoSP
  observaciones: string | null
  beneficiario: string | null
  banco: string | null
  tipo_cuenta: string | null
  numero_cuenta: string | null
  preparado_nombre?: string
  solicitado_nombre?: string
  requisicion_numero?: string
}

interface SolicitudItem {
  id: number
  solicitud_pago_id: number
  cantidad: number
  unidad: string
  descripcion: string
  descripcion_detallada: string | null
  precio_unitario: number
  precio_total: number
}

interface SolicitudAjuste {
  id: number
  solicitud_pago_id: number
  tipo: string
  descripcion: string
  porcentaje: number | null
  monto: number
}

interface BadgeConfig {
  variant: 'secondary' | 'outline' | 'default' | 'destructive'
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface ProjectSolicitudesPagoProps {
  projectId: number
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

export default function ProjectSolicitudesPago({ projectId }: ProjectSolicitudesPagoProps) {
  const { user } = useAuth()
  const canManage = !!user

  // Data
  const [solicitudes, setSolicitudes] = useState<SolicitudPago[]>([])
  const [spPrefijo, setSpPrefijo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Prefix config
  const [prefijoInput, setPrefijoInput] = useState('')
  const [savingPrefijo, setSavingPrefijo] = useState(false)

  // Filters
  const [filterEstado, setFilterEstado] = useState('all')

  // Form modal
  const [showForm, setShowForm] = useState(false)
  const [editingSolicitud, setEditingSolicitud] = useState<SolicitudPago | null>(null)
  const [editingItems, setEditingItems] = useState<SolicitudItem[]>([])
  const [editingAjustes, setEditingAjustes] = useState<SolicitudAjuste[]>([])

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

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    loadSolicitudes()
  }, [projectId, filterEstado])

  const loadSolicitudes = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = filterEstado !== 'all' ? `?estado=${filterEstado}` : ''
      const response = await api.get(`/solicitudes-pago/project/${projectId}${params}`)
      if (response.data.success) {
        setSolicitudes(response.data.solicitudes || [])
        setSpPrefijo(response.data.sp_prefijo)
      }
    } catch (err) {
      console.error('Error loading solicitudes:', err)
      setError('Error al cargar las solicitudes de pago')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePrefijo = async () => {
    if (!prefijoInput.trim()) return
    try {
      setSavingPrefijo(true)
      await api.put(`/solicitudes-pago/project/${projectId}/prefijo`, { prefijo: prefijoInput.trim().toUpperCase() })
      setSpPrefijo(prefijoInput.trim().toUpperCase())
      setPrefijoInput('')
    } catch (err) {
      console.error('Error saving prefijo:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al guardar el prefijo')
    } finally {
      setSavingPrefijo(false)
    }
  }

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
      alert('Error al cargar el detalle')
    }
  }

  const openEditForm = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`)
      if (response.data.success) {
        setEditingSolicitud(response.data.solicitud)
        setEditingItems(response.data.items || [])
        setEditingAjustes(response.data.ajustes || [])
        setShowDetail(false)
        setShowForm(true)
      }
    } catch (err) {
      console.error('Error loading for edit:', err)
    }
  }

  const handleChangeEstado = async () => {
    if (!nuevoEstado || !estadoTarget) return
    try {
      setChangingEstado(true)
      await api.patch(`/solicitudes-pago/${estadoTarget.id}/estado`, { estado: nuevoEstado })
      setShowEstadoModal(false)
      setShowDetail(false)
      await loadSolicitudes()
    } catch (err) {
      console.error('Error changing estado:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al cambiar el estado')
    } finally {
      setChangingEstado(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      setDeleteLoading(true)
      await api.delete(`/solicitudes-pago/${deletingId}`)
      setShowDeleteModal(false)
      setShowDetail(false)
      await loadSolicitudes()
    } catch (err) {
      console.error('Error deleting:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al eliminar')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Stats
  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas: solicitudes.filter(s => s.estado === 'aprobada').length,
    montoTotal: solicitudes.reduce((sum, s) => sum + (parseFloat(String(s.monto_total)) || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-semibold">Cargando solicitudes...</div>
          <div className="text-sm text-muted-foreground mt-2">Por favor espere</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // If no prefix configured, show setup prompt
  if (!spPrefijo) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center">
              <Settings className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-lg font-semibold">Configurar Prefijo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Antes de crear solicitudes de pago, configure la abreviatura del proyecto para la numeracion automatica.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ejemplo: COCP, MOP, ALM (se generara COCP-001, COCP-002, etc.)
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: COCP"
                value={prefijoInput}
                onChange={(e) => setPrefijoInput(e.target.value.toUpperCase())}
                maxLength={20}
                className="uppercase"
              />
              <Button onClick={handleSavePrefijo} disabled={!prefijoInput.trim() || savingPrefijo}>
                {savingPrefijo ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Solicitudes</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-yellow-600">{stats.pendientes}</div>
            <div className="text-sm text-muted-foreground">Pendientes</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-green-600">{stats.aprobadas}</div>
            <div className="text-sm text-muted-foreground">Aprobadas</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold whitespace-nowrap">{formatMoney(stats.montoTotal)}</div>
            <div className="text-sm text-muted-foreground">Monto Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 items-center">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="borrador">Borradores</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="aprobada">Aprobadas</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
              <SelectItem value="rechazada">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Prefijo: {spPrefijo}</span>
        </div>

        {canManage && (
          <Button onClick={() => { setEditingSolicitud(null); setEditingItems([]); setEditingAjustes([]); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {solicitudes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay solicitudes de pago
            </CardContent>
          </Card>
        ) : (
          solicitudes.map((sol) => (
            <Card
              key={sol.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openDetail(sol)}
            >
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{sol.numero}</div>
                    <div className="text-sm text-muted-foreground">{sol.proveedor}</div>
                  </div>
                  {getEstadoBadge(sol.estado)}
                </div>
                <div className="text-lg font-bold mb-1">{formatMoney(sol.monto_total)}</div>
                <div className="text-sm text-muted-foreground">{formatDate(sol.fecha)}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay solicitudes de pago
                    </TableCell>
                  </TableRow>
                ) : (
                  solicitudes.map((sol) => (
                    <TableRow
                      key={sol.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(sol)}
                    >
                      <TableCell className="font-medium">{sol.numero}</TableCell>
                      <TableCell>{formatDate(sol.fecha)}</TableCell>
                      <TableCell>{sol.proveedor}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(sol.monto_total)}</TableCell>
                      <TableCell>{getEstadoBadge(sol.estado)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Form Modal */}
      <SolicitudPagoForm
        projectId={projectId}
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingSolicitud(null); setEditingItems([]); setEditingAjustes([]) }}
        onSave={() => loadSolicitudes()}
        editingSolicitud={editingSolicitud}
        existingItems={editingItems}
        existingAjustes={editingAjustes}
      />

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de Solicitud
              {canManage && detailSolicitud && ['borrador', 'pendiente'].includes(detailSolicitud.estado) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 hover:bg-muted"
                  onClick={() => openEditForm(detailSolicitud)}
                  title="Editar solicitud"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailSolicitud && (
                <><strong>{detailSolicitud.numero}</strong> - {detailSolicitud.proveedor}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailSolicitud && (
            <div className="space-y-4 py-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Fecha</div>
                  <div className="font-medium">{formatDate(detailSolicitud.fecha)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Preparado por</div>
                  <div className="font-medium">{detailSolicitud.preparado_nombre || '-'}</div>
                </div>
                {detailSolicitud.solicitado_nombre && (
                  <div>
                    <div className="text-sm text-muted-foreground">Solicitado por</div>
                    <div className="font-medium">{detailSolicitud.solicitado_nombre}</div>
                  </div>
                )}
                {detailSolicitud.requisicion_numero && (
                  <div>
                    <div className="text-sm text-muted-foreground">Requisicion</div>
                    <div className="font-medium">{detailSolicitud.requisicion_numero}</div>
                  </div>
                )}
              </div>

              {detailSolicitud.observaciones && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Observaciones</div>
                  <div>{detailSolicitud.observaciones}</div>
                </div>
              )}

              {/* Items */}
              {detailItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Items ({detailItems.length})</h4>
                  <div className="space-y-2">
                    {detailItems.map((item) => (
                      <div key={item.id} className="p-3 border rounded-lg text-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{item.descripcion}</div>
                            {item.descripcion_detallada && (
                              <div className="text-muted-foreground text-xs mt-1">{item.descripcion_detallada}</div>
                            )}
                            <div className="text-muted-foreground">
                              {item.cantidad} {item.unidad} x {formatMoney(item.precio_unitario)}
                            </div>
                          </div>
                          <div className="font-medium">{formatMoney(item.precio_total)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ajustes */}
              {detailAjustes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Ajustes</h4>
                  <div className="space-y-1">
                    {detailAjustes.map((ajuste) => (
                      <div key={ajuste.id} className="flex justify-between items-center text-sm p-2 border rounded">
                        <div>
                          <Badge variant={ajuste.tipo === 'impuesto' ? 'outline' : 'secondary'} className="mr-2 text-xs">
                            {ajuste.tipo === 'impuesto' ? 'Imp' : 'Desc'}
                          </Badge>
                          {ajuste.descripcion}
                          {ajuste.porcentaje && <span className="text-muted-foreground ml-1">({ajuste.porcentaje}%)</span>}
                        </div>
                        <span className={`font-medium ${ajuste.tipo === 'descuento' ? 'text-red-600' : ''}`}>
                          {ajuste.tipo === 'descuento' ? '-' : '+'}{formatMoney(ajuste.monto)}
                        </span>
                      </div>
                    ))}
                  </div>
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

              {/* Bank data */}
              {(detailSolicitud.beneficiario || detailSolicitud.banco) && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Datos Bancarios
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailSolicitud.beneficiario && (
                      <div>
                        <div className="text-muted-foreground">Beneficiario</div>
                        <div>{detailSolicitud.beneficiario}</div>
                      </div>
                    )}
                    {detailSolicitud.banco && (
                      <div>
                        <div className="text-muted-foreground">Banco</div>
                        <div>{detailSolicitud.banco}</div>
                      </div>
                    )}
                    {detailSolicitud.tipo_cuenta && (
                      <div>
                        <div className="text-muted-foreground">Tipo Cuenta</div>
                        <div className="capitalize">{detailSolicitud.tipo_cuenta}</div>
                      </div>
                    )}
                    {detailSolicitud.numero_cuenta && (
                      <div>
                        <div className="text-muted-foreground">Numero Cuenta</div>
                        <div>{detailSolicitud.numero_cuenta}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Estado section */}
              <div className="space-y-3">
                <h4 className="font-medium">Estado</h4>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>{getEstadoBadge(detailSolicitud.estado)}</div>
                  {canManage && (TRANSICIONES[detailSolicitud.estado] || []).length > 0 && (
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
              </div>

              {/* Delete (only borrador) */}
              {canManage && detailSolicitud.estado === 'borrador' && (
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                    onClick={() => {
                      setDeletingId(detailSolicitud.id)
                      setShowDeleteModal(true)
                    }}
                  >
                    Eliminar Solicitud
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Estado Change Modal */}
      <Dialog open={showEstadoModal} onOpenChange={setShowEstadoModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>
              {estadoTarget && <>Solicitud: <strong>{estadoTarget.numero}</strong></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Estado Actual</Label>
              <div className="mt-1">{estadoTarget && getEstadoBadge(estadoTarget.estado)}</div>
            </div>
            <div>
              <Label>Nuevo Estado</Label>
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
          <DialogFooter className="flex gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setShowEstadoModal(false)} disabled={changingEstado} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleChangeEstado} disabled={!nuevoEstado || changingEstado} className="w-full sm:w-auto">
              {changingEstado ? 'Guardando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Solicitud</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. Solo se pueden eliminar solicitudes en borrador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Eliminando...' : 'Si, Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
