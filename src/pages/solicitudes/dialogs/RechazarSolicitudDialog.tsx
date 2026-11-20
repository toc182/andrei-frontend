// Dialog for rejecting a solicitud — captures a reason and calls back.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// Uses the project view's responsive layout (mobile-friendly), which is
// strictly better than the general view's previous layout.
//
// The opening of a caja menuda (Ivan, 2026-11-19): while the caja has
// expenses it can't be rejected, and the dialog says so with the two ways out
// instead of asking for a reason; without expenses it warns that the caja will
// be cancelled. The server enforces the same rule.

import { Alert } from '@/components/shell/Alert';
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
  /** Para rechazar algo que no es una solicitud (una orden de compra). */
  title?: string;
  /** La solicitud es la apertura de esta caja menuda. */
  cajaApertura?: { nombre: string; gastos: number } | null;
  /** Número de la solicitud, para nombrarla cuando no se puede rechazar. */
  numero?: string;
}

export function RechazarSolicitudDialog({
  open,
  onOpenChange,
  comment,
  onCommentChange,
  onConfirm,
  title = 'Rechazar Solicitud',
  cajaApertura,
  numero,
}: RechazarSolicitudDialogProps) {
  if (cajaApertura && cajaApertura.gastos > 0) {
    const gastos =
      cajaApertura.gastos === 1
        ? 'La caja ya tiene 1 gasto registrado.'
        : `La caja ya tiene ${cajaApertura.gastos} gastos registrados.`;
    return (
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="confirm"
        title="No se puede rechazar la apertura"
        description={numero ? `Solicitud ${numero} · ${cajaApertura.nombre}` : cajaApertura.nombre}
        footer={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <Alert
          variant="warning"
          title={gastos}
          description={
            <>
              <span className="block">a) Elimine los gastos de la caja y vuelva a rechazar la solicitud.</span>
              <span className="mt-1 block">
                b) Si el problema es el monto, baje el monto de la caja. La solicitud se reemplazará por una
                nueva por el monto correcto.
              </span>
            </>
          }
        />
      </AppDialog>
    );
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="confirm"
      title={title}
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
      {cajaApertura && (
        <Alert
          variant="warning"
          title={`La caja ${cajaApertura.nombre} quedará cancelada.`}
          description="Al rechazar la apertura, la caja no admitirá gastos ni cambios de monto y pasará a Inactivas."
          className="mb-4"
        />
      )}
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
