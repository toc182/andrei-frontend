/**
 * Marcar la orden como completa: el proveedor ya no va a mandar nada más.
 *
 * Las facturas no tienen por qué sumar la orden (redondeos, material que
 * faltó), así que el sistema no puede saberlo solo (Ivan, 2026-10-05). Después
 * de esto la orden no admite más facturas, y por eso se confirma antes.
 */
import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import api from '@/services/api';
import { Alert } from '@/components/shell';
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
import { plata } from '../formato';
import type { OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

export default function CompletaDialog({ orden, open, onOpenChange, onListo }: Props) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const marcar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${orden.id}/completa`);
      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo marcar como completa');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Marcar como completa</AlertDialogTitle>
          <AlertDialogDescription>
            {orden.numero} · se facturaron {plata(orden.recibido)} de {plata(orden.monto_total)}{' '}
            pedidos. Una vez completa, la orden no admite más facturas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <Alert variant="error" title={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Sin esto el diálogo se cierra antes de que la petición salga, y
              // un fallo del servidor no se vería en ninguna parte.
              e.preventDefault();
              void marcar();
            }}
            disabled={guardando}
          >
            <PackageCheck className="mr-2 h-4 w-4" />
            {guardando ? 'Guardando...' : 'Marcar como completa'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
