/**
 * EquiposPage Component
 * Wraps Información, Status, and Asignaciones with shadcn Tabs
 */

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import EquiposInformacionN from './equipos/EquiposInformacionN';
import EquiposStatusN from './equipos/EquiposStatusN';
import AsignacionesEquiposN from './equipos/AsignacionesEquiposN';

interface EquiposPageProps {
  defaultTab?: 'informacion' | 'status' | 'asignaciones';
}

const tabButtons: Record<string, string> = {
  informacion: 'Agregar Equipo',
  asignaciones: 'Nueva Asignación',
};

export default function EquiposPage({
  defaultTab = 'informacion',
}: EquiposPageProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [actionHandler, setActionHandler] = useState<(() => void) | null>(null);

  const handleRegisterAction = useCallback((handler: (() => void) | null) => {
    setActionHandler(() => handler);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const buttonLabel = tabButtons[activeTab];

  return (
    <div>
      <PageHeader
        title="Equipos"
        subtitle="Administra equipos y asignaciones"
      >
        {buttonLabel && actionHandler && (
          <Button onClick={actionHandler}>
            <Plus className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        )}
      </PageHeader>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabsList className="mb-6 w-full justify-center">
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="informacion" forceMount className={activeTab !== 'informacion' ? 'hidden' : ''}>
          <EquiposInformacionN onRegisterAction={activeTab === 'informacion' ? handleRegisterAction : undefined} />
        </TabsContent>
        <TabsContent value="status" forceMount className={activeTab !== 'status' ? 'hidden' : ''}>
          <EquiposStatusN />
        </TabsContent>
        <TabsContent value="asignaciones" forceMount className={activeTab !== 'asignaciones' ? 'hidden' : ''}>
          <AsignacionesEquiposN onRegisterAction={activeTab === 'asignaciones' ? handleRegisterAction : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
