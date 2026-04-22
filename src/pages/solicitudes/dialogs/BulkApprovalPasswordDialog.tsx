// Dialog for confirming a single or bulk approval with the user's password.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.
//
// The same dialog handles both:
// - single-approval flow (pendingApprovalId set, ignores reviewedCount)
// - bulk-approval flow (pendingApprovalId null, uses reviewedCount)

import { AppDialog } from '@/components/shell/AppDialog';
import { Alert as ShellAlert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const description = pendingApprovalId
    ? 'Ingresa tu contraseña para aprobar esta solicitud.'
    : `Vas a aprobar ${reviewedCount} solicitud${reviewedCount > 1 ? 'es' : ''} revisada${reviewedCount > 1 ? 's' : ''}. Ingresa tu contraseña para confirmar.`;

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="confirm"
      title="Confirmar Aprobacion"
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
            disabled={!password.trim() || loading}
          >
            {loading ? 'Aprobando...' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
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
          <ShellAlert variant="error" title={error} />
        )}
      </div>
    </AppDialog>
  );
}
