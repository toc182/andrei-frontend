import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import api from '@/services/api';
import type { Cuenta } from '@/types/api';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import AvanceBar from './AvanceBar';
import { formatMonto, formatPeriodo, formatWait, waitColor, CURRENT_STATUS_CONFIG } from './config';
import { Badge } from '@/components/ui/badge';
import CreateCuentaDialog from './CreateCuentaDialog';

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

export default function CuentasProjectView({ projectId, onCuentaClick }: Props) {
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

  // Current cuenta: first borrador, or if none, the next conceptual one (no row yet)
  const lastSubmittedIdx = sorted.reduce(
    (max, c, i) => (c.estado !== 'borrador' ? i : max),
    -1,
  );
  const currentCuenta = lastSubmittedIdx < sorted.length - 1 ? sorted[lastSubmittedIdx + 1] : null;

  const pendientes = sorted.filter(
    (c) => PENDING_STATES.includes(c.estado) && c.id !== currentCuenta?.id,
  );
  const pagadas = sorted.filter((c) => PAGADA_STATES.includes(c.estado));

  const daysSinceSubmission = (c: Cuenta) => {
    if (!c.fecha_primera_submision) return null;
    return Math.floor((Date.now() - new Date(c.fecha_primera_submision).getTime()) / 86400000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Cuentas</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {/* Cuenta actual */}
          <GroupCard label="Cuenta actual" color="teal">
            {currentCuenta ? (
              <CuentaRow cuenta={currentCuenta} days={null} onClick={() => onCuentaClick?.(currentCuenta.id)} isCurrent />
            ) : (
              <p className="text-sm text-muted-foreground italic px-3 py-2">Sin cuenta actual</p>
            )}
          </GroupCard>

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <GroupCard label="Pendientes" color="amber">
              {pendientes.map((c) => (
                <CuentaRow key={c.id} cuenta={c} days={daysSinceSubmission(c)} onClick={() => onCuentaClick?.(c.id)} />
              ))}
            </GroupCard>
          )}

          {/* Pagadas */}
          {pagadas.length > 0 && (
            <GroupCard label="Pagadas" color="slate">
              {pagadas.map((c) => (
                <CuentaRow key={c.id} cuenta={c} days={null} onClick={() => onCuentaClick?.(c.id)} />
              ))}
            </GroupCard>
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

// ── Group Card ──────────────────────────────────────────────────────────

function GroupCard({ label, color, children }: { label: string; color: 'teal' | 'amber' | 'slate'; children: React.ReactNode }) {
  const colorClass = color === 'teal' ? 'text-teal-600' : color === 'amber' ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2.5 ${colorClass}`}>{label}</div>
        <div className="space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

// ── Cuenta Row ──────────────────────────────────────────────────────────

function CuentaRow({ cuenta: c, days, onClick, isCurrent }: { cuenta: Cuenta; days: number | null; onClick: () => void; isCurrent?: boolean }) {
  const statusBadge = isCurrent && c.estado === 'borrador' ? (
    <Badge variant="outline" className={CURRENT_STATUS_CONFIG.borrador.className}>
      {CURRENT_STATUS_CONFIG.borrador.label}
    </Badge>
  ) : isCurrent ? (
    <Badge variant="outline" className={CURRENT_STATUS_CONFIG.no_iniciada.className}>
      {CURRENT_STATUS_CONFIG.no_iniciada.label}
    </Badge>
  ) : (
    <CuentaEstadoBadge estado={c.estado} />
  );

  return (
    <div
      className="grid grid-cols-[80px_auto_180px_130px_100px_80px] items-center gap-4 bg-muted/40 border rounded-md px-3 py-2.5 text-sm cursor-pointer hover:border-border transition-colors"
      onClick={onClick}
    >
      <span className="font-semibold">Cuenta {c.numero}</span>
      <span className="justify-self-center">{statusBadge}</span>
      <span className="font-mono text-xs text-muted-foreground">{formatPeriodo(c.periodo_inicio, c.periodo_fin)}</span>
      <span className="font-mono text-xs text-right whitespace-nowrap">{formatMonto(c.monto_total)}</span>
      {c.avance_porcentaje ? <AvanceBar value={c.avance_porcentaje} /> : <span className="text-xs text-muted-foreground">—</span>}
      <span className={`font-mono text-xs text-right ${days != null ? waitColor(days) : 'text-muted-foreground'}`}>
        {days != null ? formatWait(days) : '—'}
      </span>
    </div>
  );
}
