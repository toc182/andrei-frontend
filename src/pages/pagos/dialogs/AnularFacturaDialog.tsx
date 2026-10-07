/**
 * Anular una factura mal digitada, para registrarla de nuevo bien.
 *
 * Solo mientras no tenga una solicitud de pago encima (Ivan, 2026-10-07). No
 * se borra: deja de contar en lo que se debe y queda en la historia, con su
 * motivo. Si la orden ya estaba completa, vuelve a admitir facturas.
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
import { fechaCorta, nombreFactura, plata } from '../formato';
import type { Entrega, OrdenDetalle } from '../tiposDetalle';

interface Props {
  orden: OrdenDetalle;
  factura: Entrega | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListo: () => void;
}

export default function AnularFacturaDialog({ orden, factura, open, onOpenChange, onListo }: Props) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMotivo('');
    setError(null);
  }, [open]);

  const anular = async () => {
    if (!factura) return;
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/ordenes-compra/${orden.id}/facturas/${factura.id}/anular`, {
        motivo: motivo.trim(),
      });
      onListo();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo anular la factura');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anular factura</AlertDialogTitle>
          <AlertDialogDescription>
            {factura
              ? `${nombreFactura(factura)} · ${fechaCorta(factura.fecha)} · ${plata(factura.monto_total)} · ${orden.numero}`
              : orden.numero}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {error && <Alert variant="error" title={error} />}

          <p className="text-sm text-slate-700">
            Deja de contar en lo que se debe y queda anotada en la historia. Después se registra
            de nuevo, bien.
            {orden.completa_at && ' La orden vuelve a admitir facturas.'}
          </p>

          <div>
            <Label className="text-xs" htmlFor="motivo-anular">
              Motivo *
            </Label>
            <Input
              id="motivo-anular"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Qué estaba mal"
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
              void anular();
            }}
            disabled={guardando || motivo.trim().length === 0}
            className="bg-error text-white hover:bg-error/90"
          >
            {guardando ? 'Anulando...' : 'Anular factura'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
