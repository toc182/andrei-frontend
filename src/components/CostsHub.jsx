import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import BudgetSetup from './BudgetSetup';
import CostReporting from './CostReporting';
import { formatDate } from '../utils/dateUtils';

const CostsHub = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [costDashboard, setCostDashboard] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Estados para presupuesto
    const [categories, setCategories] = useState([]);
    const [budgetForm, setBudgetForm] = useState({
        monto_contrato_original: '',
        monto_contrato_actual: '',
        contingencia_porcentaje: 10,
        notas: '',
        categories: []
    });

    // Estados para gastos
    const [expenseForm, setExpenseForm] = useState({
        category_id: '',
        fecha: new Date().toISOString().split('T')[0],
        concepto: '',
        descripcion: '',
        monto: '',
        tipo_gasto: 'real',
        proveedor: '',
        numero_factura: '',
        observaciones: ''
    });

    const [expenses, setExpenses] = useState([]);
    const [expensesLoading, setExpensesLoading] = useState(false);

    // Cargar proyectos al montar
    useEffect(() => {
        loadProjects();
        loadCategories();
    }, []);

    // Cargar datos del proyecto seleccionado
    useEffect(() => {
        if (selectedProject) {
            loadCostDashboard();
            loadExpenses();
        }
    }, [selectedProject]);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await api.get('/projects');
            if (response.data.success) {
                setProjects(response.data.proyectos);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            setError('Error cargando proyectos');
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await api.get('/costs/categories');
            if (response.data.success) {
                setCategories(response.data.categories);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadCostDashboard = async () => {
        try {
            const response = await api.get(`/costs/projects/${selectedProject.id}/dashboard`);
            if (response.data.success) {
                setCostDashboard(response.data.dashboard);
            }
        } catch (error) {
            console.error('Error loading cost dashboard:', error);
        }
    };

    const loadExpenses = async () => {
        try {
            setExpensesLoading(true);
            const response = await api.get(`/costs/projects/${selectedProject.id}/expenses`);
            if (response.data.success) {
                setExpenses(response.data.expenses);
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
        } finally {
            setExpensesLoading(false);
        }
    };

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setActiveTab('dashboard');
    };

    const goBackToHub = () => {
        setSelectedProject(null);
        setCostDashboard(null);
        setExpenses([]);
    };

    const createExpense = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post(`/costs/projects/${selectedProject.id}/expenses`, expenseForm);
            if (response.data.success) {
                alert('Gasto registrado exitosamente');
                setExpenseForm({
                    category_id: '',
                    fecha: new Date().toISOString().split('T')[0],
                    concepto: '',
                    descripcion: '',
                    monto: '',
                    tipo_gasto: 'real',
                    proveedor: '',
                    numero_factura: '',
                    observaciones: ''
                });
                loadCostDashboard();
                loadExpenses();
            }
        } catch (error) {
            console.error('Error creating expense:', error);
            alert('Error registrando gasto');
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
            <div className="costs-loading">
                <div className="loading-spinner"></div>
                <h2>Cargando proyectos...</h2>
            </div>
        );
    }

    // Vista del proyecto específico
    if (selectedProject) {
        return (
            <div className="costs-container">
                {/* Navigation */}
                <div className="seguimiento-navigation">
                    <button className="btn-back" onClick={goBackToHub}>
                        ← Volver al Hub de Costos
                    </button>
                    <h2>Control de Costos: {selectedProject.nombre}</h2>
                </div>

                {/* Tabs */}
                <div className="seguimiento-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        📊 Dashboard
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
                        onClick={() => setActiveTab('expenses')}
                    >
                        💰 Registrar Gasto
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'budget' ? 'active' : ''}`}
                        onClick={() => setActiveTab('budget')}
                    >
                        📋 Presupuesto
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'reporting' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reporting')}
                    >
                        📊 Reportes
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'dashboard' && (
                    <div className="tab-content">
                        <h2 className="section-title">📊 Dashboard de Costos</h2>
                        
                        {costDashboard ? (
                            <div>
                                {/* Summary Cards */}
                                <div className="dashboard-cards">
                                    <div className="dashboard-card">
                                        <div className="card-icon">💰</div>
                                        <h3>Presupuesto Total</h3>
                                        <div className="card-number primary">
                                            {formatMoney(costDashboard.budget?.total_presupuestado)}
                                        </div>
                                        <p className="card-subtitle">Presupuesto aprobado</p>
                                    </div>

                                    <div className="dashboard-card">
                                        <div className="card-icon">📉</div>
                                        <h3>Total Gastado</h3>
                                        <div className="card-number warning">
                                            {formatMoney(costDashboard.budget?.total_gastado)}
                                        </div>
                                        <p className="card-subtitle">
                                            {costDashboard.budget?.porcentaje_usado?.toFixed(1)}% del presupuesto
                                        </p>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill" 
                                                style={{width: `${Math.min(costDashboard.budget?.porcentaje_usado || 0, 100)}%`}}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="dashboard-card">
                                        <div className="card-icon">💵</div>
                                        <h3>Saldo Disponible</h3>
                                        <div className={`card-number ${costDashboard.budget?.saldo_disponible >= 0 ? 'success' : 'error'}`}>
                                            {formatMoney(costDashboard.budget?.saldo_disponible)}
                                        </div>
                                        <p className="card-subtitle">
                                            {costDashboard.budget?.saldo_disponible >= 0 ? 'Disponible' : 'Sobre presupuesto'}
                                        </p>
                                    </div>
                                </div>

                                {/* Categories breakdown */}
                                <div className="metas-section">
                                    <h3 className="subsection-title">💼 Gastos por Categoría</h3>
                                    <div className="categories-grid">
                                        {costDashboard.categories?.map(category => {
                                            const porcentaje = category.presupuestado > 0 ? 
                                                (category.gastado / category.presupuestado * 100) : 0;
                                            const isOverBudget = porcentaje > 100;

                                            return (
                                                <div key={category.id} className={`category-card ${isOverBudget ? 'over-budget' : ''}`}>
                                                    <div 
                                                        className="category-header" 
                                                        style={{backgroundColor: category.color}}
                                                    >
                                                        <h4>{category.nombre}</h4>
                                                        <span className="category-code">{category.codigo}</span>
                                                    </div>
                                                    <div className="category-body">
                                                        <div className="category-amounts">
                                                            <div className="amount-item">
                                                                <span className="amount-label">Presupuestado:</span>
                                                                <span className="amount-value">{formatMoney(category.presupuestado)}</span>
                                                            </div>
                                                            <div className="amount-item">
                                                                <span className="amount-label">Gastado:</span>
                                                                <span className="amount-value">{formatMoney(category.gastado)}</span>
                                                            </div>
                                                            <div className="amount-item">
                                                                <span className="amount-label">Disponible:</span>
                                                                <span className={`amount-value ${isOverBudget ? 'negative' : 'positive'}`}>
                                                                    {formatMoney(category.presupuestado - category.gastado)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="category-progress">
                                                            <div className="progress-bar">
                                                                <div 
                                                                    className={`progress-fill ${isOverBudget ? 'over-budget' : ''}`}
                                                                    style={{width: `${Math.min(porcentaje, 100)}%`}}
                                                                ></div>
                                                            </div>
                                                            <span className="progress-text">{porcentaje.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Recent expenses */}
                                <div className="recent-expenses">
                                    <h3 className="subsection-title">📝 Gastos Recientes</h3>
                                    <div className="expenses-table">
                                        {costDashboard.recentExpenses?.length > 0 ? (
                                            costDashboard.recentExpenses.map(expense => (
                                                <div key={expense.id} className="expense-row">
                                                    <div className="expense-date">{formatDate(expense.fecha)}</div>
                                                    <div className="expense-category" style={{color: expense.categoria_color}}>
                                                        {expense.categoria_nombre}
                                                    </div>
                                                    <div className="expense-concept">{expense.concepto}</div>
                                                    <div className="expense-amount">{formatMoney(expense.monto)}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="no-expenses">No hay gastos registrados aún</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="no-budget">
                                <p>No hay datos de costos para este proyecto. Configure el presupuesto primero.</p>
                                <button 
                                    className="btn-primary"
                                    onClick={() => setActiveTab('budget')}
                                >
                                    Configurar Presupuesto
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'expenses' && (
                    <div className="tab-content">
                        <h2 className="section-title">💰 Registrar Nuevo Gasto</h2>

                        <form onSubmit={createExpense} className="seguimiento-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">💼 Categoría:</label>
                                    <select
                                        value={expenseForm.category_id}
                                        onChange={(e) => setExpenseForm({...expenseForm, category_id: e.target.value})}
                                        required
                                        className="form-input"
                                    >
                                        <option value="">Seleccionar categoría...</option>
                                        {categories.map(category => (
                                            <option key={category.id} value={category.id}>
                                                {category.nombre} ({category.codigo})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">📅 Fecha:</label>
                                    <input
                                        type="date"
                                        value={expenseForm.fecha}
                                        onChange={(e) => setExpenseForm({...expenseForm, fecha: e.target.value})}
                                        required
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">📝 Concepto:</label>
                                <input
                                    type="text"
                                    value={expenseForm.concepto}
                                    onChange={(e) => setExpenseForm({...expenseForm, concepto: e.target.value})}
                                    required
                                    placeholder="Descripción breve del gasto"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">📄 Descripción detallada:</label>
                                <textarea
                                    value={expenseForm.descripcion}
                                    onChange={(e) => setExpenseForm({...expenseForm, descripcion: e.target.value})}
                                    rows="3"
                                    placeholder="Detalles adicionales del gasto"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">💵 Monto (USD):</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={expenseForm.monto}
                                        onChange={(e) => setExpenseForm({...expenseForm, monto: e.target.value})}
                                        required
                                        placeholder="0.00"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">🏷️ Tipo de Gasto:</label>
                                    <select
                                        value={expenseForm.tipo_gasto}
                                        onChange={(e) => setExpenseForm({...expenseForm, tipo_gasto: e.target.value})}
                                        className="form-input"
                                    >
                                        <option value="real">Gasto Real</option>
                                        <option value="compromiso">Compromiso</option>
                                        <option value="estimado">Estimado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">🏢 Proveedor:</label>
                                    <input
                                        type="text"
                                        value={expenseForm.proveedor}
                                        onChange={(e) => setExpenseForm({...expenseForm, proveedor: e.target.value})}
                                        placeholder="Nombre del proveedor"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">🧾 Número de Factura:</label>
                                    <input
                                        type="text"
                                        value={expenseForm.numero_factura}
                                        onChange={(e) => setExpenseForm({...expenseForm, numero_factura: e.target.value})}
                                        placeholder="Número de factura"
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">💭 Observaciones:</label>
                                <textarea
                                    value={expenseForm.observaciones}
                                    onChange={(e) => setExpenseForm({...expenseForm, observaciones: e.target.value})}
                                    rows="2"
                                    placeholder="Observaciones adicionales"
                                    className="form-input"
                                />
                            </div>

                            <button type="submit" className="btn-submit">
                                💾 Registrar Gasto
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'budget' && (
                    <div className="tab-content">
                        <BudgetSetup 
                            project={selectedProject} 
                            onBudgetUpdate={loadCostDashboard}
                        />
                    </div>
                )}

                {activeTab === 'reporting' && (
                    <div className="tab-content">
                        <CostReporting 
                            project={selectedProject}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Vista principal del hub
    return (
        <div className="costs-hub">
            <div className="hub-header">
                <h1>💰 Hub de Control de Costos</h1>
                <p>Selecciona un proyecto para gestionar sus costos y presupuesto</p>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="projects-grid">
                {projects.length === 0 ? (
                    <div className="empty-state">
                        <h3>No hay proyectos disponibles</h3>
                        <p>Crea un proyecto primero para comenzar con el control de costos.</p>
                    </div>
                ) : (
                    projects.map(project => (
                        <div 
                            key={project.id} 
                            className="project-card cost-project-card"
                            onClick={() => handleProjectSelect(project)}
                        >
                            <div className="project-card-header">
                                <h3>{project.nombre_corto || project.nombre}</h3>
                                <span className={`budget-badge ${project.tiene_presupuesto ? 'has-budget' : 'no-budget'}`}>
                                    {project.tiene_presupuesto ? '💰 Con Presupuesto' : '⚠️ Sin Presupuesto'}
                                </span>
                            </div>
                            
                            <div className="project-card-info">
                                <div className="info-row">
                                    <span className="label">Cliente:</span>
                                    <span>{project.cliente_abreviatura || project.cliente_nombre || 'No asignado'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Estado:</span>
                                    <span className={`status-badge status-${project.estado}`}>
                                        {project.estado}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Monto Contrato:</span>
                                    <span className="project-money">{formatMoney(project.monto_contrato_original)}</span>
                                </div>
                            </div>

                            <div className="project-card-footer">
                                <span className="action-text">Gestionar Costos →</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CostsHub;