import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const BudgetSetup = ({ project, onBudgetUpdate }) => {
    const { user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [existingBudget, setExistingBudget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [budgetForm, setBudgetForm] = useState({
        monto_contrato_original: project.monto_total || project.monto_contrato_original || '',
        monto_contrato_actual: project.monto_total || project.monto_contrato_original || '',
        contingencia_porcentaje: 10,
        notas: '',
        categories: []
    });

    // Cargar datos iniciales
    useEffect(() => {
        loadInitialData();
    }, [project.id]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            
            // Cargar categorías y presupuesto existente en paralelo
            const [categoriesRes, budgetRes] = await Promise.all([
                api.get('/costs/categories'),
                api.get(`/costs/projects/${project.id}/budget`)
            ]);

            if (categoriesRes.data.success) {
                const cats = categoriesRes.data.categories;
                setCategories(cats);

                // Si hay presupuesto existente, cargar datos
                if (budgetRes.data.success && budgetRes.data.budget) {
                    const budget = budgetRes.data.budget;
                    const budgetCategories = budgetRes.data.categories || [];
                    
                    setBudgetForm({
                        monto_contrato_original: budget.monto_contrato_original || '',
                        monto_contrato_actual: budget.monto_contrato_actual || '',
                        contingencia_porcentaje: budget.contingencia_porcentaje || 10,
                        notas: budget.notas || '',
                        categories: cats.map(cat => {
                            const existing = budgetCategories.find(bc => bc.category_id === cat.id);
                            return {
                                category_id: cat.id,
                                categoria_nombre: cat.nombre,
                                categoria_codigo: cat.codigo,
                                categoria_color: cat.color,
                                presupuesto_inicial: existing ? existing.presupuesto_inicial : 0,
                                presupuesto_actual: existing ? existing.presupuesto_actual : 0
                            };
                        })
                    });
                    setExistingBudget(budget);
                } else {
                    // Nuevo presupuesto - inicializar categorías vacías
                    setBudgetForm(prev => ({
                        ...prev,
                        categories: cats.map(cat => ({
                            category_id: cat.id,
                            categoria_nombre: cat.nombre,
                            categoria_codigo: cat.codigo,
                            categoria_color: cat.color,
                            presupuesto_inicial: 0,
                            presupuesto_actual: 0
                        }))
                    }));
                }
            }
        } catch (error) {
            console.error('Error loading budget data:', error);
            setError('Error cargando datos del presupuesto');
        } finally {
            setLoading(false);
        }
    };

    const handleMainBudgetChange = (field, value) => {
        setBudgetForm(prev => ({
            ...prev,
            [field]: value
        }));

        // Si cambia el monto del contrato, distribuir automáticamente
        if (field === 'monto_contrato_actual' && value) {
            autoDistributeBudget(parseFloat(value));
        }
    };

    const handleCategoryBudgetChange = (categoryId, field, value) => {
        setBudgetForm(prev => ({
            ...prev,
            categories: prev.categories.map(cat => 
                cat.category_id === categoryId 
                    ? { ...cat, [field]: parseFloat(value) || 0 }
                    : cat
            )
        }));
    };

    // Distribución automática del presupuesto
    const autoDistributeBudget = (totalBudget) => {
        // Distribución típica para proyectos de construcción
        const distribution = {
            'MAT': 0.45, // Materiales - 45%
            'MOB': 0.25, // Mano de Obra - 25%
            'EQP': 0.15, // Equipos - 15%
            'SUB': 0.08, // Subcontratistas - 8%
            'TRA': 0.03, // Transporte - 3%
            'SER': 0.02, // Servicios - 2%
            'ADM': 0.015, // Administrativos - 1.5%
            'IMP': 0.005  // Imprevistos - 0.5%
        };

        setBudgetForm(prev => ({
            ...prev,
            categories: prev.categories.map(cat => {
                const percentage = distribution[cat.categoria_codigo] || 0;
                const amount = totalBudget * percentage;
                return {
                    ...cat,
                    presupuesto_inicial: amount,
                    presupuesto_actual: amount
                };
            })
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError('');
            setSuccess('');

            // Validaciones
            if (!budgetForm.monto_contrato_original || !budgetForm.monto_contrato_actual) {
                setError('Los montos del contrato son requeridos');
                return;
            }

            const totalCategorias = budgetForm.categories.reduce((sum, cat) => sum + cat.presupuesto_actual, 0);
            const montoContrato = parseFloat(budgetForm.monto_contrato_actual);
            const contingencia = (montoContrato * budgetForm.contingencia_porcentaje) / 100;
            const presupuestoDisponible = montoContrato + contingencia;

            if (totalCategorias > presupuestoDisponible) {
                setError(`El total de categorías ($${totalCategorias.toLocaleString()}) excede el presupuesto disponible ($${presupuestoDisponible.toLocaleString()})`);
                return;
            }

            const response = await api.post(`/costs/projects/${project.id}/budget`, budgetForm);

            if (response.data.success) {
                setSuccess('Presupuesto guardado exitosamente');
                if (onBudgetUpdate) {
                    onBudgetUpdate();
                }
                // Recargar datos
                setTimeout(() => {
                    loadInitialData();
                    setSuccess('');
                }, 1500);
            }
        } catch (error) {
            console.error('Error saving budget:', error);
            setError('Error guardando presupuesto: ' + (error.response?.data?.message || error.message));
        } finally {
            setSaving(false);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    if (loading) {
        return (
            <div className="budget-loading">
                <div className="loading-spinner"></div>
                <p>Cargando configuración de presupuesto...</p>
            </div>
        );
    }

    const totalPresupuestado = budgetForm.categories.reduce((sum, cat) => sum + cat.presupuesto_actual, 0);
    const montoContrato = parseFloat(budgetForm.monto_contrato_actual) || 0;
    const contingencia = (montoContrato * budgetForm.contingencia_porcentaje) / 100;
    const presupuestoDisponible = montoContrato + contingencia;
    const diferencia = presupuestoDisponible - totalPresupuestado;

    return (
        <div className="budget-setup">
            <div className="budget-header">
                <h2>📋 Configuración del Presupuesto</h2>
                <p>Configure el presupuesto detallado para: <strong>{project.nombre}</strong></p>
            </div>

            {error && (
                <div className="alert alert-error">
                    ❌ {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    ✅ {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="budget-form">
                {/* Información del Contrato */}
                <div className="budget-section">
                    <h3>💰 Información del Contrato</h3>
                    <div>
                        <div className="">
                            <label className="">Monto Contrato Original (USD):</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={budgetForm.monto_contrato_original}
                                onChange={(e) => handleMainBudgetChange('monto_contrato_original', e.target.value)}
                                required
                                className=""
                                placeholder="0.00"
                            />
                            <small className="">Monto original del contrato firmado</small>
                        </div>

                        <div className="">
                            <label className="">Monto Contrato Actual (USD):</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={budgetForm.monto_contrato_actual}
                                onChange={(e) => handleMainBudgetChange('monto_contrato_actual', e.target.value)}
                                required
                                className=""
                                placeholder="0.00"
                            />
                            <small className="">Monto actual incluyendo modificaciones</small>
                        </div>

                        <div className="">
                            <label className="">Contingencia (%):</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={budgetForm.contingencia_porcentaje}
                                onChange={(e) => handleMainBudgetChange('contingencia_porcentaje', e.target.value)}
                                className=""
                            />
                            <small className="">Porcentaje de contingencia para imprevistos</small>
                        </div>

                        <div>
                            <label className="">Notas del Presupuesto:</label>
                            <textarea
                                value={budgetForm.notas}
                                onChange={(e) => handleMainBudgetChange('notas', e.target.value)}
                                rows="3"
                                className=""
                                placeholder="Observaciones sobre el presupuesto..."
                            />
                        </div>
                    </div>
                </div>

                {/* Resumen Financiero */}
                <div className="budget-summary">
                    <div className="summary-cards">
                        <div className="summary-card">
                            <h4>💵 Monto Contrato</h4>
                            <div className="summary-amount primary">{formatMoney(montoContrato)}</div>
                        </div>
                        <div className="summary-card">
                            <h4>🛡️ Contingencia</h4>
                            <div className="summary-amount info">{formatMoney(contingencia)}</div>
                            <small>{budgetForm.contingencia_porcentaje}% del contrato</small>
                        </div>
                        <div className="summary-card">
                            <h4>📊 Total Disponible</h4>
                            <div className="summary-amount success">{formatMoney(presupuestoDisponible)}</div>
                        </div>
                        <div className="summary-card">
                            <h4>📈 Presupuestado</h4>
                            <div className="summary-amount warning">{formatMoney(totalPresupuestado)}</div>
                        </div>
                        <div className="summary-card">
                            <h4>⚖️ Diferencia</h4>
                            <div className={`summary-amount ${diferencia >= 0 ? 'success' : 'error'}`}>
                                {formatMoney(diferencia)}
                            </div>
                            <small>{diferencia >= 0 ? 'Saldo disponible' : 'Sobre presupuesto'}</small>
                        </div>
                    </div>
                </div>

                {/* Distribución por Categorías */}
                <div className="budget-section">
                    <div className="categories-header">
                        <h3>🗂️ Distribución por Categorías</h3>
                        <button
                            type="button"
                            onClick={() => autoDistributeBudget(montoContrato)}
                            className="btn-secondary"
                            disabled={!montoContrato}
                        >
                            🔄 Distribución Automática
                        </button>
                    </div>

                    <div className="categories-grid">
                        {budgetForm.categories.map(category => {
                            const percentage = montoContrato > 0 ? (category.presupuesto_actual / montoContrato * 100) : 0;
                            
                            return (
                                <div key={category.category_id} className="category-budget-card">
                                    <div 
                                        className="category-budget-header"
                                        style={{ backgroundColor: category.categoria_color }}
                                    >
                                        <h4>{category.categoria_nombre}</h4>
                                        <span className="category-code">{category.categoria_codigo}</span>
                                    </div>
                                    
                                    <div className="category-budget-body">
                                        <div className="">
                                            <div className="">
                                                <label className="">Presupuesto Inicial:</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={category.presupuesto_inicial}
                                                    onChange={(e) => handleCategoryBudgetChange(
                                                        category.category_id, 
                                                        'presupuesto_inicial', 
                                                        e.target.value
                                                    )}
                                                    className=""
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            
                                            <div className="">
                                                <label className="">Presupuesto Actual:</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={category.presupuesto_actual}
                                                    onChange={(e) => handleCategoryBudgetChange(
                                                        category.category_id, 
                                                        'presupuesto_actual', 
                                                        e.target.value
                                                    )}
                                                    className=""
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="category-stats">
                                            <div className="stat-item">
                                                <span className="stat-label">Porcentaje:</span>
                                                <span className="stat-value">{percentage.toFixed(1)}%</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">Monto:</span>
                                                <span className="stat-value">{formatMoney(category.presupuesto_actual)}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="category-progress">
                                            <div className="progress-bar">
                                                <div 
                                                    className="progress-fill"
                                                    style={{ 
                                                        width: `${Math.min(percentage, 100)}%`,
                                                        backgroundColor: category.categoria_color 
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Botones de acción */}
                <div className="budget-actions">
                    <button
                        type="submit"
                        disabled={saving || diferencia < 0}
                        className={`btn-submit ${diferencia < 0 ? 'disabled' : ''}`}
                    >
                        {saving ? '💾 Guardando...' : existingBudget ? '📝 Actualizar Presupuesto' : '✅ Crear Presupuesto'}
                    </button>
                    
                    {diferencia < 0 && (
                        <p className="warning-text">
                            ⚠️ El total presupuestado excede el monto disponible. Ajuste las categorías antes de guardar.
                        </p>
                    )}
                </div>
            </form>
        </div>
    );
};

export default BudgetSetup;