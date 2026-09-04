// ProjectCostos — Control de Costos del proyecto.
//
// Sigue el dibujo que Ivan aprobó: tres números arriba, un aviso para lo que
// está sin clasificar, y debajo la curva y el reparto lado a lado, mitad y
// mitad. Responde tres preguntas en ese orden: cuánto se va a cobrar, cuánto se
// calculó que iba a costar, y cuánto se lleva gastado.
//
//   contrato    -> el monto del proyecto.
//   presupuesto -> el presupuesto marcado con la estrella. Si no hay ninguno,
//                  la tarjeta lo dice y lleva a crearlo: sin él no hay contra
//                  qué comparar y la curva sale sin techo.
//   gastado     -> las solicitudes de pago ya pagadas. Las cajas menudas no se
//                  cuentan aparte porque terminan pasando por solicitudes.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  StatCard, StatCardSkeleton, Alert, EmptyState, ErrorState,
} from '@/components/shell';
import { formatMoney } from '@/utils/formatters';
import CurvaGasto from '@/components/costos/CurvaGasto';
import RepartoCategorias from '@/components/costos/RepartoCategorias';
import ComparativoPartidas from '@/components/costos/ComparativoPartidas';
import { getResumenCostos, type ResumenCostos } from '@/lib/costosApi';

interface ProjectCostosProps {
  projectId: number;
  /** Salta a la pestaña de Presupuestos: viven en la misma pantalla. */
  onIrAPresupuestos?: () => void;
}

/** Título de una tarjeta del dibujo: 14px, sin la barra Navy de SectionHeader —
 *  aquí el título vive DENTRO de la tarjeta, no encima. */
const CabeceraTarjeta = ({ titulo, extra }: { titulo: string; extra?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-[18px] py-3">
    <h3 className="text-sm font-semibold">{titulo}</h3>
    {extra}
  </div>
);

/** Leyenda de la curva. El "ritmo parejo" NO va aquí: es una vara de
 *  referencia dibujada muy tenue, y nombrarla la subía al mismo rango que el
 *  gasto y el presupuesto, que son los dos datos de verdad. */
const Leyenda = () => (
  <div className="flex items-center gap-3.5 text-[11.5px] text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <svg width="16" height="3" aria-hidden>
        <line x1="0" y1="1.5" x2="16" y2="1.5" className="stroke-navy" strokeWidth="2.25" />
      </svg>
      Gastado
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="16" height="3" aria-hidden>
        <line x1="0" y1="1.5" x2="16" y2="1.5" className="stroke-slate-400" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
      Presupuesto
    </span>
  </div>
);

export default function ProjectCostos({ projectId, onIrAPresupuestos }: ProjectCostosProps) {
  const [resumen, setResumen] = useState<ResumenCostos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setResumen(await getResumenCostos(projectId));
    } catch (err) {
      console.error('Error cargando el resumen de costos:', err);
      setError('No se pudo cargar el control de costos.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  if (error || !resumen) {
    return (
      <Card className="overflow-hidden p-0">
        <ErrorState description={error ?? undefined} onRetry={cargar} />
      </Card>
    );
  }

  const {
    contrato, presupuesto, gastado, categorias, sinClasificar, serie, solicitudes,
    comparativo, fechas,
  } = resumen;
  const irAlPresupuesto = () => onIrAPresupuestos?.();
  const pctGastado = presupuesto && presupuesto.costo > 0
    ? Math.round((gastado / presupuesto.costo) * 100)
    : null;
  const totalRepartido = categorias.reduce((s, c) => s + c.monto, 0) + sinClasificar.monto;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Valor del contrato"
          value={contrato != null ? formatMoney(contrato) : '—'}
          accent="navy"
          trend={{ value: 'Incluye ITBMS', direction: 'flat' }}
        />
        <StatCard
          label="Presupuesto estimado"
          value={presupuesto ? formatMoney(presupuesto.costo) : 'Sin presupuesto'}
          accent="navy"
          onClick={irAlPresupuesto}
          trend={{
            value: presupuesto ? presupuesto.nombre : 'Ninguno marcado como oficial',
            direction: 'flat',
          }}
        />
        <StatCard
          label="Gastado hasta hoy"
          value={formatMoney(gastado)}
          accent="navy"
          trend={{
            value: pctGastado != null ? `${pctGastado}% del presupuesto` : 'Sin presupuesto contra qué comparar',
            direction: 'flat',
          }}
        />
      </div>

      {!presupuesto && (
        <Alert
          variant="info"
          title="Este proyecto todavía no tiene un presupuesto oficial"
          description="Sin él no hay contra qué comparar el gasto: la curva sale sin techo."
          actions={
            <Button variant="outline" size="sm" onClick={irAlPresupuesto}>
              Ir a Presupuestos
            </Button>
          }
        />
      )}

      {sinClasificar.monto > 0 && (
        <Alert
          variant="warning"
          title={`Sin clasificar: ${formatMoney(sinClasificar.monto)} en ${
            sinClasificar.solicitudes === 1 ? '1 pago' : `${sinClasificar.solicitudes} pagos`
          }. Ponles categoría para que dejen de estar aquí.`}
        />
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Card className="flex flex-col overflow-hidden p-0">
          <CabeceraTarjeta
            titulo="Gasto acumulado contra el presupuesto"
            extra={serie.length > 0 ? <Leyenda /> : undefined}
          />
          {serie.length === 0 ? (
            <EmptyState
              title="Todavía no hay pagos"
              description="La curva se dibuja con las fechas en que se pagan las solicitudes. En cuanto se marque la primera como pagada, aparece aquí."
            />
          ) : (
            // min-h, no h: dentro de una columna flexible el alto fijo lo pisa
            // el reparto de espacio y el dibujo se aplasta hasta la nada.
            <div className="relative mx-3 mb-1.5 mt-1 min-h-[320px] flex-1">
              <CurvaGasto
                serie={serie}
                presupuesto={presupuesto ? presupuesto.costo : null}
                inicio={fechas.inicio}
                fin={fechas.fin}
              />
            </div>
          )}
        </Card>

        <Card className="flex flex-col overflow-hidden p-0">
          <CabeceraTarjeta titulo="En qué se ha ido" />
          <div className="px-[18px] pb-4 pt-3">
            <RepartoCategorias
              categorias={categorias}
              sinClasificar={sinClasificar}
              solicitudes={solicitudes}
              total={totalRepartido}
            />
          </div>
        </Card>
      </div>

      {/* Debajo de los dos cuadros: la curva y el reparto dicen COMO va el
          gasto; este dice contra que. Es el cuadro largo, y va al final. */}
      <ComparativoPartidas
        filas={comparativo.filas}
        sinPartida={comparativo.sinPartida}
        presupuestoNombre={presupuesto ? presupuesto.nombre : null}
      />
    </div>
  );
}
