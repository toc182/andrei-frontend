// Action buttons row for SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor.
//
// Renders the contextual action buttons: Download PDF, the Settings dropdown
// (Corregir / Registrar Devolución), and the Editar Solicitud button.
// The dialog title and solicitud number are provided by AppDialog — this
// component only handles the button row.

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Pencil, Settings, Undo2 } from 'lucide-react';
import type { SolicitudPago, Aprobacion } from '../../types';

interface SolicitudDetailHeaderProps {
  solicitud: SolicitudPago | null;
  aprobaciones: Aprobacion[];
  isAdmin: boolean;
  isAdminOrCoAdmin: boolean;
  canManage: boolean;
  canManageSolicitud: (sol: SolicitudPago) => boolean;
  hasPermission: (key: string) => boolean;
  onDownloadPDF: (id: number) => void;
  onOpenCorreccion: () => void;
  onOpenDevolucionForm: () => void;
  onEditSolicitud: (sol: SolicitudPago) => void;
  onRequestEditConfirmation: (sol: SolicitudPago, approvedCount: number) => void;
}

export function SolicitudDetailHeader({
  solicitud,
  aprobaciones,
  isAdmin,
  isAdminOrCoAdmin,
  canManage,
  canManageSolicitud,
  hasPermission,
  onDownloadPDF,
  onOpenCorreccion,
  onOpenDevolucionForm,
  onEditSolicitud,
  onRequestEditConfirmation,
}: SolicitudDetailHeaderProps) {
  if (!solicitud) return null;

  // Only the admin corrects, also a request paid in part (abonada): that is
  // where a payment is fixed or cancelled. A refund from the supplier is only
  // for a request paid in full.
  const puedeCorregir =
    isAdmin && ['abonada', 'pagada', 'facturada'].includes(solicitud.estado);
  const puedeDevolver =
    (solicitud.estado === 'pagada' || solicitud.estado === 'facturada') &&
    (isAdminOrCoAdmin || hasPermission('registrar_pago'));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => onDownloadPDF(solicitud.id)}
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        Descargar PDF
      </Button>
      {(puedeCorregir || puedeDevolver) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {puedeCorregir && (
              <DropdownMenuItem onClick={onOpenCorreccion}>
                <Pencil className="h-4 w-4 mr-2" />
                Corregir solicitud
              </DropdownMenuItem>
            )}
            {puedeDevolver && (
              <DropdownMenuItem onClick={onOpenDevolucionForm}>
                <Undo2 className="h-4 w-4 mr-2" />
                Registrar Devolución
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canManage &&
        (solicitud.estado === 'pendiente' ||
          solicitud.estado === 'aprobada') &&
        canManageSolicitud(solicitud) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const aprobadas = aprobaciones.filter(
                (a) => a.accion === 'aprobado',
              ).length;
              if (aprobadas > 0) {
                onRequestEditConfirmation(solicitud, aprobadas);
                return;
              }
              onEditSolicitud(solicitud);
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar Solicitud
          </Button>
        )}
    </div>
  );
}
