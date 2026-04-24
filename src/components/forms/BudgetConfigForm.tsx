import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, MinusCircle, Plus, PlusCircle } from 'lucide-react';
import api from '../../services/api';
import { formatMoney } from '../../utils/formatters';
import type { ProjectCategory } from '@/types';

interface NewCategory {
  nombre: string;
  codigo: string;
  color: string;
}

interface PendingCategory extends NewCategory {
  tempId: string;
  isPending: true;
}

interface VisibleCategory extends ProjectCategory {
  isPending?: boolean;
  tempId?: string;
}

interface BudgetConfigFormProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<void>;
}

const COLOR_PALETTE = [
  '#e74c3c',
  '#3498db',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#34495e',
  '#e67e22',
  '#95a5a6',
  '#27ae60',
  '#e91e63',
  '#00bcd4',
  '#8bc34a',
  '#ff5722',
  '#607d8b',
  '#795548',
  '#673ab7',
  '#009688',
  '#ff9800',
];

function getFirstUnusedColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  return (
    COLOR_PALETTE.find((c) => !used.has(c.toLowerCase())) || COLOR_PALETTE[0]
  );
}

export default function BudgetConfigForm({
  projectId,
  isOpen,
  onClose,
  onSave,
}: BudgetConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [availableCategories, setAvailableCategories] = useState<
    ProjectCategory[]
  >([]);
  const [budgets, setBudgets] = useState<Record<string | number, string>>({});
  const [notes, setNotes] = useState('');
  const [totalBudget, setTotalBudget] = useState('');

  // State for new category form
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState<NewCategory>({
    nombre: '',
    codigo: '',
    color: COLOR_PALETTE[0],
  });

  // Track pending changes (only applied on save)
  const [pendingRemovals, setPendingRemovals] = useState<number[]>([]); // IDs of categories to remove
  const [pendingActivations, setPendingActivations] = useState<number[]>([]); // IDs of categories to activate
  const [pendingNewCategories, setPendingNewCategories] = useState<
    PendingCategory[]
  >([]); // New categories to create

  // Cargar categorías cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      // Reset all state when modal opens
      setTotalBudget('');
      setNotes('');
      setBudgets({});
      setPendingRemovals([]);
      setPendingActivations([]);
      setPendingNewCategories([]);
      setError(null);
      loadCategories();
    }
  }, [isOpen, projectId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load project-specific categories
      const response = await api.get(`/costs/projects/${projectId}/categories`);

      // Load existing budget data
      const budgetResponse = await api.get(
        `/costs/projects/${projectId}/budget`,
      );

      if (response.data.success) {
        setCategories(response.data.categories);

        // Build a map of saved budgets by project_category_id
        const savedBudgets: Record<number, number> = {};
        if (budgetResponse.data.success && budgetResponse.data.categories) {
          budgetResponse.data.categories.forEach(
            (cat: {
              project_category_id: number;
              presupuesto_actual?: number;
              presupuesto_inicial?: number;
            }) => {
              savedBudgets[cat.project_category_id] =
                cat.presupuesto_actual || cat.presupuesto_inicial || 0;
            },
          );
        }

        // Initialize budgets with saved values or empty
        const initialBudgets: Record<number, string> = {};
        response.data.categories.forEach((cat: ProjectCategory) => {
          const savedValue = savedBudgets[cat.id];
          initialBudgets[cat.id] =
            savedValue !== undefined && savedValue > 0
              ? String(savedValue)
              : '';
        });
        setBudgets(initialBudgets);

        // Load saved notes
        if (budgetResponse.data.budget?.notas) {
          setNotes(budgetResponse.data.budget.notas);
        }

        // Calculate total from saved budgets
        const savedTotal = Object.values(savedBudgets).reduce(
          (sum, val) => sum + (parseFloat(String(val)) || 0),
          0,
        );
        if (savedTotal > 0) {
          setTotalBudget(String(savedTotal));
        }
      }

      // Load available categories (removed ones)
      const availableResponse = await api.get(
        `/costs/projects/${projectId}/categories/available`,
      );
      if (availableResponse.data.success) {
        setAvailableCategories(availableResponse.data.availableCategories);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetChange = (categoryId: string | number, value: string) => {
    setBudgets((prev) => ({
      ...prev,
      [categoryId]: value,
    }));
  };

  // Remove category (local only - applied on save)
  const handleRemoveCategory = (category: VisibleCategory) => {
    // If it's a pending new category, just remove it from pending
    if (category.isPending && category.tempId) {
      setPendingNewCategories((prev) =>
        prev.filter((c) => c.tempId !== category.tempId),
      );
      setBudgets((prev) => {
        const newBudgets = { ...prev };
        delete newBudgets[category.tempId!];
        return newBudgets;
      });
      return;
    }

    // Add to pending removals
    setPendingRemovals((prev) => [...prev, category.id]);

    // Remove from budgets
    setBudgets((prev) => {
      const newBudgets = { ...prev };
      delete newBudgets[category.id];
      return newBudgets;
    });

    // Add to available list for potential re-activation
    if (category.category_id) {
      setAvailableCategories((prev) => [...prev, category as ProjectCategory]);
    }
  };

  // Re-activate a removed category (local only - applied on save)
  const handleActivateCategory = (category: ProjectCategory) => {
    // Remove from pending removals if it was there
    setPendingRemovals((prev) => prev.filter((id) => id !== category.id));

    // Add to pending activations to be saved later
    setPendingActivations((prev) => [...prev, category.id]);

    // Remove from available list
    setAvailableCategories((prev) => prev.filter((c) => c.id !== category.id));

    // Add back to categories list so it shows up
    setCategories((prev) => [...prev, category]);

    // Re-add budget entry
    setBudgets((prev) => ({ ...prev, [category.id]: '' }));
  };

  // Create new custom category (local only - applied on save)
  const handleCreateCategory = () => {
    if (!newCategory.nombre || !newCategory.codigo) {
      setError('Nombre y código son requeridos');
      return;
    }

    // Create a temporary category with a temp ID
    const tempId = `temp_${Date.now()}`;
    const tempCategory: PendingCategory = {
      ...newCategory,
      tempId,
      isPending: true,
    };

    setPendingNewCategories((prev) => [...prev, tempCategory]);
    setBudgets((prev) => ({ ...prev, [tempId]: '' }));

    // Reset form
    setNewCategory({ nombre: '', codigo: '', color: COLOR_PALETTE[0] });
    setShowNewCategoryForm(false);
  };

  // Compute visible categories (excluding pending removals, including pending new)
  const visibleCategories: VisibleCategory[] = [
    ...categories.filter((c) => !pendingRemovals.includes(c.id)),
    ...pendingNewCategories.map(
      (c) => ({ ...c, id: c.tempId as unknown as number }) as VisibleCategory,
    ),
  ];

  // Calcular total asignado
  const totalAssigned = Object.values(budgets).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0,
  );
  const totalBudgetNum = parseFloat(totalBudget) || 0;
  const difference = totalBudgetNum - totalAssigned;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (totalBudgetNum <= 0) {
      setError('Debes ingresar un presupuesto total mayor a 0');
      return;
    }

    if (Math.abs(difference) > 0.01) {
      setError(
        `La suma de categorías debe igualar el presupuesto total. Diferencia: B/. ${difference.toFixed(2)}`,
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Apply pending removals
      for (const categoryId of pendingRemovals) {
        await api.delete(
          `/costs/projects/${projectId}/categories/${categoryId}`,
        );
      }

      // 2. Apply pending activations
      for (const categoryId of pendingActivations) {
        await api.post(
          `/costs/projects/${projectId}/categories/${categoryId}/activate`,
        );
      }

      // 3. Create pending new categories and get their real IDs
      const newCategoryIdMap: Record<string, number> = {}; // tempId -> realId
      for (const cat of pendingNewCategories) {
        const response = await api.post(
          `/costs/projects/${projectId}/categories`,
          {
            nombre: cat.nombre,
            codigo: cat.codigo,
            color: cat.color,
          },
        );
        if (response.data.success) {
          newCategoryIdMap[cat.tempId] = response.data.category.id;
        }
      }

      // 4. Build payload with visible categories
      const activeCategories = categories.filter(
        (c) => !pendingRemovals.includes(c.id),
      );
      const payload = {
        notas: notes,
        categories: [
          ...activeCategories.map((cat) => ({
            project_category_id: cat.id,
            presupuesto_inicial: parseFloat(budgets[cat.id] || '0'),
            presupuesto_actual: parseFloat(budgets[cat.id] || '0'),
          })),
          ...pendingNewCategories.map((cat) => ({
            project_category_id: newCategoryIdMap[cat.tempId],
            presupuesto_inicial: parseFloat(budgets[cat.tempId] || '0'),
            presupuesto_actual: parseFloat(budgets[cat.tempId] || '0'),
          })),
        ],
      };

      await api.post(`/costs/projects/${projectId}/budget`, payload);

      if (onSave) {
        await onSave();
      }

      onClose();
    } catch (err: unknown) {
      console.error('Error saving budget:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message || 'Error al guardar el presupuesto',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={onClose}
      size="complex"
      title="Configuración de Presupuesto"
      description="Configura las categorías y presupuesto del proyecto"
      footer={
        <>
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
            form="budget-config-form"
            disabled={loading || Math.abs(difference) > 0.01}
            className="w-full sm:w-auto"
          >
            {loading ? 'Guardando...' : 'Guardar Presupuesto'}
          </Button>
        </>
      }
    >
        <form id="budget-config-form" onSubmit={handleSubmit} className="space-y-6">
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
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTotalBudget(e.target.value)
              }
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ingresa el presupuesto total para este proyecto
            </p>
          </div>

          {/* Categorías */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Distribución por Categorías
                </h3>
                <p className="text-xs text-muted-foreground">
                  Asigna el presupuesto entre las categorías de gastos
                </p>
              </div>

              {/* Botón Añadir Categoría */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {availableCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Categorías removidas
                      </div>
                      {availableCategories.map((cat) => (
                        <DropdownMenuItem
                          key={cat.id}
                          onClick={() => handleActivateCategory(cat)}
                        >
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.nombre} ({cat.codigo})
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      const usedColors = visibleCategories
                        .map((c) => c.color)
                        .filter(Boolean);
                      const suggested = getFirstUnusedColor(usedColors);
                      setNewCategory({
                        nombre: '',
                        codigo: '',
                        color: suggested,
                      });
                      setShowNewCategoryForm(true);
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Crear nueva categoría
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Formulario nueva categoría */}
            {showNewCategoryForm && (
              <div className="bg-muted p-4 rounded-md space-y-3">
                <h4 className="text-sm font-medium">Nueva Categoría</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="new_cat_nombre" className="text-xs">
                      Nombre
                    </Label>
                    <Input
                      id="new_cat_nombre"
                      placeholder="Ej: Combustible"
                      value={newCategory.nombre}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setNewCategory((prev) => ({
                          ...prev,
                          nombre: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_cat_codigo" className="text-xs">
                      Código
                    </Label>
                    <Input
                      id="new_cat_codigo"
                      placeholder="Ej: COMB"
                      maxLength={10}
                      value={newCategory.codigo}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setNewCategory((prev) => ({
                          ...prev,
                          codigo: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COLOR_PALETTE.filter((color) => {
                      const usedColors = new Set(
                        visibleCategories
                          .map((c) => c.color?.toLowerCase())
                          .filter(Boolean),
                      );
                      return !usedColors.has(color.toLowerCase());
                    }).map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          newCategory.color.toLowerCase() ===
                          color.toLowerCase()
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:border-muted-foreground/50'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setNewCategory((prev) => ({ ...prev, color }))
                        }
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewCategoryForm(false);
                      setNewCategory({
                        nombre: '',
                        codigo: '',
                        color: COLOR_PALETTE[0],
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                  >
                    Crear Categoría
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="bg-muted p-8 rounded-md text-center">
                <p className="text-sm text-muted-foreground">
                  Cargando categorías...
                </p>
              </div>
            ) : visibleCategories.length === 0 ? (
              <div className="bg-muted p-8 rounded-md text-center">
                <p className="text-sm text-muted-foreground">
                  No hay categorías disponibles
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleCategories.map((category) => (
                  <div
                    key={category.id}
                    className="grid grid-cols-[auto_1fr_2fr_auto] gap-3 items-center"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <Label htmlFor={`cat_${category.id}`} className="text-sm">
                      {category.nombre}{' '}
                      <span className="text-muted-foreground">
                        ({category.codigo})
                      </span>
                      {category.is_custom && (
                        <span className="text-xs text-info ml-1">
                          (custom)
                        </span>
                      )}
                      {category.isPending && (
                        <span className="text-xs text-warning ml-1">
                          (nuevo)
                        </span>
                      )}
                    </Label>
                    <Input
                      id={`cat_${category.id}`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={budgets[category.id] || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleBudgetChange(category.id, e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="h-5 w-5 rounded-full bg-error flex items-center justify-center hover:bg-error/90 transition-colors"
                      onClick={() => handleRemoveCategory(category)}
                      title="Remover categoría"
                    >
                      <MinusCircle
                        className="h-5 w-5 text-white"
                        strokeWidth={2.5}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Resumen */}
            {visibleCategories.length > 0 && (
              <div className="bg-muted p-4 rounded-md space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Suma de Categorías:</span>
                  <span className="font-semibold">
                    {formatMoney(totalAssigned)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Presupuesto Total:</span>
                  <span className="font-semibold">
                    {formatMoney(totalBudgetNum)}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between text-sm font-bold ${
                    Math.abs(difference) < 0.01
                      ? 'text-success'
                      : 'text-destructive'
                  }`}
                >
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setNotes(e.target.value)
              }
              rows={3}
            />
          </div>

        </form>
    </AppDialog>
  );
}
