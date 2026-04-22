// Payment-status info cards shown inside SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor.
//
// Renders up to four colored info cards, each conditional on the
// solicitud state:
// - Comprobante de Pago (blue)   — pagada / facturada
// - Factura o Recibo (emerald)   — facturada
// - Devolución (red)             — devolucion
// - Comprobante de Reembolso (amber) — pinellas_paga && (pagada|facturada)
//
// They are grouped in one component because they share a visual
// pattern (colored card with header + info fields + optional
// attachments preview or download button) and are always rendered
// in the same vertical sequence.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/shell/Alert';
import { Download, Upload } from 'lucide-react';
import api from '../../../../services/api';
import AdjuntosPreview from '../../../../components/AdjuntosPreview';
import type { SolicitudPagoAdjunto } from '../../../../types/api';
import type { SolicitudPago } from '../../types';

interface SolicitudPaymentStatusCardsProps {
  solicitud: SolicitudPago;
  comprobante: {
    fecha_pago: string;
    registrado_por_nombre: string;
    adjuntos: SolicitudPagoAdjunto[];
  } | null;
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
  factura,
  devolucion,
  reembolso,
  isAdminOrCoAdmin,
  hasPermission,
  onOpenRegistrarReembolsoPinellasDialog,
}: SolicitudPaymentStatusCardsProps) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  return (
    <>
      {/* Comprobante de Pago */}
      {(solicitud.estado === 'pagada' || solicitud.estado === 'facturada' || solicitud.estado === 'transferida') &&
        comprobante && (
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <h4 className="font-medium text-blue-900">
                {solicitud.tipo === 'apertura' ? 'Comprobante de Transferencia' : 'Comprobante de Pago'}
              </h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div>
                  {solicitud.tipo === 'apertura' ? 'Fecha de transferencia' : 'Fecha de pago'}:{' '}
                  {new Date(
                    comprobante.fecha_pago.split('T')[0] + 'T12:00:00',
                  ).toLocaleDateString('es-PA')}
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
      {solicitud.estado === 'facturada' && factura && (
        <div className="space-y-3">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
            <h4 className="font-medium text-emerald-900">
              {factura.tipo === 'recibo' ? 'Recibo' : 'Factura'}
            </h4>
            <div className="text-sm text-emerald-800 space-y-1">
              <div>
                Fecha:{' '}
                {new Date(
                  factura.fecha_factura.split('T')[0] + 'T12:00:00',
                ).toLocaleDateString('es-PA')}
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
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <h4 className="font-medium text-red-900">Devolución</h4>
            <div className="text-sm text-red-800 space-y-1">
              <div>
                Fecha:{' '}
                {new Date(
                  devolucion.fecha_devolucion.split('T')[0] + 'T12:00:00',
                ).toLocaleDateString('es-PA')}
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
              <div className="p-4 bg-yellow-50/50 border border-amber-200 rounded-lg space-y-3">
                <h4 className="font-medium text-amber-900">
                  Comprobante de Reembolso
                </h4>
                <div className="text-sm text-amber-800 space-y-1">
                  <div>
                    Fecha de reembolso:{' '}
                    {new Date(
                      reembolso.fecha_reembolso.split('T')[0] + 'T12:00:00',
                    ).toLocaleDateString('es-PA')}
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
                <div className="p-4 bg-yellow-50/50/50 border border-amber-200 border-dashed rounded-lg">
                  <div className="text-sm text-amber-700 mb-2">
                    Pinellas paga esta solicitud. Pendiente de registrar
                    reembolso.
                  </div>
                  <Button
                    variant="outline"
                    onClick={onOpenRegistrarReembolsoPinellasDialog}
                    className="w-full border-amber-300 text-amber-700 hover:bg-yellow-50/50"
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
