// Confirmation when editing a solicitud that already has approvals.
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

interface EditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EditConfirmDialog({
  open,
  onOpenChange,
  count,
  onCancel,
  onConfirm,
}: EditConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar solicitud</AlertDialogTitle>
          <AlertDialogDescription>
            Esta solicitud ya tiene {count}{' '}
            {count === 1 ? 'aprobación' : 'aprobaciones'}. Si la editas, se
            reiniciará la cadena de aprobaciones y los aprobadores deberán
            aprobar nuevamente. ¿Deseas continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Editar y reiniciar aprobaciones
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}