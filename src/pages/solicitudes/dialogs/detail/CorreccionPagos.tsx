// The «Pagos» part of «Corregir solicitud» (pagos parciales, migración 191).
//
// Ivan, 2026-11-18: a payment registered wrong is fixed or cancelled by an
// admin, with a reason, and stays in the history. Each active payment shows its
// date, amount and receipt; the admin can change any of them or mark the
// payment «Anular». The reason is the one written at the top of the window.
//
// The arithmetic is in utils/correccionPagos.ts (planPagos): what is paid, the
// balance, the state the request ends in and — for a request paid in full whose
// total changes — the last payment moving by the difference.

import { useRef } from 'react';
import { Ban, Undo2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/shell/DatePicker';
import { Alert } from '@/components/shell';
import { parseMoney } from '@/lib/desglosePaste';
import { fecha as fechaLegible } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { EstadoBadge } from '../../components/EstadoBadge';
import {
  dinero,
  escribirMonto,
  type PagoEditable,
  type PlanPagos,
} from '../../utils/correccionPagos';

interface CorreccionPagosProps {
  pagos: PagoEditable[];
  onChange: (pagos: PagoEditable[]) => void;
  plan: PlanPagos;
  totalNuevo: number;
}

export function CorreccionPagos({ pagos, onChange, plan, totalNuevo }: CorreccionPagosProps) {
  const entradas = useRef<Record<number, HTMLInputElement | null>>({});

  const cambiar = (id: number, cambio: Partial<PagoEditable>) =>
    onChange(pagos.map((p) => (p.id === id ? { ...p, ...cambio } : p)));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Pagos</h3>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden sm:grid grid-cols-[150px_130px_1fr_auto] gap-2 border-b border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <span>Fecha de pago</span>
          <span className="text-right">Monto</span>
          <span>Comprobante</span>
          <span />
        </div>

        {pagos.map((p) =>
          p.anular ? (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 border-t border-border bg-error/[0.04] px-3 py-2.5 text-sm first:border-t-0"
            >
              <span className="text-muted-foreground line-through tabular-nums">
                Pago del {fechaLegible(p.fechaOriginal)} · {dinero(p.montoOriginal)}
              </span>
              <span className="font-medium text-error">Se anula</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => cambiar(p.id, { anular: false })}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Deshacer
              </Button>
            </div>
          ) : (
            <div
              key={p.id}
              className="grid grid-cols-1 gap-2 border-t border-border px-3 py-2.5 first:border-t-0 sm:grid-cols-[150px_130px_1fr_auto] sm:items-center"
            >
              <DatePicker
                value={p.fecha}
                onChange={(v) => cambiar(p.id, { fecha: v })}
              />
              <Input
                value={p.montoTexto}
                inputMode="decimal"
                aria-label="Monto del pago"
                onChange={(e) => cambiar(p.id, { montoTexto: e.target.value })}
                onBlur={() => {
                  const escrito = parseMoney(p.montoTexto);
                  if (escrito !== null && escrito > 0) {
                    cambiar(p.id, { montoTexto: escribirMonto(Math.round(escrito * 100)) });
                  }
                }}
                className="h-9 text-right tabular-nums"
              />
              <div className="flex min-w-0 items-center gap-2">
                <input
                  ref={(el) => {
                    entradas.current[p.id] = el;
                  }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    cambiar(p.id, { archivos: e.target.files ? Array.from(e.target.files) : [] })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => entradas.current[p.id]?.click()}
                >
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  Reemplazar
                </Button>
                <span
                  className={cn(
                    'truncate text-xs',
                    p.archivos.length > 0 ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {p.archivos.length > 0
                    ? p.archivos.map((f) => f.name).join(', ')
                    : p.archivosActuales.join(', ') || '—'}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 justify-self-start text-xs text-error hover:text-error sm:justify-self-end"
                onClick={() =>
                  cambiar(p.id, {
                    anular: true,
                    fecha: p.fechaOriginal,
                    montoTexto: escribirMonto(p.montoOriginal),
                    archivos: [],
                  })
                }
              >
                <Ban className="mr-1 h-3.5 w-3.5" />
                Anular
              </Button>
            </div>
          ),
        )}
      </div>

      {plan.movido && !plan.error && (
        <Alert
          variant="info"
          title={`El pago del ${fechaLegible(plan.movido.fecha)} pasa de ${dinero(plan.movido.antes)} a ${dinero(plan.movido.despues)}`}
          description="Cambió el total de una solicitud ya pagada: el último pago se ajusta para que siga pagada."
        />
      )}
      {plan.error && <Alert variant="error" title={plan.error} />}

      <div className="space-y-1.5 rounded-md border border-border bg-muted px-3 py-2.5 text-sm sm:max-w-sm sm:ml-auto">
        <FilaResumen etiqueta="Total de la solicitud" valor={dinero(totalNuevo)} />
        <FilaResumen etiqueta="Pagado" valor={dinero(plan.pagadoCentavos)} />
        <FilaResumen
          etiqueta="Saldo"
          valor={plan.saldoCentavos < 0 ? '—' : dinero(plan.saldoCentavos)}
        />
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5">
          <span className="font-semibold text-foreground">Queda</span>
          <EstadoBadge estado={plan.estado} />
        </div>
      </div>
    </div>
  );
}

function FilaResumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
    </div>
  );
}
