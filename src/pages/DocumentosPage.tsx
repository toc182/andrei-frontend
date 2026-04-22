/**
 * DocumentosPage Component
 * Document forms with Select dropdown to switch between types
 */

import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DocumentFormN from '../components/forms/DocumentFormN';

interface DocumentosPageProps {
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
}

const documentTypes = [
  { value: 'acuerdo-consorcio', label: 'Acuerdo Consorcio' },
  { value: 'carta-adhesion', label: 'Carta Adhesión' },
  { value: 'medidas-retorsion', label: 'Medidas Retorsión' },
  { value: 'no-incapacidad', label: 'No Incapacidad' },
  { value: 'pacto-integridad', label: 'Pacto Integridad' },
  { value: 'carta-compromiso-verde', label: 'Compromiso Verde' },
];

export default function DocumentosPage({
  defaultTab = 'acuerdo-consorcio',
  onTabChange,
}: DocumentosPageProps) {
  const [selected, setSelected] = useState(defaultTab);

  const handleChange = (value: string) => {
    setSelected(value);
    onTabChange?.(value);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={documentTypes.find((d) => d.value === selected)?.label ?? 'Documentos'}
      >
        <Select value={selected} onValueChange={handleChange}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {documentTypes.map((doc) => (
              <SelectItem key={doc.value} value={doc.value}>
                {doc.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>
      <DocumentFormN documentType={selected} />
    </div>
  );
}
