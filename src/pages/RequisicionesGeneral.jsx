/**
 * RequisicionesGeneral Component
 * Vista consolidada de todas las requisiciones de todos los proyectos
 * Accesible desde el sidebar principal
 */

import { useState, useEffect } from "react"
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
import api from "../services/api"
import RequisicionForm from "../components/forms/RequisicionForm"

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

export default function RequisicionesGeneral() {
  const [requisiciones, setRequisiciones] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterProyecto, setFilterProyecto] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [editingRequisicion, setEditingRequisicion] = useState(null)
  const [existingItems, setExistingItems] = useState([])

  // Estado change modal
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [estadoRequisicion, setEstadoRequisicion] = useState(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [comentarioEstado, setComentarioEstado] = useState('')
  const [changingEstado, setChangingEstado] = useState(false)

  // History modal
  const [showHistorial, setShowHistorial] = useState(false)
  const [historialRequisicion, setHistorialRequisicion] = useState(null)
  const [historialData, setHistorialData] = useState({ requisicion: null, items: [], historial: [] })

  // Archivar modal
  const [showArchivarModal, setShowArchivarModal] = useState(false)
  const [archivarLoading, setArchivarLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [filterEstado])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Si el filtro es "archivadas", pedir las archivadas al backend
      const params = filterEstado === 'archivadas' ? '?archivadas=true' : ''
      const [reqRes, projRes] = await Promise.all([
        api.get(`/requisiciones${params}`),
        api.get('/projects')
      ])

      if (reqRes.data.success) {
        setRequisiciones(reqRes.data.requisiciones)
      }
      if (projRes.data.success) {
        setProyectos(projRes.data.proyectos || projRes.data.data || [])
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Error al cargar las requisiciones')
    } finally {
      setLoading(false)
    }
  }

  // Filter requisiciones
  const filteredRequisiciones = requisiciones.filter(req => {
    // Si es archivadas, no filtrar por estado (ya viene del backend)
    if (filterEstado === 'archivadas') {
      // Solo filtrar por proyecto y búsqueda
    } else if (filterEstado !== 'all' && req.estado !== filterEstado) return false
    if (filterProyecto !== 'all' && req.project_id !== parseInt(filterProyecto)) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        req.numero?.toLowerCase().includes(search) ||
        req.proveedor?.toLowerCase().includes(search) ||
        req.proyecto_nombre?.toLowerCase().includes(search) ||
        req.concepto?.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Stats
  const stats = {
    total: requisiciones.length,
    porAprobar: requisiciones.filter(r => r.estado === 'por_aprobar').length,
    pagadas: requisiciones.filter(r => r.estado === 'pagada').length,
    montoTotal: requisiciones.reduce((sum, r) => sum + (parseFloat(r.monto_total) || 0), 0)
  }

  // Handle new requisition - first select project
  const handleNewRequisicion = () => {
    setShowProjectSelector(true)
  }

  const handleProjectSelected = (projectId) => {
    setSelectedProjectId(parseInt(projectId))
    setShowProjectSelector(false)
    setEditingRequisicion(null)
    setExistingItems([])
    setShowForm(true)
  }

  const handleSaveRequisicion = async (data) => {
    try {
      if (editingRequisicion) {
        await api.put(`/requisiciones/${editingRequisicion.id}`, data)
      } else {
        await api.post('/requisiciones', data)
      }
      setShowForm(false)
      setEditingRequisicion(null)
      setSelectedProjectId(null)
      loadData()
    } catch (err) {
      throw err
    }
  }

  const handleEditRequisicion = async (requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`)
      if (response.data.success) {
        setSelectedProjectId(requisicion.project_id)
        setEditingRequisicion(response.data.requisicion)
        setExistingItems(response.data.items || [])
        setShowForm(true)
      }
    } catch (err) {
      console.error('Error loading requisicion:', err)
    }
  }

  const handleArchivar = async () => {
    if (!historialRequisicion) return

    try {
      setArchivarLoading(true)
      await api.patch(`/requisiciones/${historialRequisicion.id}/archivar`)
      await loadData()
      setShowArchivarModal(false)
      setShowHistorial(false)
      setHistorialRequisicion(null)
      setHistorialData({ requisicion: null, items: [], historial: [] })
    } catch (err) {
      console.error('Error archivando requisicion:', err)
      alert(err.response?.data?.message || 'Error al archivar la requisicion')
    } finally {
      setArchivarLoading(false)
    }
  }

  // Estado change handlers
  const handleOpenEstadoModal = (requisicion) => {
    setEstadoRequisicion(requisicion)
    setNuevoEstado('')
    setComentarioEstado('')
    setShowEstadoModal(true)
  }

  const handleChangeEstado = async () => {
    if (!nuevoEstado || !estadoRequisicion) return

    try {
      setChangingEstado(true)
      await api.patch(`/requisiciones/${estadoRequisicion.id}/estado`, {
        estado: nuevoEstado,
        comentario: comentarioEstado
      })
      setShowEstadoModal(false)
      loadData()
    } catch (err) {
      console.error('Error changing estado:', err)
      setError(err.response?.data?.message || 'Error al cambiar estado')
    } finally {
      setChangingEstado(false)
    }
  }

  // History handlers
  const handleShowHistorial = async (requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`)
      if (response.data.success) {
        setHistorialData({
          requisicion: response.data.requisicion,
          items: response.data.items || [],
          historial: response.data.historial || []
        })
        setHistorialRequisicion(requisicion)
        setShowHistorial(true)
      }
    } catch (err) {
      console.error('Error loading historial:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando requisiciones...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Requisiciones</h1>
          <p className="text-muted-foreground">Vista consolidada de todos los proyectos</p>
        </div>
        <Button onClick={handleNewRequisicion}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Requisicion
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Por Aprobar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-600">{stats.porAprobar}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{stats.pagadas}</div>
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
            <SelectItem value="archivadas">Archivadas</SelectItem>
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
            {filteredRequisiciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No se encontraron requisiciones
                </TableCell>
              </TableRow>
            ) : (
              filteredRequisiciones.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleShowHistorial(req)}
                >
                  <TableCell className="font-medium">
                    <div>{req.numero}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(req.fecha)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs bg-muted px-2 py-1 rounded w-fit">
                      {req.proyecto_corto || req.proyecto_nombre}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                      {req.proveedor}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{req.proveedor}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(req.monto_total)}
                  </TableCell>
                  <TableCell>{getEstadoBadge(req.estado)}</TableCell>
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
              Selecciona el proyecto para la nueva requisicion
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

      {/* Requisicion Form Modal */}
      {showForm && selectedProjectId && (
        <RequisicionForm
          projectId={selectedProjectId}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setEditingRequisicion(null)
            setSelectedProjectId(null)
          }}
          onSave={handleSaveRequisicion}
          editingRequisicion={editingRequisicion}
          existingItems={existingItems}
        />
      )}

      {/* Estado Change Modal */}
      <Dialog open={showEstadoModal} onOpenChange={setShowEstadoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>
              Requisicion: {estadoRequisicion?.numero}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Estado actual</Label>
              <div className="mt-1">
                {estadoRequisicion && getEstadoBadge(estadoRequisicion.estado)}
              </div>
            </div>
            <div>
              <Label>Nuevo estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {estadoRequisicion && getValidTransitions(estadoRequisicion.estado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {estadoLabels[estado]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comentario (opcional)</Label>
              <Textarea
                value={comentarioEstado}
                onChange={(e) => setComentarioEstado(e.target.value)}
                placeholder="Agregar un comentario..."
                className="mt-1"
              />
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

      {/* History Modal */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de Requisicion
              {historialRequisicion && ['pendiente', 'en_cotizacion'].includes(historialRequisicion.estado) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 hover:bg-muted"
                  onClick={() => {
                    setShowHistorial(false)
                    handleEditRequisicion(historialRequisicion)
                  }}
                  title="Editar requisición"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {historialRequisicion?.numero} - {historialRequisicion?.proveedor}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Descripción */}
            {historialRequisicion?.concepto && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Descripción</div>
                <div className="font-medium">{historialRequisicion.concepto}</div>
              </div>
            )}

            {/* Items */}
            {historialData.items.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Detalle ({historialData.items.length} items)</h4>
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
                      {historialData.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.descripcion}</TableCell>
                          <TableCell className="text-right">{item.cantidad} {item.unidad}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.precio_unitario)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Estado Section */}
            {historialRequisicion && (
              <div className="space-y-3">
                <h4 className="font-medium">Estado</h4>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getEstadoBadge(historialRequisicion.estado)}
                  </div>
                  {getValidTransitions(historialRequisicion.estado).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowHistorial(false)
                        handleOpenEstadoModal(historialRequisicion)
                      }}
                    >
                      Cambiar Estado
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Historial */}
            {historialData.historial.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Historial de cambios</h4>
                <div className="space-y-2">
                  {historialData.historial.map((h, idx) => (
                    <div key={idx} className="border rounded p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          {h.estado_anterior && (
                            <span className="text-muted-foreground">
                              {estadoLabels[h.estado_anterior]} →{' '}
                            </span>
                          )}
                          <span className="font-medium">{estadoLabels[h.estado_nuevo]}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(h.created_at)}
                        </span>
                      </div>
                      {h.comentario && (
                        <p className="text-muted-foreground mt-1">{h.comentario}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Por: {h.usuario_nombre}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archivar Section */}
            {historialRequisicion && (
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

          {historialRequisicion && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="font-medium">{historialRequisicion.numero}</div>
                <div className="text-sm text-muted-foreground">{historialRequisicion.proveedor}</div>
                <div className="text-sm">{formatMoney(historialRequisicion.monto_total)}</div>
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
