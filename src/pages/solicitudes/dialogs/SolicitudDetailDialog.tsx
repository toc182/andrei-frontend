// Full detail view of a solicitud de pago.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Uses the general view's items table layout (shadcn Table) for both
// pages — see issue #26 discussion.
//
// The Requisición field is NOT rendered — see issue #39 for the cleanup
// decision about requisicion-solicitud integration.

import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { SolicitudApprovalSection } from './detail/SolicitudApprovalSection';

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
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="detail"
      title="Detalle de Solicitud"
      description={solicitud?.numero}
    >
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
        <Badge className="bg-error/10 text-error border-error/30 border text-xs w-fit mt-2">
          Urgente
        </Badge>
      )}

      {solicitud && (
        <div className="space-y-4 mt-2">
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
          <SolicitudApprovalSection
            solicitud={solicitud}
            aprobaciones={aprobaciones}
            aprobadores={aprobadores}
            reembolso={reembolso}
            revisada={revisada}
            togglingRevisada={togglingRevisada}
            resubmitting={resubmitting}
            currentUserId={currentUserId}
            isAdminOrCoAdmin={isAdminOrCoAdmin}
            canManage={canManage}
            hasPermission={hasPermission}
            onPinellasPagaChange={onPinellasPagaChange}
            onToggleRevisada={onToggleRevisada}
            onAprobar={onAprobar}
            onOpenRejectDialog={onOpenRejectDialog}
            onOpenRegistrarPagoDialog={onOpenRegistrarPagoDialog}
            onOpenRegistrarFacturaDialog={onOpenRegistrarFacturaDialog}
            onReenviar={onReenviar}
          />

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
    </AppDialog>
  );
}
