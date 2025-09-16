import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandshake, faEnvelope, faShieldAlt, faUserCheck, faGavel } from '@fortawesome/free-solid-svg-icons';

const DocumentosHub = ({ onDocumentClick }) => {
    // Lista de documentos disponibles (basada en el acordeón del sidebar)
    const availableDocuments = [
        {
            id: 'doc-acuerdo-consorcio',
            title: 'Acuerdo de Consorcio',
            description: 'Documento legal que establece los términos del consorcio',
            icon: faHandshake,
            color: '#2c3e50'
        },
        {
            id: 'doc-carta-adhesion',
            title: 'Carta de Adhesión',
            description: 'Carta de adhesión a principios de sostenibilidad',
            icon: faEnvelope,
            color: '#27ae60'
        },
        {
            id: 'doc-medidas-retorsion',
            title: 'Medidas de Retorsión',
            description: 'Declaración jurada de medidas de retorsión',
            icon: faShieldAlt,
            color: '#e74c3c'
        },
        {
            id: 'doc-no-incapacidad',
            title: 'No Incapacidad',
            description: 'Certificación de no incapacidad legal',
            icon: faUserCheck,
            color: '#f39c12'
        },
        {
            id: 'doc-pacto-integridad',
            title: 'Pacto de Integridad',
            description: 'Compromiso de transparencia en procesos',
            icon: faGavel,
            color: '#9b59b6'
        }
    ];

    const handleDocumentClick = (documentId) => {
        // Si se proporciona la función onDocumentClick, úsala
        if (onDocumentClick) {
            onDocumentClick(documentId);
        } else {
            // Fallback: simular clic en el sidebar
            window.location.hash = documentId;
        }
    };

    return (
        <div className="documents-hub-container">
            <div className="documents-hub-header">
                <h1>Documentos</h1>
                <p>Selecciona el tipo de documento que deseas generar</p>
            </div>

            <div className="documents-grid">
                {availableDocuments.map((doc) => (
                    <div
                        key={doc.id}
                        className="document-card"
                        onClick={() => handleDocumentClick(doc.id)}
                        style={{ borderLeftColor: doc.color }}
                    >
                        <div className="document-card-icon" style={{ color: doc.color }}>
                            <FontAwesomeIcon icon={doc.icon} />
                        </div>
                        <div className="document-card-content">
                            <h3>{doc.title}</h3>
                            <p>{doc.description}</p>
                        </div>
                        <div className="document-card-arrow">
                            →
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DocumentosHub;