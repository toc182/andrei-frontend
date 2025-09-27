import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LicitacionForm from './LicitacionForm';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import '../styles/components/badges.css';

const LicitacionesList = () => {
    const { user } = useAuth();
    const [licitaciones, setLicitaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedEstado, setSelectedEstado] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingLicitacion, setEditingLicitacion] = useState(null);

    // Estados de licitaciones
    const estados = [
        { value: '', label: 'Todas' },
        { value: 'activa', label: 'Activas' },
        { value: 'presentada', label: 'Presentadas' },
        { value: 'ganada', label: 'Ganadas' },
        { value: 'perdida', label: 'Perdidas' },
        { value: 'sin_interes', label: 'Sin Interés' },
        { value: 'cancelada', label: 'Canceladas' }
    ];

    // Cargar licitaciones
    const loadLicitaciones = async () => {
        try {
            setLoading(true);
            setError('');
            
            const params = new URLSearchParams();
            if (selectedEstado) params.append('estado', selectedEstado);
            
            const response = await api.get(`/licitaciones?${params.toString()}`);
            
            if (response.data.success) {
                setLicitaciones(response.data.licitaciones);
            }
        } catch (err) {
            console.error('Error loading licitaciones:', err);
            setError('Error al cargar licitaciones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLicitaciones();
    }, [selectedEstado]);

    // Actualizar estado de licitación
    const updateEstado = async (id, nuevoEstado) => {
        try {
            const response = await api.put(`/licitaciones/${id}/estado`, {
                estado_licitacion: nuevoEstado
            });
            
            if (response.data.success) {
                loadLicitaciones(); // Recargar lista
            }
        } catch (err) {
            console.error('Error updating estado:', err);
            alert('Error al actualizar estado');
        }
    };

    // Convertir a proyecto
    const convertToProject = async (licitacion) => {
        if (!window.confirm(`¿Convertir "${licitacion.nombre}" a proyecto?`)) return;
        
        try {
            const response = await api.post(`/licitaciones/${licitacion.id}/convert-to-project`);
            
            if (response.data.success) {
                alert('Proyecto creado exitosamente');
                loadLicitaciones();
            }
        } catch (err) {
            console.error('Error converting to project:', err);
            alert('Error al convertir a proyecto');
        }
    };

    const handleLicitacionSave = (savedLicitacion) => {
        loadLicitaciones();
        setShowCreateForm(false);
        setEditingLicitacion(null);
    };

    const handleEditLicitacion = (licitacion) => {
        setEditingLicitacion(licitacion);
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
            'activa': 'status-active',
            'presentada': 'status-planning',
            'ganada': 'status-completed',
            'perdida': 'status-cancelled',
            'sin_interes': 'status-paused',
            'cancelada': 'status-cancelled'
        };
        return statusClasses[estado] || 'status-paused';
    };

    const getEstadoText = (estado) => {
        const statusTexts = {
            'activa': 'Activa',
            'presentada': 'Presentada',
            'ganada': 'Ganada',
            'perdida': 'Perdida',
            'sin_interes': 'Sin Interés',
            'cancelada': 'Cancelada'
        };
        return statusTexts[estado] || estado;
    };

    if (loading) return <div className="p-4">Cargando licitaciones...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="projects-container">
            <div className="projects-header">
                <h1>Licitaciones</h1>
                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        + Nueva Licitación
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

            {/* Tabla de Licitaciones */}
            <div className="projects-table-container">
                <table className="projects-table">
                    <thead>
                    <tr>
                        <th>Número</th>
                        <th>Nombre</th>
                        <th>Entidad</th>
                        <th>Estado</th>
                        <th>Fecha Cierre</th>
                        <th>Presupuesto</th>
                        <th>Acciones</th>
                    </tr>
                    </thead>
                    <tbody>
                    {licitaciones.length === 0 ? (
                        <tr>
                            <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem' }}>
                                {loading ? 'Cargando licitaciones...' : selectedEstado ? `No hay licitaciones ${selectedEstado}s` : 'No hay licitaciones registradas'}
                            </td>
                        </tr>
                    ) : (
                        licitaciones.map(licitacion => (
                            <tr key={licitacion.id}>
                                <td className="project-name">
                                    {licitacion.numero_licitacion}
                                </td>
                                <td className="project-client">
                                    {licitacion.nombre}
                                </td>
                                <td>{licitacion.entidad_licitante}</td>
                                <td>
                                    <span className={`status-badge ${getEstadoClass(licitacion.estado_licitacion)}`}>
                                        {getEstadoText(licitacion.estado_licitacion)}
                                    </span>
                                </td>
                                <td>{formatDate(licitacion.fecha_cierre)}</td>
                                <td className="project-money">
                                    {formatCurrency(licitacion.presupuesto_referencial)}
                                </td>
                                <td className="project-actions">
                                    <button
                                        className="btn-action btn-edit"
                                        onClick={() => handleEditLicitacion(licitacion)}
                                        title="Editar licitación"
                                    >
                                        ✏️
                                    </button>

                                    {/* Botones de cambio de estado */}
                                    {licitacion.estado_licitacion === 'activa' && (
                                        <>
                                            <button
                                                onClick={() => updateEstado(licitacion.id, 'presentada')}
                                                className="btn-action btn-primary"
                                                title="Marcar como presentada"
                                            >
                                                📄
                                            </button>
                                            <button
                                                onClick={() => updateEstado(licitacion.id, 'sin_interes')}
                                                className="btn-action btn-secondary"
                                                title="Marcar sin interés"
                                            >
                                                ❌
                                            </button>
                                        </>
                                    )}

                                    {licitacion.estado_licitacion === 'presentada' && (
                                        <>
                                            <button
                                                onClick={() => updateEstado(licitacion.id, 'ganada')}
                                                className="btn-action btn-success"
                                                title="Marcar como ganada"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                onClick={() => updateEstado(licitacion.id, 'perdida')}
                                                className="btn-action btn-danger"
                                                title="Marcar como perdida"
                                            >
                                                ❌
                                            </button>
                                        </>
                                    )}

                                    {licitacion.estado_licitacion === 'ganada' && !licitacion.tiene_proyecto_asociado && (
                                        <button
                                            onClick={() => convertToProject(licitacion)}
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
            <LicitacionForm
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                onSave={handleLicitacionSave}
            />

            <LicitacionForm
                licitacionId={editingLicitacion?.id}
                isOpen={!!editingLicitacion}
                onClose={() => setEditingLicitacion(null)}
                onSave={handleLicitacionSave}
            />
        </div>
    );
};

export default LicitacionesList;