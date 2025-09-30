import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTruckPickup } from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/logo.png';
import cocpLogo from '../assets/LogoCOCPfondoblanco.png';
import EquipoForm from './EquipoForm';
import api from '../services/api';
import SectionHeader from './common/SectionHeader';
import StandardTable from './common/StandardTable';
import StandardModal from './common/StandardModal';
import '../styles/pages/informacion-equipos.css';

const EquiposInformacion = () => {
    const [selectedEquipo, setSelectedEquipo] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingEquipo, setEditingEquipo] = useState(null);
    const [equiposPinellas, setEquiposPinellas] = useState([]);
    const [equiposCOCP, setEquiposCOCP] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Cargar equipos desde API
    const loadEquipos = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await api.get('/equipos');

            if (response.data.success) {
                const equipos = response.data.data;

                // Separar equipos por propietario
                const pinellas = equipos.filter(equipo => equipo.owner === 'Pinellas');
                const cocp = equipos.filter(equipo => equipo.owner === 'COCP');

                setEquiposPinellas(pinellas);
                setEquiposCOCP(cocp);
            } else {
                setError('Error al cargar equipos');
            }
        } catch (error) {
            console.error('Error loading equipos:', error);
            setError('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEquipos();
    }, []);

    // Funciones para manejar formularios
    const handleAddEquipo = () => {
        setEditingEquipo(null);
        setShowForm(true);
    };

    const handleEditEquipo = (equipo, e) => {
        e.stopPropagation(); // Evitar que se abra el modal de detalles
        setEditingEquipo(equipo);
        setShowForm(true);
    };


    const handleFormSuccess = () => {
        loadEquipos(); // Recargar lista después de agregar/editar
        setShowForm(false);
        setEditingEquipo(null);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingEquipo(null);
    };

    // Formato de moneda para mostrar
    const formatMoney = (amount) => {
        if (!amount) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // Funciones del modal de detalles
    const handleRowClick = (equipo) => {
        setSelectedEquipo(equipo);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedEquipo(null);
    };


    if (loading) {
        return (
            <div className="section-container">
                <SectionHeader
                    title="Información de Equipos"
                    icon={faTruckPickup}
                />
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Cargando equipos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="section-container">
                <SectionHeader
                    title="Información de Equipos"
                    icon={faTruckPickup}
                />
                <div className="error-message">
                    {error}
                    <button onClick={loadEquipos}>Reintentar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="section-container">
            <SectionHeader
                title="Información de Equipos"
                icon={faTruckPickup}
                actionButton={{
                    icon: faPlus,
                    onClick: handleAddEquipo,
                    title: "Agregar nuevo equipo"
                }}
            />

            {/* Tabla de Equipos de Pinellas */}
            <div style={{ textAlign: 'center', marginBottom: '0.2rem', marginTop: '2rem' }}>
                <img src={logo} alt="Pinellas Logo" className="equipos-logo" />
            </div>
            <StandardTable
                className="equipos-standard-table-container"
                tableClassName="equipos-standard-table"
                columns={[
                    { header: 'Código', accessor: 'codigo' },
                    { header: 'Descripción', accessor: 'descripcion' },
                    { header: 'Marca', accessor: 'marca' },
                    { header: 'Modelo', accessor: 'modelo' },
                    { header: 'Año', accessor: 'ano' },
                    {
                        header: '',
                        render: (equipo) => (
                            <button
                                className="standard-table-icon"
                                onClick={(e) => handleEditEquipo(equipo, e)}
                                title="Editar equipo"
                            >
                                <FontAwesomeIcon icon={faEdit} />
                            </button>
                        )
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
                className="equipos-standard-table-container"
                tableClassName="equipos-standard-table"
                columns={[
                    { header: 'Código', accessor: 'codigo' },
                    { header: 'Descripción', accessor: 'descripcion' },
                    { header: 'Marca', accessor: 'marca' },
                    { header: 'Modelo', accessor: 'modelo' },
                    { header: 'Año', accessor: 'ano' },
                    {
                        header: '',
                        render: (equipo) => (
                            <button
                                className="standard-table-icon"
                                onClick={(e) => handleEditEquipo(equipo, e)}
                                title="Editar equipo"
                            >
                                <FontAwesomeIcon icon={faEdit} />
                            </button>
                        )
                    }
                ]}
                data={equiposCOCP}
                onRowClick={handleRowClick}
                emptyMessage="No hay equipos de COCP disponibles"
            />

            {/* Modal de detalles */}
            <StandardModal
                isOpen={showModal}
                onClose={closeModal}
                title="Detalles del Equipo"
            >
                <div>
                    <div className="modal-row">
                        <label className="modal-row-label">Código:</label>
                        <span className="modal-row-value">{selectedEquipo?.codigo || 'N/A'}</span>
                    </div>

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
                        <span className="modal-row-value">{selectedEquipo?.ano}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label"># Motor:</label>
                        <span className="modal-row-value">{selectedEquipo?.motor || 'N/A'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label"># Chasis:</label>
                        <span className="modal-row-value">{selectedEquipo?.chasis || 'N/A'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Costo:</label>
                        <span className="modal-row-value">{selectedEquipo ? formatMoney(selectedEquipo.costo) : 'N/A'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Valor Actual:</label>
                        <span className="modal-row-value">{selectedEquipo ? formatMoney(selectedEquipo.valor_actual) : 'N/A'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Rata/Mes:</label>
                        <span className="modal-row-value">{selectedEquipo ? formatMoney(selectedEquipo.rata_mes) : 'N/A'}</span>
                    </div>

                    <div className="modal-row">
                        <label className="modal-row-label">Propietario:</label>
                        <span className="modal-row-value">{selectedEquipo?.owner}</span>
                    </div>

                    {selectedEquipo?.observaciones && (
                        <div className="modal-row">
                            <label className="modal-row-label">Observaciones:</label>
                            <div className="modal-row-value">
                                {selectedEquipo.observaciones}
                            </div>
                        </div>
                    )}
                </div>
            </StandardModal>

            {/* Formulario de agregar/editar equipo */}
            {showForm && (
                <EquipoForm
                    equipo={editingEquipo}
                    onClose={handleCloseForm}
                    onSuccess={handleFormSuccess}
                />
            )}
        </div>
    );
};

export default EquiposInformacion;