// DetallePagoDialog — mirar un pago desde Control de Costos.
//
// Es el cuadro de Solicitudes de Pago RECORTADO a lo que sirve para revisar un
// gasto: que se compro, cuanto, y los papeles. Fuera quedan las aprobaciones y
// todo boton que cambie algo —aprobar, rechazar, registrar pago, eliminar—:
// aqui se viene a entender el gasto, no a tramitarlo. Para eso esta el enlace
// del pie, que lleva a la pantalla de solicitudes.
//
// Los adjuntos del pago y los del comprobante van en un mismo grupo de
// miniaturas: quien revisa no distingue entre "lo que venia con la solicitud" y
// "lo que se subio al pagar", quiere ver los papeles.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AppDialog, ErrorState } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';
import AdjuntosPreview from '@/components/AdjuntosPreview';
import api from '@/services/api';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '@/utils/dateUtils';
import type { SolicitudPagoAdjunto } from '@/types/api';
import type { SolicitudItem, SolicitudPago } from '@/pages/solicitudes/types';

const TH = 'px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

/** Las mismas clases de estado que el resto de la aplicacion. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  pagada: { texto: 'Pagada', clase: 'bg-success/10 text-success border-success/30' },
  facturada: { texto: 'Facturada', clase: 'bg-info/10 text-info border-info/30' },
  transferida: { texto: 'Transferida', clase: 'bg-info/10 text-info border-info/30' },
};

interface Detalle {
  solicitud: SolicitudPago;
  items: SolicitudItem[];
  adjuntos: SolicitudPagoAdjunto[];
  comprobante: { fecha_pago: string; adjuntos: SolicitudPagoAdjunto[] } | null;
}

interface DetallePagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El pago que se mira; null mientras no hay ninguno abierto. */
  solicitudId: number | null;
  /** Lleva a la pantalla de Solicitudes de Pago del proyecto. */
  onAbrirSolicitudes?: () => void;
}

export default function DetallePagoDialog({
  open, onOpenChange, solicitudId, onAbrirSolicitudes,
}: DetallePagoDialogProps) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (solicitudId == null) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/solicitudes-pago/${solicitudId}`);
      if (!res.data.success) throw new Error('respuesta sin exito');
      setDetalle({
        solicitud: res.data.solicitud,
        items: res.data.items ?? [],
        adjuntos: res.data.adjuntos ?? [],
        comprobante: res.data.comprobante ?? null,
      });
    } catch (err) {
      console.error('Error cargando el detalle del pago:', err);
      setError('No se pudo cargar el detalle de este pago.');
    } finally {
      setLoading(false);
    }
  }, [solicitudId]);

  useEffect(() => {
    if (!open) { setDetalle(null); setError(null); return; }
    cargar();
  }, [open, cargar]);

  const s = detalle?.solicitud;
  const estado = s ? ESTADOS[s.estado] : undefined;

  // Un adjunto puede venir en las dos listas; se muestra una sola vez.
  const papeles: SolicitudPagoAdjunto[] = [];
  if (detalle) {
    for (const a of [...detalle.adjuntos, ...(detalle.comprobante?.adjuntos ?? [])]) {
      if (!papeles.some((x) => x.id === a.id)) papeles.push(a);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title={s ? `${s.numero} · ${s.proveedor}` : 'Detalle del pago'}
      description={
        detalle?.comprobante
          ? `Pagado el ${formatDate(detalle.comprobante.fecha_pago)}`
          : s
            ? `Solicitado el ${formatDate(s.fecha)}`
            : undefined
      }
      footer={
        <>
          {onAbrirSolicitudes ? (
            <Button variant="outline" onClick={onAbrirSolicitudes}>
              Abrir la solicitud completa
            </Button>
          ) : <span />}
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error || !s ? (
        <ErrorState description={error ?? undefined} onRetry={cargar} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dato etiqueta="Concepto" valor={s.observaciones || '—'} />
            <Dato etiqueta="Categoría de gasto" valor={s.categoria_nombre || 'Sin categoría'} />
            <Dato etiqueta="Monto" valor={formatMoney(s.monto_total)} numerico />
            <Dato
              etiqueta="Estado"
              valor={
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                    estado?.clase ?? 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  {estado?.texto ?? s.estado}
                </span>
              }
            />
          </div>

          {detalle.items.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Renglones
              </h3>
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                      <TableHead className={TH}>Descripción</TableHead>
                      <TableHead className={`${TH} w-[90px] text-right`}>Cant.</TableHead>
                      <TableHead className={`${TH} w-[110px] text-right`}>Precio</TableHead>
                      <TableHead className={`${TH} w-[120px] text-right`}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.items.map((it) => (
                      <TableRow key={it.id} className="border-b border-slate-100 last:border-0">
                        <TableCell className="px-4 py-2 text-sm">
                          {it.descripcion}
                          {it.unidad && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({it.unidad})</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                          {it.cantidad}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                          {formatMoney(it.precio_unitario)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                          {formatMoney(it.precio_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {papeles.length > 0 ? (
            <AdjuntosPreview
              adjuntos={papeles}
              solicitudPagoId={s.id}
              readOnly
              title="Adjuntos y comprobante"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Este pago no tiene archivos adjuntos.</p>
          )}
        </div>
      )}
    </AppDialog>
  );
}

function Dato({
  etiqueta, valor, numerico,
}: { etiqueta: string; valor: React.ReactNode; numerico?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{etiqueta}</div>
      <div className={`text-sm text-foreground ${numerico ? 'tabular-nums' : ''}`}>{valor}</div>
    </div>
  );
}
