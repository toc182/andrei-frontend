// Dialog for "Registrar Pago" / "Registrar Reembolso" — switches labels based
// on solicitud.tipo. Used after a solicitud has been approved.
//
// A regular solicitud can be paid in parts (pagos parciales, migración 191;
// design approved by Ivan 2026-11-18): fecha de pago, then «Pago total» (the
// balance, the default) or «Pago parcial» with an amount, then a table that
// follows the choice, then the receipt. An amount above the balance shows an
// error and blocks the button. Caja menuda (reembolso, apertura) is always
// paid in full, so it keeps the plain form.
//
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

import { useEffect, useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/shell/DatePicker';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatMoney } from '@/utils/formatters';
import { parseMoney } from '@/lib/desglosePaste';
import { cn } from '@/lib/utils';
import type { TipoSolicitud } from '../types';

interface RegistrarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoSolicitud | undefined;
  /** monto_total and what has already been paid, as the detail brings them. */
  totalAPagar: number | string | undefined;
  pagado: number | string | undefined;
  fecha: string;
  onFechaChange: (value: string) => void;
  files: FileList | null;
  onFilesChange: (files: FileList | null) => void;
  loading: boolean;
  /** The amount being paid now («1293.75»), or null for caja menuda (paid in full). */
  onConfirm: (monto: string | null) => void;
}

type Opcion = 'total' | 'parcial';

/** Money travels in whole cents: 0.1 + 0.2 never adds up in floating point. */
const centavos = (valor: number | string | undefined | null): number =>
  Math.round(Number(valor ?? 0) * 100);
const dinero = (c: number) => formatMoney(c / 100);

export function RegistrarPagoDialog({
  open,
  onOpenChange,
  tipo,
  totalAPagar,
  pagado,
  fecha,
  onFechaChange,
  files,
  onFilesChange,
  loading,
  onConfirm,
}: RegistrarPagoDialogProps) {
  const isReembolso = tipo === 'reembolso';
  const isApertura = tipo === 'apertura';
  const esRegular = !isReembolso && !isApertura;

  const [opcion, setOpcion] = useState<Opcion>('total');
  const [montoTexto, setMontoTexto] = useState('');

  // Every time the window opens it starts on «Pago total», with nothing typed.
  useEffect(() => {
    if (open) {
      setOpcion('total');
      setMontoTexto('');
    }
  }, [open]);

  const total = centavos(totalAPagar);
  const yaPagado = centavos(pagado);
  const saldo = total - yaPagado;
  const escrito = parseMoney(montoTexto);
  const escritoCentavos = escrito === null ? null : Math.round(escrito * 100);
  const parcial = opcion === 'parcial';
  const estePago = parcial ? (escritoCentavos ?? 0) : saldo;
  const excede = parcial && escritoCentavos !== null && escritoCentavos > saldo;
  const montoValido = !parcial || (escritoCentavos !== null && escritoCentavos > 0 && !excede);

  const title = isReembolso
    ? 'Registrar Reembolso'
    : isApertura
      ? 'Registrar Transferencia'
      : 'Registrar Pago';

  const description = isReembolso
    ? 'Ingresa la fecha del reembolso y adjunta el comprobante.'
    : isApertura
      ? 'Ingresa la fecha de la transferencia y adjunta el comprobante.'
      : 'Ingresa la fecha de pago, el monto y adjunta el comprobante.';

  const fechaLabel = isReembolso
    ? 'Fecha de reembolso'
    : isApertura
      ? 'Fecha de transferencia'
      : 'Fecha de pago';

  const confirmLabel = isReembolso
    ? 'Confirmar Reembolso'
    : parcial && esRegular
      ? 'Confirmar Pago Parcial'
      : 'Confirmar Pago';

  const puedeConfirmar =
    !!fecha &&
    !!files &&
    files.length > 0 &&
    !loading &&
    (!esRegular || (saldo > 0 && montoValido));

  const elegir = (valor: Opcion) => {
    setOpcion(valor);
    if (valor === 'total') setMontoTexto('');
  };

  const confirmar = () => {
    if (!puedeConfirmar) return;
    onConfirm(esRegular ? (estePago / 100).toFixed(2) : null);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="simple"
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!puedeConfirmar}>
            {loading ? 'Registrando...' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{fechaLabel}</Label>
          <DatePicker
            value={fecha}
            onChange={onFechaChange}
            className="mt-1"
          />
        </div>

        {esRegular && (
          <>
            <div>
              <Label>Monto</Label>
              <RadioGroup
                value={opcion}
                onValueChange={(v) => elegir(v as Opcion)}
                className="mt-2 grid gap-2"
              >
                <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="total" id="pago-total" />
                  Pago total
                  <span className="ml-auto font-semibold tabular-nums whitespace-nowrap">
                    {dinero(saldo)}
                  </span>
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <label
                    htmlFor="pago-parcial"
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <RadioGroupItem value="parcial" id="pago-parcial" />
                    Pago parcial
                  </label>
                  {/* Typing here is choosing «Pago parcial»: the box is never
                      disabled, it just looks faded until it is the choice. */}
                  <Input
                    value={montoTexto}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Monto del pago parcial"
                    onFocus={() => setOpcion('parcial')}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    onBlur={() => {
                      if (escrito !== null && escrito > 0) {
                        setMontoTexto(
                          escrito.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }),
                        );
                      }
                    }}
                    className={cn(
                      'ml-auto w-36 text-right tabular-nums',
                      !parcial && 'opacity-50',
                    )}
                  />
                </div>
                {excede && (
                  <p className="text-sm text-error text-right">
                    El monto es mayor que el saldo ({dinero(saldo)}).
                  </p>
                )}
              </RadioGroup>
            </div>

            <div className="space-y-1.5 rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
              <FilaResumen etiqueta="Total a pagar" valor={dinero(total)} />
              <FilaResumen etiqueta="Pagado" valor={dinero(yaPagado)} />
              <FilaResumen etiqueta="Este pago" valor={dinero(estePago)} />
              <div className="border-t border-border pt-1.5">
                <FilaResumen
                  etiqueta="Saldo después del pago"
                  valor={excede ? '—' : dinero(saldo - estePago)}
                  fuerte
                />
              </div>
            </div>
          </>
        )}

        <div>
          <Label>Comprobante(s)</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => onFilesChange(e.target.files)}
            className="mt-1"
          />
        </div>
      </div>
    </AppDialog>
  );
}

function FilaResumen({
  etiqueta,
  valor,
  fuerte = false,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className={fuerte ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
        {etiqueta}
      </span>
      <span className="font-semibold tabular-nums">{valor}</span>
    </div>
  );
}
