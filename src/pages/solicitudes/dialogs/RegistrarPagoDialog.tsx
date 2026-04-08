// Dialog for "Registrar Pago" / "Registrar Reembolso" — switches labels based
// on solicitud.tipo. Used after a solicitud has been approved.
//
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isReembolso ? 'Registrar Reembolso' : 'Registrar Pago'}
          </DialogTitle>
          <DialogDescription>
            {isReembolso
              ? 'Ingresa la fecha del reembolso y adjunta el comprobante.'
              : 'Ingresa la fecha de pago y adjunta el comprobante.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>{isReembolso ? 'Fecha de reembolso' : 'Fecha de pago'}</Label>
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
        <DialogFooter className="gap-2 sm:gap-0">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
