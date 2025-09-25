import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRefresh, faTruckPickup
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';
import logo from '../assets/logo.png';
import cocpLogo from '../assets/LogoCOCPfondoblanco.png';
import SectionHeader from './common/SectionHeader';

const EquiposStatus = () => {
    const [equiposPinellas, setEquiposPinellas] = useState([]);
    const [equiposCOCP, setEquiposCOCP] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdate, setLastUpdate] = useState(null);
    const [selectedEquipo, setSelectedEquipo] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Mapeo de estados desde BD a estados estandarizados
    const getEstadoEstandarizado = (estado) => {
        const estadoLower = (estado || '').toLowerCase();

        if (estadoLower.includes('operacion') || estadoLower.includes('operativo')) {
            return { label: 'En Operación', class: 'status-active' };
        }
        if (estadoLower.includes('standby')) {
            return { label: 'Standby', class: 'status-paused' };
        }
        if (estadoLower.includes('mantenimiento')) {
            return { label: 'En Mantenimiento', class: 'status-planning' };
        }
        if (estadoLower.includes('fuera')) {
            return { label: 'Fuera de Servicio', class: 'status-cancelled' };
        }

        // Estado por defecto
        return { label: 'En Operación', class: 'status-active' };
    };

    // Cargar equipos y sus estados desde API
    const loadEquiposStatus = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await api.get('/equipos');

            if (response.data.success) {
                // Mapear los datos para que coincidan con lo que espera el componente
                const equiposConStatus = response.data.data.map((equipo, index) => {
                    // Estados manuales para testing - distribuir diferentes estados
                    let estadoTesting;
                    switch(index % 4) {
                        case 0: estadoTesting = 'en_operacion'; break;
                        case 1: estadoTesting = 'standby'; break;
                        case 2: estadoTesting = 'en_mantenimiento'; break;
                        case 3: estadoTesting = 'fuera_de_servicio'; break;
                        default: estadoTesting = 'en_operacion';
                    }

                    return {
                        ...equipo,
                        ubicacion: equipo.proyecto || 'No especificada',
                        ultima_revision: equipo.updated_at,
                        estado: estadoTesting // Estados distribuidos para visualización
                    };
                });

                // Separar equipos por propietario
                const pinellas = equiposConStatus.filter(equipo => equipo.owner === 'Pinellas');
                const cocp = equiposConStatus.filter(equipo => equipo.owner === 'COCP');

                setEquiposPinellas(pinellas);
                setEquiposCOCP(cocp);
                setLastUpdate(new Date());
            } else {
                setError('Error al cargar estatus de equipos');
            }
        } catch (error) {
            console.error('Error loading equipos status:', error);
            setError('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEquiposStatus();

        // Auto-refresh cada 5 minutos
        const interval = setInterval(loadEquiposStatus, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    // Función para obtener el estado visual
    const getStatusInfo = (estado) => {
        return getEstadoEstandarizado(estado);
    };

    // Función para formatear fecha de última actualización
    const formatLastUpdate = (date) => {
        if (!date) return '';
        return new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    };

    // Función para refrescar manualmente
    const handleRefresh = () => {
        loadEquiposStatus();
    };

    // Función para manejar click en fila
    const handleRowClick = (equipo) => {
        setSelectedEquipo(equipo);
        setShowModal(true);
    };

    // Función para cerrar modal
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedEquipo(null);
    };

    // Renderizar tabla de status de equipos
    const renderStatusTable = (equipos, logoSrc, altText) => (
        <div className="projects-table-container">
            <table className="projects-table equipos-table">
                <thead>
                    <tr className="equipos-title-row">
                        <th colSpan="4" className="equipos-title-header">
                            <img src={logoSrc} alt={altText} className="equipos-logo" />
                        </th>
                    </tr>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Ubicación</th>
                    </tr>
                </thead>
                <tbody>
                    {equipos.map((equipo, index) => {
                        const statusInfo = getStatusInfo(equipo.estado);
                        return (
                            <tr
                                key={equipo.id || `status-${index}`}
                                className="projects-row clickable-row"
                                onClick={() => handleRowClick(equipo)}
                                style={{ cursor: 'pointer' }}
                            >
                                <td>{equipo.codigo || '-'}</td>
                                <td className="equipo-description-cell">
                                    <div className="equipo-description-row">
                                        {equipo.descripcion}
                                    </div>
                                    <div className="equipo-marca-modelo-row">
                                        {equipo.marca} {equipo.modelo}
                                    </div>
                                    <div className="equipo-ano-row">
                                        {equipo.ano || ''}
                                    </div>
                                </td>
                                <td>
                                    <span className={`status-badge ${statusInfo.class}`}>
                                        {statusInfo.label}
                                    </span>
                                </td>
                                <td>
                                    {equipo.ubicacion || 'No especificada'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    if (loading) {
        return (
            <div className="section-container">
                <SectionHeader
                    title="Estado de Equipos"
                    icon={faTruckPickup}
                />
                <div className="projects-loading">
                    <div className="loading-spinner"></div>
                    <p>Cargando estados de equipos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="section-container">
                <SectionHeader
                    title="Estado de Equipos"
                    icon={faTruckPickup}
                />
                <div className="error-message">
                    {error}
                    <button onClick={loadEquiposStatus}>Reintentar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="section-container">
            <SectionHeader
                title="Estado de Equipos"
                icon={faTruckPickup}
                actionButton={{
                    icon: faRefresh,
                    onClick: handleRefresh,
                    title: "Actualizar estados"
                }}
            />

            {/* Tabla de Equipos de Pinellas */}
            <div style={{ marginBottom: '2rem' }}>
                {renderStatusTable(equiposPinellas, logo, "Pinellas Logo")}
            </div>

            {/* Tabla de Equipos de COCP */}
            <div style={{ marginBottom: '2rem' }}>
                {renderStatusTable(equiposCOCP, cocpLogo, "COCP Logo")}
            </div>


            {/* Modal de información del equipo */}
            {showModal && selectedEquipo && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content equipo-details-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalles del Equipo</h2>
                            <button className="modal-close-btn" onClick={handleCloseModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Código:</label>
                                    <span>{selectedEquipo.codigo || 'No especificado'}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Descripción:</label>
                                    <span>{selectedEquipo.descripcion}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Marca:</label>
                                    <span>{selectedEquipo.marca}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Modelo:</label>
                                    <span>{selectedEquipo.modelo}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Año:</label>
                                    <span>{selectedEquipo.ano || 'No especificado'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Estado:</label>
                                    <span className={`status-badge ${getStatusInfo(selectedEquipo.estado).class}`}>
                                        {getStatusInfo(selectedEquipo.estado).label}
                                    </span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Motor:</label>
                                    <span>{selectedEquipo.motor || 'No especificado'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Chasis:</label>
                                    <span>{selectedEquipo.chasis || 'No especificado'}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Ubicación/Proyecto:</label>
                                    <span>{selectedEquipo.ubicacion || 'No especificada'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Responsable:</label>
                                    <span>{selectedEquipo.responsable || 'No asignado'}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Costo:</label>
                                    <span>{selectedEquipo.costo ? `$${parseFloat(selectedEquipo.costo).toLocaleString()}` : 'No especificado'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Valor Actual:</label>
                                    <span>{selectedEquipo.valor_actual ? `$${parseFloat(selectedEquipo.valor_actual).toLocaleString()}` : 'No especificado'}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Rata Mensual:</label>
                                    <span>{selectedEquipo.rata_mes ? `$${parseFloat(selectedEquipo.rata_mes).toLocaleString()}` : 'No especificado'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Propietario:</label>
                                    <span>{selectedEquipo.owner}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item full-width">
                                    <label>Observaciones:</label>
                                    <span>{selectedEquipo.observaciones || 'Sin observaciones'}</span>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>Última Actualización:</label>
                                    <span>
                                        {selectedEquipo.ultima_revision ?
                                            new Date(selectedEquipo.ultima_revision).toLocaleDateString('es-ES') :
                                            'Sin registro'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EquiposStatus;