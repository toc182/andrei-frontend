import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(''); // Limpiar error al escribir
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(formData.email, formData.password);

        if (!result.success) {
            setError(result.message);
        }

        setLoading(false);
    };

    return (
        <div className="section-container">
            <div className="document-form-card card-login">
                <div className="login-header">
                    <img src={logo} alt="Pinellas" className="login-logo" />
                </div>

                <form onSubmit={handleSubmit} className="document-form">
                    <div className="form-group">
                        <label className="form-label">Email:</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="admin@andrei.com"
                            disabled={loading}
                            className="form-control"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Contraseña:</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="123456"
                            disabled={loading}
                            className="form-control"
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div style={{textAlign: 'center', marginTop: '1rem'}}>
                        <button
                            type="submit"
                            className={`btn-submit ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default Login;