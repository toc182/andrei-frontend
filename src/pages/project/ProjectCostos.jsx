/**
 * ProjectCostos Component
 * Main container for cost tracking and budget management
 * Features: Budget overview, expense tracking, category breakdown
 */

import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import api from "../../services/api"
import CostSummaryCards from "../../components/project/CostSummaryCards"
import ExpensesByCategory from "../../components/project/ExpensesByCategory"
import RecentExpenses from "../../components/project/RecentExpenses"
import ExpenseForm from "../../components/forms/ExpenseForm"
import BudgetConfigForm from "../../components/forms/BudgetConfigForm"

export default function ProjectCostos({ projectId }) {
  const { user } = useAuth()
  const canManage = user?.rol === 'admin' || user?.rol === 'project_manager'

  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [showBudgetConfig, setShowBudgetConfig] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [projectId])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/costs/projects/${projectId}/dashboard`)
      if (response.data.success) {
        setDashboard(response.data.dashboard)
      }
    } catch (err) {
      console.error('Error loading cost dashboard:', err)
      if (err.response?.status === 404) {
        setError('No se encontraron datos de costos para este proyecto')
      } else if (err.response?.status === 403) {
        setError('No tiene permisos para ver los costos de este proyecto')
      } else {
        setError('Error al cargar los datos de costos')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExpenseSave = async (expenseData) => {
    try {
      if (editingExpense) {
        // Update existing expense
        await api.put(`/costs/projects/${projectId}/expenses/${editingExpense.id}`, expenseData)
      } else {
        // Create new expense
        await api.post(`/costs/projects/${projectId}/expenses`, expenseData)
      }

      // Reload dashboard to reflect changes
      await loadDashboard()

      // Close form
      setShowExpenseForm(false)
      setEditingExpense(null)
    } catch (err) {
      console.error('Error saving expense:', err)
      throw err // Let the form handle the error display
    }
  }

  const handleExpenseDelete = async (expenseId) => {
    if (!confirm('¿Está seguro de eliminar este gasto?')) {
      return
    }

    try {
      await api.delete(`/costs/projects/${projectId}/expenses/${expenseId}`)
      await loadDashboard()
    } catch (err) {
      console.error('Error deleting expense:', err)
      alert('Error al eliminar el gasto')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-semibold">Cargando datos de costos...</div>
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

  if (!dashboard) {
    return (
      <div className="text-center py-12">
        <div className="text-lg font-semibold mb-2">No hay datos de costos</div>
        <div className="text-sm text-muted-foreground">
          Error al cargar la información de costos
        </div>
      </div>
    )
  }

  // Check if budget is configured (optional now)
  const tienPresupuestoDetallado = dashboard?.budget?.tiene_presupuesto_configurado === true

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      {canManage && (
        <div className="flex gap-2 justify-end">
          {tienPresupuestoDetallado ? (
            <Button variant="outline" onClick={() => setShowBudgetConfig(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Editar Presupuesto
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setShowBudgetConfig(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Configurar Presupuesto Detallado
            </Button>
          )}
          <Button onClick={() => setShowExpenseForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Gasto
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <CostSummaryCards
        budget={dashboard.budget}
        spent={dashboard.totalSpent}
        available={dashboard.totalAvailable}
        percentage={dashboard.percentageUsed}
      />

      {/* Category Breakdown */}
      <ExpensesByCategory
        categories={dashboard.categoryBreakdown}
      />

      {/* Recent Expenses */}
      <RecentExpenses
        projectId={projectId}
        canManage={canManage}
        onEdit={(expense) => {
          setEditingExpense(expense)
          setShowExpenseForm(true)
        }}
        onDelete={handleExpenseDelete}
        onRefresh={loadDashboard}
      />

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <ExpenseForm
          projectId={projectId}
          isOpen={showExpenseForm}
          onClose={() => {
            setShowExpenseForm(false)
            setEditingExpense(null)
          }}
          onSave={handleExpenseSave}
          editingExpense={editingExpense}
        />
      )}

      {/* Budget Config Modal */}
      <BudgetConfigForm
        projectId={projectId}
        isOpen={showBudgetConfig}
        onClose={() => setShowBudgetConfig(false)}
        onSave={loadDashboard}
        existingBudget={dashboard.budget}
      />
    </div>
  )
}
