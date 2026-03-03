/**
 * SolicitudesPagoGeneral Component
 * Vista consolidada de todas las solicitudes de pago de todos los proyectos
 * Accesible desde el sidebar principal
 */

import { useState, useEffect, useRef, ReactNode } from "react"
import { useAuth } from "../context/AuthContext"
import { Plus, Check, X, Clock, AlertCircle, Send, CreditCard, Banknote, Paperclip, FileText, Trash2, Download, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  urgente?: boolean
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

interface Aprobacion {
  id: number
  solicitud_pago_id: number
  user_id: number
  orden: number
  accion: 'aprobado' | 'rechazado'
  comentario: string | null
  fecha: string
  usuario_nombre: string
}

interface AprobadorProyecto {
  user_id: number
  orden: number
  nombre: string
  email: string
}

interface Adjunto {
  id: number
  solicitud_pago_id: number
  nombre_original: string
  r2_key: string
  tipo_mime: string
  tamano: number
  subido_por: number
  subido_por_nombre: string
  created_at: string
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

const estadoLabels: Record<string, string> = {
  'mi_aprobacion': 'Mi aprobación',
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
  const { user } = useAuth()
  const canManage = !!user

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
  const [editingSolicitud, setEditingSolicitud] = useState<SolicitudPago | null>(null)
  const [editingItems, setEditingItems] = useState<SolicitudItem[]>([])
  const [editingAjustes, setEditingAjustes] = useState<SolicitudAjuste[]>([])

  // Detail modal
  const [showDetail, setShowDetail] = useState(false)
  const [detailSolicitud, setDetailSolicitud] = useState<SolicitudPago | null>(null)
  const [detailItems, setDetailItems] = useState<SolicitudItem[]>([])
  const [detailAjustes, setDetailAjustes] = useState<SolicitudAjuste[]>([])

  // Approval data
  const [detailAprobaciones, setDetailAprobaciones] = useState<Aprobacion[]>([])
  const [detailAprobadores, setDetailAprobadores] = useState<AprobadorProyecto[]>([])

  // Adjuntos
  const [detailAdjuntos, setDetailAdjuntos] = useState<Adjunto[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const adjuntoInputRef = useRef<HTMLInputElement>(null)

  // Approve/Reject
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)

  // Marking as paid
  const [markingPaid, setMarkingPaid] = useState(false)

  // Resubmit
  const [resubmitting, setResubmitting] = useState(false)

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [filterEstado])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      let params = ''
      if (filterEstado === 'mi_aprobacion') {
        params = '?pending_my_approval=true'
      } else if (filterEstado !== 'all') {
        params = `?estado=${filterEstado}`
      }
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
    // Delay para que el Dialog del selector cierre antes de abrir el form
    setTimeout(() => setShowForm(true), 150)
  }

  // Detail
  const openDetail = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`)
      if (response.data.success) {
        setDetailSolicitud(response.data.solicitud)
        setDetailItems(response.data.items || [])
        setDetailAjustes(response.data.ajustes || [])
        setDetailAdjuntos(response.data.adjuntos || [])
        setDetailAprobaciones(response.data.aprobaciones || [])
        setDetailAprobadores(response.data.aprobadores_proyecto || [])
        setShowDetail(true)
      }
    } catch (err) {
      console.error('Error loading detail:', err)
    }
  }

  const openEditForm = async (solicitud: SolicitudPago) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitud.id}`)
      if (response.data.success) {
        setEditingSolicitud(response.data.solicitud)
        setEditingItems(response.data.items || [])
        setEditingAjustes(response.data.ajustes || [])
        setSelectedProjectId(solicitud.proyecto_id)
        setShowDetail(false)
        setShowForm(true)
      }
    } catch (err) {
      console.error('Error loading for edit:', err)
    }
  }

  // Approval actions
  const handleAprobar = async (solicitudId: number) => {
    try {
      setApprovingId(solicitudId)
      await api.post(`/solicitudes-pago/${solicitudId}/aprobar`)
      setShowDetail(false)
      await loadData()
      window.dispatchEvent(new Event('solicitud-status-changed'))
    } catch (err) {
      console.error('Error approving:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al aprobar')
    } finally {
      setApprovingId(null)
    }
  }

  const handleRechazar = async () => {
    if (!rejectingId || !rejectComment.trim()) return
    try {
      await api.post(`/solicitudes-pago/${rejectingId}/rechazar`, { comentario: rejectComment })
      setShowRejectModal(false)
      setRejectComment('')
      setRejectingId(null)
      setShowDetail(false)
      await loadData()
      window.dispatchEvent(new Event('solicitud-status-changed'))
    } catch (err) {
      console.error('Error rejecting:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al rechazar')
    }
  }

  const handleMarcarPagada = async (solicitudId: number) => {
    try {
      setMarkingPaid(true)
      await api.patch(`/solicitudes-pago/${solicitudId}/estado`, { estado: 'pagada' })
      setShowDetail(false)
      await loadData()
      window.dispatchEvent(new Event('solicitud-status-changed'))
    } catch (err) {
      console.error('Error marking as paid:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al marcar como pagada')
    } finally {
      setMarkingPaid(false)
    }
  }

  const handleReenviar = async (solicitudId: number) => {
    try {
      setResubmitting(true)
      await api.patch(`/solicitudes-pago/${solicitudId}/estado`, { estado: 'pendiente' })
      setShowDetail(false)
      await loadData()
      window.dispatchEvent(new Event('solicitud-status-changed'))
    } catch (err) {
      console.error('Error resubmitting:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al reenviar')
    } finally {
      setResubmitting(false)
    }
  }

  const handleUploadAdjuntos = async (files: FileList) => {
    if (!detailSolicitud || files.length === 0) return
    try {
      setUploadingFiles(true)
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('archivos', files[i])
      }
      const response = await api.post(`/solicitudes-pago/${detailSolicitud.id}/adjuntos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (response.data.success) {
        setDetailAdjuntos(prev => [...response.data.adjuntos, ...prev])
      }
    } catch (err) {
      console.error('Error uploading:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al subir archivos')
    } finally {
      setUploadingFiles(false)
      if (adjuntoInputRef.current) adjuntoInputRef.current.value = ''
    }
  }

  const handleDownloadAdjunto = async (adjuntoId: number) => {
    try {
      const response = await api.get(`/solicitudes-pago/adjuntos/${adjuntoId}/download`)
      if (response.data.success) {
        window.open(response.data.url, '_blank')
      }
    } catch (err) {
      console.error('Error downloading:', err)
      alert('Error al descargar el archivo')
    }
  }

  const handleDeleteAdjunto = async (adjuntoId: number) => {
    try {
      await api.delete(`/solicitudes-pago/adjuntos/${adjuntoId}`)
      setDetailAdjuntos(prev => prev.filter(a => a.id !== adjuntoId))
    } catch (err) {
      console.error('Error deleting adjunto:', err)
      alert('Error al eliminar el adjunto')
    }
  }

  const handleDownloadPDF = (solicitudId: number) => {
    const token = localStorage.getItem('token')
    window.open(`${api.defaults.baseURL}/solicitudes-pago/${solicitudId}/pdf?token=${token}`, '_blank')
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      setDeleteLoading(true)
      await api.delete(`/solicitudes-pago/${deletingId}`)
      setShowDeleteModal(false)
      setShowDetail(false)
      await loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al eliminar')
    } finally {
      setDeleteLoading(false)
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
              <TableHead className="w-6 px-0"></TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead className="hidden sm:table-cell">Proveedor</TableHead>
              <TableHead className="text-right w-[100px]">Total</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSolicitudes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                    <div className="flex items-center gap-1">
                      {sol.numero}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(sol.fecha)}</div>
                  </TableCell>
                  <TableCell className="px-0 text-center">{sol.urgente && <span className="text-red-600 font-bold">!</span>}</TableCell>
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
      {selectedProjectId && (
        <SolicitudPagoForm
          projectId={selectedProjectId}
          isOpen={showForm}
          onClose={() => { setShowForm(false); setSelectedProjectId(null); setEditingSolicitud(null); setEditingItems([]); setEditingAjustes([]) }}
          onSave={() => loadData()}
          editingSolicitud={editingSolicitud}
          existingItems={editingItems}
          existingAjustes={editingAjustes}
        />
      )}

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de Solicitud
              {detailSolicitud && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 hover:bg-muted"
                  onClick={() => handleDownloadPDF(detailSolicitud.id)}
                  title="Descargar PDF"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {detailSolicitud && detailSolicitud.estado === 'pendiente' && detailAprobaciones.length === 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 hover:bg-muted"
                  onClick={() => openEditForm(detailSolicitud)}
                  title="Editar solicitud"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailSolicitud && (
                <>
                  {detailSolicitud.numero}
                  {detailSolicitud.urgente && (
                    <Badge variant="destructive" className="ml-2 text-xs">Urgente</Badge>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailSolicitud && (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
                <div>
                  <div className="text-muted-foreground">Fecha</div>
                  <div className="font-medium">{formatDate(detailSolicitud.fecha)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Proyecto</div>
                  <div className="font-medium">{detailSolicitud.proyecto_nombre || '-'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <div className="text-muted-foreground">Proveedor</div>
                  <div className="font-medium">{detailSolicitud.proveedor}</div>
                </div>
              </div>

              {detailSolicitud.observaciones && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="text-muted-foreground mb-1">Observaciones</div>
                  <div>{detailSolicitud.observaciones}</div>
                </div>
              )}

              {/* Items + Totals */}
              <div className="border rounded-lg overflow-hidden">
                {detailItems.length > 0 && (
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
                )}
                <div className="p-4 space-y-2 text-sm border-t">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatMoney(detailSolicitud.subtotal)}</span>
                  </div>
                  {detailAjustes.map((ajuste) => (
                    <div key={ajuste.id} className="flex justify-between">
                      <span className="text-muted-foreground">{ajuste.descripcion}:</span>
                      <span className={ajuste.tipo === 'descuento' ? 'text-red-600' : ''}>
                        {ajuste.tipo === 'descuento' ? '-' : ''}{formatMoney(ajuste.monto)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>TOTAL:</span>
                    <span>{formatMoney(detailSolicitud.monto_total)}</span>
                  </div>
                </div>
              </div>

              {/* Bank data */}
              {(detailSolicitud.beneficiario || detailSolicitud.banco) && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Datos Bancarios
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailSolicitud.beneficiario && <div><span className="text-muted-foreground">Beneficiario:</span> {detailSolicitud.beneficiario}</div>}
                    {detailSolicitud.banco && <div><span className="text-muted-foreground">Banco:</span> {detailSolicitud.banco}</div>}
                    {detailSolicitud.tipo_cuenta && <div><span className="text-muted-foreground">Tipo:</span> <span className="capitalize">{detailSolicitud.tipo_cuenta}</span></div>}
                    {detailSolicitud.numero_cuenta && <div><span className="text-muted-foreground">Cuenta:</span> {detailSolicitud.numero_cuenta}</div>}
                  </div>
                </div>
              )}

              {/* Adjuntos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Adjuntos
                  </h4>
                  <div>
                    <input
                      ref={adjuntoInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleUploadAdjuntos(e.target.files)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => adjuntoInputRef.current?.click()}
                      disabled={uploadingFiles}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {uploadingFiles ? 'Subiendo...' : 'Adjuntar'}
                    </Button>
                  </div>
                </div>
                {detailAdjuntos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin adjuntos</p>
                ) : (
                  <div className="space-y-1">
                    {detailAdjuntos.map((adj) => (
                      <div key={adj.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:text-primary"
                          onClick={() => handleDownloadAdjunto(adj.id)}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{adj.nombre_original}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(adj.tamano / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteAdjunto(adj.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval section */}
              <div className="space-y-3">
                <h4 className="font-medium">Estado y Aprobaciones</h4>
                <div className="p-4 border rounded-lg space-y-3">
                  <div>{getEstadoBadge(detailSolicitud.estado)}</div>

                  {detailAprobadores.length > 0 && (
                    <div className="space-y-2">
                      {detailAprobadores.map((aprobador) => {
                        const aprobacion = detailAprobaciones.find(a => a.user_id === aprobador.user_id)
                        return (
                          <div key={aprobador.user_id} className="flex items-center gap-2 text-sm">
                            {aprobacion ? (
                              aprobacion.accion === 'aprobado' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-600" />
                              )
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{aprobador.orden}. {aprobador.nombre}</span>
                            {aprobacion ? (
                              <span className="text-muted-foreground">
                                — {new Date(aprobacion.fecha).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">(pendiente)</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {detailSolicitud.estado === 'rechazada' && detailAprobaciones.filter(a => a.accion === 'rechazado').map(rechazo => (
                    <div key={rechazo.id} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <div className="font-medium text-red-800">Rechazada por {rechazo.usuario_nombre}</div>
                      <div className="text-red-700 mt-1">{rechazo.comentario}</div>
                    </div>
                  ))}

                  {(() => {
                    if (!user || !detailSolicitud) return null
                    const aprobacionesHechas = detailAprobaciones.filter(a => a.accion === 'aprobado').length
                    const siguienteAprobador = detailAprobadores[aprobacionesHechas]
                    const esMiTurno = detailSolicitud.estado === 'pendiente' && siguienteAprobador?.user_id === user.id

                    return (
                      <>
                        {esMiTurno && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => handleAprobar(detailSolicitud.id)}
                              disabled={approvingId === detailSolicitud.id}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              {approvingId === detailSolicitud.id ? 'Aprobando...' : 'Aprobar'}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                setRejectingId(detailSolicitud.id)
                                setRejectComment('')
                                setShowRejectModal(true)
                              }}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Rechazar
                            </Button>
                          </div>
                        )}

                        {detailSolicitud.estado === 'aprobada' && canManage && (
                          <div className="pt-2">
                            <Button
                              onClick={() => handleMarcarPagada(detailSolicitud.id)}
                              disabled={markingPaid}
                              className="w-full"
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              {markingPaid ? 'Marcando...' : 'Marcar como Pagada'}
                            </Button>
                          </div>
                        )}

                        {detailSolicitud.estado === 'rechazada' && canManage && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              onClick={() => handleReenviar(detailSolicitud.id)}
                              disabled={resubmitting}
                              className="w-full"
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {resubmitting ? 'Reenviando...' : 'Reenviar para Aprobacion'}
                            </Button>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Delete (only pendiente) */}
              {canManage && detailSolicitud.estado === 'pendiente' && detailAprobaciones.length === 0 && (
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

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Solicitud</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. Solo se pueden eliminar solicitudes en estado pendiente.
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

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
            <DialogDescription>
              Indique el motivo del rechazo
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Comentario *</Label>
            <Textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Motivo del rechazo..."
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRechazar} disabled={!rejectComment.trim()}>
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
