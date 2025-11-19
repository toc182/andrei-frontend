import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * DocumentosHubN - Página de Documentos migrada a Shadcn/ui
 *
 * Lista de documentos disponibles para generar.
 * Sin FontAwesome, sin CSS custom, 100% Shadcn + Tailwind
 */

const DocumentosHubN = ({ onDocumentClick }) => {
    // Lista de documentos disponibles
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
        if (onDocumentClick) {
            onDocumentClick(documentId);
        } else {
            // Fallback: simular clic en el sidebar
            window.location.hash = documentId;
        }
    };

    return (
        <div className="rounded-md border">
            <div className="divide-y">
                {availableDocuments.map((doc) => (
                    <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleDocumentClick(doc.id)}
                    >
                        <h3 className="font-medium">{doc.title}</h3>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DocumentosHubN;
