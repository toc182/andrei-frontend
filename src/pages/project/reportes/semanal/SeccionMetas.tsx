/**
 * Las metas de la semana: las que dejó planeadas el reporte anterior y que este
 * marca, y las que este deja planeadas para el siguiente.
 *
 * Cómo se marca una meta (decisión de Ivan, 2026-09-17): completada, parcial o
 * no completada. Si es parcial y la meta traía cantidad, se anota cuánto se
 * hizo; si no traía, un porcentaje. Parcial y no completada piden motivo.
 * La cantidad es opcional al planearla: «terminar la tubería sanitaria» no
 * tiene número y no hace falta inventarle uno.
 */

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ESTADOS, comoNumero, type EstadoMeta, type Meta, type MetaPlan } from './tipos';

interface PropsMetas {
  metas: Meta[];
  onCambio: (metas: Meta[]) => void;
}

/** Los tres botones de estado, con su punto de color. */
function Estado({
  valor, onElegir,
}: {
  valor: EstadoMeta | null;
  onElegir: (e: EstadoMeta) => void;
}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border md:inline-grid md:grid-cols-[repeat(3,auto)]">
      {ESTADOS.map((e, i) => {
        const activo = valor === e.valor;
        const color = activo
          ? e.valor === 'completada'
            ? 'bg-success/10 text-success'
            : e.valor === 'parcial'
              ? 'bg-warning/10 text-warning'
              : 'bg-error/10 text-error'
          : 'text-muted-foreground hover:bg-muted';
        return (
          <button
            key={e.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(e.valor)}
            className={`flex h-9 items-center justify-center gap-2 px-2 text-sm font-medium transition-colors md:px-3 ${
              i > 0 ? 'border-l border-border' : ''
            } ${color}`}
          >
            <span className={`h-2.5 w-2.5 flex-none rounded-full ${e.punto} ${activo ? '' : 'opacity-35'}`} />
            {e.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

/** Las metas que este reporte marca. */
export function MetasDeLaSemana({ metas, onCambio }: PropsMetas) {
  const cambiar = (i: number, cambios: Partial<Meta>) =>
    onCambio(metas.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

  const agregar = () =>
    onCambio([
      ...metas,
      {
        id: -Date.now(), texto: '', cantidad: null, unidad: null, estado: null,
        cantidad_hecha: null, porcentaje: null, motivo: null, fuera_del_plan: true,
      },
    ]);

  return (
    <div className="space-y-3">
      {metas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          La semana pasada no dejó metas planeadas. Puedes agregar aquí lo que no se pudo cumplir.
        </p>
      )}

      <div>
        {metas.map((m, i) => {
          const cantidad = comoNumero(m.cantidad);
          const marcada = m.estado !== null;
          return (
            <div key={m.id} className="space-y-2.5 border-b border-slate-100 py-3 first:pt-0 last:border-0">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="min-w-0">
                  {m.fuera_del_plan ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={m.texto}
                        placeholder="Qué no se pudo cumplir"
                        onChange={(e) => cambiar(i, { texto: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-none text-muted-foreground"
                        aria-label="Quitar la meta"
                        onClick={() => onCambio(metas.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="font-medium">{m.texto}</div>
                  )}
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {cantidad !== null ? `${cantidad} ${m.unidad ?? ''}`.trim() : 'Sin cantidad'}
                    {!marcada && <span className="ml-2 text-xs">· sin marcar</span>}
                    {m.fuera_del_plan && <span className="ml-2 text-xs">· fuera del plan</span>}
                  </div>
                </div>
                <Estado valor={m.estado} onElegir={(estado) => cambiar(i, { estado })} />
              </div>

              {m.estado === 'parcial' && (
                <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
                  <div className="flex items-center gap-2 text-sm">
                    {cantidad !== null ? (
                      <>
                        <span className="whitespace-nowrap">Se hizo</span>
                        <Input
                          className="w-20 tabular-nums"
                          inputMode="decimal"
                          value={m.cantidad_hecha ?? ''}
                          onChange={(e) => cambiar(i, { cantidad_hecha: e.target.value })}
                        />
                        <span className="whitespace-nowrap text-muted-foreground">
                          de {cantidad} {m.unidad ?? ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Avance</span>
                        <Input
                          className="w-20 tabular-nums"
                          inputMode="numeric"
                          value={m.porcentaje ?? ''}
                          onChange={(e) => cambiar(i, {
                            porcentaje: e.target.value === '' ? null : Number(e.target.value),
                          })}
                        />
                        <span className="text-muted-foreground">%</span>
                      </>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`motivo-${m.id}`}>Motivo</Label>
                    <Input
                      id={`motivo-${m.id}`}
                      value={m.motivo ?? ''}
                      placeholder="Por qué no se completó"
                      onChange={(e) => cambiar(i, { motivo: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {m.estado === 'no_completada' && (
                <div className="space-y-1.5">
                  <Label htmlFor={`motivo-${m.id}`}>Motivo</Label>
                  <Input
                    id={`motivo-${m.id}`}
                    value={m.motivo ?? ''}
                    placeholder="Por qué no se completó"
                    onChange={(e) => cambiar(i, { motivo: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={agregar}>
        <Plus className="mr-2 h-4 w-4" /> Agregar meta fuera del plan
      </Button>
    </div>
  );
}

/** El plan de la próxima semana: texto general y metas con cantidad opcional. */
export function MetasDelPlan({
  metas, onCambio,
}: {
  metas: MetaPlan[];
  onCambio: (metas: MetaPlan[]) => void;
}) {
  const cambiar = (i: number, cambios: Partial<MetaPlan>) =>
    onCambio(metas.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

  return (
    <div className="space-y-3">
      <div className="hidden gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[1fr_7rem_7rem_2rem]">
        <span>Meta</span>
        <span>Cantidad <span className="font-normal normal-case tracking-normal">(opcional)</span></span>
        <span>Unidad</span>
        <span />
      </div>

      {metas.map((m, i) => (
        <div key={m.id} className="grid grid-cols-[1fr_1fr_2rem] gap-3 md:grid-cols-[1fr_7rem_7rem_2rem]">
          <div className="col-span-2 space-y-1.5 md:col-span-1">
            <Label className="md:hidden" htmlFor={`meta-${m.id}`}>Meta</Label>
            <Input
              id={`meta-${m.id}`}
              value={m.texto}
              placeholder="Escribe la meta"
              onChange={(e) => cambiar(i, { texto: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="md:hidden" htmlFor={`cant-${m.id}`}>Cantidad</Label>
            <Input
              id={`cant-${m.id}`}
              className="tabular-nums"
              inputMode="decimal"
              placeholder="—"
              value={m.cantidad ?? ''}
              onChange={(e) => cambiar(i, { cantidad: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="md:hidden" htmlFor={`uni-${m.id}`}>Unidad</Label>
            <Input
              id={`uni-${m.id}`}
              placeholder="—"
              value={m.unidad ?? ''}
              onChange={(e) => cambiar(i, { unidad: e.target.value })}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-auto h-9 w-8 flex-none text-muted-foreground"
            aria-label="Quitar la meta"
            onClick={() => onCambio(metas.filter((_, j) => j !== i))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onCambio([...metas, { id: -Date.now(), texto: '', cantidad: null, unidad: null }])}
      >
        <Plus className="mr-2 h-4 w-4" /> Agregar meta
      </Button>
    </div>
  );
}
