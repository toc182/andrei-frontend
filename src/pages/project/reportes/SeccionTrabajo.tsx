/**
 * «Trabajo ejecutado» por áreas: los puntos del día, juntados bajo su área.
 *
 * Diseño aprobado por Ivan el 2026-09-25 en mocks sobre la pantalla real:
 *
 * - «+ Añadir trabajo» abre una ventana con las áreas en fichas y lo que se
 *   hizo. Es la misma ventana que la de Entregas, a propósito: el ingeniero ya
 *   la conoce.
 * - Un área que no está en la lista se crea ahí mismo con «+ Área», y queda en
 *   la lista del proyecto para los reportes siguientes.
 * - «General» es para lo que no es de ningún área, como la limpieza de toda la
 *   obra.
 * - Un segundo punto de la misma área no abre otra sección: se agrega como otro
 *   punto debajo de esa área.
 * - El nombre del área va más grande que sus puntos, para encontrarla rápido.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Agregar, Ficha } from './SeccionesFilas';
import { GENERAL, agruparTrabajos, type Area, type Trabajo } from './tipos';

/**
 * Lo que hay en la ventana. `area_id` undefined es que todavía no se escogió;
 * null es «General».
 */
interface Borrador {
  area_id: number | null | undefined;
  texto: string;
}

const VACIO: Borrador = { area_id: undefined, texto: '' };

interface Props {
  areas: Area[];
  trabajos: Trabajo[];
  onTrabajos: (trabajos: Trabajo[]) => void;
  /** Crea el área en el proyecto; devuelve su id, o null si no se pudo. */
  onAgregarArea: (nombre: string) => Promise<number | null>;
  /**
   * Nombres de áreas que ya no están en la lista pero sí en el reporte que se
   * corrige: un área quitada después sigue siendo donde se trabajó ese día.
   */
  nombres?: Record<number, string>;
  bloqueado?: boolean;
}

export function SeccionTrabajo({
  areas, trabajos, onTrabajos, onAgregarArea, nombres = {}, bloqueado = false,
}: Props) {
  // Abierta va aparte de qué punto se escribe: -1 es uno nuevo y un número es
  // el que se corrige. Así, cerrar la ventana sin querer (un toque fuera, la
  // tecla Esc) no borra lo escrito: al volver a «+ Añadir trabajo» sigue ahí.
  // Solo «Cancelar» la vacía.
  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState(-1);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);

  const nombreArea = (id: number | null) =>
    id === null ? GENERAL : areas.find((a) => a.id === id)?.nombre ?? nombres[id] ?? 'Área';

  const abrir = (i: number) => {
    if (bloqueado) return;
    if (i !== -1) setBorrador(trabajos[i]);
    // Lo que quedó en la ventana era la corrección de otro punto, no uno nuevo.
    else if (editando !== -1) setBorrador(VACIO);
    setEditando(i);
    setAbierta(true);
  };

  const cerrar = () => {
    setBorrador(VACIO);
    setEditando(-1);
    setAbierta(false);
  };

  const listo = borrador.area_id !== undefined && borrador.texto.trim() !== '';

  const guardar = () => {
    if (!listo) return;
    const punto: Trabajo = { area_id: borrador.area_id as number | null, texto: borrador.texto.trim() };
    onTrabajos(editando === -1
      ? [...trabajos, punto]
      : trabajos.map((t, i) => (i === editando ? punto : t)));
    cerrar();
  };

  const agregarArea = async (nombre: string) => {
    const id = await onAgregarArea(nombre);
    if (id !== null) setBorrador((b) => ({ ...b, area_id: id }));
  };

  const grupos = agruparTrabajos(trabajos, (t) => nombreArea(t.area_id));

  return (
    <div className="space-y-1">
      {trabajos.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Sin trabajo anotado todavía</p>
      ) : (
        grupos.map((g) => (
          <div key={g.clave} className="border-b border-slate-100 py-2 last:border-0">
            <span className="block text-sm font-semibold text-foreground">{g.nombre}</span>
            <ul className="mt-1 space-y-1">
              {g.indices.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground" aria-hidden="true">•</span>
                  <button
                    type="button"
                    onClick={() => abrir(i)}
                    disabled={bloqueado}
                    className="flex-1 whitespace-pre-wrap text-left text-sm hover:underline"
                  >
                    {trabajos[i].texto}
                  </button>
                  <button
                    type="button"
                    aria-label={`Quitar: ${trabajos[i].texto}`}
                    onClick={() => onTrabajos(trabajos.filter((_, j) => j !== i))}
                    disabled={bloqueado}
                    className="pt-1 text-muted-foreground hover:text-error disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={() => abrir(-1)}
        disabled={bloqueado}
        className="self-start pt-1 text-xs font-semibold text-primary hover:underline"
      >
        + Añadir trabajo
      </button>

      <AppDialog
        open={abierta}
        onOpenChange={(o) => !o && setAbierta(false)}
        size="simple"
        title={editando === -1 ? 'Agregar trabajo' : 'Corregir trabajo'}
        footer={
          <>
            <Button variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!listo}>
              {editando === -1 ? 'Agregar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Área</Label>
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <Ficha
                  key={a.id}
                  activa={borrador.area_id === a.id}
                  onClick={() => setBorrador({ ...borrador, area_id: a.id })}
                >
                  {a.nombre}
                </Ficha>
              ))}
              <Ficha
                activa={borrador.area_id === null}
                onClick={() => setBorrador({ ...borrador, area_id: null })}
              >
                {GENERAL}
              </Ficha>
            </div>
            <Agregar texto="+ Área" onAgregar={(nombre) => void agregarArea(nombre)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trabajo-texto">Qué se hizo</Label>
            <Textarea
              id="trabajo-texto"
              rows={4}
              value={borrador.texto}
              placeholder="Vaciado de losa, armado de acero…"
              onChange={(e) => setBorrador({ ...borrador, texto: e.target.value })}
              className="resize-none"
            />
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
