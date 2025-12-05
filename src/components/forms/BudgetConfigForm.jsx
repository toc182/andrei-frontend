import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import api from "../../services/api"

export default function BudgetConfigForm({ projectId, isOpen, onClose, onSave }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState({})
  const [notes, setNotes] = useState('')
  const [totalBudget, setTotalBudget] = useState(0)

  // Cargar categorías cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      loadCategories()
    }
  }, [isOpen])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get('/costs/categories')

      if (response.data.success) {
        setCategories(response.data.categories)

        // Inicializar budgets en 0
        const initialBudgets = {}
        response.data.categories.forEach(cat => {
          initialBudgets[cat.id] = '0'
        })
        setBudgets(initialBudgets)
      }
    } catch (err) {
      console.error('Error loading categories:', err)
      setError('Error al cargar las categorías')
    } finally {
      setLoading(false)
    }
  }

  const handleBudgetChange = (categoryId, value) => {
    setBudgets(prev => ({
      ...prev,
      [categoryId]: value
    }))
  }

  // Calcular total asignado
  const totalAssigned = Object.values(budgets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
  const difference = totalBudget - totalAssigned

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (totalBudget <= 0) {
      setError('Debes ingresar un presupuesto total mayor a 0')
      return
    }

    if (Math.abs(difference) > 0.01) {
      setError(`La suma de categorías debe igualar el presupuesto total. Diferencia: B/. ${difference.toFixed(2)}`)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const payload = {
        notas: notes,
        categories: categories.map(cat => ({
          category_id: cat.id,
          presupuesto_inicial: parseFloat(budgets[cat.id] || 0),
          presupuesto_actual: parseFloat(budgets[cat.id] || 0)
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
          <div>
            <Label htmlFor="total_budget">Presupuesto Total *</Label>
            <Input
              id="total_budget"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={totalBudget}
              onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ingresa el presupuesto total para este proyecto
            </p>
          </div>

          {/* Categorías */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Distribución por Categorías</h3>
            <p className="text-xs text-muted-foreground">
              Asigna el presupuesto entre las categorías de gastos
            </p>

            {loading ? (
              <div className="bg-muted p-8 rounded-md text-center">
                <p className="text-sm text-muted-foreground">Cargando categorías...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="bg-muted p-8 rounded-md text-center">
                <p className="text-sm text-muted-foreground">No hay categorías disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="grid grid-cols-[1fr_2fr] gap-3 items-center">
                    <Label htmlFor={`cat_${category.id}`} className="text-sm">
                      {category.nombre} <span className="text-muted-foreground">({category.codigo})</span>
                    </Label>
                    <Input
                      id={`cat_${category.id}`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={budgets[category.id] || '0'}
                      onChange={(e) => handleBudgetChange(category.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Resumen */}
            {categories.length > 0 && (
              <div className="bg-muted p-4 rounded-md space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Suma de Categorías:</span>
                  <span className="font-semibold">{formatMoney(totalAssigned)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Presupuesto Total:</span>
                  <span className="font-semibold">{formatMoney(totalBudget)}</span>
                </div>
                <div className={`flex items-center justify-between text-sm font-bold ${
                  Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-destructive'
                }`}>
                  <span>Falta Asignar:</span>
                  <span>{formatMoney(difference)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones sobre el presupuesto..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botones */}
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
              disabled={loading || Math.abs(difference) > 0.01}
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
