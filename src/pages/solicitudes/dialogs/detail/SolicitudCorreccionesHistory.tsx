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
      <h4 className="font-medium text-gray-700">Historial de Correcciones</h4>
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
              className="border border-gray-200 rounded-lg"
            >
              <summary className="px-4 py-3 bg-gray-50 cursor-pointer flex items-center justify-between rounded-lg hover:bg-gray-100">
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
                  <span className="text-sm text-gray-500">
                    — {correccion.usuario_nombre}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {cambios.length} cambio{cambios.length !== 1 ? 's' : ''}
                </Badge>
              </summary>
              <div className="px-4 py-3 space-y-3">
                <div className="text-sm text-gray-600 italic">
                  Motivo: {correccion.motivo}
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-gray-500">
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
                            className="border-t border-gray-100"
                          >
                            <td className="py-1.5 pr-3 text-gray-700">
                              Item &quot;{cambio.descripcion}&quot; —{' '}
                              {labelOf(ic.campo)}
                            </td>
                            <td className="py-1.5 pr-3 text-red-600 line-through">
                              {ic.anterior}
                            </td>
                            <td className="py-1.5 text-green-600">
                              {ic.nuevo}
                            </td>
                          </tr>
                        ));
                      }
                      if (cambio.campo === 'item_agregado') {
                        return (
                          <tr
                            key={idx}
                            className="border-t border-gray-100"
                          >
                            <td className="py-1.5 pr-3 text-gray-700">
                              Item agregado
                            </td>
                            <td className="py-1.5 pr-3 text-gray-400">—</td>
                            <td className="py-1.5 text-green-600">
                              {cambio.descripcion}
                            </td>
                          </tr>
                        );
                      }
                      if (cambio.campo === 'item_eliminado') {
                        return (
                          <tr
                            key={idx}
                            className="border-t border-gray-100"
                          >
                            <td className="py-1.5 pr-3 text-gray-700">
                              Item eliminado
                            </td>
                            <td className="py-1.5 pr-3 text-red-600 line-through">
                              {cambio.descripcion}
                            </td>
                            <td className="py-1.5 text-gray-400">—</td>
                          </tr>
                        );
                      }
                      return (
                        <tr
                          key={idx}
                          className="border-t border-gray-100"
                        >
                          <td className="py-1.5 pr-3 text-gray-700">
                            {labelOf(cambio.campo)}
                          </td>
                          <td className="py-1.5 pr-3 text-red-600 line-through">
                            {typeof cambio.anterior === 'string'
                              ? cambio.anterior
                              : '—'}
                          </td>
                          <td className="py-1.5 text-green-600">
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
