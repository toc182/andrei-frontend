// Basic info block shown inside SolicitudDetailDialog — fecha, proyecto
// (optional), preparado/solicitado por, proveedor, categoría de gasto, and
// observaciones. Lifted out of SolicitudDetailDialog.tsx during phase 9 of
// the issue #26 refactor.

import { useState } from 'react';
import type { SolicitudPago } from '../../types';
import { formatDate } from './formatDate';
import { CategoriaSelect } from '@/components/CategoriaSelect';
import {
  saveCategoriaSolicitud,
  type CategoriaUpdated,
} from '../../utils/solicitudActions';
import { useAuth } from '@/context/AuthContext';

interface SolicitudBasicInfoSectionProps {
  solicitud: SolicitudPago;
  // The general view shows the project name field; the project view does not.
  showProyectoField: boolean;
  onCategoriaSaved?: (updated: CategoriaUpdated) => void;
}

export function SolicitudBasicInfoSection({
  solicitud,
  showProyectoField,
  onCategoriaSaved,
}: SolicitudBasicInfoSectionProps) {
  const { user } = useAuth();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same rule the backend enforces for this endpoint, and the same one the
  // system already uses for editing a solicitud.
  const puedeEditarCategoria =
    user?.rol === 'admin' ||
    user?.rol === 'co-admin' ||
    solicitud.preparado_por === user?.id ||
    !!user?.permissions?.solicitudes_editar_todas;

  const cambiarCategoria = (categoriaId: number | null) => {
    setError(null);
    saveCategoriaSolicitud({
      solicitudId: solicitud.id,
      categoriaId,
      setSaving: setGuardando,
      onSuccess: (updated) => onCategoriaSaved?.(updated),
      onError: setError,
    });
  };

  return (
    <>
      <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
        {/* Three paired rows: proyecto/fecha, preparado/solicitado,
            proveedor/categoría. The project view has no proyecto field, so
            there fecha takes the left slot on its own. */}
        <div className="grid grid-cols-2 gap-3">
          {showProyectoField ? (
            <>
              <div>
                <div className="text-muted-foreground">Proyecto</div>
                <div className="font-medium">
                  {solicitud.proyecto_nombre || '-'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Fecha</div>
                <div className="font-medium">{formatDate(solicitud.fecha)}</div>
              </div>
            </>
          ) : (
            <div>
              <div className="text-muted-foreground">Fecha</div>
              <div className="font-medium">{formatDate(solicitud.fecha)}</div>
            </div>
          )}
        </div>
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
        {/* Categoría shares the row with Proveedor so the dropdown takes half
            the width instead of stretching across the panel. Editable in any
            estado — pagada and facturada included, which the normal edit flow
            does not allow. See saveCategoriaSolicitud. */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <div>
            <div className="text-muted-foreground">Proveedor</div>
            <div className="font-medium">{solicitud.proveedor}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Categoría</div>
            {puedeEditarCategoria ? (
              <CategoriaSelect
                value={solicitud.categoria_id ?? null}
                onChange={cambiarCategoria}
                disabled={guardando}
                className="h-9 bg-card"
              />
            ) : (
              <div className="font-medium">
                {solicitud.categoria_nombre || (
                  <span className="font-normal text-muted-foreground">
                    Sin categoría
                  </span>
                )}
              </div>
            )}
            {error && <p className="mt-1 text-xs text-error">{error}</p>}
          </div>
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
