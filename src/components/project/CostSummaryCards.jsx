/**
 * CostSummaryCards Component
 * Displays budget overview with progress indicators
 * Features: Total budget, spent, available, and progress bar
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingDown, Wallet } from "lucide-react"

export default function CostSummaryCards({ budget, spent, available, percentage }) {
  // Format money
  const formatMoney = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PAB',
    }).format(amount).replace('PAB', 'B/.')
  }

  // Get status color based on percentage used
  const getStatusColor = (percent) => {
    if (percent >= 90) return 'text-destructive'
    if (percent >= 75) return 'text-yellow-600'
    return 'text-blue-600'
  }

  const getProgressColor = (percent) => {
    if (percent >= 90) return 'bg-destructive'
    if (percent >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  // El presupuesto total viene de presupuesto_aprobado (suma de categorías o monto contrato)
  const budgetTotal = budget?.presupuesto_aprobado || budget?.total_presupuestado || 0
  const spentAmount = spent || 0
  const availableAmount = available ?? (budgetTotal - spentAmount)
  const percentageUsed = percentage ?? (budgetTotal > 0 ? (spentAmount / budgetTotal) * 100 : 0)

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="flex flex-wrap gap-4">
        {/* Total Budget Card */}
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold whitespace-nowrap">{formatMoney(budgetTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Presupuesto aprobado
            </p>
          </CardContent>
        </Card>

        {/* Total Spent Card */}
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastado</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold whitespace-nowrap ${getStatusColor(percentageUsed)}`}>
              {formatMoney(spentAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {percentageUsed.toFixed(1)}% del presupuesto
            </p>
          </CardContent>
        </Card>

        {/* Available Balance Card */}
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponible</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold whitespace-nowrap">{formatMoney(availableAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(100 - percentageUsed).toFixed(1)}% restante
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progreso del Presupuesto</span>
              <span className={`font-bold ${getStatusColor(percentageUsed)}`}>
                {percentageUsed.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getProgressColor(percentageUsed)}`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>
                {percentageUsed >= 90 ? 'Crítico' : percentageUsed >= 75 ? 'Atención' : 'Normal'}
              </span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
