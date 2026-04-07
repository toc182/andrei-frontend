// Confirmation dialog for deleting a solicitud de pago.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// The warning text changes when an admin is deleting a non-pendiente
// solicitud (admins can delete in any state).

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SolicitudPago } from '../types';

interface DeleteSolicitudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudPago | null;
  isAdmin: boolean;
  loading: boolean;
  onConfirm: () => void;
}

export function DeleteSolicitudDialog({
  open,
  onOpenChange,
  solicitud,
  isAdmin,
  loading,
  onConfirm,
}: DeleteSolicitudDialogProps) {
  const showAdminOverrideWarning =
    isAdmin && solicitud && solicitud.estado !== 'pendiente';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Eliminar Solicitud</DialogTitle>
          <DialogDescription>
            {showAdminOverrideWarning
              ? `Esta solicitud está marcada como ${solicitud!.estado.toUpperCase()}. ¿Está seguro que desea eliminarla? Esta acción no se puede deshacer.`
              : '¿Está seguro que desea eliminar esta solicitud? Esta acción no se puede deshacer.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Eliminando...' : 'Si, Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
