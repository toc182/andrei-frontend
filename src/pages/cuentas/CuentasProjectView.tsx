import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import api from '@/services/api';
import type { Cuenta } from '@/types/api';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import { formatMonto, formatPeriodoParts, waitColor, CURRENT_STATUS_CONFIG } from './config';
import { Badge } from '@/components/ui/badge';
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

  const pendientes = sorted.filter(
    (c) => PENDING_STATES.includes(c.estado) && c.id !== currentCuenta?.id,
  );
  const pagadas = sorted.filter((c) => PAGADA_STATES.includes(c.estado));

  // Compute avance_previo for each cuenta (sum of all cuentas before it)
  const avancePrevioMap = new Map<number, number>();
  let cumAvance = 0;
  for (const c of sorted) {
    avancePrevioMap.set(c.id, cumAvance);
    cumAvance += c.avance_porcentaje ? Number(c.avance_porcentaje) : 0;
  }

  // Total pending monto
  const totalPendMonto = pendientes.reduce((s, c) => s + (c.monto_total ? Number(c.monto_total) : 0), 0);
  const totalPagMonto = pagadas.reduce((s, c) => s + (c.monto_total ? Number(c.monto_total) : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <PageHeader title="Cuentas" />
          {onNavigateToGeneral && (
            <button onClick={onNavigateToGeneral} className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" />
              Ver cuentas de todos los proyectos
            </button>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
      ) : (
        <div className="space-y-4">
          {/* Cuenta actual */}
          <Card>
            <CardContent className="px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-teal-600">Cuenta actual</div>
              {currentCuenta ? (
                <CuentaSubCard
                  cuenta={currentCuenta}
                  avancePrevio={avancePrevioMap.get(currentCuenta.id) ?? 0}
                  days={null}
                  onClick={() => onCuentaClick?.(currentCuenta.id)}
                  isCurrent
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">Sin cuenta actual</p>
              )}
            </CardContent>
          </Card>

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <Card>
              <CardContent className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                    Pendientes
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    Total: {formatMonto(totalPendMonto)}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendientes.map((c) => (
                    <CuentaSubCard
                      key={c.id}
                      cuenta={c}
                      avancePrevio={avancePrevioMap.get(c.id) ?? 0}
                      days={daysSinceSubmission(c)}
                      onClick={() => onCuentaClick?.(c.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagadas */}
          {pagadas.length > 0 && (
            <Card>
              <CardContent className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pagadas
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    Total: {formatMonto(totalPagMonto)}
                  </span>
                </div>
                <div className="space-y-2">
                  {pagadas.map((c) => (
                    <CuentaSubCard
                      key={c.id}
                      cuenta={c}
                      avancePrevio={avancePrevioMap.get(c.id) ?? 0}
                      days={null}
                      onClick={() => onCuentaClick?.(c.id)}
                      isPagada
                    />
                  ))}
                </div>
              </CardContent>
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
    </div>
  );
}

// ── Cuenta Sub-Card ───────────────────────────────────────────────────────

function CuentaSubCard({ cuenta: c, avancePrevio, days, onClick, isCurrent, isPagada }: {
  cuenta: Cuenta;
  avancePrevio: number;
  days: number | null;
  onClick: () => void;
  isCurrent?: boolean;
  isPagada?: boolean;
}) {
  const obs = isObservaciones(c.estado);
  const curr = c.avance_porcentaje ? Number(c.avance_porcentaje) : 0;
  const prev = avancePrevio;
  const pp = formatPeriodoParts(c.periodo_inicio, c.periodo_fin);
  const dColor = days != null ? waitColor(days) : 'text-muted-foreground';

  const statusBadge = isCurrent && c.estado === 'borrador' ? (
    <Badge variant="outline" className={CURRENT_STATUS_CONFIG.borrador.className}>
      {CURRENT_STATUS_CONFIG.borrador.label}
    </Badge>
  ) : (
    <CuentaEstadoBadge estado={c.estado} />
  );

  return (
    <div
      className={`border rounded-md px-4 py-3 cursor-pointer transition-colors ${
        obs
          ? 'bg-red-50/50 border-l-4 border-l-red-500 hover:bg-red-100/50'
          : isPagada
            ? 'bg-muted/20 hover:bg-muted/40'
            : 'bg-muted/40 hover:bg-muted/60'
      }`}
      onClick={onClick}
    >
      {/* Row 1: Cuenta + badge + monto */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {obs && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <span className="font-semibold text-sm">Cuenta {c.numero}</span>
          {statusBadge}
        </div>
        <span className="font-medium text-sm tabular-nums">{formatMonto(c.monto_total)}</span>
      </div>

      {/* Row 2: Periodo + stacked bar + days */}
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-xs shrink-0">
          {pp.inicio && <span className="text-muted-foreground">{pp.inicio}</span>}
          {(pp.inicio || pp.fin) && <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
          {pp.fin && <span className="text-muted-foreground">{pp.fin}</span>}
          {!pp.inicio && !pp.fin && <span className="text-muted-foreground">—</span>}
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 rounded-full bg-secondary overflow-hidden h-1.5 flex">
            {prev > 0 && <div className="h-full bg-primary" style={{ width: `${prev}%` }} />}
            {curr > 0 && <div className="h-full bg-blue-400" style={{ width: `${curr}%` }} />}
          </div>
          <span className="text-xs text-muted-foreground w-7 text-right shrink-0">{curr}%</span>
        </div>
        {!isPagada && (
          <span className={`text-xs shrink-0 flex items-center gap-1 ${dColor}`}>
            {days != null && days >= 14 && <AlertTriangle className="h-3 w-3" />}
            {days != null ? `${days}d` : '—'}
          </span>
        )}
      </div>
    </div>
  );
}
