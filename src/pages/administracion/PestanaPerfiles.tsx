// «Perfiles»: el juego de permisos de cada puesto. Gerencia va primero: no es
// un perfil guardado sino el rol co-admin, y se abre solo para ver.
import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/shell/states';
import { FichaPerfil } from './FichaPerfil';
import type { Perfil, Persona } from './tipos';

const TH = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

interface Props {
  perfiles: Perfil[];
  personas: Persona[];
  cargando: boolean;
  onRecargar: () => void;
}

interface Fila {
  clave: string;
  nombre: string;
  para: string;
  gente: { nombre: string }[];
  abrir: Perfil | 'gerencia';
}

const corto = (n: string) => n.split(' ')[0];

export function PestanaPerfiles({ perfiles, personas, cargando, onRecargar }: Props) {
  const [abierto, setAbierto] = useState<Perfil | null | 'gerencia' | undefined>(undefined);

  const gerencia = personas.filter((p) => p.rol === 'co-admin' && p.tipo_usuario === 'interno');
  const filas: Fila[] = [
    { clave: 'gerencia', nombre: 'Gerencia', para: 'Puede todo, en todos los proyectos.', gente: gerencia, abrir: 'gerencia' },
    ...[...perfiles]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => ({ clave: String(p.id), nombre: p.nombre, para: p.descripcion ?? '', gente: p.personas, abrir: p })),
  ];
  const quienes = (f: Fila) => f.gente.map((p) => corto(p.nombre)).join(', ');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setAbierto(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo perfil
        </Button>
      </div>

      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className={TH}>Perfil</TableHead>
                <TableHead className={TH}>Para quién</TableHead>
                <TableHead className={TH}>Personas</TableHead>
                <TableHead className="w-10 px-4 py-2.5" />
              </TableRow>
            </TableHeader>
            {cargando ? (
              <TableSkeleton rows={4} columns={4} />
            ) : (
              <TableBody>
                {filas.map((f) => (
                  <TableRow
                    key={f.clave}
                    onClick={() => setAbierto(f.abrir)}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                  >
                    <TableCell className="px-4 py-3 text-sm font-medium text-foreground">{f.nombre}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-700">{f.para}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-700">
                      <span className="tabular-nums">{f.gente.length}</span>
                      {f.gente.length > 0 && ` · ${quienes(f)}`}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-400">
                      <ChevronRight className="h-4 w-4" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        </Card>
      </div>

      <div className="space-y-3 md:hidden">
        {filas.map((f) => (
          <Card key={f.clave} onClick={() => setAbierto(f.abrir)} className="cursor-pointer p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{f.nombre}</div>
                {f.para && <div className="text-xs text-muted-foreground">{f.para}</div>}
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {f.gente.length === 1 ? '1 persona' : `${f.gente.length} personas`}
              {f.gente.length > 0 && `: ${quienes(f)}`}
            </div>
          </Card>
        ))}
      </div>

      {abierto !== undefined && (
        <FichaPerfil
          open
          onOpenChange={(o) => !o && setAbierto(undefined)}
          perfil={abierto}
          gerencia={{ personas: gerencia }}
          onGuardado={onRecargar}
        />
      )}
    </div>
  );
}
