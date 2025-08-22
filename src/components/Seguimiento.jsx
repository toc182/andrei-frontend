import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Cargando datos de seguimiento...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
                <h2>Error: {error}</h2>
                <button onClick={cargarDashboard}>Intentar de nuevo</button>
            </div>
        );
    }

    const resumen = dashboard?.resumen_general || {};
    const metas = dashboard?.metas || [];

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>Seguimiento de Instalación de Tuberías</h1>

            {/* Navegación por pestañas */}
            <div style={{ marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    style={{
                        padding: '10px 20px',
                        marginRight: '10px',
                        backgroundColor: activeTab === 'dashboard' ? '#007bff' : 'transparent',
                        color: activeTab === 'dashboard' ? 'white' : '#007bff',
                        border: 'none',
                        borderBottom: activeTab === 'dashboard' ? '2px solid #007bff' : 'none',
                        cursor: 'pointer'
                    }}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('reportar')}
                    style={{
                        padding: '10px 20px',
                        marginRight: '10px',
                        backgroundColor: activeTab === 'reportar' ? '#28a745' : 'transparent',
                        color: activeTab === 'reportar' ? 'white' : '#28a745',
                        border: 'none',
                        borderBottom: activeTab === 'reportar' ? '2px solid #28a745' : 'none',
                        cursor: 'pointer'
                    }}
                >
                    Reportar Avance
                </button>
                <button
                    onClick={() => setActiveTab('frentes')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: activeTab === 'frentes' ? '#ffc107' : 'transparent',
                        color: activeTab === 'frentes' ? 'white' : '#ffc107',
                        border: 'none',
                        borderBottom: activeTab === 'frentes' ? '2px solid #ffc107' : 'none',
                        cursor: 'pointer'
                    }}
                >
                    Gestionar Frentes
                </button>
            </div>

            {/* Tab Dashboard */}
            {activeTab === 'dashboard' && (
                <div>
                    {/* Resumen General */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '20px',
                        marginBottom: '30px'
                    }}>
                        <div style={{
                            backgroundColor: '#f8f9fa',
                            padding: '20px',
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                        }}>
                            <h3 style={{ color: '#495057', marginBottom: '10px' }}>Tubos Totales</h3>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff', margin: '0' }}>
                                {resumen.tubos_instalados_total || 0} / {resumen.tubos_totales_requeridos || 0}
                            </p>
                            <p style={{ color: '#6c757d', margin: '5px 0 0 0' }}>
                                {resumen.porcentaje_avance_total || 0}% completado
                            </p>
                        </div>

                        <div style={{
                            backgroundColor: '#f8f9fa',
                            padding: '20px',
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                        }}>
                            <h3 style={{ color: '#495057', marginBottom: '10px' }}>Metros Instalados</h3>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745', margin: '0' }}>
                                {resumen.metros_instalados_total || 0}
                            </p>
                            <p style={{ color: '#6c757d', margin: '5px 0 0 0' }}>
                                de {resumen.metros_totales_requeridos || 0} metros
                            </p>
                        </div>

                        <div style={{
                            backgroundColor: '#f8f9fa',
                            padding: '20px',
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                        }}>
                            <h3 style={{ color: '#495057', marginBottom: '10px' }}>Promedio Diario</h3>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107', margin: '0' }}>
                                {resumen.promedio_diario || 0} tubos/día
                            </p>
                            <p style={{ color: '#6c757d', margin: '5px 0 0 0' }}>
                                Últimos 15 días
                            </p>
                        </div>
                    </div>

                    {/* Metas del Proyecto */}
                    <div style={{ marginBottom: '30px' }}>
                        <h2 style={{ color: '#495057', marginBottom: '20px' }}>Metas del Proyecto</h2>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '20px'
                        }}>
                            {metas.map((meta) => {
                                const diasRestantes = calcularDiasRestantes(meta.fecha_meta);
                                const estaAtrasado = diasRestantes < 0;
                                const tubosRestantes = meta.tubos_meta - (resumen.tubos_instalados_total || 0);
                                const tubosPorDiaRequeridos = diasRestantes > 0 ? Math.ceil(tubosRestantes / diasRestantes) : tubosRestantes;

                                return (
                                    <div key={meta.id} style={{
                                        backgroundColor: estaAtrasado ? '#ffebee' : '#e8f5e8',
                                        padding: '20px',
                                        borderRadius: '8px',
                                        border: `2px solid ${estaAtrasado ? '#f44336' : '#4caf50'}`
                                    }}>
                                        <h3 style={{
                                            color: estaAtrasado ? '#f44336' : '#4caf50',
                                            marginBottom: '15px'
                                        }}>
                                            {meta.descripcion}
                                        </h3>
                                        <div style={{ marginBottom: '10px' }}>
                                            <strong>Fecha objetivo:</strong> {new Date(meta.fecha_meta).toLocaleDateString()}
                                        </div>
                                        <div style={{ marginBottom: '10px' }}>
                                            <strong>Tubos objetivo:</strong> {meta.tubos_meta}
                                        </div>
                                        <div style={{ marginBottom: '10px' }}>
                                            <strong>Días restantes:</strong>
                                            <span style={{ color: estaAtrasado ? '#f44336' : '#4caf50', fontWeight: 'bold' }}>
                        {estaAtrasado ? `${Math.abs(diasRestantes)} días atrasado` : `${diasRestantes} días`}
                      </span>
                                        </div>
                                        <div style={{ marginBottom: '10px' }}>
                                            <strong>Tubos por día requeridos:</strong>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: tubosPorDiaRequeridos > 20 ? '#f44336' : '#4caf50' }}>
                        {tubosPorDiaRequeridos}
                      </span>
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
                <div>
                    <h2 style={{ color: '#495057', marginBottom: '20px' }}>Reportar Avance Diario</h2>

                    <form onSubmit={crearReporte} style={{
                        backgroundColor: '#f8f9fa',
                        padding: '30px',
                        borderRadius: '8px',
                        maxWidth: '600px'
                    }}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Frente de Trabajo:
                            </label>
                            <select
                                value={reporteForm.frente_id}
                                onChange={(e) => setReporteForm({...reporteForm, frente_id: e.target.value})}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    fontSize: '16px'
                                }}
                            >
                                <option value="">Seleccionar frente...</option>
                                {frentes.map((frente) => (
                                    <option key={frente.id} value={frente.id}>
                                        {frente.nombre} - {frente.tramo_nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Fecha:
                            </label>
                            <input
                                type="date"
                                value={reporteForm.fecha}
                                onChange={(e) => setReporteForm({...reporteForm, fecha: e.target.value})}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    fontSize: '16px'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Tubos Instalados:
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={reporteForm.tubos_instalados}
                                onChange={(e) => setReporteForm({...reporteForm, tubos_instalados: e.target.value})}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    fontSize: '16px'
                                }}
                            />
                            <small style={{ color: '#6c757d' }}>
                                Cada tubo = 5.8 metros
                            </small>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Observaciones:
                            </label>
                            <textarea
                                value={reporteForm.observaciones}
                                onChange={(e) => setReporteForm({...reporteForm, observaciones: e.target.value})}
                                rows="3"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    fontSize: '16px',
                                    resize: 'vertical'
                                }}
                                placeholder="Condiciones climáticas, problemas encontrados, etc..."
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Reportado por:
                            </label>
                            <input
                                type="text"
                                value={reporteForm.reportado_por}
                                onChange={(e) => setReporteForm({...reporteForm, reportado_por: e.target.value})}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    fontSize: '16px'
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                padding: '12px 30px',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Guardar Reporte
                        </button>
                    </form>
                </div>

            )}

            {/* Tab Gestionar Frentes */}
            {activeTab === 'frentes' && (
                <div>
                    <h2 style={{ color: '#495057', marginBottom: '20px' }}>Gestionar Frentes de Trabajo</h2>

                    {/* Formulario para crear frente */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ color: '#495057', marginBottom: '15px' }}>Crear Nuevo Frente</h3>

                        <form onSubmit={crearFrente} style={{
                            backgroundColor: '#f8f9fa',
                            padding: '30px',
                            borderRadius: '8px',
                            maxWidth: '600px'
                        }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Tramo:
                                </label>
                                <select
                                    value={frenteForm.tramo_id}
                                    onChange={(e) => setFrenteForm({...frenteForm, tramo_id: e.target.value})}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ced4da',
                                        borderRadius: '4px',
                                        fontSize: '16px'
                                    }}
                                >
                                    <option value="">Seleccionar tramo...</option>
                                    {tramos.map((tramo) => (
                                        <option key={tramo.id} value={tramo.id}>
                                            {tramo.nombre} - {tramo.descripcion} ({tramo.tubos_requeridos} tubos)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Nombre del Frente:
                                </label>
                                <input
                                    type="text"
                                    value={frenteForm.nombre}
                                    onChange={(e) => setFrenteForm({...frenteForm, nombre: e.target.value})}
                                    required
                                    placeholder="Ej: T1C, T2C, etc."
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ced4da',
                                        borderRadius: '4px',
                                        fontSize: '16px'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Descripción:
                                </label>
                                <textarea
                                    value={frenteForm.descripcion}
                                    onChange={(e) => setFrenteForm({...frenteForm, descripcion: e.target.value})}
                                    rows="3"
                                    placeholder="Descripción del frente de trabajo..."
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ced4da',
                                        borderRadius: '4px',
                                        fontSize: '16px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={creandoFrente}
                                style={{
                                    backgroundColor: creandoFrente ? '#6c757d' : '#ffc107',
                                    color: 'white',
                                    padding: '12px 30px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '16px',
                                    cursor: creandoFrente ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {creandoFrente ? 'Creando...' : 'Crear Frente'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de frentes existentes */}
                    <div>
                        <h3 style={{ color: '#495057', marginBottom: '15px' }}>Frentes Existentes</h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '15px'
                        }}>
                            {frentes.map((frente) => (
                                <div key={frente.id} style={{
                                    backgroundColor: '#f8f9fa',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    border: '1px solid #dee2e6'
                                }}>
                                    <h4 style={{ color: '#007bff', marginBottom: '10px' }}>
                                        {frente.nombre}
                                    </h4>
                                    <p style={{ margin: '5px 0', color: '#495057' }}>
                                        <strong>Tramo:</strong> {frente.tramo_nombre}
                                    </p>
                                    <p style={{ margin: '5px 0', color: '#6c757d' }}>
                                        {frente.descripcion}
                                    </p>
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