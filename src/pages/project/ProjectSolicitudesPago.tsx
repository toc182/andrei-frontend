/**
 * ProjectSolicitudesPago Component
 * Solicitudes de pago within a project context
 * Features: Prefix config, list with filters, create/edit/detail modals, state changes
 */

import { useState, useEffect, ReactNode } from "react"
import { useAuth } from "../../context/AuthContext"
import { Plus, Check, X, Clock, Pencil, Settings, Banknote, Send, CreditCard, AlertCircle, Download, Eye, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Checkbox } from "@/components/ui/checkbox"
import api from "../../services/api"
import { formatMoney } from "../../utils/formatters"
import type { SolicitudPagoAdjunto } from "../../types/api"
import SolicitudPagoForm from "../../components/forms/SolicitudPagoForm"
import AdjuntosPreview from "../../components/AdjuntosPreview"

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
  urgente?: boolean
  revisada?: boolean
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

interface BadgeConfig {
  variant: 'secondary' | 'outline' | 'default' | 'destructive'
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface ProjectSolicitudesPagoProps {
  projectId: number
  onNavigate?: (view: string) => void
}

// --- Helpers ---

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

export default function ProjectSolicitudesPago({ projectId, onNavigate }: ProjectSolicitudesPagoProps) {
  const { user, hasPermission, isAdminOrCoAdmin } = useAuth()
  const canManage = !!user
  const canManageSolicitud = (sol: SolicitudPago) =>
    isAdminOrCoAdmin || hasPermission('solicitudes_editar_todas') || sol.preparado_por === user?.id

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

  // Approval data
  const [detailAprobaciones, setDetailAprobaciones] = useState<Aprobacion[]>([])
  const [detailAprobadores, setDetailAprobadores] = useState<AprobadorProyecto[]>([])
  const [hasApprovers, setHasApprovers] = useState<boolean | null>(null)

  // Adjuntos
  const [detailAdjuntos, setDetailAdjuntos] = useState<SolicitudPagoAdjunto[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [detailRevisada, setDetailRevisada] = useState(false)
  const [togglingRevisada, setTogglingRevisada] = useState(false)

  // Selection for bulk approval
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Bulk approval
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [bulkPassword, setBulkPassword] = useState('')
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(null)

  // Approve/Reject

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)

  // Marking as paid
  const [markingPaid, setMarkingPaid] = useState(false)

  // Resubmit (rechazada -> pendiente)
  const [resubmitting, setResubmitting] = useState(false)

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    loadSolicitudes()
    checkApprovers()
  }, [projectId, filterEstado])

  const checkApprovers = async () => {
    try {
      const response = await api.get(`/approval-settings/project/${projectId}`)
      if (response.data.success) {
        setHasApprovers(response.data.approvers.length > 0)
      }
    } catch {
      setHasApprovers(false)
    }
  }

  const loadSolicitudes = async () => {
    try {
      setSelectedIds(new Set())
      setLoading(true)
      setError(null)
      let params = ''
      if (filterEstado === 'mi_aprobacion') {
        params = '?pending_my_approval=true'
      } else if (filterEstado !== 'all') {
        params = `?estado=${filterEstado}`
      }
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
        setDetailAdjuntos(response.data.adjuntos || [])
        setDetailAprobaciones(response.data.aprobaciones || [])
        setDetailAprobadores(response.data.aprobadores_proyecto || [])
        setDetailRevisada(!!solicitud.revisada)
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

  const handleAprobar = (solicitudId: number) => {
    setPendingApprovalId(solicitudId)
    setBulkError(null)
    setBulkPassword('')
    setShowPasswordModal(true)
  }

  const handleRechazar = async () => {
    if (!rejectingId || !rejectComment.trim()) return
    try {
      await api.post(`/solicitudes-pago/${rejectingId}/rechazar`, { comentario: rejectComment })
      setShowRejectModal(false)
      setRejectComment('')
      setRejectingId(null)
      setShowDetail(false)
      await loadSolicitudes()
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
      await loadSolicitudes()
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
      await loadSolicitudes()
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

  const handleToggleRevisada = async (solicitudId: number) => {
    try {
      setTogglingRevisada(true)
      if (detailRevisada) {
        await api.delete(`/solicitudes-pago/${solicitudId}/revisar`)
        setDetailRevisada(false)
      } else {
        await api.post(`/solicitudes-pago/${solicitudId}/revisar`)
        setDetailRevisada(true)
      }
      setSolicitudes(prev => prev.map(s =>
        s.id === solicitudId ? { ...s, revisada: !detailRevisada } : s
      ))
    } catch (err) {
      console.error('Error toggling review:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      alert(apiError.response?.data?.message || 'Error al cambiar estado de revisión')
    } finally {
      setTogglingRevisada(false)
    }
  }

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirmApproval = async () => {
    if (!bulkPassword.trim()) return
    try {
      setBulkApproving(true)
      setBulkError(null)
      if (pendingApprovalId) {
        // Individual approval
        await api.post(`/solicitudes-pago/${pendingApprovalId}/aprobar`, { password: bulkPassword })
        setShowPasswordModal(false)
        setBulkPassword('')
        setPendingApprovalId(null)
        setShowDetail(false)
        await loadSolicitudes()
        window.dispatchEvent(new Event('solicitud-status-changed'))
      } else if (selectedIds.size > 0) {
        // Bulk approval
        const response = await api.post('/solicitudes-pago/aprobar-masivo', {
          ids: Array.from(selectedIds),
          password: bulkPassword
        })
        if (response.data.success) {
          setShowPasswordModal(false)
          setBulkPassword('')
          setSelectedIds(new Set())
          alert(`${response.data.aprobadas} de ${response.data.total} solicitudes aprobadas`)
          loadSolicitudes()
          window.dispatchEvent(new Event('solicitud-status-changed'))
        }
      }
    } catch (err) {
      console.error('Error approving:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      setBulkError(apiError.response?.data?.message || 'Error al aprobar')
    } finally {
      setBulkApproving(false)
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
              <SelectItem value="mi_aprobacion">Mi aprobación</SelectItem>
              <SelectItem value="borrador">Borradores</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="aprobada">Aprobadas</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
              <SelectItem value="rechazada">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Prefijo: {spPrefijo}</span>
        </div>

        {canManage && hasApprovers === false && (
          <Alert className="flex-1 sm:flex-none">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs flex items-center gap-2">
              Para crear solicitudes de pago, primero configure los aprobadores del proyecto.
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => onNavigate?.(`project-${projectId}-miembros`)}
              >
                Ir a Miembros
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {canManage && hasApprovers && (
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
            <Card key={sol.id} className="hover:bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  {filterEstado === 'mi_aprobacion' && (
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.has(sol.id)}
                        onCheckedChange={() => toggleSelection(sol.id)}
                        disabled={!sol.revisada}
                      />
                    </div>
                  )}
                  <div className="flex-1 cursor-pointer" onClick={() => openDetail(sol)}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold flex items-center gap-1">
                          {sol.numero}
                          {sol.revisada && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                          {sol.urgente && <span className="text-red-600 font-bold ml-1">!</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">{sol.proveedor}</div>
                      </div>
                      {getEstadoBadge(sol.estado)}
                    </div>
                    <div className="text-lg font-bold mb-1">{formatMoney(sol.monto_total)}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(sol.fecha)}</div>
                  </div>
                </div>
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
                  {filterEstado === 'mi_aprobacion' && <TableHead className="w-10 px-2"></TableHead>}
                  <TableHead>Numero</TableHead>
                  <TableHead className="w-6 px-0"></TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={filterEstado === 'mi_aprobacion' ? 7 : 6} className="text-center py-8 text-muted-foreground">
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
                      {filterEstado === 'mi_aprobacion' && (
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(sol.id)}
                            onCheckedChange={() => toggleSelection(sol.id)}
                            disabled={!sol.revisada}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1">
                          {sol.numero}
                          {sol.revisada && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                        </span>
                      </TableCell>
                      <TableCell className="px-0 text-center">{sol.urgente && <span className="text-red-600 font-bold">!</span>}</TableCell>
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

      {/* Bulk Approval Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg">
          <div className="flex items-center justify-center gap-3 px-4 py-2.5">
            <span className="text-sm font-medium whitespace-nowrap">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            <Button
              onClick={() => { setPendingApprovalId(null); setBulkError(null); setBulkPassword(''); setShowPasswordModal(true) }}
              size="sm"
            >
              <Check className="h-4 w-4 mr-1" />
              Aprobar seleccionadas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

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
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
              {canManage && detailSolicitud && detailSolicitud.estado === 'pendiente' && detailAprobaciones.length === 0 && canManageSolicitud(detailSolicitud) && (
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
                  <strong>{detailSolicitud.numero}</strong>
                  {detailSolicitud.urgente && (
                    <Badge variant="destructive" className="ml-2 text-xs">Urgente</Badge>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailSolicitud && (
            <div className="space-y-4 py-4">
              {/* Basic info */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
                <div>
                  <div className="text-muted-foreground">Fecha</div>
                  <div className="font-medium">{formatDate(detailSolicitud.fecha)}</div>
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
                {detailSolicitud.requisicion_numero && (
                  <div>
                    <div className="text-muted-foreground">Requisicion</div>
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

              {/* Items + Totals */}
              <div className="border rounded-lg overflow-hidden">
                {detailItems.length > 0 && (
                  <div className="divide-y">
                    {detailItems.map((item) => (
                      <div key={item.id} className="p-3 text-sm">
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

              {/* Adjuntos */}
              <AdjuntosPreview
                adjuntos={detailAdjuntos}
                solicitudPagoId={detailSolicitud.id}
                onUpload={handleUploadAdjuntos}
                onDelete={handleDeleteAdjunto}
                uploading={uploadingFiles}
              />

              {/* Approval section */}
              <div className="space-y-3">
                <h4 className="font-medium">Estado y Aprobaciones</h4>
                <div className="p-4 border rounded-lg space-y-3">
                  <div>{getEstadoBadge(detailSolicitud.estado)}</div>

                  {/* Show approval progress */}
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

                  {/* Rejection comment */}
                  {detailSolicitud.estado === 'rechazada' && detailAprobaciones.filter(a => a.accion === 'rechazado').map(rechazo => (
                    <div key={rechazo.id} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <div className="font-medium text-red-800">Rechazada por {rechazo.usuario_nombre}</div>
                      <div className="text-red-700 mt-1">{rechazo.comentario}</div>
                    </div>
                  ))}

                  {/* Action buttons */}
                  {(() => {
                    if (!user || !detailSolicitud) return null
                    const aprobacionesHechas = detailAprobaciones.filter(a => a.accion === 'aprobado').length
                    const siguienteAprobador = detailAprobadores[aprobacionesHechas]
                    const esMiTurno = detailSolicitud.estado === 'pendiente' && siguienteAprobador?.user_id === user.id

                    return (
                      <>
                        {esMiTurno && (
                          <div className="space-y-2 pt-2">
                            <Button
                              variant={detailRevisada ? "secondary" : "outline"}
                              onClick={() => handleToggleRevisada(detailSolicitud.id)}
                              disabled={togglingRevisada}
                              className="w-full"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {togglingRevisada ? 'Procesando...' : detailRevisada ? '✓ Revisada' : 'Marcar como Revisada'}
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleAprobar(detailSolicitud.id)}
                                className="flex-1"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Aprobar
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
              {canManage && detailSolicitud.estado === 'pendiente' && detailAprobaciones.length === 0 && canManageSolicitud(detailSolicitud) && (
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

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
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
          <DialogFooter className="flex gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setShowRejectModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRechazar} disabled={!rejectComment.trim()} className="w-full sm:w-auto">
              Rechazar
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

      {/* Password Confirmation Modal */}
      <Dialog open={showPasswordModal} onOpenChange={(open) => { setShowPasswordModal(open); if (!open) setPendingApprovalId(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar Aprobacion</DialogTitle>
            <DialogDescription>
              {pendingApprovalId
                ? 'Ingresa tu contraseña para aprobar esta solicitud.'
                : `Vas a aprobar ${selectedIds.size} solicitud${selectedIds.size > 1 ? 'es' : ''}. Ingresa tu contraseña para confirmar.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={bulkPassword}
                onChange={(e) => setBulkPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="mt-1"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmApproval()}
              />
            </div>
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPasswordModal(false)} disabled={bulkApproving}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmApproval} disabled={!bulkPassword.trim() || bulkApproving}>
              {bulkApproving ? 'Aprobando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
