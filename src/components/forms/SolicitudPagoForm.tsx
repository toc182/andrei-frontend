/**
 * SolicitudPagoForm Component
 * Modal form for creating and editing solicitudes de pago
 * Sections: Datos principales, Items dinámicos, Ajustes (impuestos/descuentos), Datos bancarios
 */

import { useState, useEffect, FormEvent, ChangeEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import api from "../../services/api"
import { formatMoney } from "../../utils/formatters"
import { useAuth } from "../../context/AuthContext"

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
}

interface SolicitudItem {
  id?: number
  cantidad: number
  unidad: string
  descripcion: string
  descripcion_detallada: string | null
  precio_unitario: number
  precio_total: number
}

interface SolicitudAjuste {
  id?: number
  tipo: string
  descripcion: string
  porcentaje: number | null
  monto: number
}

interface UserOption {
  id: number
  nombre: string
}

interface RequisicionOption {
  id: number
  numero: string
}

interface ItemFormData {
  descripcion: string
  descripcion_detallada: string
  cantidad: string
  unidad: string
  precio_unitario: string
  expanded: boolean
}

interface AjusteFormData {
  tipo: string
  descripcion: string
  porcentaje: string
  monto: string
}

interface SolicitudPagoFormProps {
  projectId: number
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  editingSolicitud?: SolicitudPago | null
  existingItems?: SolicitudItem[]
  existingAjustes?: SolicitudAjuste[]
}

const emptyItem: ItemFormData = {
  descripcion: '',
  descripcion_detallada: '',
  cantidad: '1',
  unidad: 'unidad',
  precio_unitario: '',
  expanded: false
}

const emptyAjuste: AjusteFormData = {
  tipo: 'impuesto',
  descripcion: '',
  porcentaje: '',
  monto: ''
}

export default function SolicitudPagoForm({
  projectId,
  isOpen,
  onClose,
  onSave,
  editingSolicitud,
  existingItems = [],
  existingAjustes = []
}: SolicitudPagoFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [fecha, setFecha] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [solicitadoPor, setSolicitadoPor] = useState<string>('')
  const [requisicionId, setRequisicionId] = useState<string>('')
  const [observaciones, setObservaciones] = useState('')
  const [beneficiario, setBeneficiario] = useState('')
  const [banco, setBanco] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('')
  const [numeroCuenta, setNumeroCuenta] = useState('')

  // Dynamic items & ajustes
  const [items, setItems] = useState<ItemFormData[]>([{ ...emptyItem }])
  const [ajustes, setAjustes] = useState<AjusteFormData[]>([])

  // Options
  const [usuarios, setUsuarios] = useState<UserOption[]>([])
  const [requisiciones, setRequisiciones] = useState<RequisicionOption[]>([])
  const [nextNumero, setNextNumero] = useState<string>('')

  // Load options when modal opens
  useEffect(() => {
    if (isOpen) {
      loadOptions()
    }
  }, [isOpen, projectId])

  // Populate form when editing or reset for new
  useEffect(() => {
    if (editingSolicitud) {
      setFecha(editingSolicitud.fecha ? editingSolicitud.fecha.split('T')[0] : '')
      setProveedor(editingSolicitud.proveedor || '')
      setSolicitadoPor(editingSolicitud.solicitado_por?.toString() || '')
      setRequisicionId(editingSolicitud.requisicion_id?.toString() || '')
      setObservaciones(editingSolicitud.observaciones || '')
      setBeneficiario(editingSolicitud.beneficiario || '')
      setBanco(editingSolicitud.banco || '')
      setTipoCuenta(editingSolicitud.tipo_cuenta || '')
      setNumeroCuenta(editingSolicitud.numero_cuenta || '')

      if (existingItems.length > 0) {
        setItems(existingItems.map(item => ({
          descripcion: item.descripcion || '',
          descripcion_detallada: item.descripcion_detallada || '',
          cantidad: item.cantidad?.toString() || '1',
          unidad: item.unidad || 'unidad',
          precio_unitario: item.precio_unitario?.toString() || '',
          expanded: false
        })))
      } else {
        setItems([{ ...emptyItem }])
      }

      if (existingAjustes.length > 0) {
        setAjustes(existingAjustes.map(a => ({
          tipo: a.tipo || 'impuesto',
          descripcion: a.descripcion || '',
          porcentaje: a.porcentaje?.toString() || '',
          monto: a.monto?.toString() || ''
        })))
      } else {
        setAjustes([])
      }
    } else {
      // New solicitud
      const today = new Date().toISOString().split('T')[0]
      setFecha(today)
      setProveedor('')
      setSolicitadoPor(user?.id?.toString() || '')
      setRequisicionId('')
      setObservaciones('')
      setBeneficiario('')
      setBanco('')
      setTipoCuenta('')
      setNumeroCuenta('')
      setItems([{ ...emptyItem }])
      setAjustes([])
    }
    setError(null)
  }, [editingSolicitud, existingItems, existingAjustes, isOpen, user])

  const loadOptions = async () => {
    try {
      const [usersRes, reqRes, numRes] = await Promise.all([
        api.get('/project-members/users'),
        api.get(`/requisiciones/project/${projectId}`),
        editingSolicitud ? Promise.resolve(null) : api.get(`/solicitudes-pago/project/${projectId}/next-number`)
      ])

      if (usersRes.data.success) {
        setUsuarios(usersRes.data.users || [])
      }
      if (reqRes.data.success) {
        setRequisiciones((reqRes.data.requisiciones || []).map((r: { id: number; numero: string }) => ({
          id: r.id,
          numero: r.numero
        })))
      }
      if (numRes?.data?.success) {
        setNextNumero(numRes.data.numero)
      }
    } catch (err) {
      console.error('Error loading options:', err)
    }
  }

  // Calculations
  const calculateItemTotal = (item: ItemFormData) => {
    const cantidad = parseFloat(item.cantidad) || 0
    const precioUnitario = parseFloat(item.precio_unitario) || 0
    return cantidad * precioUnitario
  }

  const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)

  const calculateAjusteMonto = (ajuste: AjusteFormData): number => {
    if (ajuste.porcentaje && parseFloat(ajuste.porcentaje) > 0) {
      return subtotal * parseFloat(ajuste.porcentaje) / 100
    }
    return parseFloat(ajuste.monto) || 0
  }

  const totalDescuentos = ajustes
    .filter(a => a.tipo === 'descuento')
    .reduce((sum, a) => sum + Math.abs(calculateAjusteMonto(a)), 0)

  const totalImpuestos = ajustes
    .filter(a => a.tipo === 'impuesto')
    .reduce((sum, a) => sum + Math.abs(calculateAjusteMonto(a)), 0)

  const montoTotal = subtotal - totalDescuentos + totalImpuestos

  // Item handlers
  const handleItemChange = (index: number, field: keyof ItemFormData, value: string | boolean) => {
    setItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }])

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  // Ajuste handlers
  const handleAjusteChange = (index: number, field: keyof AjusteFormData, value: string) => {
    setAjustes(prev => {
      const newAjustes = [...prev]
      newAjustes[index] = { ...newAjustes[index], [field]: value }
      return newAjustes
    })
  }

  const addAjuste = () => setAjustes(prev => [...prev, { ...emptyAjuste }])

  const removeAjuste = (index: number) => {
    setAjustes(prev => prev.filter((_, i) => i !== index))
  }

  // Submit
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!proveedor.trim()) {
      setError('El proveedor es requerido')
      return
    }

    const validItems = items.filter(i => i.descripcion.trim() && parseFloat(i.precio_unitario) > 0)
    if (validItems.length === 0) {
      setError('Debe incluir al menos un item con descripción y precio')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = {
        proyecto_id: projectId,
        fecha,
        proveedor: proveedor.trim(),
        solicitado_por: solicitadoPor ? parseInt(solicitadoPor) : null,
        requisicion_id: requisicionId ? parseInt(requisicionId) : null,
        observaciones: observaciones.trim() || null,
        beneficiario: beneficiario.trim() || null,
        banco: banco.trim() || null,
        tipo_cuenta: tipoCuenta || null,
        numero_cuenta: numeroCuenta.trim() || null,
        items: validItems.map(item => ({
          cantidad: parseFloat(item.cantidad) || 1,
          unidad: item.unidad || 'unidad',
          descripcion: item.descripcion.trim(),
          descripcion_detallada: item.descripcion_detallada.trim() || null,
          precio_unitario: parseFloat(item.precio_unitario)
        })),
        ajustes: ajustes
          .filter(a => a.descripcion.trim() && (parseFloat(a.monto) > 0 || parseFloat(a.porcentaje) > 0))
          .map(a => ({
            tipo: a.tipo,
            descripcion: a.descripcion.trim(),
            porcentaje: a.porcentaje ? parseFloat(a.porcentaje) : null,
            monto: calculateAjusteMonto(a)
          }))
      }

      if (editingSolicitud) {
        await api.put(`/solicitudes-pago/${editingSolicitud.id}`, payload)
      } else {
        await api.post('/solicitudes-pago', payload)
      }

      onSave()
      onClose()
    } catch (err: unknown) {
      console.error('Error saving solicitud:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Error al guardar la solicitud de pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[750px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {editingSolicitud ? `Editar ${editingSolicitud.numero}` : `Nueva Solicitud de Pago${nextNumero ? ` (${nextNumero})` : ''}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Section 1: Datos principales */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos Principales</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="proveedor" className="text-xs">Proveedor *</Label>
                <Input
                  id="proveedor"
                  placeholder="Nombre del proveedor"
                  value={proveedor}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setProveedor(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="fecha" className="text-xs">Fecha *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFecha(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Solicitado por</Label>
                <Select value={solicitadoPor} onValueChange={setSolicitadoPor}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Requisicion vinculada</Label>
                <Select value={requisicionId} onValueChange={setRequisicionId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Ninguna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna</SelectItem>
                    {requisiciones.map(r => (
                      <SelectItem key={r.id} value={r.id.toString()}>{r.numero}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="observaciones" className="text-xs">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Notas adicionales..."
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Agregar Item
              </Button>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Descripcion</span>
              <span>Cant.</span>
              <span>Unidad</span>
              <span>P. Unit.</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>

            {/* Items Rows */}
            <div className="space-y-2">
              {items.map((item, index) => {
                const itemTotal = calculateItemTotal(item)
                return (
                  <div key={index} className="space-y-1">
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-2 p-3 border rounded-lg">
                      <Input
                        placeholder="Descripcion del item"
                        value={item.descripcion}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'descripcion', e.target.value)}
                        className="h-9"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Cant.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.cantidad}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'cantidad', e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unidad</Label>
                          <Select value={item.unidad} onValueChange={(v) => handleItemChange(index, 'unidad', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unidad">Und</SelectItem>
                              <SelectItem value="metro">Metro</SelectItem>
                              <SelectItem value="m2">M2</SelectItem>
                              <SelectItem value="m3">M3</SelectItem>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="galon">Galon</SelectItem>
                              <SelectItem value="global">Global</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">P. Unit.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.precio_unitario}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'precio_unitario', e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleItemChange(index, 'expanded', !item.expanded)}
                          >
                            {item.expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                            Detalle
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(index)}
                            disabled={items.length === 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-medium">{formatMoney(itemTotal)}</span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-6 p-0 shrink-0"
                          onClick={() => handleItemChange(index, 'expanded', !item.expanded)}
                          title="Descripcion detallada"
                        >
                          {item.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </Button>
                        <Input
                          placeholder="Descripcion del item"
                          value={item.descripcion}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'descripcion', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cantidad}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'cantidad', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Select value={item.unidad} onValueChange={(v) => handleItemChange(index, 'unidad', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unidad">Und</SelectItem>
                          <SelectItem value="metro">Metro</SelectItem>
                          <SelectItem value="m2">M2</SelectItem>
                          <SelectItem value="m3">M3</SelectItem>
                          <SelectItem value="kg">Kg</SelectItem>
                          <SelectItem value="galon">Galon</SelectItem>
                          <SelectItem value="global">Global</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.precio_unitario}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'precio_unitario', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="text-sm text-right font-medium">
                        {formatMoney(itemTotal)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Expanded: descripcion detallada */}
                    {item.expanded && (
                      <div className="sm:pl-8 sm:pr-10">
                        <Textarea
                          placeholder="Descripcion detallada del item..."
                          rows={2}
                          value={item.descripcion_detallada}
                          onChange={(e) => handleItemChange(index, 'descripcion_detallada', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Subtotal */}
            <div className="flex justify-end text-sm pt-1">
              <span className="text-muted-foreground mr-4">Subtotal:</span>
              <span className="font-medium w-24 text-right">{formatMoney(subtotal)}</span>
            </div>
          </div>

          {/* Section 3: Ajustes */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ajustes (Impuestos / Descuentos)</h3>
              <Button type="button" variant="outline" size="sm" onClick={addAjuste} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Agregar Ajuste
              </Button>
            </div>

            {ajustes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ajustes. Agrega impuestos o descuentos si aplica.</p>
            ) : (
              <div className="space-y-2">
                {ajustes.map((ajuste, index) => {
                  const montoCalculado = calculateAjusteMonto(ajuste)
                  return (
                    <div key={index} className="grid grid-cols-[100px_1fr_80px_90px_30px] gap-2 items-center">
                      <Select value={ajuste.tipo} onValueChange={(v) => handleAjusteChange(index, 'tipo', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="impuesto">Impuesto</SelectItem>
                          <SelectItem value="descuento">Descuento</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Descripcion (ej: ITBMS 7%)"
                        value={ajuste.descripcion}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleAjusteChange(index, 'descripcion', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="%"
                        value={ajuste.porcentaje}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleAjusteChange(index, 'porcentaje', e.target.value)}
                        className="h-8 text-sm"
                        title="Porcentaje (calcula automaticamente)"
                      />
                      <div className="text-sm text-right font-medium">
                        {ajuste.tipo === 'descuento' ? '-' : '+'}{formatMoney(montoCalculado)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAjuste(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 4: Datos bancarios */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos Bancarios</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="beneficiario" className="text-xs">Beneficiario</Label>
                <Input
                  id="beneficiario"
                  placeholder="Nombre del beneficiario"
                  value={beneficiario}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBeneficiario(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="banco" className="text-xs">Banco</Label>
                <Input
                  id="banco"
                  placeholder="Nombre del banco"
                  value={banco}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBanco(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de Cuenta</Label>
                <Select value={tipoCuenta} onValueChange={setTipoCuenta}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorro">Ahorro</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="numero_cuenta" className="text-xs">Numero de Cuenta</Label>
                <Input
                  id="numero_cuenta"
                  placeholder="Numero de cuenta"
                  value={numeroCuenta}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNumeroCuenta(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>
            {totalDescuentos > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Descuentos:</span>
                <span className="font-medium text-red-600">-{formatMoney(totalDescuentos)}</span>
              </div>
            )}
            {totalImpuestos > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Impuestos:</span>
                <span className="font-medium">+{formatMoney(totalImpuestos)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
              <span>TOTAL:</span>
              <span>{formatMoney(montoTotal)}</span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : editingSolicitud ? 'Actualizar' : 'Crear Solicitud'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
