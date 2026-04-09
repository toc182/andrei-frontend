// Full detail view of a solicitud de pago.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Uses the general view's items table layout (shadcn Table) for both
// pages — see issue #26 discussion.
//
// The Requisición field is NOT rendered — see issue #39 for the cleanup
// decision about requisicion-solicitud integration.

import { ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RefreshCw,
  Check,
  X,
  Clock,
  Eye,
  CreditCard,
  FileCheck,
  Send,
} from 'lucide-react';
import AdjuntosPreview from '../../../components/AdjuntosPreview';
import type { SolicitudPagoAdjunto } from '../../../types/api';
import type {
  SolicitudPago,
  SolicitudItem,
  SolicitudAjuste,
  Aprobacion,
  AprobadorProyecto,
} from '../types';
import { SolicitudBankDataCard } from './detail/SolicitudBankDataCard';
import { SolicitudBasicInfoSection } from './detail/SolicitudBasicInfoSection';
import { SolicitudItemsAndTotals } from './detail/SolicitudItemsAndTotals';
import { SolicitudDetailHeader } from './detail/SolicitudDetailHeader';
import { SolicitudPaymentStatusCards } from './detail/SolicitudPaymentStatusCards';
import {
  SolicitudCorreccionesHistory,
  type Correccion,
} from './detail/SolicitudCorreccionesHistory';

interface SolicitudDetailDialogProps {
  // Dialog open/close
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // The solicitud and its nested data
  solicitud: SolicitudPago | null;
  items: SolicitudItem[];
  ajustes: SolicitudAjuste[];
  aprobaciones: Aprobacion[];
  aprobadores: AprobadorProyecto[];
  adjuntos: SolicitudPagoAdjunto[];
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
  reembolso: {
    id: number;
    comprobante_url: string | null;
    comprobante_nombre: string | null;
    fecha_reembolso: string;
    registrado_por_nombre: string;
  } | null;
  devolucion: {
    id: number;
    fecha_devolucion: string;
    motivo: string;
    comprobante_url: string;
    comprobante_nombre: string;
    registrado_por_nombre: string;
  } | null;
  correcciones: Correccion[];
  puedeEliminar: boolean;
  revisada: boolean;
  togglingRevisada: boolean;
  uploadingFiles: boolean;
  resubmitting: boolean;

  // View mode — general view shows the project name, project view doesn't
  showProyectoField: boolean;

  // Current user and permissions
  currentUserId: number | undefined;
  isAdminOrCoAdmin: boolean;
  isAdmin: boolean;
  canManage: boolean;
  canManageSolicitud: (sol: SolicitudPago) => boolean;
  hasPermission: (key: string) => boolean;

  // Custom rendering hook for the status badge
  renderEstadoBadge: (estado: string, esMiTurno?: boolean) => ReactNode;

  // Actions — all callbacks the dialog fires
  onDownloadPDF: (id: number) => void;
  onOpenCorreccion: () => void;
  onOpenDevolucionForm: () => void;
  onEditSolicitud: (sol: SolicitudPago) => void;
  onRequestEditConfirmation: (sol: SolicitudPago) => void;
  onUploadAdjuntos: (files: FileList) => void;
  onDeleteAdjunto: (adjuntoId: number) => void;
  onPinellasPagaChange: (newValue: boolean) => void;
  onToggleRevisada: (id: number) => void;
  onAprobar: (id: number) => void;
  onOpenRejectDialog: (id: number) => void;
  onOpenRegistrarPagoDialog: () => void;
  onOpenRegistrarFacturaDialog: () => void;
  onOpenRegistrarReembolsoPinellasDialog: () => void;
  onReenviar: (id: number) => void;
  onOpenDeleteDialog: (id: number) => void;
}

export function SolicitudDetailDialog({
  open,
  onOpenChange,
  solicitud,
  items,
  ajustes,
  aprobaciones,
  aprobadores,
  adjuntos,
  comprobante,
  factura,
  reembolso,
  devolucion,
  correcciones,
  puedeEliminar,
  revisada,
  togglingRevisada,
  uploadingFiles,
  resubmitting,
  showProyectoField,
  currentUserId,
  isAdminOrCoAdmin,
  isAdmin,
  canManage,
  canManageSolicitud,
  hasPermission,
  renderEstadoBadge,
  onDownloadPDF,
  onOpenCorreccion,
  onOpenDevolucionForm,
  onEditSolicitud,
  onRequestEditConfirmation,
  onUploadAdjuntos,
  onDeleteAdjunto,
  onPinellasPagaChange,
  onToggleRevisada,
  onAprobar,
  onOpenRejectDialog,
  onOpenRegistrarPagoDialog,
  onOpenRegistrarFacturaDialog,
  onOpenRegistrarReembolsoPinellasDialog,
  onReenviar,
  onOpenDeleteDialog,
}: SolicitudDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <SolicitudDetailHeader
          solicitud={solicitud}
          aprobaciones={aprobaciones}
          isAdmin={isAdmin}
          isAdminOrCoAdmin={isAdminOrCoAdmin}
          canManage={canManage}
          canManageSolicitud={canManageSolicitud}
          hasPermission={hasPermission}
          onDownloadPDF={onDownloadPDF}
          onOpenCorreccion={onOpenCorreccion}
          onOpenDevolucionForm={onOpenDevolucionForm}
          onEditSolicitud={onEditSolicitud}
          onRequestEditConfirmation={onRequestEditConfirmation}
        />

        {solicitud?.urgente && (
          <Badge variant="destructive" className="text-xs w-fit">
            Urgente
          </Badge>
        )}

        {solicitud && (
          <div className="space-y-4">
            {/* Basic info */}
            <SolicitudBasicInfoSection
              solicitud={solicitud}
              showProyectoField={showProyectoField}
            />

            {/* Items + Totals */}
            <SolicitudItemsAndTotals
              solicitud={solicitud}
              items={items}
              ajustes={ajustes}
            />

            {/* Bank data */}
            <SolicitudBankDataCard solicitud={solicitud} />

            {/* Adjuntos */}
            <AdjuntosPreview
              adjuntos={adjuntos}
              solicitudPagoId={solicitud.id}
              onUpload={onUploadAdjuntos}
              onDelete={onDeleteAdjunto}
              uploading={uploadingFiles}
            />

            {/* Payment status cards — Comprobante de Pago, Factura,
                Devolución, Comprobante de Reembolso */}
            <SolicitudPaymentStatusCards
              solicitud={solicitud}
              comprobante={comprobante}
              factura={factura}
              devolucion={devolucion}
              reembolso={reembolso}
              isAdminOrCoAdmin={isAdminOrCoAdmin}
              hasPermission={hasPermission}
              onOpenRegistrarReembolsoPinellasDialog={
                onOpenRegistrarReembolsoPinellasDialog
              }
            />

            {/* Historial de Correcciones */}
            <SolicitudCorreccionesHistory correcciones={correcciones} />

            {/* Approval section */}
            <div className="space-y-3">
              <h4 className="font-medium">Estado y Aprobaciones</h4>
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {renderEstadoBadge(solicitud.estado)}
                  {solicitud.pinellas_paga && !reembolso && (
                    <Badge
                      variant="outline"
                      className="bg-yellow-50/50 text-amber-700 border-amber-300"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reembolso pendiente
                    </Badge>
                  )}
                  {solicitud.pinellas_paga && reembolso && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-300"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Reembolsada
                    </Badge>
                  )}
                </div>

                {(isAdminOrCoAdmin ||
                  solicitud.preparado_por === currentUserId) && (
                  <div>
                    <label
                      className={`flex items-center gap-2 text-sm ${
                        !solicitud.pinellas_paga &&
                        (solicitud.estado === 'pagada' ||
                          solicitud.estado === 'facturada')
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      <Checkbox
                        checked={solicitud.pinellas_paga}
                        disabled={
                          !solicitud.pinellas_paga &&
                          (solicitud.estado === 'pagada' ||
                            solicitud.estado === 'facturada')
                        }
                        onCheckedChange={(checked) =>
                          onPinellasPagaChange(!!checked)
                        }
                      />
                      Pinellas paga (reembolso)
                    </label>
                    {!solicitud.pinellas_paga &&
                      (solicitud.estado === 'pagada' ||
                        solicitud.estado === 'facturada') && (
                        <p className="text-xs text-muted-foreground ml-6 mt-1">
                          No disponible después de pagada
                        </p>
                      )}
                  </div>
                )}

                {solicitud.estado === 'pagada' ||
                solicitud.estado === 'facturada'
                  ? aprobaciones.length > 0 && (
                      <div className="space-y-2">
                        {aprobaciones.map((aprobacion, index) => (
                          <div
                            key={aprobacion.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {aprobacion.accion === 'aprobado' ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">
                              {index + 1}. {aprobacion.usuario_nombre}
                            </span>
                            <span className="text-muted-foreground">
                              —{' '}
                              {new Date(aprobacion.fecha).toLocaleDateString(
                                'es-PA',
                                {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                },
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  : aprobadores.length > 0 && (
                      <div className="space-y-2">
                        {aprobadores.map((aprobador) => {
                          const aprobacion = aprobaciones.find(
                            (a) => a.user_id === aprobador.user_id,
                          );
                          return (
                            <div
                              key={aprobador.user_id}
                              className="flex items-center gap-2 text-sm"
                            >
                              {aprobacion ? (
                                aprobacion.accion === 'aprobado' ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <X className="h-4 w-4 text-red-600" />
                                )
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">
                                {aprobador.orden}. {aprobador.nombre}
                              </span>
                              {aprobacion ? (
                                <span className="text-muted-foreground">
                                  —{' '}
                                  {new Date(
                                    aprobacion.fecha,
                                  ).toLocaleDateString('es-PA', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  (pendiente)
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                {solicitud.estado === 'rechazada' &&
                  aprobaciones
                    .filter((a) => a.accion === 'rechazado')
                    .map((rechazo) => (
                      <div
                        key={rechazo.id}
                        className="p-3 bg-red-50 border border-red-200 rounded text-sm"
                      >
                        <div className="font-medium text-red-800">
                          Rechazada por {rechazo.usuario_nombre}
                        </div>
                        <div className="text-red-700 mt-1">
                          {rechazo.comentario}
                        </div>
                      </div>
                    ))}

                {(() => {
                  if (!currentUserId || !solicitud) return null;
                  const aprobacionesHechas = aprobaciones.filter(
                    (a) => a.accion === 'aprobado',
                  ).length;
                  const siguienteAprobador = aprobadores[aprobacionesHechas];
                  const esMiTurno =
                    solicitud.estado === 'pendiente' &&
                    siguienteAprobador?.user_id === currentUserId;

                  return (
                    <>
                      {esMiTurno && (
                        <div className="space-y-2 pt-2">
                          <Button
                            variant={revisada ? 'secondary' : 'outline'}
                            onClick={() => onToggleRevisada(solicitud.id)}
                            disabled={togglingRevisada}
                            className="w-full"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {togglingRevisada
                              ? 'Procesando...'
                              : revisada
                                ? '✓ Revisada'
                                : 'Marcar como Revisada'}
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => onAprobar(solicitud.id)}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Aprobar
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => onOpenRejectDialog(solicitud.id)}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      )}

                      {solicitud.estado === 'aprobada' &&
                        (isAdminOrCoAdmin ||
                          hasPermission('registrar_pago')) && (
                          <div className="pt-2">
                            <Button
                              onClick={onOpenRegistrarPagoDialog}
                              className="w-full"
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              {solicitud.tipo === 'reembolso'
                                ? 'Registrar Reembolso'
                                : 'Registrar Pago'}
                            </Button>
                          </div>
                        )}

                      {solicitud.estado === 'pagada' &&
                        (isAdminOrCoAdmin ||
                          hasPermission('registrar_pago')) && (
                          <div className="pt-2">
                            <Button
                              onClick={onOpenRegistrarFacturaDialog}
                              className="w-full"
                            >
                              <FileCheck className="h-4 w-4 mr-2" />
                              Registrar Factura o Recibo
                            </Button>
                          </div>
                        )}

                      {solicitud.estado === 'rechazada' && canManage && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            onClick={() => onReenviar(solicitud.id)}
                            disabled={resubmitting}
                            className="w-full"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {resubmitting
                              ? 'Reenviando...'
                              : 'Reenviar para Aprobacion'}
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Delete */}
            {puedeEliminar && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => onOpenDeleteDialog(solicitud.id)}
                >
                  Eliminar Solicitud
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
