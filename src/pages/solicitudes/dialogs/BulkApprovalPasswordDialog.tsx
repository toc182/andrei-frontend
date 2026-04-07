// Dialog for confirming a single or bulk approval with the user's password.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// The same dialog handles both:
// - single-approval flow (pendingApprovalId set, ignores reviewedCount)
// - bulk-approval flow (pendingApprovalId null, uses reviewedCount)

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
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkApprovalPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  pendingApprovalId: number | null;
  reviewedCount: number;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function BulkApprovalPasswordDialog({
  open,
  onOpenChange,
  password,
  onPasswordChange,
  pendingApprovalId,
  reviewedCount,
  loading,
  error,
  onConfirm,
}: BulkApprovalPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Confirmar Aprobacion</DialogTitle>
          <DialogDescription>
            {pendingApprovalId
              ? 'Ingresa tu contraseña para aprobar esta solicitud.'
              : `Vas a aprobar ${reviewedCount} solicitud${reviewedCount > 1 ? 'es' : ''} revisada${reviewedCount > 1 ? 's' : ''}. Ingresa tu contraseña para confirmar.`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <div>
            <Label>Contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="new-password"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
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
            disabled={!password.trim() || loading}
          >
            {loading ? 'Aprobando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
