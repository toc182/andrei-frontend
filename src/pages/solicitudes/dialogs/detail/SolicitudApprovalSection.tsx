// Estado y Aprobaciones section shown inside SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor.
//
// This is the largest section of the dialog — it owns:
// - The estado badge row (plus Reembolso pendiente/Reembolsada tags)
// - The Pinellas paga (reembolso) checkbox, with disabled rules
// - The approver list (shows the linear history if already
//   pagada/facturada, or the full aprobadores roster with ticks if
//   pendiente/aprobada)
// - The rechazo comment block when rechazada
// - The action buttons (Marcar Revisada / Aprobar / Rechazar,
//   Registrar Pago, Registrar Factura, Reenviar)

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Check,
  X,
  Clock,
  Eye,
  RefreshCw,
  CreditCard,
  FileCheck,
  Send,
} from 'lucide-react';
import type {
  SolicitudPago,
  Aprobacion,
  AprobadorProyecto,
} from '../../types';

interface SolicitudApprovalSectionProps {
  solicitud: SolicitudPago;
  aprobaciones: Aprobacion[];
  aprobadores: AprobadorProyecto[];
  reembolso: { id: number } | null;
  revisada: boolean;
  togglingRevisada: boolean;
  resubmitting: boolean;

  currentUserId: number | undefined;
  isAdminOrCoAdmin: boolean;
  canManage: boolean;
  hasPermission: (key: string) => boolean;

  renderEstadoBadge: (estado: string, esMiTurno?: boolean) => ReactNode;

  onPinellasPagaChange: (newValue: boolean) => void;
  onToggleRevisada: (id: number) => void;
  onAprobar: (id: number) => void;
  onOpenRejectDialog: (id: number) => void;
  onOpenRegistrarPagoDialog: () => void;
  onOpenRegistrarFacturaDialog: () => void;
  onReenviar: (id: number) => void;
}

export function SolicitudApprovalSection({
  solicitud,
  aprobaciones,
  aprobadores,
  reembolso,
  revisada,
  togglingRevisada,
  resubmitting,
  currentUserId,
  isAdminOrCoAdmin,
  canManage,
  hasPermission,
  renderEstadoBadge,
  onPinellasPagaChange,
  onToggleRevisada,
  onAprobar,
  onOpenRejectDialog,
  onOpenRegistrarPagoDialog,
  onOpenRegistrarFacturaDialog,
  onReenviar,
}: SolicitudApprovalSectionProps) {
  const aprobacionesHechas = aprobaciones.filter(
    (a) => a.accion === 'aprobado',
  ).length;
  const siguienteAprobador = aprobadores[aprobacionesHechas];
  const esMiTurno =
    !!currentUserId &&
    solicitud.estado === 'pendiente' &&
    siguienteAprobador?.user_id === currentUserId;

  return (
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

        {solicitud.estado === 'pagada' || solicitud.estado === 'facturada'
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
                      {new Date(aprobacion.fecha).toLocaleDateString('es-PA', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
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
                          {new Date(aprobacion.fecha).toLocaleDateString(
                            'es-PA',
                            {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            },
                          )}
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
                <div className="text-red-700 mt-1">{rechazo.comentario}</div>
              </div>
            ))}

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
          (isAdminOrCoAdmin || hasPermission('registrar_pago')) && (
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
          (isAdminOrCoAdmin || hasPermission('registrar_pago')) && (
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
              {resubmitting ? 'Reenviando...' : 'Reenviar para Aprobacion'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
