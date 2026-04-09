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
  Download,
  RefreshCw,
  Check,
  X,
  Clock,
  Eye,
  CreditCard,
  FileCheck,
  Send,
  Upload,
} from 'lucide-react';
import api from '../../../services/api';
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
  correcciones: {
    id: number;
    motivo: string;
    cambios: unknown[];
    version_pdf: string | null;
    created_at: string;
    usuario_nombre: string;
  }[];
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

            {/* Comprobante de Pago */}
            {(solicitud.estado === 'pagada' ||
              solicitud.estado === 'facturada') &&
              comprobante && (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <h4 className="font-medium text-blue-900">
                      Comprobante de Pago
                    </h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <div>
                        Fecha de pago:{' '}
                        {new Date(
                          comprobante.fecha_pago.split('T')[0] + 'T12:00:00',
                        ).toLocaleDateString('es-PA')}
                      </div>
                      <div>
                        Registrado por: {comprobante.registrado_por_nombre}
                      </div>
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
                    <div>
                      Registrado por: {devolucion.registrado_por_nombre}
                    </div>
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
                          alert('Error al descargar comprobante');
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
                            reembolso.fecha_reembolso + 'T12:00:00',
                          ).toLocaleDateString('es-PA')}
                        </div>
                        <div>
                          Registrado por: {reembolso.registrado_por_nombre}
                        </div>
                        {reembolso.comprobante_nombre && (
                          <div>Archivo: {reembolso.comprobante_nombre}</div>
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

            {/* Historial de Correcciones */}
            {correcciones.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">
                  Historial de Correcciones
                </h4>
                <div className="space-y-2">
                  {correcciones.map((correccion) => {
                    const cambios = correccion.cambios as {
                      campo: string;
                      anterior?: string;
                      nuevo?: string;
                      cambios?: unknown[];
                      descripcion?: string;
                    }[];
                    return (
                      <details
                        key={correccion.id}
                        className="border border-gray-200 rounded-lg"
                      >
                        <summary className="px-4 py-3 bg-gray-50 cursor-pointer flex items-center justify-between rounded-lg hover:bg-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {new Date(
                                correccion.created_at,
                              ).toLocaleDateString('es-PA', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-sm text-gray-500">
                              — {correccion.usuario_nombre}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {cambios.length} cambio
                            {cambios.length !== 1 ? 's' : ''}
                          </Badge>
                        </summary>
                        <div className="px-4 py-3 space-y-3">
                          <div className="text-sm text-gray-600 italic">
                            Motivo: {correccion.motivo}
                          </div>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="pb-1 pr-3">Campo</th>
                                <th className="pb-1 pr-3">Anterior</th>
                                <th className="pb-1">Nuevo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cambios.map((cambio, idx) => {
                                const labelMap: Record<string, string> = {
                                  proveedor: 'Proveedor',
                                  fecha: 'Fecha',
                                  observaciones: 'Observaciones',
                                  beneficiario: 'Beneficiario',
                                  banco: 'Banco',
                                  tipo_cuenta: 'Tipo de cuenta',
                                  numero_cuenta: 'Número de cuenta',
                                  fecha_pago: 'Fecha de pago',
                                  fecha_factura: 'Fecha de factura',
                                  numero_factura: 'Número de factura',
                                  tipo: 'Tipo',
                                  subtotal: 'Subtotal',
                                  monto_total: 'Monto total',
                                  comprobante: 'Comprobante',
                                  factura: 'Factura',
                                  descripcion: 'Descripción',
                                  cantidad: 'Cantidad',
                                  unidad: 'Unidad',
                                  precio_unitario: 'Precio unitario',
                                };
                                const label = (campo: string) =>
                                  labelMap[campo] || campo;
                                if (
                                  cambio.campo === 'item' &&
                                  'cambios' in cambio
                                ) {
                                  const itemCambios = cambio.cambios as {
                                    campo: string;
                                    anterior: string;
                                    nuevo: string;
                                  }[];
                                  return itemCambios.map((ic, icIdx) => (
                                    <tr
                                      key={`${idx}-${icIdx}`}
                                      className="border-t border-gray-100"
                                    >
                                      <td className="py-1.5 pr-3 text-gray-700">
                                        Item &quot;{cambio.descripcion}&quot; —{' '}
                                        {label(ic.campo)}
                                      </td>
                                      <td className="py-1.5 pr-3 text-red-600 line-through">
                                        {ic.anterior}
                                      </td>
                                      <td className="py-1.5 text-green-600">
                                        {ic.nuevo}
                                      </td>
                                    </tr>
                                  ));
                                }
                                if (cambio.campo === 'item_agregado') {
                                  return (
                                    <tr
                                      key={idx}
                                      className="border-t border-gray-100"
                                    >
                                      <td className="py-1.5 pr-3 text-gray-700">
                                        Item agregado
                                      </td>
                                      <td className="py-1.5 pr-3 text-gray-400">
                                        —
                                      </td>
                                      <td className="py-1.5 text-green-600">
                                        {cambio.descripcion}
                                      </td>
                                    </tr>
                                  );
                                }
                                if (cambio.campo === 'item_eliminado') {
                                  return (
                                    <tr
                                      key={idx}
                                      className="border-t border-gray-100"
                                    >
                                      <td className="py-1.5 pr-3 text-gray-700">
                                        Item eliminado
                                      </td>
                                      <td className="py-1.5 pr-3 text-red-600 line-through">
                                        {cambio.descripcion}
                                      </td>
                                      <td className="py-1.5 text-gray-400">
                                        —
                                      </td>
                                    </tr>
                                  );
                                }
                                return (
                                  <tr
                                    key={idx}
                                    className="border-t border-gray-100"
                                  >
                                    <td className="py-1.5 pr-3 text-gray-700">
                                      {label(cambio.campo)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-red-600 line-through">
                                      {typeof cambio.anterior === 'string'
                                        ? cambio.anterior
                                        : '—'}
                                    </td>
                                    <td className="py-1.5 text-green-600">
                                      {typeof cambio.nuevo === 'string'
                                        ? cambio.nuevo
                                        : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}

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
