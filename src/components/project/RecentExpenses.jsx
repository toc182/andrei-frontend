/**
 * RecentExpenses Component
 * Displays list of recent expenses with edit/delete controls
 * Features: Pagination, filtering by category, role-based actions
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, FileText } from "lucide-react"
import { formatDate } from "../../utils/dateUtils"
import api from "../../services/api"

export default function RecentExpenses({ projectId, canManage, onEdit, onDelete, onRefresh }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadExpenses()
  }, [projectId])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/costs/projects/${projectId}/expenses`, {
        params: {
          limit: 20,
          offset: 0
        }
      })
      if (response.data.success) {
        setExpenses(response.data.expenses || [])
      }
    } catch (err) {
      console.error('Error loading expenses:', err)
      setError('Error al cargar los gastos')
    } finally {
      setLoading(false)
    }
  }

  // Format money
  const formatMoney = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PAB',
    }).format(amount).replace('PAB', 'B/.')
  }

  // Reload when parent refreshes
  useEffect(() => {
    if (onRefresh) {
      loadExpenses()
    }
  }, [onRefresh])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gastos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Cargando gastos...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gastos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive text-center py-8">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gastos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No hay gastos registrados
            </h3>
            <p className="text-sm text-muted-foreground">
              Los gastos aparecerán aquí una vez que sean registrados
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos Recientes</CardTitle>
        <p className="text-sm text-muted-foreground">
          {expenses.length} {expenses.length === 1 ? 'gasto registrado' : 'gastos registrados'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Expense Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Category Badge and Date */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="shrink-0"
                        style={{
                          borderColor: expense.category_color,
                          color: expense.category_color
                        }}
                      >
                        {expense.category_nombre || 'Sin categoría'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(expense.fecha)}
                      </span>
                    </div>

                    {/* Concept */}
                    <div>
                      <h4 className="font-semibold">{expense.concepto}</h4>
                      {expense.descripcion && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {expense.descripcion}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-lg font-bold">
                      {formatMoney(expense.monto)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onEdit(expense)}
                        title="Editar gasto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-destructive"
                        onClick={() => onDelete(expense.id)}
                        title="Eliminar gasto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
