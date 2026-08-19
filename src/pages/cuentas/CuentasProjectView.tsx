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
import { Plus, ArrowRight, ArrowLeft, AlertTriangle, FileText, Receipt, Settings } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatCard } from '@/components/shell/StatCard';
import { EmptyState } from '@/components/shell';
import api from '@/services/api';
import type { Cuenta } from '@/types/api';
import { getDesglosesCuentas } from '@/lib/desgloseApi';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import { formatMonto, formatPeriodoParts, waitColor } from './config';
import CreateCuentaDialog from './CreateCuentaDialog';
import NuevaCuentaFlowDialog from './NuevaCuentaFlowDialog';
import CuentasDesglosesTab from './CuentasDesglosesTab';
import ConfigCuentaPage from './ConfigCuentaPage';

interface Props {
  projectId: number;
  onCuentaClick?: (cuentaId: number) => void;
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

export default function CuentasProjectView({ projectId, onCuentaClick }: Props) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showNuevaCuenta, setShowNuevaCuenta] = useState(false);
  const [flowStep, setFlowStep] = useState<'tipo' | 'desglose' | 'fin'>('tipo');
  // Sin pestañas: la página principal es la lista de cuentas; "Desgloses de
  // Cuenta" es una sub-página a la que se entra y se regresa (view).
  const [view, setView] = useState<'main' | 'desgloses' | 'config'>('main');
  const [nDesgloses, setNDesgloses] = useState(0);
  const [showCreateDesglose, setShowCreateDesglose] = useState(false);
  /** Con un desglose abierto en el editor, "Nuevo Desglose" no aplica. */
  const [desgloseAbierto, setDesgloseAbierto] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cuentas', { params: { proyecto_id: projectId } });
      setCuentas(res.data.data || []);
      try {
        setNDesgloses((await getDesglosesCuentas(projectId)).length);
      } catch {
        setNDesgloses(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const sorted = [...cuentas].sort((a, b) => a.numero - b.numero);

  // Sections render newest-first (highest numero on top).
  const borradores = sorted.filter((c) => c.estado === 'borrador').reverse();
  const pendientes = sorted.filter((c) => PENDING_STATES.includes(c.estado)).reverse();
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

  // Resumen totals: monto por categoría.
  const totalPorPresentar = borradores.reduce((s, c) => s + Number(c.monto_total || 0), 0);
  const countPorPresentar = borradores.length;

  // "Total contratado" comes from the project's monto_total field (original
  // contract + adendas). Fall back to the sum of cuenta amounts if the project
  // has no contract amount set.
  const projectMontoTotal = cuentas[0]?.proyecto_monto_total
    ? Number(cuentas[0].proyecto_monto_total)
    : null;
  const totalContratado = projectMontoTotal ?? (totalPagMonto + totalPendMonto + totalPorPresentar);

  // Resumen avance (physical project progress, sum of avance_porcentaje per state).
  const sumAvancePagado = pagadas.reduce((s, c) => s + Number(c.avance_porcentaje || 0), 0);
  const sumAvancePendiente = pendientes.reduce((s, c) => s + Number(c.avance_porcentaje || 0), 0);
  const sumAvanceBorrador = borradores.reduce((s, c) => s + Number(c.avance_porcentaje || 0), 0);
  const sumAvance = sumAvancePagado + sumAvancePendiente + sumAvanceBorrador;

  const hasAnyCuenta =
    borradores.length > 0 ||
    pendientes.length > 0 ||
    pagadas.length > 0;

  const pagadoPctOfTotal = totalContratado > 0 ? (totalPagMonto / totalContratado) * 100 : 0;

  // Modo del proyecto, DERIVADO de las cuentas (no hay columna): sin cuentas =
  // se elige; con cuentas, todas son del mismo tipo, así que basta con ver si
  // alguna tiene desglose. Cambiar de modo = borrar las cuentas → vuelve a 'empty'.
  const modo: 'empty' | 'manual' | 'desglose' = !hasAnyCuenta
    ? 'empty'
    : cuentas.some((c) => c.desglose_id != null)
      ? 'desglose'
      : 'manual';

  // El desglose con el que se viene llevando el proyecto: el de la última
  // cuenta que lo tenga. Todas comparten el mismo (un proyecto no mezcla), así
  // que sirve de origen para la siguiente.
  const desgloseEnUso = [...sorted].reverse().find((c) => c.desglose_id != null)?.desglose_id ?? null;

  const handleNuevaCuenta = () => {
    if (modo === 'empty') { setFlowStep('tipo'); setShowNuevaCuenta(true); return; } // primera cuenta: elegir tipo
    if (modo === 'manual') { setShowCreate(true); return; }

    // Modo desglose: el proyecto ya decidió con cuál se llevan las cuentas, así
    // que la siguiente arranca del mismo sin preguntar. El "hasta anterior" se
    // encadena por row_uid, de modo que las cantidades acumuladas cuadran.
    if (desgloseEnUso == null) { setFlowStep('desglose'); setShowNuevaCuenta(true); return; }
    // Con el desglose ya decidido solo falta hasta qué fecha llega la cuenta:
    // el fin del periodo es obligatorio y el inicio lo calcula el servidor.
    setFlowStep('fin');
    setShowNuevaCuenta(true);
  };

  // Sub-página: Configurar Cuenta — el montaje de la hoja impresa, que se
  // llena una vez y vale para todas las cuentas del proyecto.
  if (view === 'config') {
    return (
      <div>
        <ConfigCuentaPage
          projectId={projectId}
          ejemploCuentaId={sorted[sorted.length - 1]?.id}
          onBack={() => setView('main')}
        />
      </div>
    );
  }

  // Sub-página: Desgloses de Cuenta (se entra y se regresa; no es pestaña par).
  if (view === 'desgloses') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {!desgloseAbierto && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setView('main'); load(); }}
              aria-label="Volver a cuentas"
              className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <PageHeader title="Desgloses de Cuenta" />
          {!desgloseAbierto && (
            <Button onClick={() => setShowCreateDesglose(true)} className="ml-auto">
              <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
              Desglose
            </Button>
          )}
        </div>
        <CuentasDesglosesTab
          proyectoId={projectId}
          proyectoNombre={cuentas[0]?.proyecto_nombre}
          createOpen={showCreateDesglose}
          onCreateOpenChange={setShowCreateDesglose}
          onAbiertoChange={setDesgloseAbierto}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Cuentas">
        {modo !== 'empty' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setView('config')}>
              <Settings className="h-4 w-4" />
              Configurar Cuenta
            </Button>
            {modo === 'desglose' && (
              <Button variant="outline" onClick={() => setView('desgloses')}>
                <FileText className="h-4 w-4" />
                Desgloses de Cuenta{nDesgloses > 0 ? ` (${nDesgloses})` : ''}
              </Button>
            )}
            <Button onClick={handleNuevaCuenta}>
              <Plus className="h-4 w-4" />
              Cuenta
            </Button>
          </div>
        )}
      </PageHeader>

      {modo === 'empty' && !loading ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No hay cuentas"
            description="Crea la primera cuenta de este proyecto."
            action={
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <Button onClick={handleNuevaCuenta}>
                  Nueva Cuenta
                </Button>
                {nDesgloses > 0 && (
                  <Button variant="outline" onClick={() => setView('desgloses')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Desgloses de Cuenta ({nDesgloses})
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
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
                <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-300">
                  {sumAvancePagado > 0 && (
                    <div className="h-full bg-success" style={{ width: `${sumAvancePagado}%` }} />
                  )}
                  {sumAvancePendiente > 0 && (
                    <div className="h-full bg-success/60" style={{ width: `${sumAvancePendiente}%` }} />
                  )}
                  {sumAvanceBorrador > 0 && (
                    <div className="h-full bg-success/30" style={{ width: `${sumAvanceBorrador}%` }} />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    Pagado {sumAvancePagado.toFixed(2)}%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-success/60" />
                    Pendiente de pago {sumAvancePendiente.toFixed(2)}%
                  </span>
                  {sumAvanceBorrador > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-success/30" />
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
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="w-[1%] whitespace-nowrap py-2.5 pl-4 pr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cuenta</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</TableHead>
                <TableHead className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avance</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap py-2.5 pl-2 pr-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">%</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap px-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Días</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap py-2.5 pl-1 pr-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {borradores.length > 0 && (
                <>
                  {(pendientes.length > 0 || pagadas.length > 0) && <SectionBand label="Borrador" />}
                  {borradores.map((c) => (
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
        </div>
      )}

      <CreateCuentaDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        projectId={projectId}
        onCreated={() => { setShowCreate(false); load(); }}
      />

      <NuevaCuentaFlowDialog
        open={showNuevaCuenta}
        onOpenChange={setShowNuevaCuenta}
        projectId={projectId}
        initialStep={flowStep}
        onManual={() => { setShowNuevaCuenta(false); setShowCreate(true); }}
        onCreated={(cuentaId) => { setShowNuevaCuenta(false); load(); onCuentaClick?.(cuentaId); }}
        desgloseEnUso={desgloseEnUso}
        finAnterior={sorted[sorted.length - 1]?.periodo_fin ?? null}
        onIrADesgloses={() => { setShowNuevaCuenta(false); setView('desgloses'); }}
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
        className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground py-2 px-4"
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
      className={`group cursor-pointer hover:bg-row-hover ${obs ? 'bg-error/[0.04]' : ''}`}
      onClick={onClick}
    >
      <TableCell className="w-[1%] whitespace-nowrap py-3 pl-4 pr-2">
        <div className="flex items-center gap-2">
          {obs && <AlertTriangle className="h-3.5 w-3.5 text-error shrink-0 group-hover:text-white" />}
          <span className="font-semibold text-sm group-hover:text-white">Cuenta {c.numero}</span>
          <CuentaEstadoBadge
            estado={c.estado}
            clienteLabel={c.cliente_abreviatura || c.cliente_nombre}
            className="group-hover:bg-white/20 group-hover:text-white group-hover:border-white/40"
          />
        </div>
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap px-2 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-white/85">
          {pp.inicio && <span>{pp.inicio}</span>}
          {(pp.inicio || pp.fin) && <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0 group-hover:text-white/70" />}
          {pp.fin && <span>{pp.fin}</span>}
          {!pp.inicio && !pp.fin && <span>—</span>}
        </span>
      </TableCell>
      <TableCell className="px-2 py-3">
        <div className="rounded-full bg-slate-300 overflow-hidden h-3.5 flex group-hover:bg-white/25">
          {prev > 0 && <div className="h-full bg-avance-past" style={{ width: `${prev}%` }} />}
          {curr > 0 && <div className="h-full bg-avance-current" style={{ width: `${curr}%` }} />}
        </div>
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap text-center text-xs text-muted-foreground tabular-nums pl-2 pr-1 py-3 group-hover:text-white/85">
        {curr}%
      </TableCell>
      <TableCell
        className={`w-[1%] whitespace-nowrap text-center text-xs tabular-nums px-1 py-3 group-hover:text-white/85 ${
          isPagada ? 'text-muted-foreground/40' : dColor
        }`}
      >
        <span className="inline-flex items-center justify-center gap-1">
          {!isPagada && days != null && days >= 14 && <AlertTriangle className="h-3 w-3" />}
          {isPagada ? '—' : (days != null ? `${days}d` : '—')}
        </span>
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap text-center text-sm font-semibold tabular-nums pl-1 pr-4 py-3 group-hover:text-white">
        {formatMonto(c.monto_total)}
      </TableCell>
    </TableRow>
  );
}
