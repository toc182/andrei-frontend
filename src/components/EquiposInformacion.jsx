import React, { useState } from 'react';
import logo from '../assets/logo.png';
import cocpLogo from '../assets/LogoCOCPfondoblanco.png';

const EquiposInformacion = () => {
    const [selectedEquipo, setSelectedEquipo] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Datos de equipos basados en el CSV
    const equiposPinellas = [
        {
            codigo: "01-19",
            descripcion: "Retroexcavadora",
            marca: "John Deere",
            modelo: "310K",
            ano: "2014",
            motor: "PE4045G945825",
            chasis: "1T0310KXPEC266013",
            costo: "$73,000.00",
            valorActual: "$25,000.00",
            rataMes: "$4,500.00",
            proyecto: "",
            responsable: "",
            estado: "OK",
            observaciones: "Comprado en sept14. Incluye kit para martillo"
        },
        {
            codigo: "01-20",
            descripcion: "Retroexcavadora",
            marca: "John Deere",
            modelo: "310K",
            ano: "2014",
            motor: "PE4045G941718",
            chasis: "1T0310KXHEC264840",
            costo: "$73,000.00",
            valorActual: "$25,000.00",
            rataMes: "$4,500.00",
            proyecto: "",
            responsable: "",
            estado: "OK",
            observaciones: "Comprado en sept14. Incluye kit para martillo"
        },
        {
            codigo: "01-18",
            descripcion: "Tractor 700J",
            marca: "John Deere",
            modelo: "700J",
            ano: "2008",
            motor: "",
            chasis: "T0700JX167545",
            costo: "$49,166.50",
            valorActual: "$40,000.00",
            rataMes: "$12,600.00",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: ""
        },
        {
            codigo: "",
            descripcion: "Tractor D5N",
            marca: "Caterpillar",
            modelo: "D5N",
            ano: "2010",
            motor: "",
            chasis: "",
            costo: "",
            valorActual: "$40,000.00",
            rataMes: "",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: ""
        },
        {
            codigo: "01-12",
            descripcion: "Pala 21 Ton",
            marca: "John Deere",
            modelo: "210G LC",
            ano: "2012",
            motor: "PE6068G880193",
            chasis: "1FF210GXCCC520557",
            costo: "$175,000.00",
            valorActual: "$40,000.00",
            rataMes: "$11,700.00",
            proyecto: "",
            responsable: "",
            estado: "OK",
            observaciones: ""
        },
        {
            codigo: "01-23",
            descripcion: "Pala 21 Ton",
            marca: "Case",
            modelo: "CX210B",
            ano: "2009",
            motor: "",
            chasis: "N8SAH1966",
            costo: "$56,656.50",
            valorActual: "$25,000.00",
            rataMes: "$11,700.00",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: ""
        },
        {
            codigo: "",
            descripcion: "Pala 20 Ton",
            marca: "Caterpillar",
            modelo: "320 GX",
            ano: "2024",
            motor: "",
            chasis: "",
            costo: "$130,000.00",
            valorActual: "$150,000.00",
            rataMes: "",
            proyecto: "MOP",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "",
            descripcion: "Pala 22 Ton",
            marca: "Shantui",
            modelo: "SE220LC",
            ano: "2025",
            motor: "93382160",
            chasis: "66SE22DKNS1022089",
            costo: "$110,210.00",
            valorActual: "$140,000.00",
            rataMes: "",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "01-21",
            descripcion: "Rola Vibratoria 10 Ton",
            marca: "Volvo",
            modelo: "SD100DC",
            ano: "2008",
            motor: "36031658",
            chasis: "198475",
            costo: "$32,034.60",
            valorActual: "$18,000.00",
            rataMes: "$7,500.00",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: ""
        },
        {
            codigo: "",
            descripcion: "Rola Vibratoria 12P5",
            marca: "Shantui",
            modelo: "SR12P-5",
            ano: "2024",
            motor: "WEICHAI WP6G140E",
            chasis: "CHSR12YPCP6000892",
            costo: "$59,767.95",
            valorActual: "$80,000.00",
            rataMes: "",
            proyecto: "MOP",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "01-22",
            descripcion: "Rodillo Neumático 9 Llantas",
            marca: "Hypac",
            modelo: "C530AH",
            ano: "2002",
            motor: "46201274",
            chasis: "109A22201987",
            costo: "$32,034.60",
            valorActual: "$15,000.00",
            rataMes: "$7,500.00",
            proyecto: "FINCA",
            responsable: "",
            estado: "",
            observaciones: ""
        }
    ];

    // Equipos de COCP (50% con Arafat)
    const equiposCOCP = [
        {
            codigo: "",
            descripcion: "Tractor SD13",
            marca: "Shantui",
            modelo: "SD13",
            ano: "2024",
            motor: "CUMMINS 6CTA8.3-C145",
            chasis: "CHSD13AATP1006074",
            costo: "$110,437.91",
            valorActual: "$140,000.00",
            rataMes: "",
            proyecto: "MOP",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT. POCO MAS GRANDE QUE UN D4 CAT"
        },
        {
            codigo: "",
            descripcion: "Pala 20 Ton",
            marca: "Caterpillar",
            modelo: "320 GX",
            ano: "2024",
            motor: "",
            chasis: "",
            costo: "$130,000.00",
            valorActual: "$150,000.00",
            rataMes: "",
            proyecto: "MOP",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "",
            descripcion: "Pala 22 Ton",
            marca: "Shantui",
            modelo: "SE220LC",
            ano: "2025",
            motor: "93382160",
            chasis: "66SE22DKNS1022089",
            costo: "$110,210.00",
            valorActual: "$140,000.00",
            rataMes: "",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "",
            descripcion: "Rola Vibratoria 12P5",
            marca: "Shantui",
            modelo: "SR12P-5",
            ano: "2024",
            motor: "WEICHAI WP6G140E",
            chasis: "CHSR12YPCP6000892",
            costo: "$59,767.95",
            valorActual: "$80,000.00",
            rataMes: "",
            proyecto: "MOP",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "02-04",
            descripcion: "Pick-up Ford Ranger 4x4",
            marca: "Ford",
            modelo: "Ranger",
            ano: "2014",
            motor: "",
            chasis: "",
            costo: "$11,000.00",
            valorActual: "$5,500.00",
            rataMes: "$0.00",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        },
        {
            codigo: "02-06",
            descripcion: "Camión 3.5 Ton Utilitario",
            marca: "Hyundai",
            modelo: "DA0514",
            ano: "2016",
            motor: "",
            chasis: "",
            costo: "$15,000.00",
            valorActual: "$7,500.00",
            rataMes: "",
            proyecto: "",
            responsable: "",
            estado: "",
            observaciones: "50% CON ARAFAT"
        }
    ];

    const handleRowClick = (equipo) => {
        setSelectedEquipo(equipo);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedEquipo(null);
    };

    return (
        <div className="section-container">
            <div className="section-header">
                <h1>Información de Equipos</h1>
            </div>

            {/* Tabla de Equipos de Pinellas */}
            <div style={{ marginBottom: '2rem' }}>
                <div className="projects-table-container">
                    <table className="projects-table equipos-table">
                        <thead>
                            <tr className="equipos-title-row">
                                <th colSpan="5" className="equipos-title-header">
                                    <img src={logo} alt="Pinellas Logo" className="equipos-logo" />
                                </th>
                            </tr>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Marca</th>
                                <th>Modelo</th>
                                <th>Año</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equiposPinellas.map((equipo, index) => (
                                <tr
                                    key={`pinellas-${index}`}
                                    onClick={() => handleRowClick(equipo)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td>{equipo.codigo || '-'}</td>
                                    <td>{equipo.descripcion}</td>
                                    <td>{equipo.marca}</td>
                                    <td>{equipo.modelo}</td>
                                    <td>{equipo.ano}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabla de Equipos de COCP */}
            <div style={{ marginBottom: '2rem' }}>
                <div className="projects-table-container">
                    <table className="projects-table equipos-table">
                        <thead>
                            <tr className="equipos-title-row">
                                <th colSpan="5" className="equipos-title-header">
                                    <img src={cocpLogo} alt="COCP Logo" className="equipos-logo" />
                                </th>
                            </tr>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Marca</th>
                                <th>Modelo</th>
                                <th>Año</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equiposCOCP.map((equipo, index) => (
                                <tr
                                    key={`cocp-${index}`}
                                    onClick={() => handleRowClick(equipo)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td>{equipo.codigo || '-'}</td>
                                    <td>{equipo.descripcion}</td>
                                    <td>{equipo.marca}</td>
                                    <td>{equipo.modelo}</td>
                                    <td>{equipo.ano}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
                                <span className="project-money">{selectedEquipo.costo || 'N/A'}</span>
                            </div>

                            <div className="detail-row">
                                <label>Valor Actual:</label>
                                <span className="project-money">{selectedEquipo.valorActual || 'N/A'}</span>
                            </div>

                            <div className="detail-row">
                                <label>Rata/Mes:</label>
                                <span className="project-money">{selectedEquipo.rataMes || 'N/A'}</span>
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
        </div>
    );
};

export default EquiposInformacion;