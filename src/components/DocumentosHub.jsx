import React from 'react';

const DocumentosHub = ({ onDocumentClick }) => {
    // Lista de documentos disponibles (basada en el acordeón del sidebar)
    const availableDocuments = [
        {
            id: 'doc-acuerdo-consorcio',
            title: 'Acuerdo de Consorcio',
            description: 'Documento legal que establece los términos del consorcio'
        },
        {
            id: 'doc-carta-adhesion',
            title: 'Carta de Adhesión',
            description: 'Carta de adhesión a principios de sostenibilidad'
        },
        {
            id: 'doc-medidas-retorsion',
            title: 'Medidas de Retorsión',
            description: 'Declaración jurada de medidas de retorsión'
        },
        {
            id: 'doc-no-incapacidad',
            title: 'No Incapacidad',
            description: 'Certificación de no incapacidad legal'
        },
        {
            id: 'doc-pacto-integridad',
            title: 'Pacto de Integridad',
            description: 'Compromiso de transparencia en procesos'
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
        <div className="dashboard-content">
            <div className="dashboard-header">
                <h1>Documentos</h1>
                <p>Selecciona el tipo de documento que deseas generar</p>
            </div>

            <div className="documents-container">
                <div className="documents-list">
                    {availableDocuments.map((doc) => (
                        <div
                            key={doc.id}
                            className="document-item"
                            onClick={() => handleDocumentClick(doc.id)}
                        >
                            <div className="document-content">
                                <h3 className="document-title">{doc.title}</h3>
                                <p className="document-description">{doc.description}</p>
                            </div>
                            <div className="document-arrow">
                                <span>→</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DocumentosHub;