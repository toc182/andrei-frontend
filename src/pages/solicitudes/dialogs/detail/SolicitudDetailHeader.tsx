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
  onRequestEditConfirmation: (sol: SolicitudPago) => void;
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
      {(solicitud.estado === 'pagada' || solicitud.estado === 'facturada') &&
        (isAdminOrCoAdmin || hasPermission('registrar_pago')) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin &&
                (solicitud.estado === 'pagada' ||
                  solicitud.estado === 'facturada') && (
                  <DropdownMenuItem onClick={onOpenCorreccion}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Corregir solicitud
                  </DropdownMenuItem>
                )}
              <DropdownMenuItem onClick={onOpenDevolucionForm}>
                <Undo2 className="h-4 w-4 mr-2" />
                Registrar Devolución
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      {canManage &&
        solicitud.estado === 'pendiente' &&
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
                onRequestEditConfirmation(solicitud);
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
