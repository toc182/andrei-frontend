import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileText, faDownload, faSpinner, faEye } from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';
import '../styles/components/standardModal.css';
import '../styles/pages/documentos.css';

const DocumentForm = ({ documentType }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewHtml, setPreviewHtml] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Configuration for each document type
    const documentConfig = {
        'acuerdo-consorcio': {
            title: 'Acuerdo de Consorcio',
            description: '',
            hasEntitySelector: false,
            fields: [
                { name: 'projectName', label: 'Nombre del Proyecto', type: 'text', required: true },
                { name: 'fecha', label: 'Fecha', type: 'date', required: true }
            ]
        },
        'carta-adhesion': {
            title: 'Carta de Adhesión a Principios de Sostenibilidad',
            description: '',
            hasEntitySelector: true,
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true }
            ]
        },
        'medidas-retorsion': {
            title: 'Declaración Jurada de Medidas de Retorsión',
            description: '',
            hasEntitySelector: true,
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true }
            ]
        },
        'no-incapacidad': {
            title: 'Declaración Jurada de No Incapacidad para Contratar',
            description: '',
            hasEntitySelector: true,
            fields: [
                { name: 'projectName', label: 'Nombre del Proyecto', type: 'text', required: true },
                { name: 'fecha', label: 'Fecha', type: 'date', required: true }
            ]
        },
        'pacto-integridad': {
            title: 'Pacto de Integridad',
            description: '',
            hasEntitySelector: true,
            fields: [
                { name: 'projectName', label: 'Nombre del Proyecto', type: 'text', required: true },
                { name: 'codigoLic', label: 'Código de Licitación', type: 'text', required: true },
                { name: 'fecha', label: 'Fecha', type: 'date', required: true }
            ]
        }
    };

    const config = documentConfig[documentType];

    if (!config) {
        return (
            <div className="document-form-container">
                <div className="error-message">
                    Tipo de documento no encontrado: {documentType}
                </div>
            </div>
        );
    }

    const handleInputChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
        setError('');
    };

    const validateForm = () => {
        // Check entity selector if required
        if (config.hasEntitySelector && (!formData.entity || formData.entity.trim() === '')) {
            setError('Debe seleccionar una entidad');
            return false;
        }

        // Check required fields
        const requiredFields = config.fields.filter(field => field.required);
        for (let field of requiredFields) {
            if (!formData[field.name] || formData[field.name].trim() === '') {
                setError(`El campo "${field.label}" es requerido`);
                return false;
            }
        }
        return true;
    };

    const formatDateForBackend = (dateString) => {
        // Create date from input (YYYY-MM-DD format)
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day); // month is 0-indexed
        
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        
        return {
            day: days[date.getDay()],
            dayOfMonth: date.getDate().toString(),
            month: months[date.getMonth()],
            year: date.getFullYear().toString()
        };
    };

    const handlePreview = async () => {
        if (!validateForm()) {
            return;
        }

        setLoadingPreview(true);
        setError('');

        try {
            // Prepare data for backend
            let backendData = { ...formData };

            // Convert date to backend format
            if (formData.fecha) {
                const dateInfo = formatDateForBackend(formData.fecha);
                backendData = { ...backendData, ...dateInfo };
                delete backendData.fecha;
            }

            // Determine endpoint based on document type and entity
            let endpoint = '';

            if (documentType === 'acuerdo-consorcio') {
                endpoint = 'acuerdo-consorcio-preview';
            } else {
                const entitySuffix = formData.entity === 'consorcio' ? 'consorcio' : 'pinellas';
                const docTypeMap = {
                    'carta-adhesion': 'adhesion',
                    'medidas-retorsion': 'retorsion',
                    'no-incapacidad': 'incapacidad',
                    'pacto-integridad': 'integridad'
                };
                const docType = docTypeMap[documentType];
                endpoint = `${docType}-${entitySuffix}-preview`;
            }

            const response = await api.post(`/documents/${endpoint}`, backendData);

            if (response.data.success) {
                setPreviewHtml(response.data.html);
                setShowPreview(true);
            } else {
                setError('Error al generar la vista previa');
            }
        } catch (error) {
            console.error('Error generating preview:', error);
            setError('Error al generar la vista previa. Por favor intenta de nuevo.');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Prepare data for backend
            let backendData = { ...formData };
            
            // Convert date to backend format
            if (formData.fecha) {
                const dateInfo = formatDateForBackend(formData.fecha);
                backendData = { ...backendData, ...dateInfo };
                delete backendData.fecha;
            }

            // Determine endpoint based on document type and entity
            let endpoint = '';
            
            if (documentType === 'acuerdo-consorcio') {
                endpoint = 'acuerdo-consorcio-pdf';
            } else {
                const entitySuffix = formData.entity === 'consorcio' ? 'consorcio' : 'pinellas';
                const docTypeMap = {
                    'carta-adhesion': 'adhesion',
                    'medidas-retorsion': 'retorsion', 
                    'no-incapacidad': 'incapacidad',
                    'pacto-integridad': 'integridad'
                };
                const docType = docTypeMap[documentType];
                endpoint = `${docType}-${entitySuffix}-pdf`;
            }


            const response = await api.post(`/documents/${endpoint}`, backendData, {
                responseType: 'blob'
            });

            // Create a blob URL and trigger download
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${endpoint.replace('-pdf', '')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            // Reset form
            setFormData({});
        } catch (error) {
            console.error('Error generating document:', error);
            setError('Error al generar el documento. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="section-container">
            <div className="section-header card-mediano">
                <h1>{config.title}</h1>
            </div>

            <div className="document-form-card card-mediano">
                <form onSubmit={handleSubmit} className="document-form">
                    {config.hasEntitySelector && (
                        <div className="form-group">
                            <div className="entity-selector">
                                <div className="entity-option">
                                    <input
                                        type="radio"
                                        id="pinellas"
                                        name="entity"
                                        value="pinellas"
                                        checked={formData.entity === 'pinellas'}
                                        onChange={(e) => handleInputChange('entity', e.target.value)}
                                    />
                                    <label htmlFor="pinellas">Pinellas S.A.</label>
                                </div>
                                <div className="entity-option">
                                    <input
                                        type="radio"
                                        id="consorcio"
                                        name="entity"
                                        value="consorcio"
                                        checked={formData.entity === 'consorcio'}
                                        onChange={(e) => handleInputChange('entity', e.target.value)}
                                    />
                                    <label htmlFor="consorcio">Consorcio</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {config.fields.map(field => (
                        <div key={field.name} className="form-group">
                            <label htmlFor={field.name} className="form-label">
                                {field.label}
                                {field.required && <span className="required">*</span>}
                            </label>
                            {field.type === 'date' ? (
                                <input
                                    type="date"
                                    id={field.name}
                                    name={field.name}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    className="form-control"
                                    required={field.required}
                                />
                            ) : field.name === 'projectName' ? (
                                <textarea
                                    id={field.name}
                                    name={field.name}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="form-control"
                                    required={field.required}
                                    rows="2"
                                />
                            ) : (
                                <input
                                    type={field.type}
                                    id={field.name}
                                    name={field.name}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="form-control"
                                    required={field.required}
                                />
                            )}
                        </div>
                    ))}

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn-preview"
                            onClick={handlePreview}
                            disabled={loadingPreview || loading}
                        >
                            {loadingPreview ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faEye} />
                                    Vista Previa
                                </>
                            )}
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading || loadingPreview}
                        >
                            {loading ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faDownload} />
                                    Generar PDF
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Modal de Vista Previa */}
            {showPreview && (
                <div className="standard-modal-overlay" onClick={() => setShowPreview(false)}>
                    <div className="standard-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="standard-modal-header">
                            <h2>Vista Previa - {config.title}</h2>
                            <button
                                className="standard-modal-close"
                                onClick={() => setShowPreview(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div
                                className="preview-content"
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowPreview(false)}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentForm;