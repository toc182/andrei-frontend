/**
 * DocumentFormN - Formulario de Documentos migrado a Shadcn/ui
 *
 * Formulario unificado para generar diferentes tipos de documentos PDF:
 * - Acuerdo de Consorcio
 * - Carta de Adhesión a Principios de Sostenibilidad
 * - Declaración Jurada de Medidas de Retorsión
 * - Declaración Jurada de No Incapacidad para Contratar
 * - Pacto de Integridad
 * - Carta de Compromiso Verde
 *
 * Características:
 * - Radio buttons para seleccionar entidad (Pinellas/Consorcio)
 * - Campos dinámicos según tipo de documento
 * - Vista previa HTML en modal
 * - Generación y descarga de PDF
 * - Sin FontAwesome, sin CSS custom
 */

import { useState, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/shell/Alert';
import { AppDialog } from '@/components/shell/AppDialog';
import { Download, Eye, Loader2 } from 'lucide-react';

type DocumentType =
  | 'acuerdo-consorcio'
  | 'carta-adhesion'
  | 'medidas-retorsion'
  | 'no-incapacidad'
  | 'pacto-integridad'
  | 'carta-compromiso-verde';

interface DocumentField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
}

interface DocumentConfig {
  title: string;
  hasEntitySelector: boolean;
  fields: DocumentField[];
}

interface DocumentFormNProps {
  documentType: DocumentType;
}

const DocumentFormN = ({ documentType }: DocumentFormNProps) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Configuration for each document type
  const documentConfig: Record<DocumentType, DocumentConfig> = {
    'acuerdo-consorcio': {
      title: 'Acuerdo de Consorcio',
      hasEntitySelector: false,
      fields: [
        {
          name: 'projectName',
          label: 'Nombre del Proyecto',
          type: 'text',
          required: true,
        },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ],
    },
    'carta-adhesion': {
      title: 'Carta de Adhesión a Principios de Sostenibilidad',
      hasEntitySelector: true,
      fields: [{ name: 'fecha', label: 'Fecha', type: 'date', required: true }],
    },
    'medidas-retorsion': {
      title: 'Declaración Jurada de Medidas de Retorsión',
      hasEntitySelector: true,
      fields: [{ name: 'fecha', label: 'Fecha', type: 'date', required: true }],
    },
    'no-incapacidad': {
      title: 'Declaración Jurada de No Incapacidad para Contratar',
      hasEntitySelector: true,
      fields: [
        {
          name: 'projectName',
          label: 'Nombre del Proyecto',
          type: 'text',
          required: true,
        },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ],
    },
    'pacto-integridad': {
      title: 'Pacto de Integridad',
      hasEntitySelector: true,
      fields: [
        {
          name: 'projectName',
          label: 'Nombre del Proyecto',
          type: 'text',
          required: true,
        },
        {
          name: 'codigoLic',
          label: 'Código de Licitación',
          type: 'text',
          required: true,
        },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ],
    },
    'carta-compromiso-verde': {
      title: 'Carta de Compromiso Verde',
      hasEntitySelector: true,
      fields: [
        {
          name: 'projectName',
          label: 'Nombre del Proyecto',
          type: 'text',
          required: true,
        },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      ],
    },
  };

  const config = documentConfig[documentType];

  if (!config) {
    return (
      <div className="space-y-6">
        <Alert variant="error" title="Tipo de documento no encontrado" description={documentType} />
      </div>
    );
  }

  const handleInputChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    setError('');
  };

  const validateForm = (): boolean => {
    // Check entity selector if required
    if (
      config.hasEntitySelector &&
      (!formData.entity || formData.entity.trim() === '')
    ) {
      setError('Debe seleccionar una entidad');
      return false;
    }

    // Check required fields
    const requiredFields = config.fields.filter((field) => field.required);
    for (const field of requiredFields) {
      if (!formData[field.name] || formData[field.name].trim() === '') {
        setError(`El campo "${field.label}" es requerido`);
        return false;
      }
    }
    return true;
  };

  const formatDateForBackend = (dateString: string) => {
    // Create date from input (YYYY-MM-DD format)
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)); // month is 0-indexed

    const days = [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ];
    const months = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    return {
      day: days[date.getDay()],
      dayOfMonth: date.getDate().toString(),
      month: months[date.getMonth()],
      year: date.getFullYear().toString(),
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
      let backendData: Record<string, string> = { ...formData };

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
        const entitySuffix =
          formData.entity === 'consorcio' ? 'consorcio' : 'pinellas';
        const docTypeMap: Record<string, string> = {
          'carta-adhesion': 'adhesion',
          'medidas-retorsion': 'retorsion',
          'no-incapacidad': 'incapacidad',
          'pacto-integridad': 'integridad',
          'carta-compromiso-verde': 'compromiso-verde',
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
    } catch (err) {
      console.error('Error generating preview:', err);
      setError('Error al generar la vista previa. Por favor intenta de nuevo.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare data for backend
      let backendData: Record<string, string> = { ...formData };

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
        const entitySuffix =
          formData.entity === 'consorcio' ? 'consorcio' : 'pinellas';
        const docTypeMap: Record<string, string> = {
          'carta-adhesion': 'adhesion',
          'medidas-retorsion': 'retorsion',
          'no-incapacidad': 'incapacidad',
          'pacto-integridad': 'integridad',
          'carta-compromiso-verde': 'compromiso-verde',
        };
        const docType = docTypeMap[documentType];
        endpoint = `${docType}-${entitySuffix}-pdf`;
      }

      const response = await api.post(`/documents/${endpoint}`, backendData, {
        responseType: 'blob',
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
    } catch (err) {
      console.error('Error generating document:', err);
      setError('Error al generar el documento. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Entity Selector */}
            {config.hasEntitySelector && (
              <div className="space-y-3">
                <Label>Seleccionar Entidad *</Label>
                <RadioGroup
                  value={formData.entity || ''}
                  onValueChange={(value) => handleInputChange('entity', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pinellas" id="pinellas" />
                    <Label
                      htmlFor="pinellas"
                      className="font-normal cursor-pointer"
                    >
                      Pinellas S.A.
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="consorcio" id="consorcio" />
                    <Label
                      htmlFor="consorcio"
                      className="font-normal cursor-pointer"
                    >
                      Consorcio
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Dynamic Fields */}
            {config.fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                {field.type === 'date' ? (
                  <Input
                    type="date"
                    id={field.name}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange(field.name, e.target.value)
                    }
                    required={field.required}
                  />
                ) : field.name === 'projectName' ? (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      handleInputChange(field.name, e.target.value)
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={2}
                  />
                ) : (
                  <Input
                    type={field.type}
                    id={field.name}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange(field.name, e.target.value)
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </div>
            ))}

            {/* Error Message */}
            {error && (
              <Alert variant="error" title={error} />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={loadingPreview || loading}
              >
                {loadingPreview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Vista Previa
                  </>
                )}
              </Button>
              <Button type="submit" disabled={loading || loadingPreview}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Generar PDF
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <AppDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        size="complex"
        title={`Vista Previa - ${config.title}`}
        footer={
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            Cerrar
          </Button>
        }
      >
        <div
          className="preview-content p-4 bg-white text-black"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </AppDialog>
    </div>
  );
};

export default DocumentFormN;
