import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruckPickup, faPlus, faEdit, faTrash, faClock } from '@fortawesome/free-solid-svg-icons';
import SectionHeader from '../../components/common/SectionHeader';
import StandardTable from '../../components/common/StandardTable';
import AsignacionForm from '../../components/forms/AsignacionForm';
import RegistroUsoForm from '../../components/forms/RegistroUsoForm';
import api from '../../services/api';
import '../../styles/pages/asignaciones_equipos.css';

const AsignacionesEquipos = () => {
    const [showForm, setShowForm] = useState(false);
    const [showRegistroUso, setShowRegistroUso] = useState(false);
    const [asignaciones, setAsignaciones] = useState({ alquiler: [], propios: [] });
    const [loading, setLoading] = useState(true);
    const [selectedAsignacion, setSelectedAsignacion] = useState(null);

    useEffect(() => {
        loadAsignaciones();
    }, []);

    const loadAsignaciones = async () => {
        try {
            setLoading(true);
            const response = await api.get('/asignaciones');
            if (response.data.success) {
                const allAsignaciones = response.data.data;
                // Separar por tipo de uso
                const alquiler = allAsignaciones.filter(a => a.tipo_uso === 'alquiler');
                const propios = allAsignaciones.filter(a => a.tipo_uso === 'propio');

                setAsignaciones({ alquiler, propios });
            }
        } catch (error) {
            console.error('Error loading asignaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewAsignacion = () => {
        setSelectedAsignacion(null);
        setShowForm(true);
    };

    const handleEditAsignacion = (asignacion) => {
        setSelectedAsignacion(asignacion);
        setShowForm(true);
    };

    const handleDeleteAsignacion = async (asignacion) => {
        if (window.confirm('¿Está seguro de eliminar esta asignación?')) {
            try {
                const response = await api.delete(`/asignaciones/${asignacion.id}`);
                if (response.data.success) {
                    loadAsignaciones();
                }
            } catch (error) {
                console.error('Error deleting asignacion:', error);
                alert('Error al eliminar la asignación');
            }
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setSelectedAsignacion(null);
    };

    const handleSuccess = () => {
        loadAsignaciones();
    };

    const handleRegistroUso = (asignacion) => {
        setSelectedAsignacion(asignacion);
        setShowRegistroUso(true);
    };

    const handleCloseRegistroUso = () => {
        setShowRegistroUso(false);
        setSelectedAsignacion(null);
    };

    // Columnas para tabla de alquiler (con icono de registro de uso)
    const columnsAlquiler = [
        {
            header: 'Descripción',
            accessor: 'equipo_descripcion'
        },
        {
            header: 'Cliente',
            accessor: 'cliente_abreviatura',
            render: (row) => row.cliente_abreviatura || row.cliente_nombre
        },
        {
            header: '',
            accessor: 'registro',
            render: (row) => (
                <button
                    className="standard-table-icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRegistroUso(row);
                    }}
                    title="Registrar Uso"
                >
                    <FontAwesomeIcon icon={faClock} />
                </button>
            )
        },
        {
            header: '',
            accessor: 'actions',
            render: (row) => (
                <button
                    className="standard-table-icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleEditAsignacion(row);
                    }}
                    title="Editar"
                >
                    <FontAwesomeIcon icon={faEdit} />
                </button>
            )
        }
    ];

    // Columnas para tabla de propios (sin icono de registro de uso)
    const columnsPropios = [
        {
            header: 'Descripción',
            accessor: 'equipo_descripcion'
        },
        {
            header: 'Cliente',
            accessor: 'cliente_abreviatura',
            render: (row) => row.cliente_abreviatura || row.cliente_nombre
        },
        {
            header: '',
            accessor: 'actions',
            render: (row) => (
                <button
                    className="standard-table-icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleEditAsignacion(row);
                    }}
                    title="Editar"
                >
                    <FontAwesomeIcon icon={faEdit} />
                </button>
            )
        }
    ];

    return (
        <div className="section-container">
            <SectionHeader
                title="Asignaciones de Equipos"
                icon={faTruckPickup}
                actionButton={{
                    icon: faPlus,
                    onClick: handleNewAsignacion,
                    title: "Agregar nueva asignación"
                }}
            />

            {loading ? (
                <div className="loading-spinner">Cargando...</div>
            ) : (
                <>
                    {/* Tabla de Equipos en Alquiler */}
                    <div className="table-title-section">
                        <h3 className="table-title-header">
                            Equipos en Alquiler
                        </h3>
                        <div className="table-title-content">
                            <StandardTable
                                className="asig-table"
                                columns={columnsAlquiler}
                                data={asignaciones.alquiler}
                                onRowClick={handleRegistroUso}
                                emptyMessage="No hay equipos en alquiler"
                            />
                        </div>
                    </div>

                    {/* Tabla de Equipos Propios */}
                    <div className="table-title-section">
                        <h3 className="table-title-header">
                            Equipos en Proyectos Propios
                        </h3>
                        <div className="table-title-content">
                            <StandardTable
                                className="asig-table"
                                columns={columnsPropios}
                                data={asignaciones.propios}
                                onRowClick={handleEditAsignacion}
                                emptyMessage="No hay equipos propios asignados"
                            />
                        </div>
                    </div>
                </>
            )}

            {showForm && (
                <AsignacionForm
                    asignacion={selectedAsignacion}
                    onClose={handleCloseForm}
                    onSuccess={handleSuccess}
                />
            )}

            {showRegistroUso && (
                <RegistroUsoForm
                    asignacion={selectedAsignacion}
                    onClose={handleCloseRegistroUso}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default AsignacionesEquipos;