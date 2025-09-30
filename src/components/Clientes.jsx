import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import '../styles/components/standardModal.css';

const Clientes = () => {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
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
    const [success, setSuccess] = useState('');

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
        setSuccess('');

        try {
            if (editingCliente) {
                const response = await api.put(`/clientes/${editingCliente.id}`, formData);
                if (response.data.success) {
                    setSuccess('Cliente actualizado exitosamente');
                    loadClientes();
                    resetForm();
                }
            } else {
                const response = await api.post('/clientes', formData);
                if (response.data.success) {
                    setSuccess('Cliente creado exitosamente');
                    loadClientes();
                    resetForm();
                }
            }
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
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este cliente?')) {
            try {
                const response = await api.delete(`/clientes/${id}`);
                if (response.data.success) {
                    setSuccess('Cliente eliminado exitosamente');
                    loadClientes();
                }
            } catch (error) {
                console.error('Error eliminando cliente:', error);
                setError('Error al eliminar el cliente');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            nombre: '',
            abreviatura: '',
            contacto: '',
            telefono: '',
            email: '',
            direccion: ''
        });
        setEditingCliente(null);
        setShowForm(false);
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Cargando clientes...</p>
            </div>
        );
    }

    return (
        <div className="clientes-container">
            <div className="clientes-header">
                <h1>Gestión de Clientes</h1>
                <button 
                    className="btn-primary"
                    onClick={() => setShowForm(true)}
                >
                    + Nuevo Cliente
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {showForm && (
                <div className="standard-modal-overlay">
                    <div className="standard-modal-content">
                        <div className="standard-modal-header">
                            <h2>{editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                            <button className="close-btn" onClick={resetForm}>×</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="cliente-form">
                            <div className="">
                                <div className="">
                                    <label htmlFor="nombre">Nombre *</label>
                                    <input
                                        type="text"
                                        id="nombre"
                                        name="nombre"
                                        value={formData.nombre}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="">
                                    <label htmlFor="abreviatura">Abreviatura</label>
                                    <input
                                        type="text"
                                        id="abreviatura"
                                        name="abreviatura"
                                        value={formData.abreviatura}
                                        onChange={handleInputChange}
                                        maxLength="25"
                                        placeholder="Ej: CONST_PAN"
                                    />
                                </div>
                            </div>

                            <div className="">
                                <label htmlFor="contacto">Persona de Contacto</label>
                                <input
                                    type="text"
                                    id="contacto"
                                    name="contacto"
                                    value={formData.contacto}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="">
                                <div className="">
                                    <label htmlFor="telefono">Teléfono</label>
                                    <input
                                        type="tel"
                                        id="telefono"
                                        name="telefono"
                                        value={formData.telefono}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="">
                                <label htmlFor="direccion">Dirección</label>
                                <textarea
                                    id="direccion"
                                    name="direccion"
                                    value={formData.direccion}
                                    onChange={handleInputChange}
                                    rows="3"
                                />
                            </div>

                            <div className="">
                                <button type="button" onClick={resetForm} className="btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingCliente ? 'Actualizar' : 'Crear'} Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="clientes-list">
                {clientes.length === 0 ? (
                    <div className="empty-state">
                        <h3>No hay clientes registrados</h3>
                        <p>Comience agregando su primer cliente al sistema</p>
                        <button 
                            className="btn-primary"
                            onClick={() => setShowForm(true)}
                        >
                            + Agregar Cliente
                        </button>
                    </div>
                ) : (
                    <div className="clientes-grid">
                        {clientes.map(cliente => (
                            <div key={cliente.id} className="cliente-card">
                                <div className="cliente-header">
                                    <div>
                                        <h3>{cliente.nombre}</h3>
                                        {cliente.abreviatura && (
                                            <span className="cliente-abreviatura">{cliente.abreviatura}</span>
                                        )}
                                    </div>
                                    <div className="cliente-actions">
                                        <button 
                                            onClick={() => handleEdit(cliente)}
                                            className="btn-edit"
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(cliente.id)}
                                            className="btn-delete"
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="cliente-info">
                                    {cliente.contacto && (
                                        <p><strong>Contacto:</strong> {cliente.contacto}</p>
                                    )}
                                    {cliente.telefono && (
                                        <p><strong>Teléfono:</strong> {cliente.telefono}</p>
                                    )}
                                    {cliente.email && (
                                        <p><strong>Email:</strong> {cliente.email}</p>
                                    )}
                                    {cliente.direccion && (
                                        <p><strong>Dirección:</strong> {cliente.direccion}</p>
                                    )}
                                </div>
                                
                                <div className="cliente-footer">
                                    <small>
                                        Registrado: {formatDate(cliente.created_at)}
                                    </small>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Clientes;