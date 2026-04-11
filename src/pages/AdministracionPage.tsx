/**
 * AdministracionPage Component
 * Wraps Usuarios and Permisos with shadcn Tabs
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UsuariosPage from './UsuariosPage';
import PermisosPage from './PermisosPage';

interface AdministracionPageProps {
  defaultTab?: 'usuarios' | 'permisos';
  onTabChange?: (tab: string) => void;
}

export default function AdministracionPage({
  defaultTab = 'usuarios',
  onTabChange,
}: AdministracionPageProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administración</h1>
      <Tabs
        defaultValue={defaultTab}
        onValueChange={(value) => onTabChange?.(value)}
      >
        <TabsList className="w-full justify-center">
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios">
          <UsuariosPage />
        </TabsContent>
        <TabsContent value="permisos">
          <PermisosPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
