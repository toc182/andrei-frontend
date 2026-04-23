// Corrections history block shown inside SolicitudDetailDialog.
// Lifted out of SolicitudDetailDialog.tsx during phase 9 of the issue
// #26 refactor.
//
// Renders a collapsible <details> per correccion. Each one shows the
// date, the author, the motivo, and a table of field-level changes
// (old vs new). Handles four kinds of cambios: plain field changes,
// nested item edits, item additions, and item removals.

import { Badge } from '@/components/ui/badge';

export interface Correccion {
  id: number;
  motivo: string;
  cambios: unknown[];
  version_pdf: string | null;
  created_at: string;
  usuario_nombre: string;
}

interface SolicitudCorreccionesHistoryProps {
  correcciones: Correccion[];
}

// Spanish labels for the raw field names stored in the correcciones
// table. Lifted to module scope so it isn't recreated on every render.
const FIELD_LABELS: Record<string, string> = {
  proveedor: 'Proveedor',
  fecha: 'Fecha',
  observaciones: 'Observaciones',
  beneficiario: 'Beneficiario',
  banco: 'Banco',
  tipo_cuenta: 'Tipo de cuenta',
  numero_cuenta: 'Número de cuenta',
  fecha_pago: 'Fecha de pago',
  fecha_factura: 'Fecha de factura',
  numero_factura: 'Número de factura',
  tipo: 'Tipo',
  subtotal: 'Subtotal',
  monto_total: 'Monto total',
  comprobante: 'Comprobante',
  factura: 'Factura',
  descripcion: 'Descripción',
  cantidad: 'Cantidad',
  unidad: 'Unidad',
  precio_unitario: 'Precio unitario',
};

const labelOf = (campo: string) => FIELD_LABELS[campo] || campo;

export function SolicitudCorreccionesHistory({
  correcciones,
}: SolicitudCorreccionesHistoryProps) {
  if (correcciones.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-slate-700">Historial de Correcciones</h4>
      <div className="space-y-2">
        {correcciones.map((correccion) => {
          const cambios = correccion.cambios as {
            campo: string;
            anterior?: string;
            nuevo?: string;
            cambios?: unknown[];
            descripcion?: string;
          }[];
          return (
            <details
              key={correccion.id}
              className="border border-border rounded-lg"
            >
              <summary className="px-4 py-3 bg-slate-50 cursor-pointer flex items-center justify-between rounded-lg hover:bg-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {new Date(correccion.created_at).toLocaleDateString(
                      'es-PA',
                      {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    — {correccion.usuario_nombre}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {cambios.length} cambio{cambios.length !== 1 ? 's' : ''}
                </Badge>
              </summary>
              <div className="px-4 py-3 space-y-3">
                <div className="text-sm text-muted-foreground italic">
                  Motivo: {correccion.motivo}
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 pr-3">Campo</th>
                      <th className="pb-1 pr-3">Anterior</th>
                      <th className="pb-1">Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambios.map((cambio, idx) => {
                      if (cambio.campo === 'item' && 'cambios' in cambio) {
                        const itemCambios = cambio.cambios as {
                          campo: string;
                          anterior: string;
                          nuevo: string;
                        }[];
                        return itemCambios.map((ic, icIdx) => (
                          <tr
                            key={`${idx}-${icIdx}`}
                            className="border-t border-slate-100"
                          >
                            <td className="py-1.5 pr-3 text-slate-700">
                              Item &quot;{cambio.descripcion}&quot; —{' '}
                              {labelOf(ic.campo)}
                            </td>
                            <td className="py-1.5 pr-3 text-error line-through">
                              {ic.anterior}
                            </td>
                            <td className="py-1.5 text-success">
                              {ic.nuevo}
                            </td>
                          </tr>
                        ));
                      }
                      if (cambio.campo === 'item_agregado') {
                        return (
                          <tr
                            key={idx}
                            className="border-t border-slate-100"
                          >
                            <td className="py-1.5 pr-3 text-slate-700">
                              Item agregado
                            </td>
                            <td className="py-1.5 pr-3 text-muted-foreground">—</td>
                            <td className="py-1.5 text-success">
                              {cambio.descripcion}
                            </td>
                          </tr>
                        );
                      }
                      if (cambio.campo === 'item_eliminado') {
                        return (
                          <tr
                            key={idx}
                            className="border-t border-slate-100"
                          >
                            <td className="py-1.5 pr-3 text-slate-700">
                              Item eliminado
                            </td>
                            <td className="py-1.5 pr-3 text-error line-through">
                              {cambio.descripcion}
                            </td>
                            <td className="py-1.5 text-muted-foreground">—</td>
                          </tr>
                        );
                      }
                      return (
                        <tr
                          key={idx}
                          className="border-t border-slate-100"
                        >
                          <td className="py-1.5 pr-3 text-slate-700">
                            {labelOf(cambio.campo)}
                          </td>
                          <td className="py-1.5 pr-3 text-error line-through">
                            {typeof cambio.anterior === 'string'
                              ? cambio.anterior
                              : '—'}
                          </td>
                          <td className="py-1.5 text-success">
                            {typeof cambio.nuevo === 'string'
                              ? cambio.nuevo
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
