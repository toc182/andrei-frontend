/**
 * ProjectRequisiciones Component
 * Main container for requisition management within a project
 * Features: List requisitions, create, edit, change status, track history
 */

import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { Plus, FileText, Check, X, Clock, Search, AlertCircle, Settings, Archive } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import api from "../../services/api"
import RequisicionForm from "../../components/forms/RequisicionForm"

const formatMoney = (amount) => {
  if (!amount) return 'B/. 0.00'
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount).replace('$', 'B/.')
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Badge variants for each status
const getEstadoBadge = (estado) => {
  const variants = {
    'pendiente': { variant: 'secondary', label: 'Pendiente', icon: Clock },
    'en_cotizacion': { variant: 'outline', label: 'En Cotizacion', icon: Search },
    'por_aprobar': { variant: 'warning', label: 'Por Aprobar', icon: AlertCircle },
    'aprobada': { variant: 'success', label: 'Aprobada', icon: Check },
    'pagada': { variant: 'default', label: 'Pagada', icon: Check },
    'rechazada': { variant: 'destructive', label: 'Rechazada', icon: X }
  }

  const config = variants[estado] || { variant: 'secondary', label: estado, icon: Clock }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Valid state transitions
const getValidTransitions = (currentState) => {
  const transitions = {
    'pendiente': ['en_cotizacion', 'por_aprobar', 'rechazada'],
    'en_cotizacion': ['por_aprobar', 'pendiente', 'rechazada'],
    'por_aprobar': ['aprobada', 'rechazada', 'pendiente'],
    'aprobada': ['pagada', 'rechazada'],
    'pagada': [],
    'rechazada': ['pendiente']
  }
  return transitions[currentState] || []
}

const estadoLabels = {
  'pendiente': 'Pendiente',
  'en_cotizacion': 'En Cotizacion',
  'por_aprobar': 'Por Aprobar',
  'aprobada': 'Aprobada',
  'pagada': 'Pagada',
  'rechazada': 'Rechazada'
}

export default function ProjectRequisiciones({ projectId }) {
  const { user } = useAuth()
  const canManage = user?.rol === 'admin' || user?.rol === 'project_manager'

  const [requisiciones, setRequisiciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRequisicion, setEditingRequisicion] = useState(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedRequisicion, setSelectedRequisicion] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState({ requisicion: null, historial: [], items: [] })
  const [filterEstado, setFilterEstado] = useState('all')
  const [editingItems, setEditingItems] = useState([])
  const [showArchivarModal, setShowArchivarModal] = useState(false)
  const [archivarLoading, setArchivarLoading] = useState(false)

  useEffect(() => {
    loadRequisiciones()
  }, [projectId, filterEstado])

  const loadRequisiciones = async () => {
    try {
      setLoading(true)
      setError(null)
      // Si el filtro es "archivadas", pedir las archivadas al backend
      const params = filterEstado === 'archivadas' ? '?archivadas=true' : ''
      const response = await api.get(`/requisiciones/project/${projectId}${params}`)
      if (response.data.success) {
        setRequisiciones(response.data.requisiciones || [])
      }
    } catch (err) {
      console.error('Error loading requisiciones:', err)
      setError('Error al cargar las requisiciones')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data) => {
    try {
      if (editingRequisicion) {
        await api.put(`/requisiciones/${editingRequisicion.id}`, data)
      } else {
        await api.post('/requisiciones', data)
      }
      await loadRequisiciones()
      setShowForm(false)
      setEditingRequisicion(null)
    } catch (err) {
      console.error('Error saving requisicion:', err)
      throw err
    }
  }

  const handleArchivar = async () => {
    if (!historyData.requisicion) return

    try {
      setArchivarLoading(true)
      await api.patch(`/requisiciones/${historyData.requisicion.id}/archivar`)
      await loadRequisiciones()
      setShowArchivarModal(false)
      setShowHistoryModal(false)
      setHistoryData({ requisicion: null, historial: [], items: [] })
    } catch (err) {
      console.error('Error archivando requisicion:', err)
      alert(err.response?.data?.message || 'Error al archivar la requisicion')
    } finally {
      setArchivarLoading(false)
    }
  }

  const openStatusModal = (requisicion) => {
    setSelectedRequisicion(requisicion)
    setNewStatus('')
    setStatusComment('')
    setShowStatusModal(true)
  }

  const handleStatusChange = async () => {
    if (!newStatus) return

    try {
      setStatusLoading(true)
      await api.patch(`/requisiciones/${selectedRequisicion.id}/estado`, {
        estado: newStatus,
        comentario: statusComment
      })
      await loadRequisiciones()
      setShowStatusModal(false)
      setSelectedRequisicion(null)
    } catch (err) {
      console.error('Error changing status:', err)
      alert(err.response?.data?.message || 'Error al cambiar el estado')
    } finally {
      setStatusLoading(false)
    }
  }

  const openHistoryModal = async (requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`)
      if (response.data.success) {
        setHistoryData({
          requisicion: response.data.requisicion,
          historial: response.data.historial || [],
          items: response.data.items || []
        })
        setShowHistoryModal(true)
      }
    } catch (err) {
      console.error('Error loading history:', err)
      alert('Error al cargar el historial')
    }
  }

  const openEditForm = async (requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`)
      if (response.data.success) {
        setEditingRequisicion(response.data.requisicion)
        setEditingItems(response.data.items || [])
        setShowForm(true)
      }
    } catch (err) {
      console.error('Error loading requisicion:', err)
      alert('Error al cargar la requisicion')
    }
  }

  // Filter requisiciones
  const filteredRequisiciones = requisiciones.filter(req => {
    if (filterEstado === 'all') return true
    if (filterEstado === 'archivadas') return true // Ya viene filtrado del backend
    if (filterEstado === 'activas') return !['pagada', 'rechazada'].includes(req.estado)
    if (filterEstado === 'finalizadas') return ['pagada', 'rechazada'].includes(req.estado)
    return req.estado === filterEstado
  })

  // Calculate summary stats
  const stats = {
    total: requisiciones.length,
    pendientes: requisiciones.filter(r => r.estado === 'pendiente').length,
    porAprobar: requisiciones.filter(r => r.estado === 'por_aprobar').length,
    aprobadas: requisiciones.filter(r => r.estado === 'aprobada').length,
    pagadas: requisiciones.filter(r => r.estado === 'pagada').length,
    montoTotal: requisiciones.reduce((sum, r) => sum + parseFloat(r.monto_total || 0), 0),
    montoPagado: requisiciones.filter(r => r.estado === 'pagada').reduce((sum, r) => sum + parseFloat(r.monto_total || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-semibold">Cargando requisiciones...</div>
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Requisiciones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.porAprobar}</div>
            <div className="text-sm text-muted-foreground">Por Aprobar</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.pagadas}</div>
            <div className="text-sm text-muted-foreground">Pagadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{formatMoney(stats.montoPagado)}</div>
            <div className="text-sm text-muted-foreground">Total Pagado</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="finalizadas">Finalizadas</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="por_aprobar">Por Aprobar</SelectItem>
              <SelectItem value="aprobada">Aprobadas</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
              <SelectItem value="rechazada">Rechazadas</SelectItem>
              <SelectItem value="archivadas">Archivadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Requisicion
          </Button>
        )}
      </div>

      {/* Requisiciones List - Cards for mobile */}
      <div className="md:hidden space-y-3">
        {filteredRequisiciones.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay requisiciones para mostrar
            </CardContent>
          </Card>
        ) : (
          filteredRequisiciones.map((req) => (
            <Card
              key={req.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openHistoryModal(req)}
            >
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{req.numero}</div>
                    <div className="text-sm text-muted-foreground">{req.proveedor}</div>
                  </div>
                  {getEstadoBadge(req.estado)}
                </div>
                <div className="text-lg font-bold mb-2">{formatMoney(req.monto_total)}</div>
                <div className="text-sm text-muted-foreground mb-3">
                  {formatDate(req.fecha)}
                  {req.categoria_nombre && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: req.categoria_color }}
                      />
                      {req.categoria_nombre}
                    </span>
                  )}
                </div>
                {req.concepto && (
                  <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {req.concepto}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Requisiciones List - Table for desktop */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequisiciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay requisiciones para mostrar
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequisiciones.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openHistoryModal(req)}
                    >
                      <TableCell className="font-medium">{req.numero}</TableCell>
                      <TableCell>{formatDate(req.fecha)}</TableCell>
                      <TableCell>
                        <div>
                          <div>{req.proveedor}</div>
                          {req.concepto && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {req.concepto}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {req.categoria_nombre ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: req.categoria_color }}
                            />
                            <span>{req.categoria_nombre}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(req.monto_total)}
                      </TableCell>
                      <TableCell>{getEstadoBadge(req.estado)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          {canManage && ['pendiente', 'rechazada'].includes(req.estado) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(req.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Requisicion Form Modal */}
      <RequisicionForm
        projectId={projectId}
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingRequisicion(null)
          setEditingItems([])
        }}
        onSave={handleSave}
        editingRequisicion={editingRequisicion}
        existingItems={editingItems}
      />

      {/* Status Change Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cambiar Estado de Requisicion</DialogTitle>
            <DialogDescription>
              {selectedRequisicion && (
                <>Requisicion: <strong>{selectedRequisicion.numero}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Estado Actual</Label>
              <div>{selectedRequisicion && getEstadoBadge(selectedRequisicion.estado)}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newStatus">Nuevo Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="newStatus">
                  <SelectValue placeholder="Seleccione nuevo estado" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRequisicion && getValidTransitions(selectedRequisicion.estado).map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estadoLabels[estado]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statusComment">Comentario (opcional)</Label>
              <Textarea
                id="statusComment"
                placeholder="Agregar un comentario sobre este cambio..."
                rows={3}
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
              />
            </div>

            {newStatus === 'pagada' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Al marcar como pagada, se registrara automaticamente como gasto del proyecto.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowStatusModal(false)}
              disabled={statusLoading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={!newStatus || statusLoading}
              className="w-full sm:w-auto"
            >
              {statusLoading ? 'Guardando...' : 'Confirmar Cambio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de Requisicion
              {canManage && historyData.requisicion && ['pendiente', 'en_cotizacion'].includes(historyData.requisicion.estado) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 hover:bg-muted"
                  onClick={() => {
                    setShowHistoryModal(false)
                    openEditForm(historyData.requisicion)
                  }}
                  title="Editar requisición"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {historyData.requisicion && (
                <>
                  <strong>{historyData.requisicion.numero}</strong> - {historyData.requisicion.proveedor}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Requisicion Details */}
            {historyData.requisicion && (
              <div className="space-y-4">
                {/* Descripción */}
                {historyData.requisicion.concepto && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Descripción</div>
                    <div className="font-medium">{historyData.requisicion.concepto}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Subtotal</div>
                    <div className="font-medium">{formatMoney(historyData.requisicion.subtotal)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">ITBMS (7%)</div>
                    <div className="font-medium">{formatMoney(historyData.requisicion.itbms)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="font-medium text-lg">{formatMoney(historyData.requisicion.monto_total)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Fecha</div>
                    <div className="font-medium">{formatDate(historyData.requisicion.fecha)}</div>
                  </div>
                  {historyData.requisicion.categoria_nombre && (
                    <div>
                      <div className="text-sm text-muted-foreground">Categoria</div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: historyData.requisicion.categoria_color }}
                        />
                        <span>{historyData.requisicion.categoria_nombre}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items List */}
                {historyData.items && historyData.items.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Detalle ({historyData.items.length} items)</h4>
                    <div className="space-y-2">
                      {historyData.items.map((item, index) => (
                        <div key={item.id || index} className="p-3 border rounded-lg text-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">{item.descripcion}</div>
                              <div className="text-muted-foreground">
                                {item.cantidad} {item.unidad} x {formatMoney(item.precio_unitario)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div>{formatMoney(item.subtotal)}</div>
                              {item.aplica_itbms && (
                                <div className="text-xs text-muted-foreground">
                                  +ITBMS: {formatMoney(item.itbms)}
                                </div>
                              )}
                              <div className="font-medium">{formatMoney(item.total)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Estado Section */}
            {historyData.requisicion && (
              <div className="space-y-3">
                <h4 className="font-medium">Estado</h4>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getEstadoBadge(historyData.requisicion.estado)}
                  </div>
                  {canManage && getValidTransitions(historyData.requisicion.estado).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowHistoryModal(false)
                        openStatusModal(historyData.requisicion)
                      }}
                    >
                      Cambiar Estado
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* History Timeline */}
            <div className="space-y-4">
              <h4 className="font-medium">Historial de Cambios</h4>
              {historyData.historial.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No hay historial de cambios
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.historial.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.estado_anterior && (
                            <>
                              <Badge variant="outline">{estadoLabels[item.estado_anterior]}</Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge variant="default">{estadoLabels[item.estado_nuevo]}</Badge>
                        </div>
                        {item.comentario && (
                          <div className="text-sm text-muted-foreground">{item.comentario}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {item.usuario_nombre && <span>{item.usuario_nombre} - </span>}
                          {formatDate(item.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Archivar Section */}
            {canManage && historyData.requisicion && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => setShowArchivarModal(true)}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archivar Requisicion
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmacion para Archivar */}
      <Dialog open={showArchivarModal} onOpenChange={setShowArchivarModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              Archivar Requisicion
            </DialogTitle>
            <DialogDescription>
              Esta accion archivara la requisicion. Podra ser restaurada mas adelante si es necesario.
            </DialogDescription>
          </DialogHeader>

          {historyData.requisicion && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="font-medium">{historyData.requisicion.numero}</div>
                <div className="text-sm text-muted-foreground">{historyData.requisicion.proveedor}</div>
                <div className="text-sm">{formatMoney(historyData.requisicion.monto_total)}</div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowArchivarModal(false)}
              disabled={archivarLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchivar}
              disabled={archivarLoading}
            >
              {archivarLoading ? 'Archivando...' : 'Si, Archivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
