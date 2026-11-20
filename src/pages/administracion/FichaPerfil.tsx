// La ficha de un perfil: nombre, para quién y sus permisos. Cambiar los
// permisos de un perfil los cambia para todos los que lo tienen; la ficha lo
// dice con nombres. Gerencia no es un perfil guardado sino el rol co-admin: se
// muestra para ver, sin nada que cambiar.
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { SectionHeader } from '@/components/shell/SectionHeader';
import { LLAVES_DE_PERFIL, type Llave, type Permisos } from './catalogo';
import { TablaPermisos } from './TablaPermisos';
import { mensajeDeError, type Perfil } from './tipos';

const esquema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80, 'Máximo 80 caracteres'),
  descripcion: z.string().trim().optional(),
});
type Datos = z.infer<typeof esquema>;

/** Gerencia, para la ficha: quiénes la tienen. */
export interface GerenciaVista {
  personas: { id: number; nombre: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = perfil nuevo; 'gerencia' = solo para ver. */
  perfil: Perfil | null | 'gerencia';
  gerencia: GerenciaVista;
  onGuardado: () => void;
}

function permisosDe(perfil: Perfil | null): Permisos {
  const p: Permisos = {};
  for (const k of LLAVES_DE_PERFIL) p[k] = !!perfil?.llaves.includes(k);
  return p;
}

export function FichaPerfil({ open, onOpenChange, perfil, gerencia, onGuardado }: Props) {
  const esGerencia = perfil === 'gerencia';
  const guardado = esGerencia ? null : perfil;
  const nuevo = !esGerencia && perfil === null;

  const [permisos, setPermisos] = useState<Permisos>(() => permisosDe(guardado));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const form = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { nombre: guardado?.nombre ?? '', descripcion: guardado?.descripcion ?? '' },
  });

  useEffect(() => {
    if (!open) return;
    setPermisos(permisosDe(guardado));
    setError('');
    form.reset({ nombre: guardado?.nombre ?? '', descripcion: guardado?.descripcion ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guardado?.id]);

  const cambiarPermiso = (llave: Llave) => setPermisos((p) => ({ ...p, [llave]: !p[llave] }));

  const guardar = async (datos: Datos) => {
    setError('');
    setGuardando(true);
    const cuerpo = {
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
      llaves: LLAVES_DE_PERFIL.filter((k) => permisos[k]),
    };
    try {
      if (guardado) await api.put(`/permission-profiles/${guardado.id}`, cuerpo);
      else await api.post('/permission-profiles', cuerpo);
      onOpenChange(false);
      onGuardado();
    } catch (err) {
      setError(mensajeDeError(err, 'Error al guardar el perfil'));
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    if (!guardado) return;
    setGuardando(true);
    try {
      await api.delete(`/permission-profiles/${guardado.id}`);
      setConfirmarQuitar(false);
      onOpenChange(false);
      onGuardado();
    } catch (err) {
      setConfirmarQuitar(false);
      setError(mensajeDeError(err, 'Error al quitar el perfil'));
    } finally {
      setGuardando(false);
    }
  };

  const gente = esGerencia ? gerencia.personas : (guardado?.personas ?? []);
  const nombres = gente.map((p) => p.nombre).join(', ');

  if (esGerencia) {
    return (
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="complex"
        title="Gerencia"
        description="Perfil"
        footer={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="space-y-3">
          <SectionHeader title="Permisos" />
          <Alert
            variant="info"
            title="Gerencia puede todo, en todos los proyectos."
            description={nombres ? `La tienen: ${nombres}.` : 'Nadie la tiene todavía.'}
          />
          <TablaPermisos permisos={permisos} bloqueada />
        </div>
      </AppDialog>
    );
  }

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="complex"
        cerrarSoloConBoton
        title={nuevo ? 'Nuevo perfil' : guardado!.nombre}
        description={nuevo ? 'Un juego de permisos para un puesto' : 'Perfil'}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" form="ficha-perfil" disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nuevo ? 'Crear perfil' : 'Guardar perfil'}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="ficha-perfil" onSubmit={form.handleSubmit(guardar)} className="space-y-6">
            {error && <Alert variant="error" title={error} />}
            <div>
              <SectionHeader title="Perfil" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del perfil</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej.: Ingeniero residente" disabled={guardando} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Para quién <span className="font-normal text-muted-foreground">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Qué hace quien tiene este perfil" disabled={guardando} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeader title="Permisos" />
              {!nuevo && (
                <Alert
                  variant="warning"
                  title={`Lo que cambies aquí cambia para ${gente.length === 1 ? '1 persona' : `${gente.length} personas`}.`}
                  description={nombres || 'Nadie lo tiene todavía.'}
                />
              )}
              <TablaPermisos permisos={permisos} onCambiar={cambiarPermiso} />
            </div>

            {!nuevo && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
                <span>
                  Si este perfil ya no se usa, quítalo: quienes lo tienen se quedan con los mismos permisos, como
                  «Personalizado».
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={guardando}
                  onClick={() => setConfirmarQuitar(true)}
                  className="text-error hover:text-error"
                >
                  Quitar perfil
                </Button>
              </div>
            )}
          </form>
        </Form>
      </AppDialog>

      <AppDialog
        open={confirmarQuitar}
        onOpenChange={setConfirmarQuitar}
        size="confirm"
        title="Quitar perfil"
        description={
          gente.length
            ? `${nombres} se ${gente.length === 1 ? 'queda' : 'quedan'} con los mismos permisos, como «Personalizado».`
            : 'Nadie lo tiene.'
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmarQuitar(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={quitar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Quitar
            </Button>
          </>
        }
      />
    </>
  );
}
