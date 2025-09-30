import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRefresh, faTruckPickup
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';
import logo from '../assets/logo.png';
import cocpLogo from '../assets/LogoCOCPfondoblanco.png';
import SectionHeader from './common/SectionHeader';
import StandardTable from './common/StandardTable';
import StandardModal from './common/StandardModal';
import '../styles/components/badges.css';
import '../styles/pages/status-equipos.css';

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
            return { label: 'En Operación', class: 'status-green' };
        }
        if (estadoLower.includes('standby')) {
            return { label: 'Standby', class: 'status-blue' };
        }
        if (estadoLower.includes('mantenimiento')) {
            return { label: 'En Mantenimiento', class: 'status-yellow' };
        }
        if (estadoLower.includes('fuera')) {
            return { label: 'Fuera de Servicio', class: 'status-red' };
        }

        // Estado por defecto
        return { label: 'En Operación', class: 'status-green' };
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


    if (loading) {
        return (
            <div className="section-container">
                <SectionHeader
                    title="Estado de Equipos"
                    icon={faTruckPickup}
                />
                <div className="loading-container">
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
        <div className="section-container status-equipos-page">
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
            <div style={{ textAlign: 'center', marginBottom: '0.2rem', marginTop: '2rem' }}>
                <img src={logo} alt="Pinellas Logo" className="equipos-logo" />
            </div>
            <StandardTable
                className=""
                tableClassName="equipos-table"
                columns={[
                    { header: 'Código', accessor: 'codigo' },
                    {
                        header: 'Descripción',
                        render: (equipo) => (
                            <div className="equipo-description-cell">
                                <div className="equipo-description-row">
                                    {equipo.descripcion}
                                </div>
                                <div className="equipo-marca-modelo-row">
                                    {equipo.marca} {equipo.modelo}
                                </div>
                                <div className="equipo-ano-row">
                                    {equipo.ano || ''}
                                </div>
                            </div>
                        )
                    },
                    {
                        header: 'Estado',
                        render: (equipo) => {
                            const statusInfo = getStatusInfo(equipo.estado);
                            return (
                                <span className={`status-badge ${statusInfo.class}`}>
                                    {statusInfo.label}
                                </span>
                            );
                        }
                    },
                    { header: 'Ubicación', render: (equipo) => equipo.ubicacion || 'No especificada' }
                ]}
                data={equiposPinellas}
                onRowClick={handleRowClick}
                emptyMessage="No hay equipos de Pinellas disponibles"
            />

            {/* Tabla de Equipos de COCP */}
            <div style={{ textAlign: 'center', marginBottom: '0.2rem', marginTop: '2rem' }}>
                <img src={cocpLogo} alt="COCP Logo" className="equipos-logo" />
            </div>
            <StandardTable
                className=""
                tableClassName="equipos-table"
                columns={[
                    { header: 'Código', accessor: 'codigo' },
                    {
                        header: 'Descripción',
                        render: (equipo) => (
                            <div className="equipo-description-cell">
                                <div className="equipo-description-row">
                                    {equipo.descripcion}
                                </div>
                                <div className="equipo-marca-modelo-row">
                                    {equipo.marca} {equipo.modelo}
                                </div>
                                <div className="equipo-ano-row">
                                    {equipo.ano || ''}
                                </div>
                            </div>
                        )
                    },
                    {
                        header: 'Estado',
                        render: (equipo) => {
                            const statusInfo = getStatusInfo(equipo.estado);
                            return (
                                <span className={`status-badge ${statusInfo.class}`}>
                                    {statusInfo.label}
                                </span>
                            );
                        }
                    },
                    { header: 'Ubicación', render: (equipo) => equipo.ubicacion || 'No especificada' }
                ]}
                data={equiposCOCP}
                onRowClick={handleRowClick}
                emptyMessage="No hay equipos de COCP disponibles"
            />


            {/* Modal de información del equipo */}
            <StandardModal
                isOpen={showModal}
                onClose={handleCloseModal}
                title="Detalles del Equipo"
            >
                <div>
                    <div className="modal-row">
                        <label className="modal-row-label">Descripción:</label>
                        <span className="modal-row-value">{selectedEquipo?.descripcion}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Marca:</label>
                        <span className="modal-row-value">{selectedEquipo?.marca}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Modelo:</label>
                        <span className="modal-row-value">{selectedEquipo?.modelo}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Año:</label>
                        <span className="modal-row-value">{selectedEquipo?.ano || 'No especificado'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Estado:</label>
                        <span className="modal-row-value">
                            <span className={`status-badge ${selectedEquipo ? getStatusInfo(selectedEquipo.estado).class : ''}`}>
                                {selectedEquipo ? getStatusInfo(selectedEquipo.estado).label : ''}
                            </span>
                        </span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Ubicación/Proyecto:</label>
                        <span className="modal-row-value">{selectedEquipo?.ubicacion || 'No especificada'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Responsable:</label>
                        <span className="modal-row-value">{selectedEquipo?.responsable || 'No asignado'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Rata Mensual:</label>
                        <span className="modal-row-value">{selectedEquipo?.rata_mes ? `$${parseFloat(selectedEquipo.rata_mes).toLocaleString()}` : 'No especificado'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Propietario:</label>
                        <span className="modal-row-value">{selectedEquipo?.owner}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Observaciones:</label>
                        <span className="modal-row-value">{selectedEquipo?.observaciones || 'Sin observaciones'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Última Actualización:</label>
                        <span className="modal-row-value">
                            {selectedEquipo?.ultima_revision ?
                                new Date(selectedEquipo.ultima_revision).toLocaleDateString('es-ES') :
                                'Sin registro'
                            }
                        </span>
                    </div>
                </div>
            </StandardModal>
        </div>
    );
};

export default EquiposStatus;