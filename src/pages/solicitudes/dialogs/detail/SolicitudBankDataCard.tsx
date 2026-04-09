// Bank data card shown inside SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor. Only renders when the solicitud has at least a
// beneficiario or banco on file.

import { Banknote } from 'lucide-react';
import type { SolicitudPago } from '../../types';

interface SolicitudBankDataCardProps {
  solicitud: SolicitudPago;
}

export function SolicitudBankDataCard({
  solicitud,
}: SolicitudBankDataCardProps) {
  if (!solicitud.beneficiario && !solicitud.banco) return null;

  return (
    <div className="p-4 bg-muted/50 rounded-lg">
      <h4 className="font-medium mb-2 flex items-center gap-2">
        <Banknote className="h-4 w-4" /> Datos Bancarios
      </h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {solicitud.beneficiario && (
          <div>
            <span className="text-muted-foreground">Beneficiario:</span>{' '}
            {solicitud.beneficiario}
          </div>
        )}
        {solicitud.banco && (
          <div>
            <span className="text-muted-foreground">Banco:</span>{' '}
            {solicitud.banco}
          </div>
        )}
        {solicitud.tipo_cuenta && (
          <div>
            <span className="text-muted-foreground">Tipo:</span>{' '}
            <span className="capitalize">{solicitud.tipo_cuenta}</span>
          </div>
        )}
        {solicitud.numero_cuenta && (
          <div>
            <span className="text-muted-foreground">Cuenta:</span>{' '}
            {solicitud.numero_cuenta}
          </div>
        )}
      </div>
    </div>
  );
}
