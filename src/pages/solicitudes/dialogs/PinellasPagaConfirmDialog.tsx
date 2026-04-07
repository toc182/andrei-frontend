// Confirmation when toggling the "pinellas paga" flag on a solicitud.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PinellasPagaConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingValue: boolean;
  onConfirm: () => void;
}

export function PinellasPagaConfirmDialog({
  open,
  onOpenChange,
  pendingValue,
  onConfirm,
}: PinellasPagaConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar cambio</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingValue
              ? '¿Marcar esta solicitud como pago de Pinellas pendiente de reembolso?'
              : '¿Quitar la marca de reembolso Pinellas a esta solicitud?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
