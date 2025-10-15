import React, { useState, useEffect } from 'react';
import api from '../services/api';
import StandardModal from './common/StandardModal';
import '../styles/pages/asignaciones_equipos.css';

const RegistroUsoForm = ({ asignacion, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        fecha_inicio: '',
        fecha_fin: '',
        cantidad: '',
        observaciones: ''
    });
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingRegistros, setLoadingRegistros] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (asignacion) {
            // Pre-llenar con la fecha de inicio de la asignación
            const fechaInicio = asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '';
            setFormData(prev => ({
                ...prev,
                fecha_inicio: fechaInicio
            }));

            // Cargar registros existentes
            loadRegistros();
        }
    }, [asignacion]);

    const loadRegistros = async () => {
        try {
            setLoadingRegistros(true);
            const response = await api.get(`/registro-uso/asignacion/${asignacion.id}`);
            if (response.data.success) {
                setRegistros(response.data.data);
            }
        } catch (error) {
            console.error('Error loading registros:', error);
        } finally {
            setLoadingRegistros(false);
        }
    };


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Si es tipo hora, verificar si la fecha ya existe
            if (asignacion.tipo_cobro === 'hora') {
                const fechaIngresada = formData.fecha_inicio.split('T')[0];
                const fechaExistente = registros.find(
                    r => r.fecha_inicio.split('T')[0] === fechaIngresada
                );

                if (fechaExistente) {
                    const confirmar = window.confirm(
                        `Ya existe un registro para esta fecha con ${fechaExistente.cantidad} horas. ¿Deseas sobreescribir la información anterior?`
                    );

                    if (!confirmar) {
                        setLoading(false);
                        return;
                    }
                }
            }

            const dataToSend = {
                asignacion_id: asignacion.id,
                fecha_inicio: formData.fecha_inicio,
                fecha_fin: asignacion.tipo_cobro === 'hora' ? formData.fecha_inicio : formData.fecha_fin,
                cantidad: formData.cantidad,
                observaciones: formData.observaciones || null
            };

            const response = await api.post('/registro-uso', dataToSend);

            if (response.data.success) {
                // Recargar registros después de guardar
                loadRegistros();
                // Limpiar formulario
                setFormData({
                    fecha_inicio: asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '',
                    fecha_fin: '',
                    cantidad: '',
                    observaciones: ''
                });
                onSuccess && onSuccess();
            } else {
                setError(response.data.message || 'Error al guardar el registro');
            }
        } catch (error) {
            console.error('Error saving registro uso:', error);
            setError('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const footer = null;

    return (
        <StandardModal
            isOpen={true}
            onClose={onClose}
            title={`Registro de Uso - ${asignacion?.equipo_descripcion || 'Equipo'}`}
            footer={footer}
            className="equipos-form-modal"
        >
            <form id="registro-uso-form" onSubmit={handleSubmit} className="form-container">
                {error && <div className="error-message">{error}</div>}

                {/* Información del equipo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <label style={{ marginBottom: 0, fontWeight: 'bold' }}>Equipo:</label>
                    <span>{asignacion?.equipo_codigo} - {asignacion?.equipo_descripcion}</span>
                </div>

                {/* Tipo de Cobro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <label style={{ marginBottom: 0, fontWeight: 'bold' }}>Tipo de Cobro:</label>
                    <span style={{ textTransform: 'capitalize' }}>
                        {asignacion?.tipo_cobro === 'mes' ? 'Por Mes' :
                         asignacion?.tipo_cobro === 'dia' ? 'Por Día' :
                         asignacion?.tipo_cobro === 'semana' ? 'Por Semana' :
                         asignacion?.tipo_cobro === 'hora' ? 'Por Hora' :
                         asignacion?.tipo_cobro === 'costo_fijo' ? 'Costo Fijo' :
                         asignacion?.tipo_cobro}
                    </span>
                </div>

{asignacion?.tipo_cobro === 'hora' ? (
                    <>
                        <div>
                            <label>Fecha *</label>
                            <input
                                type="date"
                                name="fecha_inicio"
                                value={formData.fecha_inicio}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div>
                            <label>Horas *</label>
                            <input
                                type="number"
                                step="0.01"
                                name="cantidad"
                                value={formData.cantidad}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <label>Fecha de Inicio del Periodo *</label>
                            <input
                                type="date"
                                name="fecha_inicio"
                                value={formData.fecha_inicio}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div>
                            <label>Fecha de Fin del Periodo *</label>
                            <input
                                type="date"
                                name="fecha_fin"
                                value={formData.fecha_fin}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div>
                            <label>Cantidad</label>
                            <input
                                type="number"
                                step="0.01"
                                name="cantidad"
                                value={formData.cantidad}
                                onChange={handleChange}
                            />
                        </div>
                    </>
                )}

                <div>
                    <label>Observaciones</label>
                    <textarea
                        name="observaciones"
                        rows="3"
                        value={formData.observaciones}
                        onChange={handleChange}
                        placeholder="Notas adicionales sobre este periodo..."
                    ></textarea>
                </div>

                {/* Botón de Guardar */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={loading}
                    >
                        {loading ? 'Guardando...' : 'Guardar Registro'}
                    </button>
                </div>

                {/* Sección de Registros Anteriores */}
                <div className="asig_reg-section">
                    <h3 className="asig_reg-title">Historial de Asignación</h3>

                    {loadingRegistros ? (
                        <div className="asig_reg-loading">Cargando registros...</div>
                    ) : registros.length === 0 ? (
                        <div className="asig_reg-empty">No hay registros de uso todavía</div>
                    ) : (
                        <div className="asig_reg-table-container">
                            <table className="asig_reg-table">
                                <thead>
                                    <tr>
                                        {asignacion?.tipo_cobro === 'hora' ? (
                                            <>
                                                <th>Día</th>
                                                <th>Fecha</th>
                                                <th>Horas</th>
                                                <th>Observaciones</th>
                                            </>
                                        ) : (
                                            <>
                                                <th>{asignacion?.tipo_cobro === 'mes' ? 'Mes' : asignacion?.tipo_cobro === 'semana' ? 'Semana' : 'Periodo'}</th>
                                                <th>Fecha Inicio</th>
                                                <th>Fecha Fin</th>
                                                <th>Observaciones</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {registros.map((registro, index) => (
                                        <tr key={registro.id}>
                                            {asignacion?.tipo_cobro === 'hora' ? (
                                                <>
                                                    <td>{index + 1}</td>
                                                    <td>{new Date(registro.fecha_inicio).toLocaleDateString('es-PA')}</td>
                                                    <td>{registro.cantidad}</td>
                                                    <td>{registro.observaciones || '-'}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>{index + 1}</td>
                                                    <td>{new Date(registro.fecha_inicio).toLocaleDateString('es-PA')}</td>
                                                    <td>{new Date(registro.fecha_fin).toLocaleDateString('es-PA')}</td>
                                                    <td>{registro.observaciones || '-'}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </form>
        </StandardModal>
    );
};

export default RegistroUsoForm;
