import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import OportunidadForm from './forms/OportunidadForm';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import '../styles/components/badges.css';

const OportunidadesList = () => {
    const { user } = useAuth();
    const [oportunidades, setOportunidades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedEstado, setSelectedEstado] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingOportunidad, setEditingOportunidad] = useState(null);

    // Estados de oportunidades
    const estados = [
        { value: '', label: 'Todas' },
        { value: 'prospecto', label: 'Prospectos' },
        { value: 'calificada', label: 'Calificadas' },
        { value: 'propuesta', label: 'En Propuesta' },
        { value: 'negociacion', label: 'En Negociación' },
        { value: 'cerrada', label: 'Cerradas' },
        { value: 'perdida', label: 'Perdidas' }
    ];

    // Cargar oportunidades
    const loadOportunidades = async () => {
        try {
            setLoading(true);
            setError('');
            
            const params = new URLSearchParams();
            if (selectedEstado) params.append('estado', selectedEstado);
            
            const response = await api.get(`/oportunidades?${params.toString()}`);
            
            if (response.data.success) {
                setOportunidades(response.data.oportunidades);
            }
        } catch (err) {
            console.error('Error loading oportunidades:', err);
            setError('Error al cargar oportunidades');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOportunidades();
    }, [selectedEstado]);

    // Actualizar estado de oportunidad
    const updateEstado = async (id, nuevoEstado) => {
        try {
            const response = await api.put(`/oportunidades/${id}/estado`, {
                estado_oportunidad: nuevoEstado
            });
            
            if (response.data.success) {
                loadOportunidades(); // Recargar lista
            }
        } catch (err) {
            console.error('Error updating estado:', err);
            alert('Error al actualizar estado');
        }
    };

    // Convertir a proyecto
    const convertToProject = async (oportunidad) => {
        if (!window.confirm(`¿Convertir "${oportunidad.nombre_oportunidad}" a proyecto?`)) return;
        
        try {
            const response = await api.post(`/oportunidades/${oportunidad.id}/convert-to-project`);
            
            if (response.data.success) {
                alert('Proyecto creado exitosamente');
                loadOportunidades();
            }
        } catch (err) {
            console.error('Error converting to project:', err);
            alert('Error al convertir a proyecto');
        }
    };

    const handleOportunidadSave = (savedOportunidad) => {
        loadOportunidades();
        setShowCreateForm(false);
        setEditingOportunidad(null);
    };

    const handleEditOportunidad = (oportunidad) => {
        setEditingOportunidad(oportunidad);
    };

    const formatCurrency = (amount) => {
        if (!amount) return 'No especificado';
        return new Intl.NumberFormat('es-PA', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const getEstadoClass = (estado) => {
        const statusClasses = {
            'prospecto': 'status-paused',
            'calificada': 'status-planning',
            'propuesta': 'status-active',
            'negociacion': 'status-active',
            'cerrada': 'status-completed',
            'perdida': 'status-cancelled'
        };
        return statusClasses[estado] || 'status-paused';
    };

    const getEstadoText = (estado) => {
        const statusTexts = {
            'prospecto': 'Prospecto',
            'calificada': 'Calificada',
            'propuesta': 'En Propuesta',
            'negociacion': 'En Negociación',
            'cerrada': 'Cerrada',
            'perdida': 'Perdida'
        };
        return statusTexts[estado] || estado;
    };

    const getProbabilidadColor = (probabilidad) => {
        if (!probabilidad) return '';
        if (probabilidad >= 80) return 'probability-high';
        if (probabilidad >= 50) return 'probability-medium';
        if (probabilidad >= 25) return 'probability-low';
        return 'probability-very-low';
    };

    if (loading) return <div className="p-4">Cargando oportunidades...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="projects-container">
            <div className="projects-header">
                <h1>Oportunidades Comerciales</h1>
                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        + Nueva Oportunidad
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="filters-section">
                <div className="filter-group">
                    <label>Estado</label>
                    <select
                        value={selectedEstado}
                        onChange={(e) => setSelectedEstado(e.target.value)}
                        className="filter-select"
                    >
                        {estados.map(estado => (
                            <option key={estado.value} value={estado.value}>
                                {estado.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabla de Oportunidades */}
            <div className="standard-table-container">
                <table className="standard-table">
                    <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Cliente Potencial</th>
                        <th>Estado</th>
                        <th>Probabilidad</th>
                        <th>Valor Estimado</th>
                        <th>Próximo Seguimiento</th>
                        <th>Acciones</th>
                    </tr>
                    </thead>
                    <tbody>
                    {oportunidades.length === 0 ? (
                        <tr>
                            <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem' }}>
                                {loading ? 'Cargando oportunidades...' : selectedEstado ? `No hay oportunidades ${selectedEstado}s` : 'No hay oportunidades registradas'}
                            </td>
                        </tr>
                    ) : (
                        oportunidades.map(oportunidad => (
                            <tr key={oportunidad.id}>
                                <td className="standard-name">
                                    {oportunidad.nombre_oportunidad}
                                </td>
                                <td className="standard-client">
                                    {oportunidad.cliente_potencial}
                                </td>
                                <td>
                                    <span className={`status-badge ${getEstadoClass(oportunidad.estado_oportunidad)}`}>
                                        {getEstadoText(oportunidad.estado_oportunidad)}
                                    </span>
                                </td>
                                <td className={getProbabilidadColor(oportunidad.probabilidad_cierre)}>
                                    {oportunidad.probabilidad_cierre ? `${oportunidad.probabilidad_cierre}%` : '-'}
                                </td>
                                <td className="standard-money">
                                    {formatCurrency(oportunidad.valor_estimado)}
                                </td>
                                <td>
                                    {formatDate(oportunidad.fecha_siguiente_seguimiento)}
                                </td>
                                <td className="standard-actions">
                                    <button
                                        className="btn-action btn-edit"
                                        onClick={() => handleEditOportunidad(oportunidad)}
                                        title="Editar oportunidad"
                                    >
                                        ✏️
                                    </button>

                                    {/* Botones de cambio de estado */}
                                    {oportunidad.estado_oportunidad === 'prospecto' && (
                                        <button
                                            onClick={() => updateEstado(oportunidad.id, 'calificada')}
                                            className="btn-action btn-primary"
                                            title="Calificar"
                                        >
                                            📈
                                        </button>
                                    )}

                                    {oportunidad.estado_oportunidad === 'calificada' && (
                                        <button
                                            onClick={() => updateEstado(oportunidad.id, 'propuesta')}
                                            className="btn-action btn-warning"
                                            title="Enviar propuesta"
                                        >
                                            📄
                                        </button>
                                    )}

                                    {['propuesta', 'negociacion'].includes(oportunidad.estado_oportunidad) && (
                                        <>
                                            <button
                                                onClick={() => updateEstado(oportunidad.id, 'cerrada')}
                                                className="btn-action btn-success"
                                                title="Marcar cerrada"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                onClick={() => updateEstado(oportunidad.id, 'perdida')}
                                                className="btn-action btn-danger"
                                                title="Marcar perdida"
                                            >
                                                ❌
                                            </button>
                                        </>
                                    )}

                                    {oportunidad.estado_oportunidad === 'cerrada' && !oportunidad.tiene_proyecto_asociado && (
                                        <button
                                            onClick={() => convertToProject(oportunidad)}
                                            className="btn-action btn-info"
                                            title="Crear proyecto"
                                        >
                                            🏗️
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
            <OportunidadForm
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                onSave={handleOportunidadSave}
            />

            <OportunidadForm
                oportunidadId={editingOportunidad?.id}
                isOpen={!!editingOportunidad}
                onClose={() => setEditingOportunidad(null)}
                onSave={handleOportunidadSave}
            />
        </div>
    );
};

export default OportunidadesList;