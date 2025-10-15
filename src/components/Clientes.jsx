import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';
import SectionHeader from './common/SectionHeader';
import StandardTable from './common/StandardTable';
import StandardModal from './common/StandardModal';
import '../styles/pages/clientes.css';

const Clientes = () => {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCliente, setEditingCliente] = useState(null);
    const [formData, setFormData] = useState({
        nombre: '',
        abreviatura: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: ''
    });
    const [error, setError] = useState('');

    useEffect(() => {
        loadClientes();
    }, []);

    const loadClientes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/clientes');
            if (response.data.success) {
                setClientes(response.data.clientes);
            }
        } catch (error) {
            console.error('Error cargando clientes:', error);
            setError('Error al cargar los clientes');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (editingCliente) {
                await api.put(`/clientes/${editingCliente.id}`, formData);
            } else {
                await api.post('/clientes', formData);
            }
            loadClientes();
            handleCloseModal();
        } catch (error) {
            console.error('Error guardando cliente:', error);
            setError(error.response?.data?.message || 'Error al guardar el cliente');
        }
    };

    const handleEdit = (cliente) => {
        setEditingCliente(cliente);
        setFormData({
            nombre: cliente.nombre,
            abreviatura: cliente.abreviatura || '',
            contacto: cliente.contacto || '',
            telefono: cliente.telefono || '',
            email: cliente.email || '',
            direccion: cliente.direccion || ''
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!editingCliente) return;

        if (window.confirm(`¿Está seguro de eliminar el cliente "${editingCliente.nombre}"?`)) {
            try {
                const response = await api.delete(`/clientes/${editingCliente.id}`);
                if (response.data.success) {
                    loadClientes();
                    handleCloseModal();
                } else {
                    setError(response.data.message || 'Error al eliminar el cliente');
                }
            } catch (error) {
                console.error('Error eliminando cliente:', error);
                setError(error.response?.data?.message || 'Error al eliminar el cliente');
            }
        }
    };

    const handleNewCliente = () => {
        setEditingCliente(null);
        setFormData({
            nombre: '',
            abreviatura: '',
            contacto: '',
            telefono: '',
            email: '',
            direccion: ''
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCliente(null);
        setError('');
    };

    const columns = [
        {
            header: 'Nombre',
            accessor: 'nombre'
        },
        {
            header: '',
            accessor: 'abreviatura',
            render: (row) => (
                <div style={{ textAlign: 'center' }}>
                    {row.abreviatura}
                </div>
            )
        },
        {
            header: '',
            accessor: 'actions',
            render: (row) => (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                        className="standard-table-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(row);
                        }}
                        title="Editar"
                    >
                        <FontAwesomeIcon icon={faEdit} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="section-container">
            <SectionHeader
                title="Clientes"
                actionButton={{
                    icon: faPlus,
                    onClick: handleNewCliente,
                    className: 'btn-circular'
                }}
            />

            <StandardTable
                tableClassName="clientes-table"
                columns={columns}
                data={clientes}
                loading={loading}
                emptyMessage="No hay clientes registrados"
            />

            <StandardModal
                isOpen={showModal}
                onClose={handleCloseModal}
                title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
                footer={
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: editingCliente ? 'space-between' : 'flex-end' }}>
                        {editingCliente && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="btn btn-danger"
                            >
                                Eliminar
                            </button>
                        )}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {!editingCliente && (
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="btn btn-secondary"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                form="cliente-form"
                                className="btn btn-primary"
                            >
                                {editingCliente ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                }
            >
                <form id="cliente-form" onSubmit={handleSubmit} className="form-container">
                    {error && <div className="error-message">{error}</div>}

                    <div>
                        <label>Nombre *</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div>
                        <label>Abreviatura</label>
                        <input
                            type="text"
                            name="abreviatura"
                            value={formData.abreviatura}
                            onChange={handleInputChange}
                            maxLength="25"
                            placeholder="Ej: CONST_PAN"
                        />
                    </div>

                    <div>
                        <label>Persona de Contacto</label>
                        <input
                            type="text"
                            name="contacto"
                            value={formData.contacto}
                            onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <label>Teléfono</label>
                        <input
                            type="tel"
                            name="telefono"
                            value={formData.telefono}
                            onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <label>Dirección</label>
                        <textarea
                            name="direccion"
                            value={formData.direccion}
                            onChange={handleInputChange}
                            rows="3"
                        />
                    </div>
                </form>
            </StandardModal>
        </div>
    );
};

export default Clientes;
