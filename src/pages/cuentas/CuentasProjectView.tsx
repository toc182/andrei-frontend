import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Plus, ArrowRight, ChevronRight, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatCard } from '@/components/shell/StatCard';
import api from '@/services/api';
import type { Cuenta } from '@/types/api';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import { formatMonto, formatPeriodoParts, waitColor } from './config';
import CreateCuentaDialog from './CreateCuentaDialog';

interface Props {
  projectId: number;
  onCuentaClick?: (cuentaId: number) => void;
  onNavigateToGeneral?: () => void;
}

const PAGADA_STATES = ['pagada'];
const PENDING_STATES = [
  'enviada', 'observaciones', 'aprobada',
  'enviada_institucion', 'observaciones_institucion', 'aprobada_institucion',
  'enviada_contraloria', 'observaciones_contraloria', 'aprobada_contraloria',
];
const OBSERVACIONES_STATES = ['observaciones', 'observaciones_institucion', 'observaciones_contraloria'];

function isObservaciones(estado: string): boolean {
  return OBSERVACIONES_STATES.includes(estado);
}

function daysSinceSubmission(c: Cuenta): number | null {
  if (!c.fecha_primera_submision) return null;
  return Math.floor((Date.now() - new Date(c.fecha_primera_submision).getTime()) / 86400000);
}

export default function CuentasProjectView({ projectId, onCuentaClick, onNavigateToGeneral }: Props) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cuentas', { params: { proyecto_id: projectId } });
      setCuentas(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const sorted = [...cuentas].sort((a, b) => a.numero - b.numero);

  // Current cuenta: first borrador after last submitted
  const lastSubmittedIdx = sorted.reduce(
    (max, c, i) => (c.estado !== 'borrador' ? i : max),
    -1,
  );
  const currentCuenta = lastSubmittedIdx < sorted.length - 1 ? sorted[lastSubmittedIdx + 1] : null;

  // Sections render newest-first (highest numero on top). Cuenta actual
  // stays at the top of its card as the next actionable item.
  const pendientes = sorted.filter(
    (c) => PENDING_STATES.includes(c.estado) && c.id !== currentCuenta?.id,
  ).reverse();
  const borradoresAdicionales = sorted.filter(
    (c) => c.estado === 'borrador' && c.id !== currentCuenta?.id,
  ).reverse();
  const pagadas = sorted.filter((c) => PAGADA_STATES.includes(c.estado)).reverse();

  // Compute avance_previo for each cuenta (sum of all cuentas before it)
  const avancePrevioMap = new Map<number, number>();
  let cumAvance = 0;
  for (const c of sorted) {
    avancePrevioMap.set(c.id, cumAvance);
    cumAvance += c.avance_porcentaje ? Number(c.avance_porcentaje) : 0;
  }

  // Section totals (used in the table band headers)
  const totalPendMonto = pendientes.reduce((s, c) => s + (c.monto_total ? Number(c.monto_total) : 0), 0);
  const totalPagMonto = pagadas.reduce((s, c) => s + (c.monto_total ? Number(c.monto_total) : 0), 0);

  // Resumen totals: monto by category (currentCuenta is always borrador when set).
  const totalPorPresentar =
    (currentCuenta ? Number(currentCuenta.monto_total || 0) : 0) +
    borradoresAdicionales.reduce((s, c) => s + Number(c.monto_total || 0), 0);
  const totalContratado = totalPagMonto + totalPendMonto + totalPorPresentar;
  const countPorPresentar = (currentCuenta ? 1 : 0) + borradoresAdicionales.length;

  // Resumen avance (physical project progress, sum of avance_porcentaje per state).
  const sumAvancePagado = pagadas.reduce((s, c) => s + Number(c.avance_porcentaje || 0), 0);
  const sumAvancePendiente = pendientes.reduce((s, c) => s + Number(c.avance_porcentaje || 0), 0);
  const sumAvanceBorrador =
    (currentCuenta ? Number(currentCuenta.avance_porcentaje || 0) : 0) +
    borradoresAdicionales.reduce((s, c) => s + Number(c.avance_porcentaje || 0), 0);
  const sumAvance = sumAvancePagado + sumAvancePendiente + sumAvanceBorrador;

  const hasAnyCuenta =
    !!currentCuenta ||
    borradoresAdicionales.length > 0 ||
    pendientes.length > 0 ||
    pagadas.length > 0;

  const pagadoPctOfTotal = totalContratado > 0 ? (totalPagMonto / totalContratado) * 100 : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas"
        subtitle={
          onNavigateToGeneral ? (
            <button
              type="button"
              onClick={onNavigateToGeneral}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              Ver cuentas de todos los proyectos
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
      >
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cuenta
        </Button>
      </PageHeader>

      {!loading && hasAnyCuenta && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total contratado"
              value={formatMonto(totalContratado)}
              accent="navy"
              trend={{
                direction: 'flat',
                value: `${sorted.length} cuenta${sorted.length === 1 ? '' : 's'}`,
              }}
            />
            <StatCard
              label="Pagado"
              value={formatMonto(totalPagMonto)}
              accent="success"
              trend={{
                direction: 'flat',
                value: `${pagadoPctOfTotal.toFixed(1)}% del total`,
              }}
            />
            <StatCard
              label="Pendiente de pago"
              value={formatMonto(totalPendMonto)}
              accent="info"
              trend={{
                direction: 'flat',
                value: `${pendientes.length} en proceso`,
              }}
            />
            <StatCard
              label="Por presentar"
              value={formatMonto(totalPorPresentar)}
              accent="teal"
              trend={{
                direction: 'flat',
                value: `${countPorPresentar} en borrador`,
              }}
            />
          </div>

          {sumAvance > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Avance del proyecto
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {sumAvance.toFixed(2)}%
                  </span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-300">
                  {sumAvancePagado > 0 && (
                    <div className="h-full bg-success" style={{ width: `${sumAvancePagado}%` }} />
                  )}
                  {sumAvancePendiente > 0 && (
                    <div className="h-full bg-info" style={{ width: `${sumAvancePendiente}%` }} />
                  )}
                  {sumAvanceBorrador > 0 && (
                    <div className="h-full bg-teal" style={{ width: `${sumAvanceBorrador}%` }} />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    Pagado {sumAvancePagado.toFixed(2)}%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-info" />
                    Pendiente de pago {sumAvancePendiente.toFixed(2)}%
                  </span>
                  {sumAvanceBorrador > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-teal" />
                      Por presentar {sumAvanceBorrador.toFixed(2)}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
      ) : !hasAnyCuenta ? (
        <p className="text-sm text-muted-foreground py-8 text-center italic">
          Sin cuentas
        </p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[1%] whitespace-nowrap px-2 py-2">Cuenta</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap px-2 py-2">Período</TableHead>
                <TableHead className="px-2 py-2">Avance</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap text-center pl-2 pr-1 py-2">%</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap text-center px-1 py-2">Días</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap text-center pl-1 pr-2 py-2">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(currentCuenta || borradoresAdicionales.length > 0) && (
                <>
                  <SectionBand label="Cuenta actual" />
                  {currentCuenta && (
                    <CuentaTableRow
                      cuenta={currentCuenta}
                      avancePrevio={avancePrevioMap.get(currentCuenta.id) ?? 0}
                      days={null}
                      onClick={() => onCuentaClick?.(currentCuenta.id)}
                    />
                  )}
                  {borradoresAdicionales.map((c) => (
                    <CuentaTableRow
                      key={c.id}
                      cuenta={c}
                      avancePrevio={avancePrevioMap.get(c.id) ?? 0}
                      days={null}
                      onClick={() => onCuentaClick?.(c.id)}
                    />
                  ))}
                </>
              )}

              {pendientes.length > 0 && (
                <>
                  <SectionBand label={`Pendientes — Total ${formatMonto(totalPendMonto)}`} />
                  {pendientes.map((c) => (
                    <CuentaTableRow
                      key={c.id}
                      cuenta={c}
                      avancePrevio={avancePrevioMap.get(c.id) ?? 0}
                      days={daysSinceSubmission(c)}
                      onClick={() => onCuentaClick?.(c.id)}
                    />
                  ))}
                </>
              )}

              {pagadas.length > 0 && (
                <>
                  <SectionBand label={`Pagadas — Total ${formatMonto(totalPagMonto)}`} />
                  {pagadas.map((c) => (
                    <CuentaTableRow
                      key={c.id}
                      cuenta={c}
                      avancePrevio={avancePrevioMap.get(c.id) ?? 0}
                      days={null}
                      onClick={() => onCuentaClick?.(c.id)}
                      isPagada
                    />
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateCuentaDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        projectId={projectId}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </div>
  );
}

// ── Section band ─────────────────────────────────────────────────────────

function SectionBand({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell
        colSpan={6}
        className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground py-2 px-2"
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

// ── Cuenta row ───────────────────────────────────────────────────────────

function CuentaTableRow({ cuenta: c, avancePrevio, days, onClick, isPagada }: {
  cuenta: Cuenta;
  avancePrevio: number;
  days: number | null;
  onClick: () => void;
  isPagada?: boolean;
}) {
  const obs = isObservaciones(c.estado);
  const curr = c.avance_porcentaje ? Number(c.avance_porcentaje) : 0;
  const prev = avancePrevio;
  const pp = formatPeriodoParts(c.periodo_inicio, c.periodo_fin);
  const dColor = days != null ? waitColor(days) : 'text-muted-foreground';

  return (
    <TableRow
      className={`cursor-pointer ${
        obs
          ? 'bg-error/[0.04] hover:bg-error/[0.06]'
          : 'hover:bg-muted/30'
      }`}
      onClick={onClick}
    >
      <TableCell className="w-[1%] whitespace-nowrap px-2 py-3">
        <div className="flex items-center gap-2">
          {obs && <AlertTriangle className="h-3.5 w-3.5 text-error shrink-0" />}
          <span className="font-semibold text-sm">Cuenta {c.numero}</span>
          <CuentaEstadoBadge
            estado={c.estado}
            clienteLabel={c.cliente_abreviatura || c.cliente_nombre}
          />
        </div>
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap px-2 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {pp.inicio && <span>{pp.inicio}</span>}
          {(pp.inicio || pp.fin) && <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
          {pp.fin && <span>{pp.fin}</span>}
          {!pp.inicio && !pp.fin && <span>—</span>}
        </span>
      </TableCell>
      <TableCell className="px-2 py-3">
        <div className="rounded-full bg-slate-300 overflow-hidden h-3.5 flex">
          {prev > 0 && <div className="h-full bg-avance-past" style={{ width: `${prev}%` }} />}
          {curr > 0 && <div className="h-full bg-avance-current" style={{ width: `${curr}%` }} />}
        </div>
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap text-center text-xs text-muted-foreground tabular-nums pl-2 pr-1 py-3">
        {curr}%
      </TableCell>
      <TableCell
        className={`w-[1%] whitespace-nowrap text-center text-xs tabular-nums px-1 py-3 ${
          isPagada ? 'text-muted-foreground/40' : dColor
        }`}
      >
        <span className="inline-flex items-center justify-center gap-1">
          {!isPagada && days != null && days >= 14 && <AlertTriangle className="h-3 w-3" />}
          {isPagada ? '—' : (days != null ? `${days}d` : '—')}
        </span>
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap text-center text-sm font-semibold tabular-nums pl-1 pr-2 py-3">
        {formatMonto(c.monto_total)}
      </TableCell>
    </TableRow>
  );
}
