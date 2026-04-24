/**
 * PermisosPage — Gestión de permisos individuales por usuario
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppDialog } from '@/components/shell/AppDialog';
import { TableSkeleton } from '@/components/shell/states';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Settings } from 'lucide-react';
import api from '../services/api';
import type { UserPermissions } from '@/types/api';

interface PermUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  acceso_global: boolean | null;
  proyectos_crear: boolean | null;
  proyectos_editar: boolean | null;
  proyectos_eliminar: boolean | null;
  clientes_agregar: boolean | null;
  clientes_editar: boolean | null;
  clientes_eliminar: boolean | null;
  solicitudes_editar_todas: boolean | null;
  requisiciones_editar_todas: boolean | null;
  equipos_ver: boolean | null;
  equipos_agregar: boolean | null;
  equipos_editar: boolean | null;
  equipos_eliminar: boolean | null;
  equipos_asignacion: boolean | null;
  equipos_uso: boolean | null;
  equipos_editar_asignacion: boolean | null;
  documentos_acceso: boolean | null;
  oportunidades_ver: boolean | null;
  registrar_pago: boolean | null;
  caja_menuda: boolean | null;
  cuentas: boolean | null;
}

interface ProjectOption {
  id: number;
  nombre: string;
}

interface AssignedProject {
  proyecto_id: number;
  nombre: string;
}

const DEFAULT_PERMS: UserPermissions = {
  acceso_global: false,
  proyectos_crear: false,
  proyectos_editar: false,
  proyectos_eliminar: false,
  clientes_agregar: false,
  clientes_editar: false,
  clientes_eliminar: false,
  solicitudes_editar_todas: false,
  requisiciones_editar_todas: false,
  equipos_ver: true,
  equipos_agregar: false,
  equipos_editar: false,
  equipos_eliminar: false,
  equipos_asignacion: false,
  equipos_uso: false,
  equipos_editar_asignacion: false,
  documentos_acceso: false,
  oportunidades_ver: false,
  registrar_pago: false,
  caja_menuda: false,
  cuentas: false,
};

export default function PermisosPage() {
  const [users, setUsers] = useState<PermUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PermUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [perms, setPerms] = useState<UserPermissions>(DEFAULT_PERMS);
  const [assignedProjects, setAssignedProjects] = useState<number[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/permissions/users');
      if (res.data.success) setUsers(res.data.users);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openUserDialog = async (user: PermUser) => {
    setSelectedUser(user);

    // Set perms from user data (or defaults)
    const p: UserPermissions = { ...DEFAULT_PERMS };
    for (const key of Object.keys(DEFAULT_PERMS) as (keyof UserPermissions)[]) {
      if (user[key] !== null && user[key] !== undefined) {
        p[key] = user[key] as boolean;
      }
    }
    setPerms(p);

    // Load assigned projects
    try {
      const [projRes, assignedRes] = await Promise.all([
        api.get('/projects?limit=500'),
        api.get(`/permissions/${user.id}/projects`),
      ]);
      if (projRes.data.proyectos) {
        setAllProjects(
          projRes.data.proyectos.map((p: { id: number; nombre: string; nombre_corto?: string }) => ({
            id: p.id,
            nombre: p.nombre_corto || p.nombre,
          })),
        );
      }
      if (assignedRes.data.success) {
        setAssignedProjects(
          assignedRes.data.projects.map((p: AssignedProject) => p.proyecto_id),
        );
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    }

    setShowDialog(true);
  };

  const togglePerm = (key: keyof UserPermissions) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleProject = (projectId: number) => {
    setAssignedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      await Promise.all([
        api.put(`/permissions/${selectedUser.id}`, perms),
        api.put(`/permissions/${selectedUser.id}/projects`, {
          projectIds: assignedProjects,
        }),
      ]);
      setShowDialog(false);
      loadUsers();
    } catch (err) {
      console.error('Error guardando permisos:', err);
    } finally {
      setSaving(false);
    }
  };

  const countPerms = (user: PermUser): number => {
    let count = 0;
    for (const key of Object.keys(DEFAULT_PERMS) as (keyof UserPermissions)[]) {
      if (key === 'acceso_global' || key === 'equipos_ver') continue;
      if (user[key]) count++;
    }
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Desktop table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usuario</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rol</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceso</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permisos</TableHead>
                <TableHead className="w-[100px] px-4 py-2.5"></TableHead>
              </TableRow>
            </TableHeader>
            {loading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : (
              <TableBody>
                {users
                  .filter((u) => u.activo)
                  .map((user) => (
                    <TableRow key={user.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60">
                      <TableCell className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={
                          user.rol === 'co-admin'
                            ? 'bg-warning/10 text-warning border-warning/30 border'
                            : 'bg-slate-100 text-slate-600 border-slate-200 border'
                        }>
                          {user.rol}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {user.rol === 'co-admin' ? (
                          <Badge className="bg-success/10 text-success border-success/30 border">
                            Completo
                          </Badge>
                        ) : user.acceso_global ? (
                          <Badge className="bg-info/10 text-info border-info/30 border">
                            Global
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">Limitado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {user.rol === 'co-admin' ? (
                          <span className="text-xs text-muted-foreground">
                            Todos
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {countPerms(user)} activos
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {user.rol !== 'co-admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUserDialog(user)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            )}
          </Table>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {users
          .filter((u) => u.activo)
          .map((user) => (
            <Card
              key={user.id}
              className="cursor-pointer"
              onClick={() => user.rol !== 'co-admin' && openUserDialog(user)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {user.nombre}
                  </CardTitle>
                  <Badge
                    className={`text-xs ${
                      user.rol === 'co-admin'
                        ? 'bg-warning/10 text-warning border-warning/30 border'
                        : 'bg-slate-100 text-slate-600 border-slate-200 border'
                    }`}
                  >
                    {user.rol}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs">
                    {user.rol === 'co-admin'
                      ? 'Acceso completo'
                      : user.acceso_global
                        ? 'Acceso global'
                        : 'Acceso limitado'}
                  </span>
                  {user.rol !== 'co-admin' && (
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Dialog de permisos */}
      <AppDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        size="simple"
        title={`Permisos — ${selectedUser?.nombre ?? ''}`}
        description="Configura los permisos del usuario"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Guardar
            </Button>
          </>
        }
      >
            <div className="space-y-6">
              {/* Acceso Global */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Acceso Global</Label>
                  <p className="text-xs text-muted-foreground">
                    Ve todos los proyectos sin restricción
                  </p>
                </div>
                <Switch
                  checked={perms.acceso_global}
                  onCheckedChange={() => togglePerm('acceso_global')}
                />
              </div>

              <Separator />

              {/* Proyectos asignados (solo si NO es global) */}
              {!perms.acceso_global && (
                <>
                  <div>
                    <Label className="text-sm font-medium">
                      Proyectos Asignados
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Selecciona los proyectos a los que tiene acceso
                    </p>
                    <div className="space-y-2">
                      {allProjects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`proj-${project.id}`}
                            checked={assignedProjects.includes(project.id)}
                            onCheckedChange={() => toggleProject(project.id)}
                          />
                          <Label
                            htmlFor={`proj-${project.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {project.nombre}
                          </Label>
                        </div>
                      ))}
                      {allProjects.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No hay proyectos disponibles
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Proyectos CRUD */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Proyectos
                </Label>
                <div className="space-y-2">
                  <PermCheckbox
                    label="Crear proyectos"
                    checked={perms.proyectos_crear}
                    onChange={() => togglePerm('proyectos_crear')}
                  />
                  <PermCheckbox
                    label="Editar proyectos"
                    checked={perms.proyectos_editar}
                    onChange={() => togglePerm('proyectos_editar')}
                  />
                  <PermCheckbox
                    label="Eliminar proyectos"
                    checked={perms.proyectos_eliminar}
                    onChange={() => togglePerm('proyectos_eliminar')}
                  />
                </div>
              </div>

              <Separator />

              {/* Clientes */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Clientes
                </Label>
                <div className="space-y-2">
                  <PermCheckbox
                    label="Agregar clientes"
                    checked={perms.clientes_agregar}
                    onChange={() => togglePerm('clientes_agregar')}
                  />
                  <PermCheckbox
                    label="Editar clientes"
                    checked={perms.clientes_editar}
                    onChange={() => togglePerm('clientes_editar')}
                  />
                  <PermCheckbox
                    label="Eliminar clientes"
                    checked={perms.clientes_eliminar}
                    onChange={() => togglePerm('clientes_eliminar')}
                  />
                </div>
              </div>

              <Separator />

              {/* Solicitudes y Requisiciones */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Solicitudes y Requisiciones
                </Label>
                <div className="space-y-2">
                  <PermCheckbox
                    label="Editar todas las solicitudes de pago"
                    checked={perms.solicitudes_editar_todas}
                    onChange={() => togglePerm('solicitudes_editar_todas')}
                  />
                  <PermCheckbox
                    label="Editar todas las requisiciones"
                    checked={perms.requisiciones_editar_todas}
                    onChange={() => togglePerm('requisiciones_editar_todas')}
                  />
                  <PermCheckbox
                    label="Registrar pagos y facturas"
                    checked={perms.registrar_pago}
                    onChange={() => togglePerm('registrar_pago')}
                  />
                  <PermCheckbox
                    label="Acceso a cajas menudas"
                    checked={perms.caja_menuda}
                    onChange={() => togglePerm('caja_menuda')}
                  />
                  <PermCheckbox
                    label="Acceso a cuentas"
                    checked={perms.cuentas}
                    onChange={() => togglePerm('cuentas')}
                  />
                </div>
              </div>

              <Separator />

              {/* Equipos */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Equipos
                </Label>
                <div className="space-y-2">
                  <PermCheckbox
                    label="Ver equipos"
                    checked={perms.equipos_ver}
                    onChange={() => togglePerm('equipos_ver')}
                  />
                  <PermCheckbox
                    label="Agregar equipos"
                    checked={perms.equipos_agregar}
                    onChange={() => togglePerm('equipos_agregar')}
                  />
                  <PermCheckbox
                    label="Editar equipos"
                    checked={perms.equipos_editar}
                    onChange={() => togglePerm('equipos_editar')}
                  />
                  <PermCheckbox
                    label="Eliminar equipos"
                    checked={perms.equipos_eliminar}
                    onChange={() => togglePerm('equipos_eliminar')}
                  />
                  <PermCheckbox
                    label="Gestionar asignaciones"
                    checked={perms.equipos_asignacion}
                    onChange={() => togglePerm('equipos_asignacion')}
                  />
                  <PermCheckbox
                    label="Registrar uso"
                    checked={perms.equipos_uso}
                    onChange={() => togglePerm('equipos_uso')}
                  />
                  <PermCheckbox
                    label="Editar asignaciones"
                    checked={perms.equipos_editar_asignacion}
                    onChange={() => togglePerm('equipos_editar_asignacion')}
                  />
                </div>
              </div>

              <Separator />

              {/* Documentos y Oportunidades */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Otros</Label>
                <div className="space-y-2">
                  <PermCheckbox
                    label="Acceso a documentos"
                    checked={perms.documentos_acceso}
                    onChange={() => togglePerm('documentos_acceso')}
                  />
                  <PermCheckbox
                    label="Ver oportunidades"
                    checked={perms.oportunidades_ver}
                    onChange={() => togglePerm('oportunidades_ver')}
                  />
                </div>
              </div>
            </div>
      </AppDialog>
    </div>
  );
}

function PermCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <Label className="text-sm font-normal cursor-pointer" onClick={onChange}>
        {label}
      </Label>
    </div>
  );
}
