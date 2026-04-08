// Dialog for registering a full devolución from a proveedor on a solicitud.
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

interface RegistrarDevolucionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fecha: string;
  onFechaChange: (value: string) => void;
  motivo: string;
  onMotivoChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function RegistrarDevolucionDialog({
  open,
  onOpenChange,
  fecha,
  onFechaChange,
  motivo,
  onMotivoChange,
  file,
  onFileChange,
  loading,
  onConfirm,
}: RegistrarDevolucionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Registrar Devolución</DialogTitle>
          <DialogDescription>
            Registra la devolución total del proveedor.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Fecha de devolución *</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => onFechaChange(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Motivo *</Label>
            <textarea
              value={motivo}
              onChange={(e) => onMotivoChange(e.target.value)}
              placeholder="Describe el motivo de la devolución..."
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
            />
          </div>
          <div>
            <Label>Comprobante de devolución *</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
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
            variant="destructive"
            onClick={onConfirm}
            disabled={!fecha || !motivo.trim() || !file || loading}
          >
            {loading ? 'Registrando...' : 'Confirmar Devolución'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
