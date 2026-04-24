import { useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean;
}

export function ChangePasswordModal({
  open,
  onOpenChange,
  forced = false,
}: ChangePasswordModalProps) {
  const { clearPasswordChange } = useAuth();
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setPasswordActual('');
    setPasswordNueva('');
    setPasswordConfirmar('');
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (passwordNueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (passwordNueva !== passwordConfirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.changePassword(
        forced ? null : passwordActual,
        passwordNueva,
      );
      if (result.success) {
        clearPasswordChange();
        setSuccess(true);
        setTimeout(() => {
          resetForm();
          onOpenChange(false);
        }, 1500);
      } else {
        setError(result.message || 'Error al cambiar contraseña');
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(
        axiosError.response?.data?.message || 'Error al cambiar contraseña',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!forced) {
      if (!value) resetForm();
      onOpenChange(value);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="simple"
      title={forced ? 'Debes cambiar tu contraseña' : 'Cambiar Contraseña'}
      description={forced ? 'Por seguridad, debes establecer una nueva contraseña antes de continuar.' : undefined}
      footer={!success ? (
        <>
          {!forced && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
          )}
          {forced && <div />}
          <Button type="submit" form="change-password-form" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cambiar Contraseña
          </Button>
        </>
      ) : undefined}
    >
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-base font-medium text-success">
              Contraseña cambiada exitosamente
            </p>
          </div>
        ) : (
          <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
            {!forced && (
              <div className="space-y-2">
                <Label htmlFor="password-actual">Contraseña actual</Label>
                <Input
                  id="password-actual"
                  type="password"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password-nueva">Nueva contraseña</Label>
              <Input
                id="password-nueva"
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-confirmar">
                Confirmar nueva contraseña
              </Label>
              <Input
                id="password-confirmar"
                type="password"
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}
          </form>
        )}
    </AppDialog>
  );
}
