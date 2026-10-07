import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoRow } from '@/components/project/InfoRow';
import { ESTADO_ADENDA, TIPO_ADENDA, diasConSigno, montoConSigno } from '@/lib/adendas';
import { formatDate } from '@/utils/dateUtils';
import type { Adenda } from '@/types';

interface AdendaTarjetaProps {
  adenda: Adenda;
  onEditar: () => void;
  onEliminar: () => void;
}

/** Una adenda en la ficha del proyecto. El monto es uno solo, con su signo. */
export function AdendaTarjeta({ adenda, onEditar, onEliminar }: AdendaTarjetaProps) {
  const estado = ESTADO_ADENDA[adenda.estado];
  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Adenda #{adenda.numero_adenda}</span>
          <Badge className={estado.className}>{estado.label}</Badge>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEditar} title="Editar adenda">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onEliminar}
            title="Eliminar adenda"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <InfoRow label="Tipo:">{TIPO_ADENDA[adenda.tipo]}</InfoRow>

      {adenda.nueva_fecha_fin && (
        <InfoRow label="Nueva Fecha:">
          {formatDate(adenda.nueva_fecha_fin)}
          {adenda.dias_extension != null && (
            <span className="text-muted-foreground">
              {' '}({diasConSigno(adenda.dias_extension)})
            </span>
          )}
        </InfoRow>
      )}

      {adenda.monto != null && (
        <InfoRow label="Monto:">
          <span className="tabular-nums">{montoConSigno(adenda.monto)}</span>
        </InfoRow>
      )}

      {adenda.observaciones && <InfoRow label="Observaciones:">{adenda.observaciones}</InfoRow>}

      <InfoRow label="Solicitada:">
        {formatDate(adenda.fecha_solicitud)}
        {adenda.fecha_aprobacion && (
          <span className="text-muted-foreground">
            {' | Aprobada: '}
            {formatDate(adenda.fecha_aprobacion)}
          </span>
        )}
      </InfoRow>
    </div>
  );
}
