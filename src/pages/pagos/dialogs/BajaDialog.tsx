/**
 * Dar de baja una orden.
 *
 * Solo antes de recibirla: no se debe nada todavía, y la orden no se borra.
 * Recibida ya no se da de baja, porque se debe completa.
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert } from '@/components/shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { plata } from '../formato';
import type { OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

export default function BajaDialog({ orden, open, onOpenChange, onListo }: Props) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMotivo('');
    setError(null);
  }, [open]);

  const darDeBaja = async () => {
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${orden.id}/baja`, { motivo: motivo.trim() });
      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo dar de baja la orden');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Dar de baja esta orden?</AlertDialogTitle>
          <AlertDialogDescription>
            {orden.numero} · {orden.proveedor} · {plata(orden.monto_total)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {error && <Alert variant="error" title={error} />}

          <p className="text-sm text-slate-700">
            No se debe nada: la orden todavía no llegó. No se borra — queda como Dada de
            baja, con su historia.
          </p>

          <div>
            <Label className="text-xs" htmlFor="motivo-baja">
              Motivo *
            </Label>
            <Input
              id="motivo-baja"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se da de baja"
              className="mt-1.5"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Sin esto el diálogo se cierra antes de que la petición salga, y
              // un fallo del servidor no se vería en ninguna parte.
              e.preventDefault();
              void darDeBaja();
            }}
            disabled={guardando || motivo.trim().length === 0}
            className="bg-error text-white hover:bg-error/90"
          >
            {guardando ? 'Dando de baja...' : 'Dar de baja'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
