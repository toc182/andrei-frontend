// BarraPropuesta — la barra de Aplicar / Descartar de una propuesta.
//
// Va encima de la tabla, no dentro del panel de la conversacion: lo que se
// aplica son las filas marcadas de la tabla, y el boton tiene que estar donde
// se esta mirando.

import { Button } from '@/components/ui/button';
import { formatMoney } from '@/utils/formatters';
import type { CambioPropuesto } from '@/lib/asistentePagosApi';

interface BarraPropuestaProps {
  cambios: CambioPropuesto[];
  seleccionados: Set<number>;
  aplicando: boolean;
  onAplicar: () => void;
  onDescartar: () => void;
}

export default function BarraPropuesta({
  cambios, seleccionados, aplicando, onAplicar, onDescartar,
}: BarraPropuestaProps) {
  const marcados = cambios.filter((c) => seleccionados.has(c.solicitudId));
  const suma = marcados.reduce((s, c) => s + c.monto, 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/25 bg-info/[0.07] px-4 py-2.5">
      <span className="text-sm text-info">
        {marcados.length === cambios.length
          ? <><strong>{cambios.length}</strong> {cambios.length === 1 ? 'cambio' : 'cambios'} sin aplicar</>
          : <><strong>{marcados.length} de {cambios.length}</strong> cambios seleccionados</>}
        <span className="ml-2 tabular-nums text-muted-foreground">{formatMoney(suma)}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDescartar} disabled={aplicando}>
          Descartar
        </Button>
        <Button size="sm" onClick={onAplicar} disabled={aplicando || marcados.length === 0}>
          {aplicando
            ? 'Aplicando…'
            : marcados.length === cambios.length
              ? 'Aplicar'
              : `Aplicar los ${marcados.length}`}
        </Button>
      </div>
    </div>
  );
}
