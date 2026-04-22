// Dialog for rejecting a solicitud — captures a reason and calls back.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Uses the project view's responsive layout (mobile-friendly), which is
// strictly better than the general view's previous layout.

import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface RechazarSolicitudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
}

export function RechazarSolicitudDialog({
  open,
  onOpenChange,
  comment,
  onCommentChange,
  onConfirm,
}: RechazarSolicitudDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="confirm"
      title="Rechazar Solicitud"
      description="Indique el motivo del rechazo"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!comment.trim()}
          >
            Rechazar
          </Button>
        </>
      }
    >
      <div>
        <Label>Comentario *</Label>
        <Textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Motivo del rechazo..."
          className="mt-1"
          rows={3}
        />
      </div>
    </AppDialog>
  );
}
