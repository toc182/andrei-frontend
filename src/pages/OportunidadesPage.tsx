/**
 * OportunidadesPage Component
 * Vista unificada de licitaciones y oportunidades
 */

import { useState, useEffect } from "react"
import { Plus, Search, AlertCircle } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import api from "../services/api"
import { formatMoney } from "../utils/formatters"
import LicitacionForm from "../components/forms/LicitacionForm"
import OportunidadForm from "../components/forms/OportunidadForm"

interface UnifiedItem {
  id: number
  tipo: 'licitacion' | 'oportunidad'
  nombre: string
  cliente: string
  estado: string
  monto: number
  fecha: string
  creado_por: string
}

const LICITACION_ESTADOS: Record<string, { label: string; variant: string }> = {
  'activa': { label: 'Activa', variant: 'default' },
  'presentada': { label: 'Presentada', variant: 'secondary' },
  'ganada': { label: 'Ganada', variant: 'success' },
  'perdida': { label: 'Perdida', variant: 'destructive' },
  'sin_interes': { label: 'Sin Interés', variant: 'outline' },
  'cancelada': { label: 'Cancelada', variant: 'destructive' },
}

const OPORTUNIDAD_ESTADOS: Record<string, { label: string; variant: string }> = {
  'prospecto': { label: 'Prospecto', variant: 'outline' },
  'calificada': { label: 'Calificada', variant: 'secondary' },
  'propuesta': { label: 'Propuesta', variant: 'default' },
  'negociacion': { label: 'Negociación', variant: 'default' },
  'cerrada': { label: 'Cerrada', variant: 'success' },
  'perdida': { label: 'Perdida', variant: 'destructive' },
}

function getStatusConfig(tipo: string, estado: string) {
  if (tipo === 'licitacion') {
    return LICITACION_ESTADOS[estado] || { label: estado, variant: 'secondary' }
  }
  return OPORTUNIDAD_ESTADOS[estado] || { label: estado, variant: 'secondary' }
}

export default function OportunidadesPage() {
  const [items, setItems] = useState<UnifiedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [tipoFilter, setTipoFilter] = useState<string>("todos")
  const [showLicitacionForm, setShowLicitacionForm] = useState(false)
  const [showOportunidadForm, setShowOportunidadForm] = useState(false)
  const [editingLicitacionId, setEditingLicitacionId] = useState<number | null>(null)
  const [editingOportunidadId, setEditingOportunidadId] = useState<number | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [licResult, opResult] = await Promise.allSettled([
        api.get('/licitaciones'),
        api.get('/oportunidades')
      ])

      const licitaciones: UnifiedItem[] = licResult.status === 'fulfilled'
        ? (licResult.value.data.licitaciones || []).map(
            (l: Record<string, unknown>) => ({
              id: l.id as number,
              tipo: 'licitacion' as const,
              nombre: l.nombre as string,
              cliente: l.entidad_licitante as string,
              estado: l.estado_licitacion as string,
              monto: (l.presupuesto_referencial as number) || 0,
              fecha: l.fecha_cierre as string,
              creado_por: (l.created_by_name as string) || '',
            })
          )
        : []

      const oportunidades: UnifiedItem[] = opResult.status === 'fulfilled'
        ? (opResult.value.data.oportunidades || []).map(
            (o: Record<string, unknown>) => ({
              id: o.id as number,
              tipo: 'oportunidad' as const,
              nombre: o.nombre_oportunidad as string,
              cliente: o.cliente_potencial as string,
              estado: o.estado_oportunidad as string,
              monto: (o.valor_estimado as number) || 0,
              fecha: o.fecha_estimada_cierre as string || o.created_at as string,
              creado_por: (o.created_by_name as string) || '',
            })
          )
        : []

      if (licResult.status === 'rejected' && opResult.status === 'rejected') {
        setError('Error al cargar licitaciones y oportunidades')
        return
      }

      // Merge and sort by date descending
      const merged = [...licitaciones, ...oportunidades].sort((a, b) => {
        const da = a.fecha ? new Date(a.fecha).getTime() : 0
        const db = b.fecha ? new Date(b.fecha).getTime() : 0
        return db - da
      })

      setItems(merged)
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('Error al cargar licitaciones y oportunidades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter items
  const filtered = items.filter(item => {
    if (tipoFilter !== 'todos' && item.tipo !== tipoFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        item.nombre.toLowerCase().includes(q) ||
        item.cliente.toLowerCase().includes(q) ||
        item.estado.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleRowClick = (item: UnifiedItem) => {
    if (item.tipo === 'licitacion') {
      setEditingLicitacionId(item.id)
      setShowLicitacionForm(true)
    } else {
      setEditingOportunidadId(item.id)
      setShowOportunidadForm(true)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('es-PA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">
            Licitaciones y oportunidades de negocio
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setEditingLicitacionId(null)
              setShowLicitacionForm(true)
            }}>
              Nueva Licitación
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setEditingOportunidadId(null)
              setShowOportunidadForm(true)
            }}>
              Nueva Oportunidad
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cliente o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="licitacion">Licitaciones</SelectItem>
            <SelectItem value="oportunidad">Oportunidades</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search || tipoFilter !== 'todos'
            ? 'No se encontraron resultados con los filtros actuales.'
            : 'No hay licitaciones ni oportunidades registradas.'}
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((item) => {
              const status = getStatusConfig(item.tipo, item.estado)
              return (
                <Card
                  key={`${item.tipo}-${item.id}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(item)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm line-clamp-2">{item.nombre}</span>
                      <Badge variant={item.tipo === 'licitacion' ? 'default' : 'outline'} className="shrink-0 text-xs">
                        {item.tipo === 'licitacion' ? 'Licitación' : 'Oportunidad'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{item.cliente}</span>
                      <Badge variant={status.variant as any} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(item.fecha)}</span>
                      {item.monto > 0 && (
                        <span className="font-medium">{formatMoney(item.monto)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const status = getStatusConfig(item.tipo, item.estado)
                  return (
                    <TableRow
                      key={`${item.tipo}-${item.id}`}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(item)}
                    >
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {item.nombre}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.tipo === 'licitacion' ? 'default' : 'outline'} className="text-xs">
                          {item.tipo === 'licitacion' ? 'Licitación' : 'Oportunidad'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.cliente}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant as any} className="text-xs">
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.monto > 0 ? formatMoney(item.monto) : '—'}
                      </TableCell>
                      <TableCell>{formatDate(item.fecha)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Forms */}
      <LicitacionForm
        licitacionId={editingLicitacionId}
        isOpen={showLicitacionForm}
        onClose={() => {
          setShowLicitacionForm(false)
          setEditingLicitacionId(null)
        }}
        onSave={() => {
          setShowLicitacionForm(false)
          setEditingLicitacionId(null)
          loadData()
        }}
      />

      <OportunidadForm
        oportunidadId={editingOportunidadId}
        isOpen={showOportunidadForm}
        onClose={() => {
          setShowOportunidadForm(false)
          setEditingOportunidadId(null)
        }}
        onSave={() => {
          setShowOportunidadForm(false)
          setEditingOportunidadId(null)
          loadData()
        }}
      />
    </div>
  )
}
