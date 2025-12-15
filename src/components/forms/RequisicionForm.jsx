/**
 * RequisicionForm Component
 * Modal form for creating and editing requisiciones with items
 * Features: Compact table-style items, global ITBMS option
 */

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2 } from "lucide-react"
import api from "../../services/api"
import { useAuth } from "../../context/AuthContext"

const formatMoney = (amount) => {
  if (!amount && amount !== 0) return 'B/. 0.00'
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount).replace('$', 'B/.')
}

const emptyItem = {
  descripcion: '',
  cantidad: '1',
  unidad: 'unidad',
  precio_unitario: ''
}

export default function RequisicionForm({ projectId, isOpen, onClose, onSave, editingRequisicion, existingItems = [] }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    numero: '',
    fecha: '',
    proveedor: '',
    concepto: '',
    solicitante_id: null
  })
  const [items, setItems] = useState([{ ...emptyItem }])
  const [aplicaItbms, setAplicaItbms] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [solicitantes, setSolicitantes] = useState([])

  // Cargar lista de solicitantes al abrir el modal
  // Si hay projectId: cargar miembros del proyecto (usuarios + externos)
  // Si no hay projectId: cargar todos los usuarios del sistema
  useEffect(() => {
    if (isOpen) {
      loadSolicitantes()
    }
  }, [isOpen, projectId])

  const loadSolicitantes = async () => {
    try {
      if (projectId) {
        // Cargar miembros del proyecto (usuarios + externos)
        const response = await api.get(`/project-members/project/${projectId}`)
        if (response.data.success) {
          // Mapear a formato unificado con tipo
          const members = response.data.members.map(m => ({
            id: m.tipo_miembro === 'usuario' ? m.user_id : `ext_${m.external_contact_id}`,
            nombre: m.nombre_display,
            tipo: m.tipo_miembro,
            user_id: m.user_id,
            external_contact_id: m.external_contact_id
          }))
          setSolicitantes(members)
        }
      } else {
        // Cargar todos los usuarios del sistema (vista general)
        const response = await api.get('/project-members/users')
        if (response.data.success) {
          setSolicitantes(response.data.users.map(u => ({
            id: u.id,
            nombre: u.nombre,
            tipo: 'usuario',
            user_id: u.id
          })))
        }
      }
    } catch (err) {
      console.error('Error loading solicitantes:', err)
    }
  }

  // Populate form when editing or reset for new
  useEffect(() => {
    if (editingRequisicion) {
      setFormData({
        numero: editingRequisicion.numero || '',
        fecha: editingRequisicion.fecha ? editingRequisicion.fecha.split('T')[0] : '',
        proveedor: editingRequisicion.proveedor || '',
        concepto: editingRequisicion.concepto || '',
        solicitante_id: editingRequisicion.solicitante_id || user?.id || null
      })
      // Check if any item has ITBMS
      const hasItbms = existingItems?.some(item => item.aplica_itbms) || false
      setAplicaItbms(hasItbms)

      if (existingItems && existingItems.length > 0) {
        setItems(existingItems.map(item => ({
          descripcion: item.descripcion || '',
          cantidad: item.cantidad?.toString() || '1',
          unidad: item.unidad || 'unidad',
          precio_unitario: item.precio_unitario?.toString() || ''
        })))
      } else {
        setItems([{ ...emptyItem }])
      }
    } else {
      const today = new Date().toISOString().split('T')[0]
      setFormData({
        numero: '',
        fecha: today,
        proveedor: '',
        concepto: '',
        solicitante_id: user?.id || null
      })
      setItems([{ ...emptyItem }])
      setAplicaItbms(false)
    }
    setValidationErrors({})
    setError(null)
  }, [editingRequisicion, existingItems, isOpen, user])

  // Calculate item subtotal
  const calculateItemSubtotal = (item) => {
    const cantidad = parseFloat(item.cantidad) || 0
    const precioUnitario = parseFloat(item.precio_unitario) || 0
    return cantidad * precioUnitario
  }

  // Calculate grand totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0)
    const itbms = aplicaItbms ? subtotal * 0.07 : 0
    return {
      subtotal,
      itbms,
      total: subtotal + itbms
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.numero || formData.numero.trim().length < 2) {
      errors.numero = 'Requerido'
    }
    if (!formData.proveedor || formData.proveedor.trim().length < 2) {
      errors.proveedor = 'Requerido'
    }
    if (!formData.fecha) {
      errors.fecha = 'Requerido'
    }
    if (!formData.concepto || formData.concepto.trim().length < 2) {
      errors.concepto = 'Requerido'
    }

    // Validate items
    let hasItemError = false
    items.forEach((item, index) => {
      if (!item.descripcion || item.descripcion.trim().length < 2) {
        hasItemError = true
      }
      if (!item.precio_unitario || parseFloat(item.precio_unitario) <= 0) {
        hasItemError = true
      }
    })

    if (hasItemError) {
      errors.items = 'Todos los items requieren detalle y precio'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const dataToSave = {
        numero: formData.numero,
        fecha: formData.fecha,
        proveedor: formData.proveedor,
        concepto: formData.concepto,
        solicitante_id: formData.solicitante_id,
        project_id: projectId,
        items: items.map(item => ({
          descripcion: item.descripcion,
          cantidad: parseFloat(item.cantidad) || 1,
          unidad: item.unidad || 'unidad',
          precio_unitario: parseFloat(item.precio_unitario),
          aplica_itbms: aplicaItbms,
          categoria_id: null,
          notas: null
        }))
      }

      await onSave(dataToSave)
    } catch (err) {
      console.error('Error saving requisicion:', err)
      setError(err.response?.data?.message || 'Error al guardar la requisicion')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
    if (validationErrors.items) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.items
        return newErrors
      })
    }
  }

  const addItem = () => {
    setItems(prev => [...prev, { ...emptyItem }])
  }

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  const totals = calculateTotals()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {editingRequisicion ? 'Editar Requisicion' : 'Nueva Requisicion'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Header Fields - Compact */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="numero" className="text-xs">Numero *</Label>
              <Input
                id="numero"
                type="text"
                placeholder="ALM-033"
                value={formData.numero}
                onChange={(e) => handleChange('numero', e.target.value)}
                className={`h-9 ${validationErrors.numero ? 'border-destructive' : ''}`}
                disabled={!!editingRequisicion}
              />
            </div>
            <div>
              <Label htmlFor="fecha" className="text-xs">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => handleChange('fecha', e.target.value)}
                className={`h-9 ${validationErrors.fecha ? 'border-destructive' : ''}`}
              />
            </div>
            <div>
              <Label htmlFor="proveedor" className="text-xs">Proveedor *</Label>
              <Input
                id="proveedor"
                type="text"
                placeholder="Nombre"
                value={formData.proveedor}
                onChange={(e) => handleChange('proveedor', e.target.value)}
                className={`h-9 ${validationErrors.proveedor ? 'border-destructive' : ''}`}
              />
            </div>
          </div>

          {/* Descripción (antes Concepto) */}
          <div>
            <Label htmlFor="concepto" className="text-xs">Descripción *</Label>
            <Input
              id="concepto"
              type="text"
              placeholder="Descripción general de la requisición"
              value={formData.concepto}
              onChange={(e) => handleChange('concepto', e.target.value)}
              className={`h-9 ${validationErrors.concepto ? 'border-destructive' : ''}`}
            />
          </div>

          {/* Solicitante - selector de miembros del proyecto o usuarios */}
          <div>
            <Label className="text-xs">Solicitante</Label>
            <Select
              value={formData.solicitante_id?.toString() || ''}
              onValueChange={(value) => handleChange('solicitante_id', parseInt(value))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar solicitante" />
              </SelectTrigger>
              <SelectContent>
                {solicitantes.length === 0 ? (
                  <SelectItem value="-" disabled>
                    {projectId ? 'No hay miembros en el proyecto' : 'No hay usuarios'}
                  </SelectItem>
                ) : (
                  solicitantes.map((s) => (
                    <SelectItem key={s.id} value={s.user_id?.toString() || s.id.toString()}>
                      {s.nombre}
                      {s.tipo === 'externo' && <span className="text-muted-foreground ml-1">(Externo)</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {projectId && solicitantes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Agrega miembros desde la seccion "Miembros" del proyecto
              </p>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Agregar
              </Button>
            </div>

            {validationErrors.items && (
              <p className="text-xs text-destructive">{validationErrors.items}</p>
            )}

            {/* Table Header */}
            <div className="grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Detalle</span>
              <span>Cant.</span>
              <span>Unidad</span>
              <span>P. Unit.</span>
              <span className="text-right">Subtotal</span>
              <span></span>
            </div>

            {/* Items Rows */}
            <div className="space-y-1">
              {items.map((item, index) => {
                const subtotal = calculateItemSubtotal(item)
                return (
                  <div key={index} className="grid grid-cols-[1fr_70px_80px_90px_90px_30px] gap-2 items-center">
                    <Input
                      type="text"
                      placeholder="Detalle del item"
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Select
                      value={item.unidad}
                      onValueChange={(value) => handleItemChange(index, 'unidad', value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unidad">Und</SelectItem>
                        <SelectItem value="metro">Metro</SelectItem>
                        <SelectItem value="m2">M2</SelectItem>
                        <SelectItem value="m3">M3</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="lb">Lb</SelectItem>
                        <SelectItem value="galon">Galon</SelectItem>
                        <SelectItem value="bolsa">Bolsa</SelectItem>
                        <SelectItem value="caja">Caja</SelectItem>
                        <SelectItem value="rollo">Rollo</SelectItem>
                        <SelectItem value="global">Global</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={item.precio_unitario}
                      onChange={(e) => handleItemChange(index, 'precio_unitario', e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="text-sm text-right font-medium">
                      {formatMoney(subtotal)}
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
                )
              })}
            </div>
          </div>

          {/* Totals Section */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatMoney(totals.subtotal)}</span>
            </div>

            {/* ITBMS Checkbox */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="aplica-itbms"
                  checked={aplicaItbms}
                  onCheckedChange={setAplicaItbms}
                />
                <Label htmlFor="aplica-itbms" className="text-sm cursor-pointer">
                  Aplica ITBMS (7%)
                </Label>
              </div>
              {aplicaItbms && (
                <span className="text-sm text-muted-foreground">{formatMoney(totals.itbms)}</span>
              )}
            </div>

            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
              <span>TOTAL:</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : editingRequisicion ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
