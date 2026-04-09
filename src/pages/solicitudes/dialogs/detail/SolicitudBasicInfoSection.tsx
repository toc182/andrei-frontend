// Basic info block shown inside SolicitudDetailDialog — fecha, proyecto
// (optional), preparado/solicitado por, proveedor, and observaciones.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor.

import type { SolicitudPago } from '../../types';
import { formatDate } from './formatDate';

interface SolicitudBasicInfoSectionProps {
  solicitud: SolicitudPago;
  // The general view shows the project name field; the project view does not.
  showProyectoField: boolean;
}

export function SolicitudBasicInfoSection({
  solicitud,
  showProyectoField,
}: SolicitudBasicInfoSectionProps) {
  return (
    <>
      <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
        <div>
          <div className="text-muted-foreground">Fecha</div>
          <div className="font-medium">{formatDate(solicitud.fecha)}</div>
        </div>
        {showProyectoField && (
          <div>
            <div className="text-muted-foreground">Proyecto</div>
            <div className="font-medium">
              {solicitud.proyecto_nombre || '-'}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">Preparado por</div>
            <div className="font-medium">
              {solicitud.preparado_nombre || '-'}
            </div>
          </div>
          {solicitud.solicitado_nombre && (
            <div>
              <div className="text-muted-foreground">Solicitado por</div>
              <div className="font-medium">{solicitud.solicitado_nombre}</div>
            </div>
          )}
        </div>
        <div>
          <div className="text-muted-foreground">Proveedor</div>
          <div className="font-medium">{solicitud.proveedor}</div>
        </div>
      </div>

      {solicitud.observaciones && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <div className="text-muted-foreground mb-1">Observaciones</div>
          <div>{solicitud.observaciones}</div>
        </div>
      )}
    </>
  );
}
