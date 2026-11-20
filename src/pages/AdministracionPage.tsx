/**
 * Administración: «Personas» y «Perfiles» (paso 1 de permisos y usuarios, Ivan
 * 2026-11-18). Reemplaza las pestañas Usuarios y Permisos con la misma regla:
 * cómo se ven y se asignan los permisos no cambia lo que nadie puede hacer.
 * Las piezas viven en pages/administracion/.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert } from '@/components/shell/Alert';
import { ErrorState } from '@/components/shell/states';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PestanaPersonas } from './administracion/PestanaPersonas';
import { PestanaPerfiles } from './administracion/PestanaPerfiles';
import type { Perfil, PermisosDePersona, Persona, ProyectoOpcion } from './administracion/tipos';

interface AdministracionPageProps {
  /** Lo que piden las vistas viejas «usuarios» y «permisos»: las dos abren Personas. */
  defaultTab?: 'usuarios' | 'permisos';
}

interface Datos {
  personas: Persona[];
  permisos: Map<number, PermisosDePersona>;
  perfiles: Perfil[];
  proyectos: ProyectoOpcion[];
}

export default function AdministracionPage(_props: AdministracionPageProps) {
  const { user } = useAuth();
  const [pestana, setPestana] = useState<'personas' | 'perfiles'>('personas');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(false);
    try {
      const [usuarios, permisos, perfiles, proyectos] = await Promise.all([
        api.get('/users'),
        api.get('/permissions/users'),
        api.get('/permission-profiles'),
        api.get('/projects?limit=500'),
      ]);
      setDatos({
        personas: usuarios.data.users,
        permisos: new Map((permisos.data.users as PermisosDePersona[]).map((p) => [p.id, p])),
        perfiles: perfiles.data.data,
        proyectos: ((proyectos.data.proyectos ?? []) as { id: number; nombre: string; nombre_corto?: string | null }[])
          .map((p) => ({ id: p.id, nombre: p.nombre_corto || p.nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      });
    } catch (err) {
      console.error('Error cargando la administración:', err);
      setErrorCarga(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const yo = useMemo(() => ({ id: user?.id ?? 0, rol: user?.rol ?? '' }), [user?.id, user?.rol]);

  return (
    <div className="space-y-6">
      <PageHeader title="Administración" />
      {aviso && <Alert variant="warning" title={aviso} />}
      {errorCarga ? (
        <ErrorState title="No se pudo cargar la administración" onRetry={cargar} />
      ) : (
        <Tabs value={pestana} onValueChange={(v) => setPestana(v as 'personas' | 'perfiles')}>
          <TabsList className="mb-6 w-full justify-center">
            <TabsTrigger value="personas">Personas</TabsTrigger>
            <TabsTrigger value="perfiles">Perfiles</TabsTrigger>
          </TabsList>
          <TabsContent value="personas">
            <PestanaPersonas
              personas={datos?.personas ?? []}
              permisos={datos?.permisos ?? new Map()}
              perfiles={datos?.perfiles ?? []}
              proyectos={datos?.proyectos ?? []}
              yo={yo}
              cargando={cargando && !datos}
              onRecargar={() => {
                setAviso('');
                cargar();
              }}
              onAviso={setAviso}
            />
          </TabsContent>
          <TabsContent value="perfiles">
            <PestanaPerfiles
              perfiles={datos?.perfiles ?? []}
              personas={datos?.personas ?? []}
              cargando={cargando && !datos}
              onRecargar={cargar}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
