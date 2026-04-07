// Dialog for rejecting a solicitud — captures a reason and calls back.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Uses the project view's responsive layout (mobile-friendly), which is
// strictly better than the general view's previous layout.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Rechazar Solicitud</DialogTitle>
          <DialogDescription>Indique el motivo del rechazo</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label>Comentario *</Label>
          <Textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Motivo del rechazo..."
            className="mt-1"
            rows={3}
          />
        </div>
        <DialogFooter className="flex gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!comment.trim()}
            className="w-full sm:w-auto"
          >
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
