/**
 * AdministracionPage Component
 * Wraps Usuarios and Permisos with shadcn Tabs
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shell/PageHeader';
import UsuariosPage from './UsuariosPage';
import PermisosPage from './PermisosPage';

interface AdministracionPageProps {
  defaultTab?: 'usuarios' | 'permisos';
}

export default function AdministracionPage({
  defaultTab = 'usuarios',
}: AdministracionPageProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div>
      <PageHeader title="Administración" />
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-6 w-full justify-center">
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" forceMount className={activeTab !== 'usuarios' ? 'hidden' : ''}>
          <UsuariosPage />
        </TabsContent>
        <TabsContent value="permisos" forceMount className={activeTab !== 'permisos' ? 'hidden' : ''}>
          <PermisosPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
