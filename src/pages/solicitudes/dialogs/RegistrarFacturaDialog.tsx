// Dialog for registering a factura or recibo against a paid solicitud.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

import { useId } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface RegistrarFacturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: 'factura' | 'recibo';
  onTipoChange: (value: 'factura' | 'recibo') => void;
  fecha: string;
  onFechaChange: (value: string) => void;
  numero: string;
  onNumeroChange: (value: string) => void;
  files: FileList | null;
  onFilesChange: (files: FileList | null) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function RegistrarFacturaDialog({
  open,
  onOpenChange,
  tipo,
  onTipoChange,
  fecha,
  onFechaChange,
  numero,
  onNumeroChange,
  files,
  onFilesChange,
  loading,
  onConfirm,
}: RegistrarFacturaDialogProps) {
  const idPrefix = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Registrar Factura o Recibo</DialogTitle>
          <DialogDescription>
            Ingresa los datos del documento del proveedor.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Tipo de documento *</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => onTipoChange(v as 'factura' | 'recibo')}
              className="flex gap-4 mt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="factura" id={`${idPrefix}-factura`} />
                <Label
                  htmlFor={`${idPrefix}-factura`}
                  className="font-normal cursor-pointer"
                >
                  Factura
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recibo" id={`${idPrefix}-recibo`} />
                <Label
                  htmlFor={`${idPrefix}-recibo`}
                  className="font-normal cursor-pointer"
                >
                  Recibo
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => onFechaChange(e.target.value)}
              className="mt-1"
            />
          </div>
          {tipo === 'factura' && (
            <div>
              <Label>Número de factura</Label>
              <Input
                type="text"
                value={numero}
                onChange={(e) => onNumeroChange(e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label>Archivo(s) *</Label>
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
            {loading ? 'Registrando...' : 'Confirmar Factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
