import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTruckPickup } from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/logo.png';
import cocpLogo from '../assets/LogoCOCPfondoblanco.png';
import EquipoForm from './EquipoForm';
import api from '../services/api';
import SectionHeader from './common/SectionHeader';

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

    // Renderizar tabla de equipos
    const renderEquiposTable = (equipos, logoSrc, altText) => (
        <div className="projects-table-container">
            <table className="projects-table equipos-table">
                <thead>
                    <tr className="equipos-title-row">
                        <th colSpan="6" className="equipos-title-header">
                            <img src={logoSrc} alt={altText} className="equipos-logo" />
                        </th>
                    </tr>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Marca</th>
                        <th>Modelo</th>
                        <th>Año</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {equipos.map((equipo, index) => (
                        <tr
                            key={equipo.id || `equipo-${index}`}
                            onClick={() => handleRowClick(equipo)}
                            style={{ cursor: 'pointer' }}
                        >
                            <td>{equipo.codigo || '-'}</td>
                            <td>{equipo.descripcion}</td>
                            <td>{equipo.marca}</td>
                            <td>{equipo.modelo}</td>
                            <td>{equipo.ano}</td>
                            <td>
                                <button
                                    className="btn-edit-icon"
                                    onClick={(e) => handleEditEquipo(equipo, e)}
                                    title="Editar equipo"
                                >
                                    <FontAwesomeIcon icon={faEdit} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    if (loading) {
        return (
            <div className="section-container">
                <SectionHeader
                    title="Información de Equipos"
                    icon={faTruckPickup}
                />
                <div className="projects-loading">
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
            <div style={{ marginBottom: '2rem' }}>
                {renderEquiposTable(equiposPinellas, logo, "Pinellas Logo")}
            </div>

            {/* Tabla de Equipos de COCP */}
            <div style={{ marginBottom: '2rem' }}>
                {renderEquiposTable(equiposCOCP, cocpLogo, "COCP Logo")}
            </div>

            {/* Modal de detalles */}
            {showModal && selectedEquipo && (
                <div className="modal-overlay">
                    <div className="modal-content project-details-modal equipos-modal">
                        <div className="modal-header">
                            <h2>Detalles del Equipo</h2>
                            <button
                                className="modal-close"
                                onClick={closeModal}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="project-details">
                            <div className="detail-row">
                                <label>Código:</label>
                                <span>{selectedEquipo.codigo || 'N/A'}</span>
                            </div>

                            <div className="detail-row">
                                <label>Descripción:</label>
                                <span>{selectedEquipo.descripcion}</span>
                            </div>

                            <div className="detail-row">
                                <label>Marca:</label>
                                <span>{selectedEquipo.marca}</span>
                            </div>

                            <div className="detail-row">
                                <label>Modelo:</label>
                                <span>{selectedEquipo.modelo}</span>
                            </div>

                            <div className="detail-row">
                                <label>Año:</label>
                                <span>{selectedEquipo.ano}</span>
                            </div>

                            <div className="detail-row">
                                <label># Motor:</label>
                                <span>{selectedEquipo.motor || 'N/A'}</span>
                            </div>

                            <div className="detail-row">
                                <label># Chasis:</label>
                                <span>{selectedEquipo.chasis || 'N/A'}</span>
                            </div>

                            <div className="detail-row">
                                <label>Costo:</label>
                                <span className="project-money">{formatMoney(selectedEquipo.costo)}</span>
                            </div>

                            <div className="detail-row">
                                <label>Valor Actual:</label>
                                <span className="project-money">{formatMoney(selectedEquipo.valor_actual)}</span>
                            </div>

                            <div className="detail-row">
                                <label>Rata/Mes:</label>
                                <span className="project-money">{formatMoney(selectedEquipo.rata_mes)}</span>
                            </div>

                            <div className="detail-row">
                                <label>Propietario:</label>
                                <span className="client-abbreviation owner-badge">{selectedEquipo.owner}</span>
                            </div>

                            {selectedEquipo.observaciones && (
                                <div className="detail-row full-width">
                                    <label>Observaciones:</label>
                                    <div className="observations">
                                        {selectedEquipo.observaciones}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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