// Payment-status info cards shown inside SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor.
//
// Renders up to four colored info cards, each conditional on the
// solicitud state:
// - Pagos (blue)                 — a regular request with payments (abonada,
//                                  pagada, facturada): total, paid, balance and
//                                  each payment with its receipt (pagos
//                                  parciales, migración 191; mock approved by
//                                  Ivan 2026-11-18, also for one payment)
// - Comprobante de Transferencia (blue) — caja menuda opening (transferida)
// - Factura o Recibo (emerald)   — facturada, or abonada once it is registered
// - Devolución (red)             — devolucion
// - Comprobante de Reembolso (amber) — pinellas_paga && (pagada|facturada)
//
// They are grouped in one component because they share a visual
// pattern (colored card with header + info fields + optional
// attachments preview or download button) and are always rendered
// in the same vertical sequence.

import { useState } from 'react';
import { formatMoney } from '@/utils/formatters';
import { fecha } from '@/lib/fechas';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/shell/Alert';
import { Download, Upload } from 'lucide-react';
import api from '../../../../services/api';
import AdjuntosPreview from '../../../../components/AdjuntosPreview';
import type { SolicitudPagoAdjunto } from '../../../../types/api';
import type { PagoSolicitud, SolicitudPago } from '../../types';

interface SolicitudPaymentStatusCardsProps {
  solicitud: SolicitudPago;
  comprobante: {
    fecha_pago: string;
    registrado_por_nombre: string;
    adjuntos: SolicitudPagoAdjunto[];
  } | null;
  /** Every payment; only the active ones are shown (a cancelled one is in the
   *  corrections history). */
  pagos: PagoSolicitud[];
  factura: {
    fecha_factura: string;
    numero_factura?: string;
    tipo?: string;
    registrado_por_nombre: string;
    adjuntos: SolicitudPagoAdjunto[];
  } | null;
  devolucion: {
    id: number;
    fecha_devolucion: string;
    motivo: string;
    comprobante_url: string;
    comprobante_nombre: string;
    registrado_por_nombre: string;
  } | null;
  reembolso: {
    id: number;
    comprobante_url: string | null;
    comprobante_nombre: string | null;
    fecha_reembolso: string;
    registrado_por_nombre: string;
  } | null;
  isAdminOrCoAdmin: boolean;
  hasPermission: (key: string) => boolean;
  onOpenRegistrarReembolsoPinellasDialog: () => void;
}

export function SolicitudPaymentStatusCards({
  solicitud,
  comprobante,
  pagos,
  factura,
  devolucion,
  reembolso,
  isAdminOrCoAdmin,
  hasPermission,
  onOpenRegistrarReembolsoPinellasDialog,
}: SolicitudPaymentStatusCardsProps) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const vigentes = pagos.filter((p) => p.activo);
  const conPagos =
    solicitud.tipo === 'regular' &&
    ['abonada', 'pagada', 'facturada'].includes(solicitud.estado) &&
    vigentes.length > 0;
  const total = Number(solicitud.monto_total);
  const pagado = Number(
    solicitud.pagado ?? vigentes.reduce((s, p) => s + Number(p.monto), 0),
  );
  const saldo = Number(solicitud.saldo ?? total - pagado);

  return (
    <>
      {/* Pagos */}
      {conPagos && (
        <div className="space-y-3">
          <div className="p-4 bg-info/[0.06] border border-info/20 rounded-lg space-y-3">
            <h4 className="font-medium text-foreground">Pagos</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Cifra etiqueta="Total a pagar" valor={formatMoney(total)} />
              <Cifra etiqueta="Pagado" valor={formatMoney(pagado)} />
              <Cifra etiqueta="Saldo" valor={formatMoney(saldo)} />
            </div>
            <div className="rounded-lg border bg-card divide-y">
              {vigentes.map((p, i) => (
                <div key={p.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        Pago {i + 1} · {fecha(p.fecha_pago)}
                      </div>
                      <div className="text-muted-foreground">
                        Registrado por: {p.registrado_por_nombre ?? '—'}
                      </div>
                    </div>
                    <div className="font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(Number(p.monto))}
                    </div>
                  </div>
                  {p.adjuntos.length > 0 && (
                    <AdjuntosPreview
                      adjuntos={p.adjuntos}
                      solicitudPagoId={solicitud.id}
                      readOnly
                      title={null}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comprobante de Transferencia (caja menuda: la apertura, como siempre) */}
      {solicitud.estado === 'transferida' &&
        comprobante && (
          <div className="space-y-3">
            <div className="p-4 bg-info/[0.06] border border-info/20 rounded-lg space-y-3">
              <h4 className="font-medium text-foreground">
                {solicitud.tipo === 'apertura' ? 'Comprobante de Transferencia' : 'Comprobante de Pago'}
              </h4>
              <div className="text-sm text-slate-700 space-y-1">
                <div>
                  {solicitud.tipo === 'apertura' ? 'Fecha de transferencia' : 'Fecha de pago'}:{' '}
                  {fecha(comprobante.fecha_pago)}
                </div>
                <div>Registrado por: {comprobante.registrado_por_nombre}</div>
              </div>
              {comprobante.adjuntos.length > 0 && (
                <AdjuntosPreview
                  adjuntos={comprobante.adjuntos}
                  solicitudPagoId={solicitud.id}
                  readOnly
                  title="Comprobantes"
                />
              )}
            </div>
          </div>
        )}

      {/* Factura */}
      {(solicitud.estado === 'facturada' || solicitud.estado === 'abonada') &&
        factura && (
        <div className="space-y-3">
          <div className="p-4 bg-success/[0.06] border border-success/20 rounded-lg space-y-3">
            <h4 className="font-medium text-foreground">
              {factura.tipo === 'recibo' ? 'Recibo' : 'Factura'}
            </h4>
            <div className="text-sm text-slate-700 space-y-1">
              <div>
                Fecha:{' '}
                {fecha(factura.fecha_factura)}
              </div>
              {factura.numero_factura && (
                <div>Número de factura: {factura.numero_factura}</div>
              )}
              <div>Registrado por: {factura.registrado_por_nombre}</div>
            </div>
            {factura.adjuntos.length > 0 && (
              <AdjuntosPreview
                adjuntos={factura.adjuntos}
                solicitudPagoId={solicitud.id}
                readOnly
                title={factura.tipo === 'recibo' ? 'Recibos' : 'Facturas'}
              />
            )}
          </div>
        </div>
      )}

      {/* Devolución */}
      {solicitud.estado === 'devolucion' && devolucion && (
        <div className="space-y-3">
          <div className="p-4 bg-error/[0.06] border border-error/20 rounded-lg space-y-3">
            <h4 className="font-medium text-foreground">Devolución</h4>
            <div className="text-sm text-slate-700 space-y-1">
              <div>
                Fecha:{' '}
                {fecha(devolucion.fecha_devolucion)}
              </div>
              <div>Motivo: {devolucion.motivo}</div>
              <div>Registrado por: {devolucion.registrado_por_nombre}</div>
            </div>
            {devolucion.comprobante_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const resp = await api.get(
                      `/solicitudes-pago/${solicitud.id}/devolucion/comprobante`,
                    );
                    if (resp.data.success && resp.data.url) {
                      window.open(resp.data.url, '_blank');
                    }
                  } catch {
                    setDownloadError('Error al descargar comprobante');
                  }
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {devolucion.comprobante_nombre}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Comprobante de Reembolso (Pinellas paga) */}
      {solicitud.pinellas_paga &&
        ['pagada', 'facturada'].includes(solicitud.estado) && (
          <div className="space-y-3">
            {reembolso ? (
              <div className="p-4 bg-warning/[0.06] border border-warning/20 rounded-lg space-y-3">
                <h4 className="font-medium text-foreground">
                  Comprobante de Reembolso
                </h4>
                <div className="text-sm text-slate-700 space-y-1">
                  <div>
                    Fecha de reembolso:{' '}
                    {fecha(reembolso.fecha_reembolso)}
                  </div>
                  <div>Registrado por: {reembolso.registrado_por_nombre}</div>
                  {reembolso.comprobante_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const resp = await api.get(
                            `/solicitudes-pago/${solicitud.id}/reembolso/comprobante`,
                          );
                          if (resp.data.success && resp.data.url) {
                            window.open(resp.data.url, '_blank');
                          }
                        } catch {
                          setDownloadError('Error al descargar comprobante');
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {reembolso.comprobante_nombre}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              (isAdminOrCoAdmin || hasPermission('registrar_pago')) && (
                <div className="p-4 bg-warning/[0.04] border border-warning/20 border-dashed rounded-lg">
                  <div className="text-sm text-warning mb-2">
                    Pinellas paga esta solicitud. Pendiente de registrar
                    reembolso.
                  </div>
                  <Button
                    variant="outline"
                    onClick={onOpenRegistrarReembolsoPinellasDialog}
                    className="w-full border-warning/30 text-warning hover:bg-warning/[0.06]"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Registrar Reembolso
                  </Button>
                </div>
              )
            )}
          </div>
        )}

      {downloadError && (
        <Alert variant="error" title={downloadError} />
      )}
    </>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{etiqueta}</div>
      <div className="font-semibold tabular-nums">{valor}</div>
    </div>
  );
}
