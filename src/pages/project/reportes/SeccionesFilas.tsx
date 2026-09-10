/**
 * Las tres secciones del reporte diario que son filas: Personal, Equipo y
 * Entregas. Viven aparte de ReporteForm porque ese archivo ya era largo y
 * estas tres tienen su propia lógica de listas.
 *
 * Diseño acordado con Ivan el 2026-09-10, probado en mocks antes de escribir
 * una línea:
 *
 * - Personal y Equipo salen SOLOS cada día: son lo que hay en la obra, y la
 *   lista del proyecto aparece con sus casillas para que el ingeniero solo
 *   teclee números. Una entrega, en cambio, es un hecho de ese día y no se
 *   puede precargar.
 * - En Personal, cada bloque (el propio y cada empresa) es dueño de sus
 *   puestos. La equis SIEMPRE quita la línea de ese bloque y nunca toca a los
 *   demás; por eso el «+ Puesto» está dentro de cada bloque y no suelto.
 * - La equis va pegada al nombre, no al final, para que las casillas de número
 *   queden todas en la misma columna y se lean de un vistazo.
 * - Los cuatro puestos de arranque del bloque propio no se quitan.
 *
 * Las listas se guardan en cuanto se tocan, como las áreas: no esperan a que
 * se guarde el reporte, porque son del proyecto y no del día.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  FilaEntrega, ItemLista, Listas,
} from './tipos';

/** El nombre del bloque propio. Fijo por decisión de Ivan. */
export const EMPRESA_PROPIA = 'Pinellas';

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

/** Una línea: nombre, equis si se puede quitar, y sus casillas a la derecha. */
function Linea({
  nombre, sePuedeQuitar, onQuitar, children,
}: {
  nombre: string;
  sePuedeQuitar: boolean;
  onQuitar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-1 last:border-0">
      <span className="text-sm">{nombre}</span>
      {sePuedeQuitar && (
        <button
          type="button"
          aria-label={`Quitar ${nombre}`}
          onClick={onQuitar}
          className="text-muted-foreground hover:text-error"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <span className="ml-auto flex items-center gap-2">{children}</span>
    </div>
  );
}

/** Casilla de número, angosta y alineada a la derecha. */
function Numero({
  value, onChange, ancha = false, etiqueta,
}: {
  value: string;
  onChange: (v: string) => void;
  ancha?: boolean;
  etiqueta: string;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min="0"
      placeholder="0"
      aria-label={etiqueta}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 ${ancha ? 'w-[4.5rem]' : 'w-14'} px-2 text-right tabular-nums`}
    />
  );
}

/** El «+ algo» de cada bloque: se abre en un campo y se cierra al agregar. */
function Agregar({
  texto, onAgregar, sugerencias = [], idSugerencias,
}: {
  texto: string;
  onAgregar: (nombre: string) => void;
  sugerencias?: string[];
  idSugerencias?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');

  const confirmar = () => {
    const nombre = valor.trim();
    if (nombre) onAgregar(nombre);
    setValor('');
    setAbierto(false);
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start pt-1 text-xs font-semibold text-primary hover:underline"
      >
        {texto}
      </button>
    );
  }
  return (
    <div className="flex gap-2 pt-1">
      <Input
        autoFocus
        list={idSugerencias}
        value={valor}
        placeholder="Nombre…"
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
          if (e.key === 'Escape') { setValor(''); setAbierto(false); }
        }}
        className="h-8"
      />
      {idSugerencias && (
        <datalist id={idSugerencias}>
          {sugerencias.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      <Button type="button" size="sm" className="h-8" onClick={confirmar}>
        Agregar
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personal
// ---------------------------------------------------------------------------

interface PersonalProps {
  listas: Listas;
  valores: Record<number, string>;
  onCantidad: (puestoId: number, v: string) => void;
  onAgregarPuesto: (nombre: string, empresaId: number | null) => void;
  onQuitarPuesto: (id: number) => void;
  onAgregarEmpresa: (nombre: string) => void;
  onQuitarEmpresa: (id: number) => void;
}

export function SeccionPersonal({
  listas, valores, onCantidad, onAgregarPuesto, onQuitarPuesto,
  onAgregarEmpresa, onQuitarEmpresa,
}: PersonalProps) {
  const delBloque = (empresaId: number | null) =>
    listas.puestos.filter((p) => (p.empresa_id ?? null) === empresaId);

  const total = listas.puestos.reduce(
    (s, p) => s + (Number(valores[p.id]) || 0), 0,
  );
  const hayEmpresas = listas.empresas.length > 0;

  const bloque = (empresa: ItemLista | null) => {
    const puestos = delBloque(empresa?.id ?? null);
    return (
      <div
        key={empresa?.id ?? 'propio'}
        className={
          empresa
            ? 'rounded-md border border-border bg-primary/[0.03] p-2'
            : ''
        }
      >
        {/* El nombre del bloque propio solo aparece cuando hay con quién
            confundirlo: si no hay subcontratistas, sobra la etiqueta. */}
        {(empresa || hayEmpresas) && (
          <div className="flex items-center gap-2 pb-1 text-xs font-bold uppercase tracking-wide text-primary">
            {empresa ? empresa.nombre : EMPRESA_PROPIA}
            {empresa && (
              <button
                type="button"
                aria-label={`Quitar ${empresa.nombre}`}
                onClick={() => onQuitarEmpresa(empresa.id)}
                className="ml-auto text-muted-foreground hover:text-error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {puestos.map((p) => (
          <Linea
            key={p.id}
            nombre={p.nombre}
            // Los cuatro de arranque del bloque propio no se quitan. Dentro de
            // una empresa sí: un subcontratista rara vez trae los cuatro.
            sePuedeQuitar={!p.fijo}
            onQuitar={() => onQuitarPuesto(p.id)}
          >
            <Numero
              etiqueta={p.nombre}
              value={valores[p.id] ?? ''}
              onChange={(v) => onCantidad(p.id, v)}
            />
          </Linea>
        ))}

        <Agregar
          texto="+ Puesto"
          onAgregar={(nombre) => onAgregarPuesto(nombre, empresa?.id ?? null)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {bloque(null)}
      {listas.empresas.map((e) => bloque(e))}

      <div className="flex items-baseline justify-between border-t border-border pt-2 text-sm">
        <span className="text-muted-foreground">Total en obra</span>
        <span className="font-bold tabular-nums">{total}</span>
      </div>

      <Agregar texto="+ Empresa" onAgregar={onAgregarEmpresa} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------

interface EquipoProps {
  listas: Listas;
  valores: Record<number, { unidades: string; horas: string }>;
  onValor: (equipoId: number, campo: 'unidades' | 'horas', v: string) => void;
  onAgregar: (nombre: string) => void;
  onQuitar: (id: number) => void;
}

export function SeccionEquipo({
  listas, valores, onValor, onAgregar, onQuitar,
}: EquipoProps) {
  return (
    <div className="space-y-1">
      {listas.equipos.length > 0 && (
        <div className="flex items-center gap-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <span className="ml-auto w-14 text-center">Unid.</span>
          <span className="w-[4.5rem] text-center">Horas</span>
        </div>
      )}

      {listas.equipos.length === 0 && (
        <p className="text-sm italic text-muted-foreground">
          Este proyecto todavía no tiene equipos en su lista.
        </p>
      )}

      {listas.equipos.map((q) => (
        <Linea
          key={q.id}
          nombre={q.nombre}
          sePuedeQuitar
          onQuitar={() => onQuitar(q.id)}
        >
          <Numero
            etiqueta={`Unidades de ${q.nombre}`}
            value={valores[q.id]?.unidades ?? ''}
            onChange={(v) => onValor(q.id, 'unidades', v)}
          />
          <Numero
            ancha
            etiqueta={`Horas de ${q.nombre}`}
            value={valores[q.id]?.horas ?? ''}
            onChange={(v) => onValor(q.id, 'horas', v)}
          />
        </Linea>
      ))}

      <Agregar texto="+ Equipo" onAgregar={onAgregar} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entregas
// ---------------------------------------------------------------------------

const ENTREGA_VACIA: FilaEntrega = {
  categoria_id: 0, descripcion: '', cantidad: '', unidad: '', notas: '',
};

interface EntregasProps {
  listas: Listas;
  filas: FilaEntrega[];
  onFilas: (filas: FilaEntrega[]) => void;
  onAgregarCategoria: (nombre: string) => void;
}

export function SeccionEntregas({
  listas, filas, onFilas, onAgregarCategoria,
}: EntregasProps) {
  // `editando` es el índice de la fila abierta, o -1 para una nueva.
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<FilaEntrega>(ENTREGA_VACIA);

  const nombreCategoria = (id: number) =>
    listas.categorias.find((c) => c.id === id)?.nombre ?? '';

  const abrir = (i: number | null) => {
    setEditando(i);
    setBorrador(
      i === null
        ? { ...ENTREGA_VACIA, categoria_id: listas.categorias[0]?.id ?? 0 }
        : filas[i],
    );
  };

  const guardar = () => {
    if (!borrador.descripcion.trim() || !borrador.categoria_id) return;
    if (editando === null) onFilas([...filas, borrador]);
    else onFilas(filas.map((f, i) => (i === editando ? borrador : f)));
    setEditando(null);
  };

  const cantidadTexto = (f: FilaEntrega) =>
    [f.cantidad, f.unidad].filter((x) => x !== '' && x !== null).join(' ');

  return (
    <div className="space-y-1">
      {filas.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Sin entregas hoy</p>
      ) : (
        filas.map((f, i) => (
          <div
            key={`${f.descripcion}-${i}`}
            className="flex items-baseline gap-2 border-b border-slate-100 py-2 last:border-0"
          >
            <button
              type="button"
              onClick={() => abrir(i)}
              className="text-left text-sm font-medium hover:underline"
            >
              {f.descripcion}
            </button>
            <span className="text-xs text-muted-foreground">
              {nombreCategoria(f.categoria_id).toLowerCase()}
            </span>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {cantidadTexto(f)}
            </span>
            <button
              type="button"
              aria-label={`Quitar ${f.descripcion}`}
              onClick={() => onFilas(filas.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={() => abrir(null)}
        className="self-start pt-1 text-xs font-semibold text-primary hover:underline"
      >
        + Entrega
      </button>

      <AppDialog
        open={editando !== null}
        onOpenChange={(o) => !o && setEditando(null)}
        size="simple"
        title={editando === null ? 'Agregar entrega' : 'Corregir entrega'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>
              {editando === null ? 'Agregar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {listas.categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setBorrador({ ...borrador, categoria_id: c.id })}
                  aria-pressed={borrador.categoria_id === c.id}
                  className={
                    'rounded-full border px-3 py-1 text-sm font-medium transition-colors '
                    + (borrador.categoria_id === c.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-slate-700 hover:border-primary')
                  }
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <Agregar texto="+ Categoría" onAgregar={onAgregarCategoria} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-desc">Qué llegó</Label>
            <Input
              id="ent-desc"
              value={borrador.descripcion}
              placeholder="Varilla #5, andamio tubular…"
              onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ent-cant">Cantidad</Label>
              <Input
                id="ent-cant"
                type="number"
                inputMode="decimal"
                min="0"
                value={String(borrador.cantidad ?? '')}
                onChange={(e) => setBorrador({ ...borrador, cantidad: e.target.value })}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ent-unidad">Unidad</Label>
              <Input
                id="ent-unidad"
                value={borrador.unidad ?? ''}
                placeholder="ton, sacos, cuerpos, global…"
                onChange={(e) => setBorrador({ ...borrador, unidad: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-notas">Notas</Label>
            <Input
              id="ent-notas"
              value={borrador.notas ?? ''}
              placeholder="Opcional"
              onChange={(e) => setBorrador({ ...borrador, notas: e.target.value })}
            />
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
