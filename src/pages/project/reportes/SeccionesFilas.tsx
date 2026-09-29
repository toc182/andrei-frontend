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
 * - En Personal y en Equipo, cada bloque (el propio y cada empresa) es dueño
 *   de sus puestos o de sus máquinas. La equis SIEMPRE quita la línea de ese bloque y nunca toca a los
 *   demás; por eso el «+ Puesto» está dentro de cada bloque y no suelto.
 * - La equis va pegada al nombre, no al final, para que las casillas de número
 *   queden todas en la misma columna y se lean de un vistazo.
 * - Las listas llevan un ancho máximo. Alinear los números exige una columna
 *   fija, y sin tope, en una pantalla ancha esa columna se va al borde y deja
 *   medio metro de vacío entre el nombre y su casilla.
 * - Los cuatro puestos de arranque del bloque propio no se quitan.
 *
 * Las listas se guardan en cuanto se tocan, como las áreas: no esperan a que
 * se guarde el reporte, porque son del proyecto y no del día.
 */

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  FilaEntrega, ItemLista, Listas,
} from './tipos';

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
  children: ReactNode;
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

/**
 * Una ficha para escoger una opción: la categoría de una entrega, el área de un
 * trabajo. Ocupan mucho menos que una lista de casillas.
 */
export function Ficha({
  activa, onClick, children,
}: {
  activa: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={
        'rounded-full border px-3 py-1 text-sm font-medium transition-colors '
        + (activa
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-slate-700 hover:border-primary')
      }
    >
      {children}
    </button>
  );
}

/** El «+ algo» de cada bloque: se abre en un campo y se cierra al agregar. */
export function Agregar({
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
// Bloques por empresa: Personal y Equipo
// ---------------------------------------------------------------------------

/**
 * Un bloque de Personal o de Equipo: el propio, o el de una empresa en su
 * recuadro con su equis. Las dos secciones lo comparten para verse y portarse
 * igual (decisión de Ivan del 2026-09-28: el equipo va por empresa como el
 * personal, y las empresas son las mismas en las dos).
 */
function Bloque({
  empresa, nombrePropio, hayEmpresas, onQuitarEmpresa, children,
}: {
  /** null es el bloque propio. */
  empresa: ItemLista | null;
  nombrePropio: string;
  hayEmpresas: boolean;
  onQuitarEmpresa: (id: number) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={
        empresa
          ? 'rounded-md border border-border bg-primary/[0.03] p-2'
          : ''
      }
    >
      {/* El nombre del bloque propio solo aparece cuando hay con quién
          confundirlo: si no hay subcontratistas, sobra la etiqueta. Es
          «Pinellas», o el consorcio en un proyecto en consorcio (lo decide
          el servidor, igual que en el PDF). */}
      {(empresa || hayEmpresas) && (
        <div className="flex items-center gap-2 pb-1 text-xs font-bold uppercase tracking-wide text-primary">
          {empresa ? empresa.nombre : nombrePropio}
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
      {children}
    </div>
  );
}

/** Lo que comparten Personal y Equipo: la lista de empresas y cómo tocarla. */
interface EmpresasProps {
  listas: Listas;
  onAgregarEmpresa: (nombre: string) => void;
  onQuitarEmpresa: (id: number) => void;
}

/** Los ítems de un bloque: los del propio (null) o los de esa empresa. */
const delBloque = (items: ItemLista[], empresaId: number | null) =>
  items.filter((x) => (x.empresa_id ?? null) === empresaId);

// ---------------------------------------------------------------------------
// Personal
// ---------------------------------------------------------------------------

interface PersonalProps extends EmpresasProps {
  valores: Record<number, string>;
  onCantidad: (puestoId: number, v: string) => void;
  onAgregarPuesto: (nombre: string, empresaId: number | null) => void;
  onQuitarPuesto: (id: number) => void;
}

export function SeccionPersonal({
  listas, valores, onCantidad, onAgregarPuesto, onQuitarPuesto,
  onAgregarEmpresa, onQuitarEmpresa,
}: PersonalProps) {
  const total = listas.puestos.reduce(
    (s, p) => s + (Number(valores[p.id]) || 0), 0,
  );

  const bloque = (empresa: ItemLista | null) => (
    <Bloque
      key={empresa?.id ?? 'propio'}
      empresa={empresa}
      nombrePropio={listas.nombre_propio}
      hayEmpresas={listas.empresas.length > 0}
      onQuitarEmpresa={onQuitarEmpresa}
    >
      {delBloque(listas.puestos, empresa?.id ?? null).map((p) => (
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
    </Bloque>
  );

  return (
    <div className="max-w-[26rem] space-y-3">
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

interface EquipoProps extends EmpresasProps {
  valores: Record<number, { unidades: string; horas: string }>;
  onValor: (equipoId: number, campo: 'unidades' | 'horas', v: string) => void;
  onAgregar: (nombre: string, empresaId: number | null) => void;
  onQuitar: (id: number) => void;
}

export function SeccionEquipo({
  listas, valores, onValor, onAgregar, onQuitar,
  onAgregarEmpresa, onQuitarEmpresa,
}: EquipoProps) {
  const bloque = (empresa: ItemLista | null) => {
    const maquinas = delBloque(listas.equipos, empresa?.id ?? null);
    return (
      <Bloque
        key={empresa?.id ?? 'propio'}
        empresa={empresa}
        nombrePropio={listas.nombre_propio}
        hayEmpresas={listas.empresas.length > 0}
        onQuitarEmpresa={onQuitarEmpresa}
      >
        {maquinas.length > 0 && (
          <div className="flex items-center gap-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span className="ml-auto w-14 text-center">Unid.</span>
            <span className="w-[4.5rem] text-center">Horas</span>
          </div>
        )}

        {maquinas.length === 0 && !empresa && (
          <p className="text-sm italic text-muted-foreground">
            Este proyecto todavía no tiene equipos en su lista.
          </p>
        )}

        {maquinas.map((q) => (
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

        <Agregar
          texto="+ Equipo"
          onAgregar={(nombre) => onAgregar(nombre, empresa?.id ?? null)}
        />
      </Bloque>
    );
  };

  return (
    <div className="max-w-[26rem] space-y-3">
      {bloque(null)}
      {listas.empresas.map((e) => bloque(e))}

      {/* Es la misma lista de empresas de Personal: la que se agrega aquí
          aparece allá, y al revés. */}
      <Agregar texto="+ Empresa" onAgregar={onAgregarEmpresa} />
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
  // Tres estados y no dos: null es cerrado, -1 es una entrega nueva, y un
  // número es la fila que se está corrigiendo. Usar null para "cerrado" y
  // "nueva" a la vez fue un error: el botón ponía "nueva" y el diálogo leía
  // eso como "cerrado", así que agregar no abría nada.
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<FilaEntrega>(ENTREGA_VACIA);

  const nombreCategoria = (id: number) =>
    listas.categorias.find((c) => c.id === id)?.nombre ?? '';

  const abrir = (i: number) => {
    setEditando(i);
    setBorrador(
      i === -1
        ? { ...ENTREGA_VACIA, categoria_id: listas.categorias[0]?.id ?? 0 }
        : filas[i],
    );
  };

  const guardar = () => {
    if (!borrador.descripcion.trim() || !borrador.categoria_id) return;
    if (editando === -1) onFilas([...filas, borrador]);
    else onFilas(filas.map((f, i) => (i === editando ? borrador : f)));
    setEditando(null);
  };

  const cantidadTexto = (f: FilaEntrega) =>
    [f.cantidad, f.unidad].filter((x) => x !== '' && x !== null).join(' ');

  return (
    <div className="max-w-[30rem] space-y-1">
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
        onClick={() => abrir(-1)}
        className="self-start pt-1 text-xs font-semibold text-primary hover:underline"
      >
        + Entrega
      </button>

      <AppDialog
        open={editando !== null}
        onOpenChange={(o) => !o && setEditando(null)}
        size="simple"
        title={editando === -1 ? 'Agregar entrega' : 'Corregir entrega'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>
              {editando === -1 ? 'Agregar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {listas.categorias.map((c) => (
                <Ficha
                  key={c.id}
                  activa={borrador.categoria_id === c.id}
                  onClick={() => setBorrador({ ...borrador, categoria_id: c.id })}
                >
                  {c.nombre}
                </Ficha>
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
