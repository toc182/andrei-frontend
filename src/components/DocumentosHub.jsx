import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileContract, faEnvelope, faFileAlt, faPlus, faEye, faEdit, faDownload } from '@fortawesome/free-solid-svg-icons';

const DocumentosHub = ({ activeSubsection = null }) => {
    const [selectedType, setSelectedType] = useState(activeSubsection || 'contratos');

    const documentTypes = [
        {
            key: 'contratos',
            title: 'Contratos',
            icon: faFileContract,
            description: 'Gestión de contratos de proyectos',
            color: '#2c3e50'
        },
        {
            key: 'cartas',
            title: 'Cartas',
            icon: faEnvelope,
            description: 'Cartas oficiales y comunicaciones',
            color: '#27ae60'
        },
        {
            key: 'informes',
            title: 'Informes',
            icon: faFileAlt,
            description: 'Informes técnicos y reportes',
            color: '#e74c3c'
        }
    ];

    // Tipos de documentos disponibles para generar
    const documentTemplates = {
        contratos: [
            { 
                id: 'acuerdo-consorcio', 
                name: 'Acuerdo de Consorcio', 
                description: 'Documento legal que establece los términos del consorcio',
                campos: ['Nombre del Proyecto', 'Día', 'Mes', 'Año'],
                disponible: true
            }
        ],
        cartas: [
            { 
                id: 'adhesion-pinellas', 
                name: 'Adhesión - Pinellas', 
                description: 'Carta de adhesión oficial de Pinellas S.A.',
                campos: ['Día', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'adhesion-consorcio', 
                name: 'Adhesión - Consorcio', 
                description: 'Carta de adhesión del consorcio',
                campos: ['Día', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'retorsion-pinellas', 
                name: 'Retorsión - Pinellas', 
                description: 'Carta de retorsión de Pinellas S.A.',
                campos: ['Día de la Semana', 'Día del Mes', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'retorsion-consorcio', 
                name: 'Retorsión - Consorcio', 
                description: 'Carta de retorsión del consorcio',
                campos: ['Día de la Semana', 'Día del Mes', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'incapacidad-pinellas', 
                name: 'Incapacidad - Pinellas', 
                description: 'Carta de incapacidad de Pinellas S.A.',
                campos: ['Nombre del Proyecto', 'Día', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'incapacidad-consorcio', 
                name: 'Incapacidad - Consorcio', 
                description: 'Carta de incapacidad del consorcio',
                campos: ['Nombre del Proyecto', 'Día', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'integridad-pinellas', 
                name: 'Integridad - Pinellas', 
                description: 'Carta de integridad de Pinellas S.A.',
                campos: ['Nombre del Proyecto', 'Código de Licitación', 'Día de la Semana', 'Día del Mes', 'Mes', 'Año'],
                disponible: true
            },
            { 
                id: 'integridad-consorcio', 
                name: 'Integridad - Consorcio', 
                description: 'Carta de integridad del consorcio',
                campos: ['Nombre del Proyecto', 'Código de Licitación', 'Día de la Semana', 'Día del Mes', 'Mes', 'Año'],
                disponible: true
            }
        ],
        informes: [
            { 
                id: 'informe-avance', 
                name: 'Informe de Avance', 
                description: 'Documento de seguimiento de proyecto (próximamente)',
                campos: [],
                disponible: false
            }
        ]
    };

    const selectedTypeData = documentTypes.find(type => type.key === selectedType);
    const templates = documentTemplates[selectedType] || [];

    return (
        <div className="documentos-hub">
            {/* Header */}
            <div className="hub-header">
                <h1>Gestión de Documentos</h1>
                <p>Crea y gestiona documentos oficiales para tus proyectos</p>
            </div>

            {/* Document Type Selector */}
            <div className="document-type-selector">
                {documentTypes.map(type => (
                    <button
                        key={type.key}
                        className={`type-card ${selectedType === type.key ? 'active' : ''}`}
                        onClick={() => setSelectedType(type.key)}
                        style={{ '--type-color': type.color }}
                    >
                        <div className="type-icon">
                            <FontAwesomeIcon icon={type.icon} />
                        </div>
                        <div className="type-info">
                            <h3>{type.title}</h3>
                            <p>{type.description}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Selected Type Content */}
            <div className="document-content">
                <div className="content-header">
                    <div className="content-title">
                        <FontAwesomeIcon icon={selectedTypeData.icon} />
                        <h2>{selectedTypeData.title}</h2>
                    </div>
                    <button className="btn-primary">
                        <FontAwesomeIcon icon={faPlus} />
                        Crear {selectedTypeData.title.slice(0, -1)}
                    </button>
                </div>

                {/* Document Templates List */}
                <div className="documents-list">
                    {templates.length > 0 ? (
                        <div className="templates-grid">
                            {templates.map(template => (
                                <div key={template.id} className={`template-card ${!template.disponible ? 'disabled' : ''}`}>
                                    <div className="template-header">
                                        <div className="template-icon">
                                            <FontAwesomeIcon icon={selectedTypeData.icon} />
                                        </div>
                                        <h3>{template.name}</h3>
                                    </div>
                                    <div className="template-body">
                                        <p>{template.description}</p>
                                        {template.campos.length > 0 && (
                                            <div className="template-fields">
                                                <span className="fields-label">Campos requeridos:</span>
                                                <div className="fields-list">
                                                    {template.campos.map((campo, index) => (
                                                        <span key={index} className="field-tag">
                                                            {campo}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="template-actions">
                                        {template.disponible ? (
                                            <button className="btn-generate">
                                                <FontAwesomeIcon icon={faPlus} />
                                                Generar Documento
                                            </button>
                                        ) : (
                                            <button className="btn-disabled" disabled>
                                                Próximamente
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <FontAwesomeIcon icon={selectedTypeData.icon} />
                            <h3>No hay plantillas disponibles</h3>
                            <p>No se encontraron plantillas para {selectedTypeData.title.toLowerCase()}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentosHub;