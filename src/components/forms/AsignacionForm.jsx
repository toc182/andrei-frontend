import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import StandardModal from '../common/StandardModal';

const AsignacionForm = ({ asignacion = null, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        equipo_id: '',
        cliente_id: '',
        proyecto_id: '',
        responsable_id: '',
        fecha_inicio: '',
        fecha_fin: '',
        tipo_uso: '',
        tipo_cobro: '',
        tarifa: '',
        incluye_operador: false,
        costo_operador: '',
        incluye_combustible: false,
        costo_combustible: '',
        ajuste_monto: '',
        motivo_ajuste: '',
        observaciones: ''
    });

    const [equipos, setEquipos] = useState([]);
    const [equiposDisponibles, setEquiposDisponibles] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Cargar datos iniciales
    useEffect(() => {
        loadInitialData();
        if (asignacion) {
            setFormData({
                equipo_id: asignacion.equipo_id || '',
                cliente_id: asignacion.cliente_id || '',
                proyecto_id: asignacion.proyecto_id || '',
                responsable_id: asignacion.responsable_id || '',
                fecha_inicio: asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '',
                fecha_fin: asignacion.fecha_fin ? asignacion.fecha_fin.split('T')[0] : '',
                tipo_uso: asignacion.tipo_uso || '',
                tipo_cobro: asignacion.tipo_cobro || '',
                tarifa: asignacion.tarifa || '',
                incluye_operador: asignacion.incluye_operador || false,
                costo_operador: asignacion.costo_operador || '',
                incluye_combustible: asignacion.incluye_combustible || false,
                costo_combustible: asignacion.costo_combustible || '',
                ajuste_monto: asignacion.ajuste_monto || '',
                motivo_ajuste: asignacion.motivo_ajuste || '',
                observaciones: asignacion.observaciones || ''
            });
        }
    }, [asignacion]);

    const loadInitialData = async () => {
        try {
            const [equiposRes, clientesRes, proyectosRes, asignacionesRes] = await Promise.all([
                api.get('/equipos'),
                api.get('/clientes'),
                api.get('/projects'),
                api.get('/asignaciones')
            ]);

            if (equiposRes.data.success) {
                const todosEquipos = equiposRes.data.data;
                setEquipos(todosEquipos);

                // Filtrar equipos que ya están asignados (excepto si estamos editando)
                if (asignacionesRes.data.success) {
                    const asignaciones = asignacionesRes.data.data;
                    const equiposAsignadosIds = asignaciones
                        .filter(a => !asignacion || a.id !== asignacion.id) // Excluir asignación actual si estamos editando
                        .map(a => a.equipo_id);

                    const disponibles = todosEquipos.filter(e => !equiposAsignadosIds.includes(e.id));
                    setEquiposDisponibles(disponibles);
                } else {
                    setEquiposDisponibles(todosEquipos);
                }
            }

            if (clientesRes.data.success) setClientes(clientesRes.data.clientes);
            if (proyectosRes.data.success) setProyectos(proyectosRes.data.proyectos);
        } catch (error) {
            console.error('Error loading initial data:', error);
            setError('Error al cargar datos iniciales');
        }
    };

    const handleChange = (e) => {
        const { name, type, value, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let response;
            if (asignacion) {
                response = await api.put(`/asignaciones/${asignacion.id}`, formData);
            } else {
                response = await api.post('/asignaciones', formData);
            }

            if (response.data.success) {
                onSuccess && onSuccess();
                onClose();
            } else {
                setError(response.data.message || 'Error al guardar la asignación');
            }
        } catch (error) {
            console.error('Error saving asignacion:', error);
            setError(error.response?.data?.message || 'Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!asignacion) return;

        const equipoNombre = equipos.find(e => e.id === formData.equipo_id)?.descripcion || 'este equipo';

        if (window.confirm(`¿Está seguro de que desea eliminar la asignación de ${equipoNombre}?`)) {
            try {
                setLoading(true);
                const response = await api.delete(`/asignaciones/${asignacion.id}`);

                if (response.data.success) {
                    onSuccess && onSuccess();
                    onClose();
                } else {
                    setError('Error al eliminar la asignación');
                }
            } catch (error) {
                console.error('Error deleting asignacion:', error);
                setError('Error al conectar con el servidor');
            } finally {
                setLoading(false);
            }
        }
    };

    const footer = (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: asignacion ? 'space-between' : 'flex-end' }}>
            {asignacion && (
                <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={loading}
                >
                    Eliminar
                </button>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
                {!asignacion && (
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    form="asignacion-form"
                    className="btn btn-primary"
                    disabled={loading}
                >
                    {loading ? 'Guardando...' : (asignacion ? 'Actualizar' : 'Crear Asignación')}
                </button>
            </div>
        </div>
    );

    return (
        <StandardModal
            isOpen={true}
            onClose={onClose}
            title={asignacion ? "Editar Asignación" : "Nueva Asignación de Equipo"}
            footer={footer}
            className="equipos-form-modal"
        >
            <form id="asignacion-form" onSubmit={handleSubmit} className="form-container">
                {error && <div className="error-message">{error}</div>}

                {/* Mostrar selector de equipo solo en modo creación */}
                {!asignacion && (
                    <div>
                        <label>Equipo *</label>
                        <select
                            name="equipo_id"
                            value={formData.equipo_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Seleccionar equipo...</option>
                            {equiposDisponibles && equiposDisponibles.map(equipo => (
                                <option key={equipo.id} value={equipo.id}>
                                    {equipo.codigo} - {equipo.descripcion}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Mostrar equipo como texto solo en modo edición */}
                {asignacion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <label style={{ marginBottom: 0, minWidth: '100px' }}>Equipo:</label>
                        <span style={{ fontWeight: 'bold' }}>
                            {equipos.find(e => e.id === formData.equipo_id)?.codigo} - {equipos.find(e => e.id === formData.equipo_id)?.descripcion}
                        </span>
                    </div>
                )}

                <div>
                    <label>Cliente *</label>
                    <select
                        name="cliente_id"
                        value={formData.cliente_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Seleccionar cliente...</option>
                        {clientes && clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>
                                {cliente.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label>Proyecto *</label>
                    <select
                        name="proyecto_id"
                        value={formData.proyecto_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Seleccionar proyecto...</option>
                        {proyectos && proyectos.map(proyecto => (
                            <option key={proyecto.id} value={proyecto.id}>
                                {proyecto.nombre_corto}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label>Responsable</label>
                    <input
                        type="text"
                        name="responsable_id"
                        value={formData.responsable_id}
                        onChange={handleChange}
                        placeholder="Nombre del responsable"
                    />
                </div>

                <div>
                    <label>Fecha de Inicio *</label>
                    <input
                        type="date"
                        name="fecha_inicio"
                        value={formData.fecha_inicio}
                        onChange={handleChange}
                        required
                    />
                </div>


                <div>
                    <label>Tipo de Uso *</label>
                    <select
                        name="tipo_uso"
                        value={formData.tipo_uso}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Seleccionar...</option>
                        <option value="propio">Propio</option>
                        <option value="alquiler">Alquiler</option>
                    </select>
                </div>

                {formData.tipo_uso === 'alquiler' && (
                    <div>
                        <label>Tipo de Cobro</label>
                        <select
                            name="tipo_cobro"
                            value={formData.tipo_cobro}
                            onChange={handleChange}
                        >
                            <option value="">Seleccionar...</option>
                            <option value="hora">Por Hora</option>
                            <option value="dia">Por Día</option>
                            <option value="semana">Por Semana</option>
                            <option value="mes">Por Mes</option>
                            <option value="costo_fijo">Costo Fijo</option>
                        </select>
                    </div>
                )}

                {formData.tipo_uso === 'alquiler' && (
                    <div>
                        <label>Tarifa</label>
                        <input
                            type="number"
                            step="0.01"
                            name="tarifa"
                            value={formData.tarifa}
                            onChange={handleChange}
                            placeholder="Ej: 100.00"
                        />
                    </div>
                )}

                <div className="asig-toggle-container">
                    <label>Incluye Operador</label>
                    <button
                        type="button"
                        className={`asig-toggle ${formData.incluye_operador ? 'asig-toggle-active' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, incluye_operador: !prev.incluye_operador }))}
                    >
                        <span className="asig-toggle-slider"></span>
                    </button>
                </div>

                {formData.incluye_operador && (
                    <div>
                        <label>Costo Operador</label>
                        <input
                            type="number"
                            step="0.01"
                            name="costo_operador"
                            value={formData.costo_operador}
                            onChange={handleChange}
                            placeholder="Ej: 50.00"
                        />
                    </div>
                )}

                <div className="asig-toggle-container">
                    <label>Incluye Combustible</label>
                    <button
                        type="button"
                        className={`asig-toggle ${formData.incluye_combustible ? 'asig-toggle-active' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, incluye_combustible: !prev.incluye_combustible }))}
                    >
                        <span className="asig-toggle-slider"></span>
                    </button>
                </div>

                {formData.incluye_combustible && (
                    <div>
                        <label>Costo Combustible</label>
                        <input
                            type="number"
                            step="0.01"
                            name="costo_combustible"
                            value={formData.costo_combustible}
                            onChange={handleChange}
                            placeholder="Ej: 25.00"
                        />
                    </div>
                )}


                <div>
                    <label>Observaciones</label>
                    <textarea
                        name="observaciones"
                        rows="3"
                        value={formData.observaciones}
                        onChange={handleChange}
                        placeholder="Comentarios adicionales"
                    ></textarea>
                </div>
            </form>
        </StandardModal>
    );
};

export default AsignacionForm;