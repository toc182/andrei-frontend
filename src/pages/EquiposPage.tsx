/**
 * EquiposPage Component
 * Wraps Información, Status, and Asignaciones with shadcn Tabs
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shell/PageHeader';
import EquiposInformacionN from './equipos/EquiposInformacionN';
import EquiposStatusN from './equipos/EquiposStatusN';
import AsignacionesEquiposN from './equipos/AsignacionesEquiposN';

interface EquiposPageProps {
  defaultTab?: 'informacion' | 'status' | 'asignaciones';
  onTabChange?: (tab: string) => void;
}

export default function EquiposPage({
  defaultTab = 'informacion',
  onTabChange,
}: EquiposPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipos"
        subtitle="Administra equipos y asignaciones"
      />
      <Tabs
        defaultValue={defaultTab}
        onValueChange={(value) => onTabChange?.(value)}
      >
        <TabsList className="w-full justify-center">
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="informacion">
          <EquiposInformacionN />
        </TabsContent>
        <TabsContent value="status">
          <EquiposStatusN />
        </TabsContent>
        <TabsContent value="asignaciones">
          <AsignacionesEquiposN />
        </TabsContent>
      </Tabs>
    </div>
  );
}
