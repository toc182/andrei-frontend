// «Personas»: una sola tabla (Persona · Perfil · Proyectos), sin columna
// «Activo» —solo un distintivo «Desactivada»— y los nombres sin acceso al
// sistema en su propio recuadro abajo (Ivan, 2026-10-02 y mock aprobado).
import { useMemo, useState } from 'react';
import { ChevronRight, Loader2, Plus, Search, Users } from 'lucide-react';
import api from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { EmptyState, TableSkeleton } from '@/components/shell/states';
import { cn } from '@/lib/utils';
import { FichaPersona } from './FichaPersona';
import { mensajeDeError, type Perfil, type PermisosDePersona, type Persona, type ProyectoOpcion } from './tipos';

const NEUTRO = 'bg-slate-100 text-slate-600 border-slate-200 border';
const TH = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

interface Props {
  personas: Persona[];
  permisos: Map<number, PermisosDePersona>;
  perfiles: Perfil[];
  proyectos: ProyectoOpcion[];
  yo: { id: number; rol: string };
  cargando: boolean;
  onRecargar: () => void;
  onAviso: (texto: string) => void;
}

export function PestanaPersonas({ personas, permisos, perfiles, proyectos, yo, cargando, onRecargar, onAviso }: Props) {
  const [buscar, setBuscar] = useState('');
  const [abierta, setAbierta] = useState<Persona | null | undefined>(undefined);
  const [externo, setExterno] = useState<Persona | null | undefined>(undefined);

  const internas = useMemo(() => {
    const orden = (p: Persona) => (p.rol === 'admin' ? 0 : 1) + (p.activo ? 0 : 2);
    return personas
      .filter((p) => p.tipo_usuario === 'interno')
      .sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre));
  }, [personas]);
  const externos = useMemo(
    () => personas.filter((p) => p.tipo_usuario === 'externo').sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [personas],
  );
  const q = buscar.trim().toLowerCase();
  const visibles = q ? internas.filter((p) => `${p.nombre} ${p.email ?? ''}`.toLowerCase().includes(q)) : internas;

  // Un co-admin no toca al dueño (servidor: users.ts).
  const sePuedeAbrir = (p: Persona) => !(p.rol === 'admin' && yo.rol !== 'admin');

  const perfilBadge = (p: Persona) => {
    if (p.rol === 'admin') return <Badge className="bg-navy/10 text-navy border-navy/30 border">Dueño</Badge>;
    if (p.rol === 'co-admin') return <Badge className={NEUTRO}>Gerencia</Badge>;
    const perfil = perfiles.find((x) => x.id === permisos.get(p.id)?.permission_profile_id);
    if (perfil) return <Badge className={NEUTRO}>{perfil.nombre}</Badge>;
    return <Badge className="bg-warning/10 text-warning border-warning/30 border">Personalizado</Badge>;
  };

  const proyectosTexto = (p: Persona) => {
    if (p.rol !== 'usuario') return 'Todos';
    const fila = permisos.get(p.id);
    if (fila?.acceso_global) return 'Todos';
    const nombres = proyectos.filter((x) => fila?.proyectos.includes(x.id)).map((x) => x.nombre);
    if (nombres.length === 0) return '—';
    return nombres.length <= 2 ? nombres.join(', ') : `${nombres.length} proyectos`;
  };

  const desactivada = (p: Persona) =>
    !p.activo && <Badge className={cn(NEUTRO, 'ml-2 align-middle')}>Desactivada</Badge>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar persona…" className="h-9 pl-8" />
        </div>
        <Button onClick={() => setAbierta(null)} className="sm:shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Nueva persona
        </Button>
      </div>

      {/* Computadora */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className={TH}>Persona</TableHead>
                <TableHead className={TH}>Perfil</TableHead>
                <TableHead className={TH}>Proyectos</TableHead>
                <TableHead className="w-10 px-4 py-2.5" />
              </TableRow>
            </TableHeader>
            {cargando ? (
              <TableSkeleton rows={6} columns={4} />
            ) : visibles.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState icon={Users} title={q ? 'Nadie con ese nombre' : 'No hay personas'} />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {visibles.map((p) => {
                  const abre = sePuedeAbrir(p);
                  return (
                    <TableRow
                      key={p.id}
                      onClick={abre ? () => setAbierta(p) : undefined}
                      className={cn(
                        'border-b border-slate-100 transition-colors last:border-0',
                        abre ? 'cursor-pointer hover:bg-slate-50/60' : 'hover:bg-transparent',
                        !p.activo && 'opacity-60',
                      )}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="text-sm font-medium text-foreground">
                          {p.nombre}
                          {desactivada(p)}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3">{perfilBadge(p)}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-slate-700">{proyectosTexto(p)}</TableCell>
                      <TableCell className="px-4 py-3 text-slate-400">
                        {abre && <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </Table>
        </Card>
      </div>

      {/* Teléfono */}
      <div className="space-y-3 md:hidden">
        {!cargando && visibles.length === 0 && (
          <EmptyState icon={Users} title={q ? 'Nadie con ese nombre' : 'No hay personas'} />
        )}
        {visibles.map((p) => {
          const abre = sePuedeAbrir(p);
          return (
            <Card
              key={p.id}
              onClick={abre ? () => setAbierta(p) : undefined}
              className={cn('p-4', abre && 'cursor-pointer', !p.activo && 'opacity-60')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{p.nombre}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                {abre && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {perfilBadge(p)}
                {!p.activo && <Badge className={NEUTRO}>Desactivada</Badge>}
                <span className="text-xs text-muted-foreground">Proyectos: {proyectosTexto(p)}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Nombres sin acceso al sistema */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Nombres sin acceso al sistema</div>
            <div className="text-sm text-muted-foreground">
              Solo aparecen como «Solicitado por» en las solicitudes de pago. No entran al sistema.
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExterno(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar nombre
          </Button>
        </div>
        {externos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {externos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setExterno(p)}
                className="rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground hover:border-slate-300 hover:bg-slate-50"
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}
      </Card>

      {abierta !== undefined && (
        <FichaPersona
          open
          onOpenChange={(o) => !o && setAbierta(undefined)}
          persona={abierta}
          permisosPersona={abierta ? permisos.get(abierta.id) : undefined}
          perfiles={perfiles}
          proyectos={proyectos}
          yo={yo}
          onGuardado={onRecargar}
          onAviso={onAviso}
        />
      )}
      {externo !== undefined && (
        <NombreExterno persona={externo} onCerrar={() => setExterno(undefined)} onGuardado={onRecargar} />
      )}
    </div>
  );
}

/** Agregar o corregir un nombre sin acceso. Como hoy: solo el nombre. */
function NombreExterno({
  persona,
  onCerrar,
  onGuardado,
}: {
  persona: Persona | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(persona?.nombre ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (persona) await api.put(`/users/${persona.id}`, { nombre: nombre.trim() });
      else await api.post('/users', { nombre: nombre.trim(), tipo_usuario: 'externo' });
      onCerrar();
      onGuardado();
    } catch (err) {
      setError(mensajeDeError(err, 'Error al guardar el nombre'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open
      onOpenChange={(o) => !o && onCerrar()}
      size="simple"
      title={persona ? 'Corregir nombre' : 'Agregar nombre'}
      description="Aparece como «Solicitado por» en las solicitudes de pago. No entra al sistema."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="nombre-externo" disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <form id="nombre-externo" onSubmit={guardar} className="space-y-4">
        {error && <Alert variant="error" title={error} />}
        <div className="space-y-1">
          <Label htmlFor="nombre-externo-input">Nombre</Label>
          <Input
            id="nombre-externo-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            disabled={guardando}
            autoFocus
          />
        </div>
      </form>
    </AppDialog>
  );
}
