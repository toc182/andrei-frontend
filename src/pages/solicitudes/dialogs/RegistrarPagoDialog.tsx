// Dialog for "Registrar Pago" / "Registrar Reembolso" — switches labels based
// on solicitud.tipo. Used after a solicitud has been approved.
//
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TipoSolicitud } from '../types';

interface RegistrarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoSolicitud | undefined;
  fecha: string;
  onFechaChange: (value: string) => void;
  files: FileList | null;
  onFilesChange: (files: FileList | null) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function RegistrarPagoDialog({
  open,
  onOpenChange,
  tipo,
  fecha,
  onFechaChange,
  files,
  onFilesChange,
  loading,
  onConfirm,
}: RegistrarPagoDialogProps) {
  const isReembolso = tipo === 'reembolso';
  const isApertura = tipo === 'apertura';

  const title = isReembolso
    ? 'Registrar Reembolso'
    : isApertura
      ? 'Registrar Transferencia'
      : 'Registrar Pago';

  const description = isReembolso
    ? 'Ingresa la fecha del reembolso y adjunta el comprobante.'
    : isApertura
      ? 'Ingresa la fecha de la transferencia y adjunta el comprobante.'
      : 'Ingresa la fecha de pago y adjunta el comprobante.';

  const fechaLabel = isReembolso
    ? 'Fecha de reembolso'
    : isApertura
      ? 'Fecha de transferencia'
      : 'Fecha de pago';

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="confirm"
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!fecha || !files || files.length === 0 || loading}
          >
            {loading
              ? 'Registrando...'
              : isReembolso
                ? 'Confirmar Reembolso'
                : 'Confirmar Pago'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{fechaLabel}</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => onFechaChange(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Comprobante(s)</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => onFilesChange(e.target.files)}
            className="mt-1"
          />
        </div>
      </div>
    </AppDialog>
  );
}
