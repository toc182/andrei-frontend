/**
 * BudgetConfigForm Component
 * Form to configure project budget and distribute among categories
 * Features: Automatic budget from project contract, category distribution
 */

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import api from "../../services/api"

export default function BudgetConfigForm({ projectId, isOpen, onClose, onSave, existingBudget = null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [projectData, setProjectData] = useState(null)

  // Form data
  const [formData, setFormData] = useState({
    presupuesto_total: '',
    notas: '',
    categories: []
  })

  // Presupuesto total: usa el del proyecto si existe, sino permite ingresarlo
  const montoContratoProyecto = projectData?.monto_contrato_actual || 0
  const presupuestoTotal = parseFloat(formData.presupuesto_total || montoContratoProyecto || 0)

  // Total assigned to categories
  const totalAsignado = formData.categories.reduce((sum, cat) => sum + parseFloat(cat.presupuesto_actual || 0), 0)
  const diferencia = presupuestoTotal - totalAsignado

  useEffect(() => {
    loadProjectData()
    loadCategories()
    if (existingBudget) {
      loadExistingBudget()
    }
  }, [existingBudget])

  const loadProjectData = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      if (response.data.success) {
        setProjectData(response.data.project)
      }
    } catch (err) {
      console.error('Error loading project data:', err)
      setError('Error al cargar los datos del proyecto')
    }
  }

  const loadCategories = async () => {
    try {
      const response = await api.get('/costs/categories')
      if (response.data.success) {
        setCategories(response.data.categories)

        // Initialize categories array in form data
        setFormData(prev => ({
          ...prev,
          categories: response.data.categories.map(cat => ({
            category_id: cat.id,
            nombre: cat.nombre,
            codigo: cat.codigo,
            presupuesto_inicial: '0',
            presupuesto_actual: '0'
          }))
        }))
      }
    } catch (err) {
      console.error('Error loading categories:', err)
      setError('Error al cargar las categorías de gastos')
    }
  }

  const loadExistingBudget = async () => {
    try {
      const response = await api.get(`/costs/projects/${projectId}/budget`)
      if (response.data.success && response.data.budget) {
        setFormData({
          presupuesto_total: '',
          notas: response.data.budget.notas || '',
          categories: response.data.categories.map(cat => ({
            category_id: cat.category_id,
            nombre: cat.categoria_nombre,
            codigo: cat.categoria_codigo,
            presupuesto_inicial: cat.presupuesto_inicial || '0',
            presupuesto_actual: cat.presupuesto_actual || '0'
          }))
        })
      }
    } catch (err) {
      console.error('Error loading existing budget:', err)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCategoryChange = (categoryId, value) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.category_id === categoryId
          ? { ...cat, presupuesto_actual: value, presupuesto_inicial: value }
          : cat
      )
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!presupuestoTotal || presupuestoTotal <= 0) {
      setError('El proyecto debe tener un monto de contrato configurado')
      return
    }

    if (Math.abs(diferencia) > 0.01) {
      setError(`El total asignado a categorías debe ser igual al presupuesto total. Diferencia: B/. ${diferencia.toFixed(2)}`)
      return
    }

    try {
      setLoading(true)

      const payload = {
        monto_contrato_original: presupuestoTotal,
        monto_contrato_actual: presupuestoTotal,
        contingencia_porcentaje: 0,
        notas: formData.notas,
        categories: formData.categories.map(cat => ({
          category_id: cat.category_id,
          presupuesto_inicial: parseFloat(cat.presupuesto_inicial),
          presupuesto_actual: parseFloat(cat.presupuesto_actual)
        }))
      }

      await api.post(`/costs/projects/${projectId}/budget`, payload)

      if (onSave) {
        await onSave()
      }

      onClose()
    } catch (err) {
      console.error('Error saving budget:', err)
      setError(err.response?.data?.message || 'Error al guardar el presupuesto')
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (amount) => {
    if (!amount && amount !== 0) return 'B/. 0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PAB',
    }).format(amount).replace('PAB', 'B/.')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración de Presupuesto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Presupuesto Total */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Presupuesto del Proyecto</h3>

            {montoContratoProyecto > 0 ? (
              // Si el proyecto tiene monto de contrato, mostrarlo
              <div className="bg-muted p-4 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Presupuesto Total (del contrato):</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatMoney(montoContratoProyecto)}
                  </span>
                </div>
              </div>
            ) : (
              // Si NO tiene monto de contrato, permitir ingresarlo
              <div>
                <Label htmlFor="presupuesto_total">Presupuesto Total *</Label>
                <Input
                  id="presupuesto_total"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.presupuesto_total}
                  onChange={(e) => handleInputChange('presupuesto_total', e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa el presupuesto total para este proyecto
                </p>
              </div>
            )}
          </div>

          {/* Category Distribution */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Distribución por Categorías</h3>
            <p className="text-xs text-muted-foreground">
              Asigna el presupuesto entre las categorías de gastos
            </p>

            <div className="space-y-3">
              {formData.categories.map((category) => (
                <div key={category.category_id} className="grid grid-cols-[1fr_2fr] gap-3 items-center">
                  <Label htmlFor={`cat_${category.category_id}`} className="text-sm">
                    {category.nombre} <span className="text-muted-foreground">({category.codigo})</span>
                  </Label>
                  <Input
                    id={`cat_${category.category_id}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={category.presupuesto_actual}
                    onChange={(e) => handleCategoryChange(category.category_id, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-muted p-4 rounded-md space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Suma de Categorías:</span>
                <span className="font-semibold">{formatMoney(totalAsignado)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Presupuesto Total:</span>
                <span className="font-semibold">{formatMoney(presupuestoTotal)}</span>
              </div>
              <div className={`flex items-center justify-between text-sm font-bold ${
                Math.abs(diferencia) < 0.01 ? 'text-green-600' : 'text-destructive'
              }`}>
                <span>Falta Asignar:</span>
                <span>{formatMoney(diferencia)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              placeholder="Observaciones sobre el presupuesto..."
              value={formData.notas}
              onChange={(e) => handleInputChange('notas', e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-col sm:flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || Math.abs(diferencia) > 0.01}
              className="w-full sm:w-auto"
            >
              {loading ? 'Guardando...' : 'Guardar Presupuesto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
