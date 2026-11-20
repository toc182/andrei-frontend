// La ficha de una persona: Perfil y Proyectos lado a lado, Permisos, Datos y
// «Desactivar cuenta» (mock aprobado, versión 5). Guarda lo mismo que guardaban
// las dos pestañas de antes (Usuarios y Permisos), con las mismas rutas:
// PUT /users/:id, PUT /permissions/:id y PUT /permissions/:id/projects.
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { SectionHeader } from '@/components/shell/SectionHeader';
import { LLAVES_DE_PERFIL, type Llave, type Permisos } from './catalogo';
import { TablaPermisos } from './TablaPermisos';
import { SelectorProyectos } from './SelectorProyectos';
import {
  mensajeDeError,
  type EleccionPerfil,
  type Perfil,
  type PermisosDePersona,
  type Persona,
  type ProyectoOpcion,
  type Rol,
} from './tipos';

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().trim().email('Correo inválido'),
  // Sin formato obligatorio: el servidor lo deja como Meta lo manda y devuelve
  // el motivo si no puede.
  whatsapp: z.string().optional(),
  password: z.string().optional(),
});
type Datos = z.infer<typeof esquema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = persona nueva. */
  persona: Persona | null;
  permisosPersona?: PermisosDePersona;
  perfiles: Perfil[];
  proyectos: ProyectoOpcion[];
  yo: { id: number; rol: string };
  onGuardado: () => void;
  /** Para avisar en la página lo que salió a medias después de crear a alguien. */
  onAviso: (texto: string) => void;
}

/** Las llaves de casilla de la persona; lo que no tiene valor cuenta como no. */
function permisosDe(fila: PermisosDePersona | undefined): Permisos {
  const p: Permisos = {};
  // Sin fila en user_permissions la persona no puede nada: así se muestra.
  for (const k of LLAVES_DE_PERFIL) p[k] = fila?.[k] === true;
  return p;
}

function permisosDelPerfil(perfil: Perfil): Permisos {
  const p: Permisos = {};
  for (const k of LLAVES_DE_PERFIL) p[k] = perfil.llaves.includes(k);
  return p;
}

export function FichaPersona({
  open, onOpenChange, persona, permisosPersona, perfiles, proyectos, yo, onGuardado, onAviso,
}: Props) {
  const nueva = persona === null;
  const esDueno = persona?.rol === 'admin';
  const soyYo = persona?.id === yo.id;

  const eleccionInicial = (): EleccionPerfil => {
    if (persona?.rol === 'co-admin') return 'gerencia';
    const id = permisosPersona?.permission_profile_id;
    return id && perfiles.some((p) => p.id === id) ? id : 'personalizado';
  };

  const [eleccion, setEleccion] = useState<EleccionPerfil>(eleccionInicial);
  // Una cuenta nueva nace como la crea el servidor: «Ver equipos» encendido.
  const [permisos, setPermisos] = useState<Permisos>(() =>
    nueva ? { ...permisosDe(undefined), equipos_ver: true } : permisosDe(permisosPersona),
  );
  const [todos, setTodos] = useState<boolean>(!!permisosPersona?.acceso_global);
  const [elegidos, setElegidos] = useState<number[]>(permisosPersona?.proyectos ?? []);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarActivo, setConfirmarActivo] = useState(false);

  const form = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: persona?.nombre ?? '',
      email: persona?.email ?? '',
      whatsapp: persona?.whatsapp ?? '',
      password: '',
    },
  });

  // Cada vez que se abre, desde lo que hay guardado.
  useEffect(() => {
    if (!open) return;
    setEleccion(eleccionInicial());
    setPermisos(nueva ? { ...permisosDe(undefined), equipos_ver: true } : permisosDe(permisosPersona));
    setTodos(!!permisosPersona?.acceso_global);
    setElegidos(permisosPersona?.proyectos ?? []);
    setError('');
    form.reset({
      nombre: persona?.nombre ?? '',
      email: persona?.email ?? '',
      whatsapp: persona?.whatsapp ?? '',
      password: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, persona?.id]);

  const elegirPerfil = (valor: string) => {
    if (valor === 'gerencia' || valor === 'personalizado') {
      setEleccion(valor);
      return;
    }
    const perfil = perfiles.find((p) => p.id === Number(valor));
    if (!perfil) return;
    setEleccion(perfil.id);
    setPermisos(permisosDelPerfil(perfil));
  };

  // Cambiar cualquier casilla deja el perfil en «Personalizado», solo y sin
  // avisos (Ivan, 2026-10-07).
  const cambiarPermiso = (llave: Llave) => {
    setPermisos((p) => ({ ...p, [llave]: !p[llave] }));
    if (typeof eleccion === 'number') setEleccion('personalizado');
  };

  const gerencia = eleccion === 'gerencia';
  const corto = (persona?.nombre ?? '').split(' ')[0] || 'esta persona';
  const valorSelect = typeof eleccion === 'number' ? String(eleccion) : eleccion;
  const perfilesOrdenados = useMemo(() => [...perfiles].sort((a, b) => a.nombre.localeCompare(b.nombre)), [perfiles]);

  const cuerpoPermisos = () => {
    const cuerpo: Record<string, unknown> = { acceso_global: todos };
    for (const k of LLAVES_DE_PERFIL) cuerpo[k] = !!permisos[k];
    cuerpo.permission_profile_id = typeof eleccion === 'number' ? eleccion : null;
    return cuerpo;
  };

  const guardarAcceso = async (id: number) => {
    await api.put(`/permissions/${id}`, cuerpoPermisos());
    await api.put(`/permissions/${id}/projects`, { projectIds: elegidos });
  };

  const guardar = async (datos: Datos) => {
    setError('');
    if (nueva && (!datos.password || datos.password.length < 6)) {
      form.setError('password', { message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    const rol: Rol = esDueno ? 'admin' : gerencia ? 'co-admin' : 'usuario';
    setGuardando(true);
    try {
      if (nueva) {
        const creada = await api.post('/users', {
          nombre: datos.nombre,
          email: datos.email,
          password: datos.password,
          rol,
          tipo_usuario: 'interno',
        });
        const id = creada.data.user.id as number;
        // Ya existe: si algo de aquí en adelante falla, se avisa en la página
        // para que se abra y se vuelva a guardar.
        let faltó = '';
        try {
          if (datos.whatsapp?.trim()) await api.put(`/users/${id}`, { whatsapp: datos.whatsapp });
          if (rol === 'usuario') await guardarAcceso(id);
        } catch (err) {
          faltó = `${datos.nombre} se creó, pero no se guardó todo: ${mensajeDeError(err, 'error del servidor')}. Ábrela y vuelve a guardar.`;
        }
        onOpenChange(false);
        onGuardado();
        if (faltó) onAviso(faltó);
        return;
      }

      await api.put(`/users/${persona.id}`, {
        nombre: datos.nombre,
        email: datos.email,
        whatsapp: datos.whatsapp ?? '',
        rol,
      });
      if (rol === 'usuario') await guardarAcceso(persona.id);
      onOpenChange(false);
      onGuardado();
    } catch (err) {
      setError(mensajeDeError(err, nueva ? 'Error al crear la persona' : 'Error al guardar'));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarActivo = async () => {
    if (!persona) return;
    setGuardando(true);
    try {
      await api.delete(`/users/${persona.id}`);
      setConfirmarActivo(false);
      onOpenChange(false);
      onGuardado();
    } catch (err) {
      setConfirmarActivo(false);
      setError(mensajeDeError(err, 'Error al cambiar la cuenta'));
    } finally {
      setGuardando(false);
    }
  };

  const seccionDatos = (
    <div>
      <SectionHeader title="Datos" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Nombre completo" disabled={guardando} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo</FormLabel>
              <FormControl>
                <Input type="email" placeholder="correo@pinellaspanama.com" disabled={guardando} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
              </FormLabel>
              <FormControl>
                <Input type="tel" inputMode="tel" placeholder="6000-0000" disabled={guardando} {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Desde este número podrá usar el asistente. Si no es de Panamá, escribe el código del país.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        {nueva && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña inicial</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Mínimo 6 caracteres" disabled={guardando} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      {!nueva && !soyYo && !esDueno && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
          <span>
            {persona.activo
              ? `Si ${corto} ya no trabaja aquí, desactiva la cuenta: deja de poder entrar y no se borra nada.`
              : 'Esta cuenta está desactivada: no puede entrar.'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={guardando}
            onClick={() => setConfirmarActivo(true)}
            className={persona.activo ? 'text-error hover:text-error' : undefined}
          >
            {persona.activo ? 'Desactivar cuenta' : 'Volver a activar'}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="complex"
        cerrarSoloConBoton
        title={nueva ? 'Nueva persona' : persona.nombre}
        description={nueva ? 'Alguien que va a entrar al sistema' : (persona.email ?? undefined)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" form="ficha-persona" disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nueva ? 'Crear persona' : 'Guardar'}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="ficha-persona" onSubmit={form.handleSubmit(guardar)} className="space-y-6">
            {error && <Alert variant="error" title={error} />}
            {nueva && seccionDatos}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <SectionHeader title="Perfil" />
                {esDueno ? (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    Dueño
                  </div>
                ) : (
                  <Select value={valorSelect} onValueChange={elegirPerfil} disabled={soyYo || guardando}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {perfilesOrdenados.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                      ))}
                      {perfilesOrdenados.length > 0 && <SelectSeparator />}
                      <SelectItem value="gerencia">Gerencia</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {soyYo && !esDueno && (
                  <p className="mt-1.5 text-xs text-muted-foreground">Nadie cambia su propio perfil.</p>
                )}
              </div>
              <div>
                <SectionHeader title="Proyectos" />
                <SelectorProyectos
                  proyectos={proyectos}
                  todos={todos}
                  elegidos={elegidos}
                  fijoEnTodos={esDueno || gerencia}
                  onCambiar={(t, e) => {
                    setTodos(t);
                    setElegidos(e);
                  }}
                />
              </div>
            </div>

            <div>
              <SectionHeader title="Permisos" />
              {esDueno ? (
                <Alert variant="info" title="El dueño puede todo, en todos los proyectos." />
              ) : (
                <div className="space-y-3">
                  {gerencia && (
                    <Alert
                      variant="info"
                      title="Gerencia puede todo, en todos los proyectos."
                      description="Para quitarle algo, elige otro perfil."
                    />
                  )}
                  <TablaPermisos permisos={permisos} onCambiar={cambiarPermiso} bloqueada={gerencia} />
                </div>
              )}
            </div>

            {!nueva && seccionDatos}
          </form>
        </Form>
      </AppDialog>

      <AppDialog
        open={confirmarActivo}
        onOpenChange={setConfirmarActivo}
        size="confirm"
        title={persona?.activo ? 'Desactivar cuenta' : 'Volver a activar la cuenta'}
        description={
          persona?.activo
            ? `${corto} deja de poder entrar. No se borra nada.`
            : `${corto} podrá volver a entrar al sistema.`
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmarActivo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={persona?.activo ? 'destructive' : 'default'}
              onClick={cambiarActivo}
              disabled={guardando}
            >
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {persona?.activo ? 'Desactivar' : 'Activar'}
            </Button>
          </>
        }
      />
    </>
  );
}
