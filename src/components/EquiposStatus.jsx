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
    const [showStatusForm, setShowStatusForm] = useState(false);
    const [equipoToEdit, setEquipoToEdit] = useState(null);
    const [formData, setFormData] = useState({
        estado: '',
        proyecto: '',
        responsable: '',
        rata_mes: '',
        observaciones_status: ''
    });
    const [submitting, setSubmitting] = useState(false);

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
                const equiposConStatus = response.data.data.map((equipo) => {
                    return {
                        ...equipo,
                        ubicacion: equipo.proyecto || 'No especificada',
                        ultima_revision: equipo.updated_at,
                        estado: equipo.estado || 'en_operacion'
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
        const formatted = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
        // Reemplazar espacios con guiones y acortar mes si es necesario
        return formatted
            .replace(/\s/g, '-')
            .replace('sept', 'sep')
            .replace('dic', 'dic');
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

    // Función para abrir formulario de status
    const handleOpenStatusForm = () => {
        setEquipoToEdit(selectedEquipo);
        setFormData({
            estado: selectedEquipo?.estado || 'en_operacion',
            proyecto: selectedEquipo?.ubicacion || '',
            responsable: selectedEquipo?.responsable || '',
            rata_mes: selectedEquipo?.rata_mes || '',
            observaciones_status: selectedEquipo?.observaciones_status || ''
        });
        setShowStatusForm(true);
        setShowModal(false);
    };

    // Función para cerrar formulario de status
    const handleCloseStatusForm = () => {
        setShowStatusForm(false);
        setEquipoToEdit(null);
    };

    // Función para manejar cambios en el formulario
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Función para manejar submit del formulario
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await api.put(`/equipos/${equipoToEdit.id}/status`, formData);

            // Recargar los datos
            await loadEquiposStatus();

            // Cerrar formulario
            setShowStatusForm(false);
            setEquipoToEdit(null);

        } catch (error) {
            console.error('Error al actualizar status:', error);
            setError('Error al actualizar el status del equipo');
        } finally {
            setSubmitting(false);
        }
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
                tableClassName=""
                columns={[
                    {
                        header: 'Código',
                        render: (equipo) => equipo.codigo || 'Sin código'
                    },
                    {
                        header: 'Descripción',
                        render: (equipo) => (
                            <div>
                                <div>
                                    {equipo.descripcion}
                                </div>
                                <div>
                                    {equipo.marca} {equipo.modelo}
                                </div>
                                <div>
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
                    { header: 'Ubicación', render: (equipo) => equipo.ubicacion || 'No especificada' },
                    {
                        header: 'Última Actualización',
                        render: (equipo) => {
                            if (equipo.updated_at) {
                                return formatLastUpdate(new Date(equipo.updated_at));
                            }
                            return formatLastUpdate(lastUpdate);
                        }
                    }
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
                tableClassName=""
                columns={[
                    {
                        header: 'Código',
                        render: (equipo) => equipo.codigo || 'Sin código'
                    },
                    {
                        header: 'Descripción',
                        render: (equipo) => (
                            <div>
                                <div>
                                    {equipo.descripcion}
                                </div>
                                <div>
                                    {equipo.marca} {equipo.modelo}
                                </div>
                                <div>
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
                    { header: 'Ubicación', render: (equipo) => equipo.ubicacion || 'No especificada' },
                    {
                        header: 'Última Actualización',
                        render: (equipo) => {
                            if (equipo.updated_at) {
                                return formatLastUpdate(new Date(equipo.updated_at));
                            }
                            return formatLastUpdate(lastUpdate);
                        }
                    }
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
                footer={
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleOpenStatusForm}
                        >
                            Actualizar Status
                        </button>
                    </div>
                }
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
                                formatLastUpdate(new Date(selectedEquipo.ultima_revision)) :
                                'Sin registro'
                            }
                        </span>
                    </div>
                </div>
            </StandardModal>

            {/* Modal del formulario de status */}
            {showStatusForm && equipoToEdit && (
                <StandardModal
                    isOpen={showStatusForm}
                    onClose={handleCloseStatusForm}
                    title="Actualizar Status del Equipo"
                    footer={
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleCloseStatusForm}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="status-form"
                                className="btn btn-primary"
                                disabled={submitting}
                            >
                                {submitting ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    }
                >
                    <form id="status-form" className="form-container" onSubmit={handleFormSubmit}>
                        <div>
                            <label>Equipo:</label>
                            <span style={{ fontWeight: 'bold' }}>
                                {equipoToEdit.codigo || 'Sin código'} - {equipoToEdit.descripcion}
                            </span>
                        </div>

                        <div>
                            <label>Estado:</label>
                            <select
                                name="estado"
                                value={formData.estado}
                                onChange={handleFormChange}
                            >
                                <option value="en_operacion">En Operación</option>
                                <option value="standby">Standby</option>
                                <option value="en_mantenimiento">En Mantenimiento</option>
                                <option value="fuera_de_servicio">Fuera de Servicio</option>
                            </select>
                        </div>

                        <div>
                            <label>Ubicación/Proyecto:</label>
                            <input
                                type="text"
                                name="proyecto"
                                value={formData.proyecto}
                                onChange={handleFormChange}
                                placeholder="Proyecto donde se encuentra el equipo"
                            />
                        </div>

                        <div>
                            <label>Responsable:</label>
                            <input
                                type="text"
                                name="responsable"
                                value={formData.responsable}
                                onChange={handleFormChange}
                                placeholder="Persona responsable del equipo"
                            />
                        </div>

                        <div>
                            <label>Rata Mensual:</label>
                            <input
                                type="number"
                                step="0.01"
                                name="rata_mes"
                                value={formData.rata_mes}
                                onChange={handleFormChange}
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label>Observaciones:</label>
                            <textarea
                                rows="3"
                                name="observaciones_status"
                                value={formData.observaciones_status}
                                onChange={handleFormChange}
                                placeholder="Observaciones sobre el status actual del equipo..."
                            />
                        </div>
                    </form>
                </StandardModal>
            )}
        </div>
    );
};

export default EquiposStatus;