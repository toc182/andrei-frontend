/**
 * Las áreas de trabajo del proyecto, las que el reporte diario puede señalar.
 *
 * Vive dentro de Reportes y no en la información del proyecto, porque es
 * lo único para lo que se usan.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { Area } from './tipos';

interface Props {
  projectId: number;
  abierto: boolean;
  onCerrar: () => void;
  /** Se llama al cerrar, para que el formulario recargue su lista. */
  onCambios: () => void;
}

export default function AreasDialog({ projectId, abierto, onCerrar, onCambios }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(false);
  const [nueva, setNueva] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [porBorrar, setPorBorrar] = useState<Area | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [hubocambios, setHuboCambios] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api
      .get(`/proyecto-areas/${projectId}`)
      .then((r) => setAreas(r.data.data ?? []))
      .catch(() => toast.error('No se pudieron cargar las áreas'))
      .finally(() => setCargando(false));
  }, [projectId]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  const fallo = (e: unknown, porDefecto: string) => {
    const err = e as { response?: { data?: { message?: string } } };
    toast.error(err.response?.data?.message ?? porDefecto);
  };

  const agregar = async () => {
    const nombre = nueva.trim();
    if (!nombre) return;
    setOcupado(true);
    try {
      await api.post(`/proyecto-areas/${projectId}`, { nombre });
      setNueva('');
      setHuboCambios(true);
      cargar();
    } catch (e) {
      fallo(e, 'No se pudo agregar el área');
    } finally {
      setOcupado(false);
    }
  };

  const renombrar = async (id: number) => {
    const nombre = nombreEditado.trim();
    if (!nombre) return;
    setOcupado(true);
    try {
      await api.put(`/proyecto-areas/${projectId}/${id}`, { nombre });
      setEditandoId(null);
      setHuboCambios(true);
      cargar();
    } catch (e) {
      fallo(e, 'No se pudo renombrar el área');
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    if (!porBorrar) return;
    setOcupado(true);
    try {
      await api.delete(`/proyecto-areas/${projectId}/${porBorrar.id}`);
      setPorBorrar(null);
      setHuboCambios(true);
      cargar();
    } catch (e) {
      fallo(e, 'No se pudo quitar el área');
    } finally {
      setOcupado(false);
    }
  };

  const cerrar = () => {
    if (hubocambios) onCambios();
    setHuboCambios(false);
    onCerrar();
  };

  return (
    <>
      <AppDialog
        open={abierto}
        onOpenChange={(v) => { if (!v) cerrar(); }}
        title="Áreas del proyecto"
        description="Las zonas de la obra que el ingeniero puede señalar en su reporte diario."
        size="md"
      >
        <div className="space-y-4">
          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este proyecto todavía no tiene áreas. Agrega la primera abajo.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-border">
              {areas.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                  {editandoId === a.id ? (
                    <>
                      <Input
                        autoFocus
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renombrar(a.id);
                          if (e.key === 'Escape') setEditandoId(null);
                        }}
                        className="h-8"
                      />
                      <Button
                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                        aria-label="Guardar" disabled={ocupado}
                        onClick={() => renombrar(a.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                        aria-label="Cancelar" onClick={() => setEditandoId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{a.nombre}</span>
                      <Button
                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                        aria-label={`Renombrar ${a.nombre}`}
                        onClick={() => { setEditandoId(a.id); setNombreEditado(a.nombre); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-error"
                        aria-label={`Quitar ${a.nombre}`}
                        onClick={() => setPorBorrar(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={nueva}
              placeholder="Nombre del área…"
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
            />
            <Button onClick={agregar} disabled={ocupado || !nueva.trim()}>
              {ocupado
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Plus className="mr-2 h-4 w-4" />}
              Agregar
            </Button>
          </div>
        </div>
      </AppDialog>

      <AlertDialog open={!!porBorrar} onOpenChange={(v) => { if (!v) setPorBorrar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar “{porBorrar?.nombre}”</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de ofrecerse en reportes nuevos. Los reportes que ya la mencionan
              la siguen mostrando.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
