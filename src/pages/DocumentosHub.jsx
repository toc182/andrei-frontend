import React from 'react';
import '../styles/pages/documentos.css';

const DocumentosHub = ({ onDocumentClick }) => {
    // Lista de documentos disponibles (basada en el acordeón del sidebar)
    const availableDocuments = [
        {
            id: 'doc-acuerdo-consorcio',
            title: 'Acuerdo de Consorcio'
        },
        {
            id: 'doc-carta-adhesion',
            title: 'Carta de Adhesión a Principios de Sostenibilidad'
        },
        {
            id: 'doc-medidas-retorsion',
            title: 'Declaración Jurada de Medidas de Retorsión'
        },
        {
            id: 'doc-no-incapacidad',
            title: 'Declaración Jurada de No Incapacidad para Contratar'
        },
        {
            id: 'doc-pacto-integridad',
            title: 'Pacto de Integridad'
        },
        {
            id: 'doc-carta-compromiso-verde',
            title: 'Carta de Compromiso Verde'
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
        <div className="section-container">
            <div className="section-header card-mediano">
                <h1>Documentos</h1>
            </div>

            <div className="documents-main-card card-mediano">
                <div className="documents-list">
                    {availableDocuments.map((doc, index) => (
                        <div key={doc.id}>
                            <div
                                className="document-item-row"
                                onClick={() => handleDocumentClick(doc.id)}
                            >
                                <div className="document-content">
                                    <h3 className="document-title">{doc.title}</h3>
                                </div>
                                <div className="document-arrow">›</div>
                            </div>
                            {index < availableDocuments.length - 1 && (
                                <div className="document-separator"></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DocumentosHub;