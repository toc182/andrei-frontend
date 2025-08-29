import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';

function Seguimiento() {
    const { user } = useAuth();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Estados para reportes
    const [frentes, setFrente] = useState([]);
    const [reporteForm, setReporteForm] = useState({
        frente_id: '',
        fecha: new Date().toISOString().split('T')[0],
        tubos_instalados: '',
        observaciones: '',
        reportado_por: user?.nombre || ''
    });

    // Estados para gestión de frentes
    const [tramos, setTramos] = useState([]);
    const [frenteForm, setFrenteForm] = useState({
        tramo_id: '',
        nombre: '',
        descripcion: ''
    });
    const [creandoFrente, setCreandoFrente] = useState(false);

    // ID del proyecto (cambiar según ambiente)
    const PROJECT_ID = process.env.NODE_ENV === 'production' ? 5 : 3;

    useEffect(() => {
        cargarDashboard();
        cargarFrente();
        cargarTramos();
    }, []);

    const cargarDashboard = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/seguimiento/${PROJECT_ID}/dashboard`);
            setDashboard(response.data.dashboard);
            setError(null);
        } catch (error) {
            console.error('Error cargando dashboard:', error);
            setError('Error cargando datos del dashboard');
        } finally {
            setLoading(false);
        }
    };

    const cargarFrente = async () => {
        try {
            const response = await api.get(`/seguimiento/${PROJECT_ID}/frentes`);
            setFrente(response.data.frentes || []);
        } catch (error) {
            console.error('Error cargando frentes:', error);
        }
    };

    const cargarTramos = async () => {
        try {
            const response = await api.get(`/seguimiento/${PROJECT_ID}/tramos`);
            setTramos(response.data.tramos || []);
        } catch (error) {
            console.error('Error cargando tramos:', error);
        }
    };

    const crearFrente = async (e) => {
        e.preventDefault();
        try {
            setCreandoFrente(true);
            await api.post(`/seguimiento/${PROJECT_ID}/frentes`, frenteForm);
            alert('Frente creado exitosamente');
            cargarFrente(); // Recargar la lista de frentes
            setFrenteForm({
                tramo_id: '',
                nombre: '',
                descripcion: ''
            });
        } catch (error) {
            console.error('Error creando frente:', error);
            alert('Error creando frente: ' + (error.response?.data?.message || 'Error desconocido'));
        } finally {
            setCreandoFrente(false);
        }
    };

    const crearReporte = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/seguimiento/${PROJECT_ID}/reportes`, reporteForm);
            alert('Reporte creado exitosamente');
            cargarDashboard(); // Recargar dashboard para ver los cambios
            setReporteForm({
                ...reporteForm,
                frente_id: '',
                tubos_instalados: '',
                observaciones: ''
            });
            cargarDashboard(); // Actualizar dashboard
        } catch (error) {
            console.error('Error creando reporte:', error);
            alert('Error creando reporte');
        }
    };

    const calcularDiasRestantes = (fechaMeta) => {
        const hoy = new Date();
        const meta = new Date(fechaMeta);
        const diferencia = meta - hoy;
        return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <div className="seguimiento-loading">
                <div className="loading-spinner"></div>
                <h2>Cargando datos de seguimiento...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="seguimiento-error">
                <h2>❌ Error: {error}</h2>
                <button onClick={cargarDashboard} className="btn-retry">
                    🔄 Intentar de nuevo
                </button>
            </div>
        );
    }

    const resumen = dashboard?.resumen_general || {};
    const metas = dashboard?.metas || [];

    return (
        <div className="seguimiento-bonyic">
            <div className="seguimiento-header">
                <h1>Seguimiento de Instalación de Tuberías</h1>
                <p className="project-subtitle">Proyecto Bonyic - Control de Avance</p>
            </div>

            {/* Navegación por pestañas */}
            <div className="seguimiento-tabs">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                >
                    📊 Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('reportar')}
                    className={`tab-btn ${activeTab === 'reportar' ? 'active' : ''}`}
                >
                    📈 Reportar Avance
                </button>
                <button
                    onClick={() => setActiveTab('frentes')}
                    className={`tab-btn ${activeTab === 'frentes' ? 'active' : ''}`}
                >
                    🏗️ Gestionar Frentes
                </button>
            </div>

            {/* Tab Dashboard */}
            {activeTab === 'dashboard' && (
                <div className="tab-content">
                    {/* Resumen General */}
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <div className="card-icon">🔧</div>
                            <h3>Tubos Totales</h3>
                            <div className="card-number primary">
                                {resumen.tubos_instalados_total || 0} / {resumen.tubos_totales_requeridos || 0}
                            </div>
                            <p className="card-subtitle">
                                {resumen.porcentaje_avance_total || 0}% completado
                            </p>
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{width: `${resumen.porcentaje_avance_total || 0}%`}}
                                ></div>
                            </div>
                        </div>

                        <div className="dashboard-card">
                            <div className="card-icon">📏</div>
                            <h3>Metros Instalados</h3>
                            <div className="card-number success">
                                {resumen.metros_instalados_total || 0}
                            </div>
                            <p className="card-subtitle">
                                de {resumen.metros_totales_requeridos || 0} metros
                            </p>
                        </div>

                        <div className="dashboard-card">
                            <div className="card-icon">⚡</div>
                            <h3>Promedio Diario</h3>
                            <div className="card-number warning">
                                {resumen.promedio_diario || 0} tubos/día
                            </div>
                            <p className="card-subtitle">
                                Últimos 15 días
                            </p>
                        </div>
                    </div>

                    {/* Metas del Proyecto */}
                    <div className="metas-section">
                        <h2 className="section-title">🎯 Metas del Proyecto</h2>
                        <div className="metas-grid">
                            {metas.map((meta) => {
                                const diasRestantes = calcularDiasRestantes(meta.fecha_meta);
                                const estaAtrasado = diasRestantes < 0;
                                const tubosRestantes = meta.tubos_meta - (resumen.tubos_instalados_total || 0);
                                const tubosPorDiaRequeridos = diasRestantes > 0 ? Math.ceil(tubosRestantes / diasRestantes) : tubosRestantes;

                                return (
                                    <div key={meta.id} className={`meta-card ${estaAtrasado ? 'atrasado' : 'en-tiempo'}`}>
                                        <h3 className="meta-title">
                                            {meta.descripcion}
                                        </h3>
                                        <div className="meta-info">
                                            <div className="meta-item">
                                                <span className="meta-label">📅 Fecha objetivo:</span>
                                                <span>{formatDate(meta.fecha_meta)}</span>
                                            </div>
                                            <div className="meta-item">
                                                <span className="meta-label">🎯 Tubos objetivo:</span>
                                                <span>{meta.tubos_meta}</span>
                                            </div>
                                            <div className="meta-item">
                                                <span className="meta-label">⏱️ Días restantes:</span>
                                                <span className={`meta-days ${estaAtrasado ? 'overdue' : 'on-time'}`}>
                                                    {estaAtrasado ? `${Math.abs(diasRestantes)} días atrasado` : `${diasRestantes} días`}
                                                </span>
                                            </div>
                                            <div className="meta-item">
                                                <span className="meta-label">🚀 Tubos/día requeridos:</span>
                                                <span className={`meta-rate ${tubosPorDiaRequeridos > 20 ? 'high' : 'normal'}`}>
                                                    {tubosPorDiaRequeridos}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Reportar Avance */}
            {activeTab === 'reportar' && (
                <div className="tab-content">
                    <h2 className="section-title">📈 Reportar Avance Diario</h2>

                    <form onSubmit={crearReporte} className="seguimiento-form">
                        <div className="form-group">
                            <label className="form-label">
                                🏗️ Frente de Trabajo:
                            </label>
                            <select
                                value={reporteForm.frente_id}
                                onChange={(e) => setReporteForm({...reporteForm, frente_id: e.target.value})}
                                required
                                className="form-input"
                            >
                                <option value="">Seleccionar frente...</option>
                                {frentes.map((frente) => (
                                    <option key={frente.id} value={frente.id}>
                                        {frente.nombre} - {frente.tramo_nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                📅 Fecha:
                            </label>
                            <input
                                type="date"
                                value={reporteForm.fecha}
                                onChange={(e) => setReporteForm({...reporteForm, fecha: e.target.value})}
                                required
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                🔧 Tubos Instalados:
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={reporteForm.tubos_instalados}
                                onChange={(e) => setReporteForm({...reporteForm, tubos_instalados: e.target.value})}
                                required
                                className="form-input"
                            />
                            <small className="form-help">
                                📏 Cada tubo = 5.8 metros
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                📝 Observaciones:
                            </label>
                            <textarea
                                value={reporteForm.observaciones}
                                onChange={(e) => setReporteForm({...reporteForm, observaciones: e.target.value})}
                                rows="3"
                                className="form-input"
                                placeholder="Condiciones climáticas, problemas encontrados, etc..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                👤 Reportado por:
                            </label>
                            <input
                                type="text"
                                value={reporteForm.reportado_por}
                                onChange={(e) => setReporteForm({...reporteForm, reportado_por: e.target.value})}
                                className="form-input"
                            />
                        </div>

                        <button type="submit" className="btn-submit">
                            💾 Guardar Reporte
                        </button>
                    </form>
                </div>

            )}

            {/* Tab Gestionar Frentes */}
            {activeTab === 'frentes' && (
                <div className="tab-content">
                    <h2 className="section-title">🏗️ Gestionar Frentes de Trabajo</h2>

                    {/* Formulario para crear frente */}
                    <div className="crear-frente-section">
                        <h3 className="subsection-title">➕ Crear Nuevo Frente</h3>

                        <form onSubmit={crearFrente} className="seguimiento-form">
                            <div className="form-group">
                                <label className="form-label">
                                    🛤️ Tramo:
                                </label>
                                <select
                                    value={frenteForm.tramo_id}
                                    onChange={(e) => setFrenteForm({...frenteForm, tramo_id: e.target.value})}
                                    required
                                    className="form-input"
                                >
                                    <option value="">Seleccionar tramo...</option>
                                    {tramos.map((tramo) => (
                                        <option key={tramo.id} value={tramo.id}>
                                            {tramo.nombre} - {tramo.descripcion} ({tramo.tubos_requeridos} tubos)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    🏷️ Nombre del Frente:
                                </label>
                                <input
                                    type="text"
                                    value={frenteForm.nombre}
                                    onChange={(e) => setFrenteForm({...frenteForm, nombre: e.target.value})}
                                    required
                                    placeholder="Ej: T1C, T2C, etc."
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    📝 Descripción:
                                </label>
                                <textarea
                                    value={frenteForm.descripcion}
                                    onChange={(e) => setFrenteForm({...frenteForm, descripcion: e.target.value})}
                                    rows="3"
                                    placeholder="Descripción del frente de trabajo..."
                                    className="form-input"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={creandoFrente}
                                className={`btn-submit ${creandoFrente ? 'loading' : ''}`}
                            >
                                {creandoFrente ? '⏳ Creando...' : '➕ Crear Frente'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de frentes existentes */}
                    <div className="frentes-existentes">
                        <h3 className="subsection-title">📋 Frentes Existentes</h3>
                        <div className="frentes-grid">
                            {frentes.map((frente) => (
                                <div key={frente.id} className="frente-card">
                                    <div className="frente-header">
                                        <h4 className="frente-nombre">🏗️ {frente.nombre}</h4>
                                    </div>
                                    <div className="frente-info">
                                        <p className="frente-tramo">
                                            <span className="info-label">🛤️ Tramo:</span> {frente.tramo_nombre}
                                        </p>
                                        <p className="frente-descripcion">
                                            {frente.descripcion}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Seguimiento;