/**
 * ExpensesByCategory Component
 * Shows budget vs actual spending by expense category
 * Features: Color-coded categories, progress bars, responsive layout
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ExpensesByCategory({ categories }) {
  // Format money
  const formatMoney = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PAB',
    }).format(amount).replace('PAB', 'B/.')
  }

  const getProgressColor = (percent) => {
    if (percent >= 90) return 'bg-destructive'
    if (percent >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay categorías de gastos disponibles
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por Categoría</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Presupuesto</TableHead>
                <TableHead className="text-right">Gastado</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="w-[200px]">Progreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(category.presupuesto_actual)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(category.gastado)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(category.disponible)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {category.porcentaje_usado?.toFixed(0) || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getProgressColor(category.porcentaje_usado || 0)}`}
                          style={{ width: `${Math.min(category.porcentaje_usado || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="pt-4 space-y-3">
                {/* Category Name with Color */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-semibold">{category.nombre}</span>
                </div>

                {/* Budget Info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Presupuesto</div>
                    <div className="font-medium">{formatMoney(category.presupuesto_actual)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Gastado</div>
                    <div className="font-medium">{formatMoney(category.gastado)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Disponible</div>
                    <div className="font-medium">{formatMoney(category.disponible)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Progreso</div>
                    <div className="font-medium">{category.porcentaje_usado?.toFixed(0) || 0}%</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getProgressColor(category.porcentaje_usado || 0)}`}
                    style={{ width: `${Math.min(category.porcentaje_usado || 0, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
