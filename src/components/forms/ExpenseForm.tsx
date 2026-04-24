/**
 * ExpenseForm Component
 * Modal form for creating and editing expenses
 * Features: Category selection, date picker, amount validation
 */

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '../../services/api';
import type { Expense, ProjectCategory } from '@/types';

interface ExpenseFormData {
  category_id: string;
  fecha: string;
  concepto: string;
  monto: string;
  descripcion: string;
  tipo_gasto: 'real' | 'compromiso' | 'estimado';
  moneda: string;
  aprobado: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

interface ExpenseFormProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  editingExpense?: Expense | null;
}

export default function ExpenseForm({
  projectId,
  isOpen,
  onClose,
  onSave,
  editingExpense,
}: ExpenseFormProps) {
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>({
    category_id: '',
    fecha: '',
    concepto: '',
    monto: '',
    descripcion: '',
    tipo_gasto: 'real',
    moneda: 'USD',
    aprobado: false,
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );

  // Load project categories when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadCategories();
    }
  }, [isOpen, projectId]);

  // Populate form when editing
  useEffect(() => {
    if (editingExpense) {
      setFormData({
        category_id: editingExpense.category_id?.toString() || '',
        fecha: editingExpense.fecha ? editingExpense.fecha.split('T')[0] : '',
        concepto: editingExpense.concepto || '',
        monto: editingExpense.monto?.toString() || '',
        descripcion: editingExpense.descripcion || '',
        tipo_gasto: editingExpense.tipo_gasto || 'real',
        moneda: editingExpense.moneda || 'USD',
        aprobado: editingExpense.aprobado || false,
      });
    } else {
      // Reset form for new expense
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        category_id: '',
        fecha: today,
        concepto: '',
        monto: '',
        descripcion: '',
        tipo_gasto: 'real',
        moneda: 'USD',
        aprobado: false,
      });
    }
    setValidationErrors({});
    setError(null);
  }, [editingExpense, isOpen]);

  const loadCategories = async () => {
    try {
      // Load project-specific categories (includes both global and custom categories)
      const response = await api.get(`/costs/projects/${projectId}/categories`);
      if (response.data.success) {
        setCategories(response.data.categories || []);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Error al cargar las categorías del proyecto');
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.category_id) {
      errors.category_id = 'La categoría es requerida';
    }

    if (!formData.concepto || formData.concepto.trim().length < 3) {
      errors.concepto = 'El concepto debe tener al menos 3 caracteres';
    }

    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      errors.monto = 'El monto debe ser mayor a 0';
    }

    if (!formData.fecha) {
      errors.fecha = 'La fecha es requerida';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        category_id: parseInt(formData.category_id),
        monto: parseFloat(formData.monto),
      };

      await onSave(dataToSave);
    } catch (err: unknown) {
      console.error('Error saving expense:', err);
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al guardar el gasto');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    field: keyof ExpenseFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={onClose}
      size="simple"
      title={editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
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
            form="expense-form"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading
              ? 'Guardando...'
              : editingExpense
                ? 'Actualizar'
                : 'Guardar'}
          </Button>
        </>
      }
    >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_id">
              Categoría <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => handleChange('category_id', value)}
            >
              <SelectTrigger
                id="category_id"
                className={
                  validationErrors.category_id ? 'border-destructive' : ''
                }
              >
                <SelectValue placeholder="Seleccione una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.nombre}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.category_id && (
              <p className="text-sm text-destructive">
                {validationErrors.category_id}
              </p>
            )}
          </div>

          {/* Date and Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="fecha">
                Fecha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange('fecha', e.target.value)
                }
                className={validationErrors.fecha ? 'border-destructive' : ''}
              />
              {validationErrors.fecha && (
                <p className="text-sm text-destructive">
                  {validationErrors.fecha}
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="monto">
                Monto (B/.) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.monto}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange('monto', e.target.value)
                }
                className={validationErrors.monto ? 'border-destructive' : ''}
              />
              {validationErrors.monto && (
                <p className="text-sm text-destructive">
                  {validationErrors.monto}
                </p>
              )}
            </div>
          </div>

          {/* Concept */}
          <div className="space-y-2">
            <Label htmlFor="concepto">
              Concepto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="concepto"
              type="text"
              placeholder="¿En qué se gastó?"
              value={formData.concepto}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleChange('concepto', e.target.value)
              }
              className={validationErrors.concepto ? 'border-destructive' : ''}
            />
            {validationErrors.concepto && (
              <p className="text-sm text-destructive">
                {validationErrors.concepto}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              placeholder="Detalles adicionales sobre este gasto..."
              rows={3}
              value={formData.descripcion}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                handleChange('descripcion', e.target.value)
              }
            />
          </div>

        </form>
    </AppDialog>
  );
}
