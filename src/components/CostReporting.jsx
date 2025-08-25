import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CostReporting = ({ project }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        budget: null,
        expenses: [],
        categories: [],
        analytics: {
            totalSpent: 0,
            budgetUtilization: 0,
            remainingBudget: 0,
            overBudgetCategories: [],
            topExpenseCategories: []
        }
    });
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [chartView, setChartView] = useState('budget-vs-actual');

    useEffect(() => {
        if (project?.id) {
            loadReportData();
        }
    }, [project?.id, selectedPeriod]);

    const loadReportData = async () => {
        try {
            setLoading(true);
            
            const [budgetRes, expensesRes, categoriesRes] = await Promise.all([
                api.get(`/costs/projects/${project.id}/budget`),
                api.get(`/costs/projects/${project.id}/expenses?period=${selectedPeriod}`),
                api.get('/costs/categories')
            ]);

            const budget = budgetRes.data.success ? budgetRes.data.budget : null;
            const budgetCategories = budgetRes.data.success ? budgetRes.data.categories : [];
            const expenses = expensesRes.data.success ? expensesRes.data.expenses : [];
            const categories = categoriesRes.data.success ? categoriesRes.data.categories : [];

            // Calculate analytics
            const analytics = calculateAnalytics(budget, budgetCategories, expenses, categories);

            setReportData({
                budget,
                budgetCategories,
                expenses,
                categories,
                analytics
            });
        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateAnalytics = (budget, budgetCategories, expenses, categories) => {
        if (!budget || !budgetCategories.length) {
            return {
                totalSpent: 0,
                budgetUtilization: 0,
                remainingBudget: 0,
                overBudgetCategories: [],
                topExpenseCategories: []
            };
        }

        // Calculate total spent by category
        const spentByCategory = {};
        expenses.forEach(expense => {
            if (!spentByCategory[expense.category_id]) {
                spentByCategory[expense.category_id] = 0;
            }
            spentByCategory[expense.category_id] += parseFloat(expense.monto);
        });

        // Calculate analytics
        const totalBudget = parseFloat(budget.monto_contrato_actual) || 0;
        const totalSpent = Object.values(spentByCategory).reduce((sum, amount) => sum + amount, 0);
        const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget * 100) : 0;
        const remainingBudget = totalBudget - totalSpent;

        // Find over-budget categories
        const overBudgetCategories = budgetCategories
            .map(budgetCat => {
                const spent = spentByCategory[budgetCat.category_id] || 0;
                const budgeted = parseFloat(budgetCat.presupuesto_actual) || 0;
                const category = categories.find(c => c.id === budgetCat.category_id);
                
                return {
                    ...budgetCat,
                    categoria_nombre: category?.nombre || 'Sin categoría',
                    categoria_codigo: category?.codigo || '',
                    spent,
                    budgeted,
                    variance: spent - budgeted,
                    utilizationPercent: budgeted > 0 ? (spent / budgeted * 100) : 0
                };
            })
            .filter(cat => cat.variance > 0)
            .sort((a, b) => b.variance - a.variance);

        // Top expense categories
        const topExpenseCategories = budgetCategories
            .map(budgetCat => {
                const spent = spentByCategory[budgetCat.category_id] || 0;
                const category = categories.find(c => c.id === budgetCat.category_id);
                
                return {
                    ...budgetCat,
                    categoria_nombre: category?.nombre || 'Sin categoría',
                    categoria_codigo: category?.codigo || '',
                    categoria_color: category?.color || '#6b7280',
                    spent,
                    budgeted: parseFloat(budgetCat.presupuesto_actual) || 0
                };
            })
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 5);

        return {
            totalSpent,
            budgetUtilization,
            remainingBudget,
            overBudgetCategories,
            topExpenseCategories,
            spentByCategory
        };
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatPercent = (percent) => {
        return `${(percent || 0).toFixed(1)}%`;
    };

    const renderBudgetVsActualChart = () => {
        const { topExpenseCategories } = reportData.analytics;
        const maxAmount = Math.max(...topExpenseCategories.map(cat => Math.max(cat.budgeted, cat.spent)));

        return (
            <div className="chart-container">
                <h4>💰 Presupuesto vs Gasto Real por Categoría</h4>
                <div className="bar-chart">
                    {topExpenseCategories.map(category => (
                        <div key={category.category_id} className="bar-chart-row">
                            <div className="bar-chart-label">
                                <span className="category-name">{category.categoria_nombre}</span>
                                <span className="category-code">({category.categoria_codigo})</span>
                            </div>
                            <div className="bar-chart-bars">
                                <div className="bar-container">
                                    <div 
                                        className="bar bar-budgeted"
                                        style={{ 
                                            width: `${(category.budgeted / maxAmount) * 100}%`,
                                            backgroundColor: `${category.categoria_color}40`
                                        }}
                                    >
                                        <span className="bar-value">{formatMoney(category.budgeted)}</span>
                                    </div>
                                    <div 
                                        className="bar bar-spent"
                                        style={{ 
                                            width: `${(category.spent / maxAmount) * 100}%`,
                                            backgroundColor: category.categoria_color,
                                            marginTop: '4px'
                                        }}
                                    >
                                        <span className="bar-value">{formatMoney(category.spent)}</span>
                                    </div>
                                </div>
                                <div className="bar-legend">
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: `${category.categoria_color}40` }}></div>
                                        <span>Presupuestado</span>
                                    </div>
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: category.categoria_color }}></div>
                                        <span>Gastado</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderUtilizationChart = () => {
        const { topExpenseCategories } = reportData.analytics;

        return (
            <div className="chart-container">
                <h4>📊 Utilización del Presupuesto por Categoría</h4>
                <div className="utilization-chart">
                    {topExpenseCategories.map(category => {
                        const utilizationPercent = category.budgeted > 0 ? (category.spent / category.budgeted * 100) : 0;
                        const isOverBudget = utilizationPercent > 100;
                        
                        return (
                            <div key={category.category_id} className="utilization-row">
                                <div className="utilization-header">
                                    <span className="category-name">{category.categoria_nombre}</span>
                                    <span className={`utilization-percent ${isOverBudget ? 'over-budget' : ''}`}>
                                        {formatPercent(utilizationPercent)}
                                    </span>
                                </div>
                                <div className="utilization-bar">
                                    <div 
                                        className={`utilization-fill ${isOverBudget ? 'over-budget' : ''}`}
                                        style={{ 
                                            width: `${Math.min(utilizationPercent, 100)}%`,
                                            backgroundColor: isOverBudget ? '#ef4444' : category.categoria_color
                                        }}
                                    ></div>
                                    {isOverBudget && (
                                        <div 
                                            className="over-budget-indicator"
                                            style={{ left: '100%' }}
                                        >
                                            🚨
                                        </div>
                                    )}
                                </div>
                                <div className="utilization-details">
                                    <span>Gastado: {formatMoney(category.spent)}</span>
                                    <span>Presupuestado: {formatMoney(category.budgeted)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSpendingTrend = () => {
        // Group expenses by month
        const expensesByMonth = {};
        reportData.expenses.forEach(expense => {
            const month = new Date(expense.fecha).toISOString().slice(0, 7); // YYYY-MM format
            if (!expensesByMonth[month]) {
                expensesByMonth[month] = 0;
            }
            expensesByMonth[month] += parseFloat(expense.monto);
        });

        const months = Object.keys(expensesByMonth).sort();
        const maxSpending = Math.max(...Object.values(expensesByMonth));

        return (
            <div className="chart-container">
                <h4>📈 Tendencia de Gastos Mensuales</h4>
                <div className="trend-chart">
                    {months.length > 0 ? (
                        months.map(month => (
                            <div key={month} className="trend-bar">
                                <div 
                                    className="trend-fill"
                                    style={{ 
                                        height: `${(expensesByMonth[month] / maxSpending) * 100}%`
                                    }}
                                ></div>
                                <div className="trend-label">
                                    <span className="month-label">{month}</span>
                                    <span className="amount-label">{formatMoney(expensesByMonth[month])}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-data">
                            📊 No hay datos de gastos para mostrar
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="cost-reporting-loading">
                <div className="loading-spinner"></div>
                <p>Generando reportes de costos...</p>
            </div>
        );
    }

    if (!reportData.budget) {
        return (
            <div className="cost-reporting-empty">
                <div className="empty-state">
                    <h3>📊 Sin Presupuesto Configurado</h3>
                    <p>Para generar reportes de costos, primero debe configurar el presupuesto del proyecto.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cost-reporting">
            <div className="reporting-header">
                <h2>📊 Reportes de Costos</h2>
                <p>Análisis financiero para: <strong>{project.nombre}</strong></p>
            </div>

            {/* Filters */}
            <div className="reporting-filters">
                <div className="filter-group">
                    <label>Período:</label>
                    <select 
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">Todos los períodos</option>
                        <option value="30">Últimos 30 días</option>
                        <option value="90">Últimos 90 días</option>
                        <option value="180">Últimos 6 meses</option>
                        <option value="365">Último año</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Vista:</label>
                    <select 
                        value={chartView} 
                        onChange={(e) => setChartView(e.target.value)}
                        className="filter-select"
                    >
                        <option value="budget-vs-actual">Presupuesto vs Real</option>
                        <option value="utilization">Utilización</option>
                        <option value="trend">Tendencia</option>
                    </select>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="key-metrics">
                <div className="metric-card">
                    <h4>💵 Total Gastado</h4>
                    <div className="metric-value primary">
                        {formatMoney(reportData.analytics.totalSpent)}
                    </div>
                </div>

                <div className="metric-card">
                    <h4>📊 Utilización</h4>
                    <div className={`metric-value ${reportData.analytics.budgetUtilization > 90 ? 'warning' : 'success'}`}>
                        {formatPercent(reportData.analytics.budgetUtilization)}
                    </div>
                </div>

                <div className="metric-card">
                    <h4>💰 Presupuesto Restante</h4>
                    <div className={`metric-value ${reportData.analytics.remainingBudget < 0 ? 'error' : 'info'}`}>
                        {formatMoney(reportData.analytics.remainingBudget)}
                    </div>
                </div>

                <div className="metric-card">
                    <h4>🚨 Categorías Sobrepasadas</h4>
                    <div className="metric-value warning">
                        {reportData.analytics.overBudgetCategories.length}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="reporting-charts">
                {chartView === 'budget-vs-actual' && renderBudgetVsActualChart()}
                {chartView === 'utilization' && renderUtilizationChart()}
                {chartView === 'trend' && renderSpendingTrend()}
            </div>

            {/* Over Budget Alert */}
            {reportData.analytics.overBudgetCategories.length > 0 && (
                <div className="over-budget-alert">
                    <h4>🚨 Categorías Sobre Presupuesto</h4>
                    <div className="alert-grid">
                        {reportData.analytics.overBudgetCategories.map(category => (
                            <div key={category.category_id} className="alert-item">
                                <div className="alert-header">
                                    <span className="category-name">{category.categoria_nombre}</span>
                                    <span className="variance-amount">+{formatMoney(category.variance)}</span>
                                </div>
                                <div className="alert-details">
                                    <span>Presupuestado: {formatMoney(category.budgeted)}</span>
                                    <span>Gastado: {formatMoney(category.spent)}</span>
                                    <span>Utilización: {formatPercent(category.utilizationPercent)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Export Options */}
            <div className="reporting-actions">
                <button className="btn-secondary" disabled>
                    📄 Exportar PDF
                </button>
                <button className="btn-secondary" disabled>
                    📊 Exportar Excel
                </button>
                <button className="btn-secondary" disabled>
                    📧 Enviar por Email
                </button>
            </div>
        </div>
    );
};

export default CostReporting;