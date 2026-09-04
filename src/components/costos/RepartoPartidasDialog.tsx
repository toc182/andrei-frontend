// RepartoPartidasDialog — repartir UN pago entre varias partidas del desglose.
//
// Una factura de un proveedor no siempre es de una sola partida: el mismo
// camion trae acero de dos renglones distintos. Aqui se escribe cuanto va a
// cada uno.
//
// La suma tiene que dar el monto del pago, ni mas ni menos: si no cuadra, el
// gasto por partida no cuadraria con el total gastado y las dos cifras de la
// pantalla se contradirian. El servidor lo vuelve a comprobar.
//
// Los montos se guardan como TEXTO mientras se escriben —"8.0" es un paso
// legitimo hacia "8.05"— y se convierten a numero solo para sumar y guardar.

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AppDialog, Alert } from '@/components/shell';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { ListaPartidas } from './SelectorPartida';
import type { Partida, PartidaAsignada, ResumenSolicitud } from '@/lib/costosApi';

interface Linea {
  rowUid: string | null;
  monto: string;
}

interface RepartoPartidasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pago: ResumenSolicitud | null;
  partidas: Partida[];
  onGuardar: (lineas: { rowUid: string; monto: number }[]) => Promise<void>;
}

/** Centavos en entero: sumar decimales en coma flotante deja repartos que no
 *  cuadran por una millonesima. */
const centavos = (n: number) => Math.round(n * 100);
const aNumero = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export default function RepartoPartidasDialog({
  open, onOpenChange, pago, partidas, onGuardar,
}: RepartoPartidasDialogProps) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Que linea tiene el buscador abierto; escoger una partida lo cierra. */
  const [buscandoEn, setBuscandoEn] = useState<number | null>(null);

  // Al abrirlo se parte de lo que el pago ya tenia. Si no tenia nada, una linea
  // vacia con el monto entero: el caso mas comun es "todo esto es de una sola
  // partida", y ya queda cuadrado de entrada.
  useEffect(() => {
    if (!open || !pago) return;
    setError(null);
    setLineas(
      pago.partidas.length > 0
        ? pago.partidas.map((p: PartidaAsignada) => ({
            rowUid: p.rowUid,
            monto: p.monto.toFixed(2),
          }))
        : [{ rowUid: null, monto: pago.monto.toFixed(2) }],
    );
  }, [open, pago]);

  const nombrePartida = useMemo(() => {
    const porUid = new Map(partidas.map((p) => [p.rowUid, p]));
    return (rowUid: string | null) => (rowUid ? porUid.get(rowUid) ?? null : null);
  }, [partidas]);

  const total = pago ? centavos(pago.monto) : 0;
  const suma = lineas.reduce((s, l) => s + centavos(aNumero(l.monto)), 0);
  const diferencia = total - suma;
  const completas = lineas.every((l) => l.rowUid != null && centavos(aNumero(l.monto)) > 0);
  const repetidas = new Set(lineas.map((l) => l.rowUid)).size !== lineas.length;
  const puedeGuardar = lineas.length > 0 && completas && !repetidas && diferencia === 0 && !guardando;

  const cambiar = (i: number, cambio: Partial<Linea>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...cambio } : l)));

  // La linea nueva nace con lo que falte para cuadrar: repartir 12,050 entre
  // dos es escribir el primer monto y que el segundo salga solo.
  const anadir = () =>
    setLineas((prev) => [...prev, { rowUid: null, monto: (Math.max(diferencia, 0) / 100).toFixed(2) }]);

  const quitar = (i: number) => setLineas((prev) => prev.filter((_, j) => j !== i));

  const guardar = async () => {
    try {
      setGuardando(true);
      setError(null);
      await onGuardar(
        lineas.map((l) => ({ rowUid: l.rowUid as string, monto: aNumero(l.monto) })),
      );
      onOpenChange(false);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'No se pudo guardar el reparto.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title="¿A qué partidas va este pago?"
      description={
        pago
          ? `${pago.numero ?? 'Sin número'} · ${pago.proveedor ?? 'Sin proveedor'} · ${formatMoney(pago.monto)} · pagado el ${formatDate(pago.fecha)}`
          : undefined
      }
      footer={
        <>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              diferencia === 0 ? 'text-success' : 'text-warning',
            )}
          >
            {diferencia === 0
              ? 'Cuadra con el pago'
              : diferencia > 0
                ? `Faltan ${formatMoney(diferencia / 100)}`
                : `Sobran ${formatMoney(-diferencia / 100)}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!puedeGuardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="error" title={error} />}
        {repetidas && (
          <Alert
            variant="warning"
            title="Hay una partida repetida"
            description="Cada partida va una sola vez, con la suma de lo que le toca."
          />
        )}

        <div className="overflow-hidden rounded-md border border-border">
          {lineas.map((linea, i) => {
            const escogida = nombrePartida(linea.rowUid);
            return (
              <div
                key={i}
                className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 first:border-t-0"
              >
                <Popover
                  open={buscandoEn === i}
                  onOpenChange={(o) => setBuscandoEn(o ? i : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-slate-100"
                    >
                      {escogida ? (
                        <>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {escogida.item}
                          </span>
                          <span className="truncate">{escogida.descripcion}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Escoge la partida…</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[340px] p-0">
                    <ListaPartidas
                      partidas={partidas}
                      onEscoger={(rowUid) => { cambiar(i, { rowUid }); setBuscandoEn(null); }}
                    />
                  </PopoverContent>
                </Popover>

                <Input
                  value={linea.monto}
                  inputMode="decimal"
                  onChange={(e) => cambiar(i, { monto: e.target.value })}
                  aria-label="Monto de esta partida"
                  className="h-8 w-[120px] text-right tabular-nums"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  aria-label="Quitar esta partida del reparto"
                  onClick={() => quitar(i)}
                  disabled={lineas.length === 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={anadir}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir otra partida
        </Button>
      </div>
    </AppDialog>
  );
}
