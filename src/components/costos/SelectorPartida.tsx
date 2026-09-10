// SelectorPartida — escoger, EN LA MISMA FILA, a que partida del presupuesto va un
// pago. Se abre pinchando la casilla de la columna Partida: se escriben dos
// letras, se escoge, y se puede seguir con la fila de abajo sin que se abra
// nada encima.
//
// Repartir un pago entre varias partidas es el otro camino, y sale al pie de la
// lista: escoger una sola es lo comun y no puede costar dos pasos.
//
// No hay componente de buscador desplegable en el proyecto (cmdk esta instalado
// pero sin envoltorio), asi que va armado con Popover + Input + lista, con las
// flechas y Enter atendidas a mano.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Split, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/formatters';
import type { Partida, PartidaAsignada } from '@/lib/costosApi';

/** Sin tildes y en minusculas: buscar "diseno" tiene que encontrar "diseño". */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cuantas partidas se ven sin desplegar. Dos caben en la fila sin estirarla.
 *  De tres en adelante se recoge: no es solo el pago repartido entre catorce
 *  —que tambien—, es que veinte pagos con dos o tres partidas cada uno ya hacen
 *  una pagina kilometrica. */
export const PARTIDAS_VISIBLES = 2;

/** De mayor a menor. Cuando la lista va recogida se ve solo la primera, y la
 *  que mas se llevo es la que dice de que fue el gasto. */
const porMonto = (asignadas: PartidaAsignada[]) =>
  [...asignadas].sort((a, b) => b.monto - a.monto);

interface SelectorPartidaProps {
  partidas: Partida[];
  asignadas: PartidaAsignada[];
  onEscoger: (rowUid: string) => void;
  onRepartir: () => void;
  /** Devolver el pago a cero: se le quitan todas las partidas de un golpe.
   *  Guarda al momento, igual que escoger una de la lista. */
  onEliminarTodas: () => void;
  disabled?: boolean;
}

/** El buscador con su lista. Se usa suelto dentro de un Popover: aqui en la
 *  fila, y tambien en cada linea del cuadro de repartir. */
export function ListaPartidas({
  partidas, onEscoger, pie,
}: {
  partidas: Partida[];
  onEscoger: (rowUid: string) => void;
  pie?: React.ReactNode;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [marcada, setMarcada] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return partidas;
    return partidas.filter(
      (p) => normalizar(p.item).includes(q) || normalizar(p.descripcion).includes(q),
    );
  }, [partidas, busqueda]);

  useEffect(() => { setMarcada(0); }, [busqueda]);

  useEffect(() => {
    listaRef.current
      ?.querySelector('[data-marcada="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [marcada]);

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMarcada((m) => Math.min(m + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMarcada((m) => Math.max(m - 1, 0));
    } else if (e.key === 'Enter' && filtradas[marcada]) {
      e.preventDefault();
      onEscoger(filtradas[marcada].rowUid);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <Input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={teclas}
          placeholder="Buscar partida…"
          className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <div ref={listaRef} className="max-h-[210px] overflow-y-auto">
        {filtradas.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            Ninguna partida se llama así
          </p>
        ) : (
          filtradas.map((p, i) => (
            <button
              key={p.rowUid}
              type="button"
              data-marcada={i === marcada}
              onMouseEnter={() => setMarcada(i)}
              onClick={() => onEscoger(p.rowUid)}
              className={cn(
                'flex w-full items-baseline gap-2.5 border-t border-slate-100 px-3 py-1.5 text-left first:border-t-0',
                i === marcada && 'bg-primary/5',
              )}
            >
              <span className="min-w-[38px] shrink-0 text-xs tabular-nums text-muted-foreground">
                {p.item}
              </span>
              <span className="truncate text-sm">{p.descripcion}</span>
            </button>
          ))
        )}
      </div>

      {pie}
    </>
  );
}

export default function SelectorPartida({
  partidas, asignadas, onEscoger, onRepartir, onEliminarTodas, disabled,
}: SelectorPartidaProps) {
  const [abierto, setAbierto] = useState(false);
  const [expandida, setExpandida] = useState(false);

  // El boton de abrir la lista va FUERA del que abre el desplegable. Metido
  // dentro seria un boton dentro de otro: al pincharlo se abriria el buscador
  // en vez de desplegar las partidas.
  const muchas = asignadas.length > PARTIDAS_VISIBLES;

  return (
    <div className="flex w-full min-w-0 flex-col items-start">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              'flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-sm',
              'transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60',
            )}
            aria-label="Partida de este pago"
          >
            <EtiquetaPartida asignadas={asignadas} expandida={expandida} />
            <ChevronDown className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>

        {/* key: al cerrar y volver a abrir, el buscador nace limpio. Reabrirlo
            con lo escrito antes hace creer que esas son todas las que hay. */}
        <PopoverContent key={String(abierto)} align="start" className="w-[340px] p-0">
          <ListaPartidas
            partidas={partidas}
            onEscoger={(rowUid) => { onEscoger(rowUid); setAbierto(false); }}
            pie={
              <>
                <button
                  type="button"
                  onClick={() => { setAbierto(false); onRepartir(); }}
                  className="flex w-full items-center gap-2 border-t border-border bg-muted/40 px-3 py-2 text-left text-sm text-primary hover:bg-muted"
                >
                  <Split className="h-3.5 w-3.5" />
                  Repartir entre varias partidas…
                </button>

                {/* Solo cuando hay algo que quitar. En un pago que ya esta sin
                    clasificar esta linea no haria nada, y una opcion que no
                    hace nada se lee como que esta rota. */}
                {asignadas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setAbierto(false); onEliminarTodas(); }}
                    className="flex w-full items-center gap-2 border-t border-border bg-muted/40 px-3 py-2 text-left text-sm text-error hover:bg-error/5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Eliminar todas
                  </button>
                )}
              </>
            }
          />
        </PopoverContent>
      </Popover>

      {muchas && (
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-primary hover:underline"
        >
          {expandida ? (
            <>Cerrar <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>y {asignadas.length - 1} partidas más <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

/** Un cambio propuesto sobre una fila: lo que tenia, tachado, y lo que quedaria
 *  debajo. No se pincha — para tocar esta fila hay que descartar la propuesta o
 *  soltarla con su casilla. */
export function DiferenciaPartida({
  antes, despues,
}: {
  antes: { rowUid: string; item: string | null; descripcion: string | null; monto: number }[];
  despues: { rowUid: string; item: string | null; descripcion: string | null; monto: number }[];
}) {
  return (
    <div className="space-y-1 px-1.5 py-1">
      <div className="text-xs text-muted-foreground line-through">
        {antes.length === 0
          ? 'Sin partida'
          : antes.map((l) => `${l.item ?? '—'} ${formatMoney(l.monto)}`).join(' · ')}
      </div>
      {despues.length === 0 ? (
        <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
          Sin partida
        </span>
      ) : (
        despues.map((l) => (
          <div key={l.rowUid} className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <span className="min-w-[30px] shrink-0 text-xs tabular-nums text-muted-foreground">
              {l.item ?? '—'}
            </span>
            <span className="min-w-0 flex-1 truncate">{l.descripcion ?? ''}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatMoney(l.monto)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/** Lo que se lee en la casilla cuando el desplegable esta cerrado.
 *
 *  `expandida` solo la manda quien ademas pinta el boton de abrir y cerrar. Por
 *  defecto se ven todas, que es como se usa suelta. */
export function EtiquetaPartida({
  asignadas, expandida = true,
}: {
  asignadas: PartidaAsignada[];
  expandida?: boolean;
}) {
  if (asignadas.length === 0) {
    return (
      <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
        Sin partida
      </span>
    );
  }

  // Repartido: se ven todas, cada una con lo que le toco. Decir solo "2
  // partidas" obligaba a abrir el reparto para saber cuales eran.
  //
  // Salvo que sean muchas: ahi se queda la mayor y las demas se cuentan, o la
  // pagina se hace kilometrica. Quien pinta esto pone el boton de abrirla.
  if (asignadas.length > 1) {
    const muchas = asignadas.length > PARTIDAS_VISIBLES;
    const lista = muchas ? porMonto(asignadas) : asignadas;
    const visibles = muchas && !expandida ? lista.slice(0, 1) : lista;
    return (
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {visibles.map((a) => (
          <span key={a.rowUid} className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-[30px] shrink-0 text-xs tabular-nums text-muted-foreground">
              {a.item ?? '—'}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {a.descripcion ?? 'Esta partida ya no está en el presupuesto oficial'}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatMoney(a.monto)}
            </span>
          </span>
        ))}
      </span>
    );
  }

  const [unica] = asignadas;
  // item null = la fila ya no esta en el desglose. No se calla: ese pago hay
  // que volver a asignarlo y tiene que verse igual que uno sin partida.
  if (unica.item == null) {
    return (
      <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
        Partida borrada
      </span>
    );
  }

  // El mismo ancho de codigo que las repartidas, para que las descripciones
  // queden en la misma vertical de una fila a otra.
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
      <span className="min-w-[30px] shrink-0 text-xs tabular-nums text-muted-foreground">
        {unica.item}
      </span>
      <span className="min-w-0 flex-1 truncate">{unica.descripcion}</span>
    </span>
  );
}
