import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import api from '@/services/api';
import CuentaEstadoBadge from './CuentaEstadoBadge';
import AvanceBar from './AvanceBar';
import { formatMonto, formatPeriodo, formatPeriodoParts, formatWait, waitColor, CURRENT_STATUS_CONFIG } from './config';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Badge } from '@/components/ui/badge';

interface PendienteCuenta {
  id: number;
  numero: number;
  estado: string;
  monto_total: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  avance_porcentaje: string | null;
  avance_previo: number;
  fecha_primera_submision: string | null;
}

interface CuentaActual {
  id: number;
  numero: number;
  estado: string;
  monto_total: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  avance_porcentaje: string | null;
}

interface ProjectResumen {
  proyecto_id: number;
  proyecto_nombre: string;
  proyecto_nombre_corto: string | null;
  cliente_nombre: string | null;
  cliente_abreviatura: string | null;
  cliente_tipo: string | null;
  tiene_ipt: boolean;
  avance_acumulado: number;
  avance_previo: number;
  dias_inicio: number | null;
  dias_ultimo_envio: number | null;
  cuenta_actual: CuentaActual | null;
  pendientes: PendienteCuenta[];
  pagadas: number;
  total_cuentas: number;
  all_paid: boolean;
}

interface CuentasGeneralPageProps {
  onNavigateToProject?: (projectId: number) => void;
}

export default function CuentasGeneralPage({ onNavigateToProject }: CuentasGeneralPageProps) {
  const [data, setData] = useState<ProjectResumen[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cuentas/resumen');
      setData(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleProjectClick = (projectId: number) => {
    onNavigateToProject?.(projectId);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Cuentas" subtitle="Vista general por proyecto" />

      <Tabs defaultValue="resumen">
        <TabsList className="w-full justify-center">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="actuales">Cuentas actuales</TabsTrigger>
          <TabsTrigger value="pendientes">Cuentas pendientes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-3 mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin cuentas registradas</p>
          ) : (
            data.map((proj) => (
              <ResumenCard key={proj.proyecto_id} project={proj} onClick={() => handleProjectClick(proj.proyecto_id)} />
            ))
          )}
        </TabsContent>

        <TabsContent value="actuales" className="mt-4">
          <ActualesTable data={data} loading={loading} onProjectClick={handleProjectClick} />
        </TabsContent>

        <TabsContent value="pendientes" className="mt-4">
          <PendientesTab data={data} loading={loading} onProjectClick={handleProjectClick} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Resumen Card ────────────────────────────────────────────────────────

function ResumenCard({ project: p, onClick }: { project: ProjectResumen; onClick: () => void }) {
  return (
    <Card className={`cursor-pointer hover:border-border transition-colors ${p.all_paid ? 'opacity-50' : ''}`} onClick={onClick}>
      <CardContent className="px-5 py-4">
        <ProjectHeader project={p} />
        {p.all_paid ? (
          <div className="grid grid-cols-2 gap-6 mt-4">
            <p className="text-sm text-green-600 font-medium">&#10003; Todas las cuentas pagadas</p>
            <div>
              <SectionLabel color="amber">Cuentas pendientes</SectionLabel>
              <p className="text-sm text-muted-foreground italic">Sin pendientes</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 mt-4">
            {/* Cuenta actual */}
            <div>
              <SectionLabel color="teal">Cuenta actual</SectionLabel>
              {p.cuenta_actual ? (
                <div className="bg-muted/40 border rounded-md px-4 py-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Cuenta {p.cuenta_actual.numero}</span>
                    <CurrentStatusBadge estado={p.cuenta_actual.estado} />
                  </div>
                  {(() => {
                    const parts = formatPeriodoParts(p.cuenta_actual.periodo_inicio, p.cuenta_actual.periodo_fin);
                    return (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Periodo</span>
                        <span className="flex items-center gap-1.5">
                          {parts.inicio && <span>{parts.inicio}</span>}
                          {(parts.inicio || parts.fin) && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                          {parts.fin && <span>{parts.fin}</span>}
                          {!parts.inicio && !parts.fin && <span className="text-muted-foreground">—</span>}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between text-xs">
                    <div><span className="text-muted-foreground">Monto </span><span className="whitespace-nowrap">{formatMonto(p.cuenta_actual.monto_total)}</span></div>
                    <div><span className="text-muted-foreground">Avance </span><span>{p.cuenta_actual.avance_porcentaje ? `${Number(p.cuenta_actual.avance_porcentaje).toFixed(0)}%` : '—'}</span></div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sin cuenta actual</p>
              )}
            </div>

            {/* Pendientes */}
            <div>
              <SectionLabel color="amber">Cuentas pendientes</SectionLabel>
              {p.pendientes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin pendientes</p>
              ) : (
                <div className="space-y-1.5">
                  {p.pendientes.map((c) => {
                    const days = c.fecha_primera_submision
                      ? Math.floor((Date.now() - new Date(c.fecha_primera_submision).getTime()) / 86400000)
                      : null;
                    return (
                      <div key={c.id} className="flex items-center gap-2 bg-muted/40 border rounded-md px-2.5 py-1.5 text-xs">
                        <span className="font-semibold min-w-[22px]">C{c.numero}</span>
                        <CuentaEstadoBadge estado={c.estado} className="text-[10px] px-1.5 py-0" />
                        <span className="ml-auto text-muted-foreground">{formatMonto(c.monto_total)}</span>
                        <span className={`${days != null ? waitColor(days) : 'text-muted-foreground'}`}>
                          {days != null ? `${days}d` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Actuales Table ──────────────────────────────────────────────────────

type SortKey = 'dias' | 'avance' | 'monto';
type SortDir = 'asc' | 'desc';

function ActualesTable({ data, loading, onProjectClick }: { data: ProjectResumen[]; loading: boolean; onProjectClick: (id: number) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('dias');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>;

  const active = data.filter((p) => !p.all_paid);
  if (active.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Sin proyectos activos</p>;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...active].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortKey === 'dias') {
      va = a.dias_ultimo_envio ?? a.dias_inicio ?? 0;
      vb = b.dias_ultimo_envio ?? b.dias_inicio ?? 0;
    } else if (sortKey === 'avance') {
      va = a.avance_acumulado;
      vb = b.avance_acumulado;
    } else {
      va = a.cuenta_actual?.monto_total ? Number(a.cuenta_actual.monto_total) : 0;
      vb = b.cuenta_actual?.monto_total ? Number(b.cuenta_actual.monto_total) : 0;
    }
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const getDias = (p: ProjectResumen) => p.dias_ultimo_envio ?? p.dias_inicio ?? null;

  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Proyecto</TableHead>
                  <TableHead className="w-[90px]">Estado</TableHead>
                  <TableHead
                    className={`min-w-[200px] cursor-pointer select-none ${sortKey === 'avance' ? 'text-blue-600' : ''}`}
                    onClick={() => toggleSort('avance')}
                  >
                    <span className="flex items-center gap-1">
                      Avance
                      {sortKey === 'avance' && <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </span>
                  </TableHead>
                  <TableHead
                    className={`w-[70px] text-right cursor-pointer select-none ${sortKey === 'dias' ? 'text-blue-600' : ''}`}
                    onClick={() => toggleSort('dias')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Días
                      {sortKey === 'dias' && <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </span>
                  </TableHead>
                  <TableHead
                    className={`w-[120px] text-right cursor-pointer select-none ${sortKey === 'monto' ? 'text-blue-600' : ''}`}
                    onClick={() => toggleSort('monto')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Monto Cuenta
                      {sortKey === 'monto' && <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => {
                  const ca = p.cuenta_actual;
                  const dias = getDias(p);
                  const prev = p.avance_previo ?? 0;
                  const curr = ca?.avance_porcentaje ? Number(ca.avance_porcentaje) : 0;
                  const total = prev + curr;
                  const isRed = dias != null && dias >= 46;
                  const isAmber = dias != null && dias >= 31 && dias < 46;

                  return (
                    <TableRow
                      key={p.proyecto_id}
                      className={`cursor-pointer transition-colors ${isRed ? 'bg-red-50/30' : isAmber ? 'bg-amber-50/30' : ''}`}
                      onClick={() => onProjectClick(p.proyecto_id)}
                    >
                      <TableCell className="font-medium">
                        <div>{p.proyecto_nombre_corto || p.proyecto_nombre}</div>
                        {(p.cliente_abreviatura || p.cliente_nombre) && (
                          <div className="text-xs text-muted-foreground font-normal">{p.cliente_abreviatura || p.cliente_nombre}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {ca ? <CurrentStatusBadge estado={ca.estado} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-full bg-secondary overflow-hidden h-2 flex">
                            {prev > 0 && <div className="h-full bg-primary" style={{ width: `${prev}%` }} />}
                            {curr > 0 && <div className="h-full bg-blue-400" style={{ width: `${curr}%` }} />}
                          </div>
                          <span className="text-xs text-muted-foreground w-7 text-right shrink-0">{total.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {dias != null ? (
                          <span className="flex items-center justify-end gap-1">
                            {(isRed || isAmber) && (
                              <AlertTriangle className={`h-3.5 w-3.5 ${isRed ? 'text-red-500' : 'text-amber-500'}`} />
                            )}
                            <span className={`font-semibold ${isRed ? 'text-red-600' : isAmber ? 'text-amber-600' : ''}`}>
                              {dias}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {ca ? formatMonto(ca.monto_total) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.map((p) => {
          const ca = p.cuenta_actual;
          const dias = getDias(p);
          const prev = p.avance_previo ?? 0;
          const curr = ca?.avance_porcentaje ? Number(ca.avance_porcentaje) : 0;
          const total = prev + curr;
          const isRed = dias != null && dias >= 46;
          const isAmber = dias != null && dias >= 31 && dias < 46;

          return (
            <Card
              key={p.proyecto_id}
              className={`cursor-pointer transition-colors ${isRed ? 'border-l-4 border-l-red-500' : ''}`}
              onClick={() => onProjectClick(p.proyecto_id)}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.proyecto_nombre_corto || p.proyecto_nombre}</div>
                    {(p.cliente_abreviatura || p.cliente_nombre) && (
                      <div className="text-xs text-muted-foreground truncate">{p.cliente_abreviatura || p.cliente_nombre}</div>
                    )}
                  </div>
                  {ca ? <CurrentStatusBadge estado={ca.estado} /> : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full bg-secondary overflow-hidden h-2 flex">
                    {prev > 0 && <div className="h-full bg-primary" style={{ width: `${prev}%` }} />}
                    {curr > 0 && <div className="h-full bg-blue-400" style={{ width: `${curr}%` }} />}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{total.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  {dias != null ? (
                    <span className="flex items-center gap-1">
                      {(isRed || isAmber) && (
                        <AlertTriangle className={`h-3.5 w-3.5 ${isRed ? 'text-red-500' : 'text-amber-500'}`} />
                      )}
                      <span className={`font-semibold ${isRed ? 'text-red-600' : isAmber ? 'text-amber-600' : ''}`}>
                        {dias} días
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="font-medium">{ca ? formatMonto(ca.monto_total) : '—'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Pendientes Card ─────────────────────────────────────────────────────

// ── Pendientes Tab (Option A: Grouped Cards) ─────────────────────────────

type PendSortKey = 'dias' | 'monto';
type PendSortDir = 'asc' | 'desc';

const OBSERVACIONES_STATES = ['observaciones', 'observaciones_institucion', 'observaciones_contraloria'];

function isObservaciones(estado: string): boolean {
  return OBSERVACIONES_STATES.includes(estado);
}

// Status groups for filter chips
const PEND_STATUS_GROUPS: { key: string; label: string; match: (estado: string) => boolean }[] = [
  { key: 'observaciones', label: 'Por Subsanar', match: (e) => OBSERVACIONES_STATES.includes(e) },
  { key: 'enviada', label: 'Enviada a inst.', match: (e) => e === 'enviada' || e === 'enviada_institucion' },
  { key: 'sometida', label: 'Sometida', match: (e) => e === 'aprobada_institucion' },
  { key: 'contraloria', label: 'En Contraloría', match: (e) => e === 'enviada_contraloria' },
  { key: 'aprobada', label: 'Aprobadas', match: (e) => e === 'aprobada' || e === 'aprobada_contraloria' },
];

function pendDays(c: PendienteCuenta): number | null {
  return c.fecha_primera_submision
    ? Math.floor((Date.now() - new Date(c.fecha_primera_submision).getTime()) / 86400000)
    : null;
}

function PendientesTab({ data, loading, onProjectClick }: {
  data: ProjectResumen[];
  loading: boolean;
  onProjectClick: (id: number) => void;
}) {
  const [sortKey, setSortKey] = useState<PendSortKey>('dias');
  const [sortDir, setSortDir] = useState<PendSortDir>('desc');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const withPending = data.filter((p) => p.pendientes.length > 0);

  // Count bills per filter group
  const allBills = withPending.flatMap((p) => p.pendientes);
  const groupCounts = PEND_STATUS_GROUPS.map((g) => ({
    ...g,
    count: allBills.filter((b) => g.match(b.estado)).length,
  }));
  const totalMonto = allBills.reduce((s, b) => s + (b.monto_total ? Number(b.monto_total) : 0), 0);

  // Sort helpers
  const billSortVal = (b: PendienteCuenta, key: PendSortKey): number => {
    if (key === 'dias') return pendDays(b) ?? 0;
    return b.monto_total ? Number(b.monto_total) : 0;
  };

  const sorted = withPending
    .map((p) => ({
      ...p,
      pendientes: [...p.pendientes].sort((a, b) => {
        const va = billSortVal(a, sortKey), vb = billSortVal(b, sortKey);
        return sortDir === 'desc' ? vb - va : va - vb;
      }),
    }))
    .sort((a, b) => {
      const worstA = Math.max(...a.pendientes.map((c) => billSortVal(c, sortKey)));
      const worstB = Math.max(...b.pendientes.map((c) => billSortVal(c, sortKey)));
      return sortDir === 'desc' ? worstB - worstA : worstA - worstB;
    });

  const toggleSort = (key: PendSortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>;
  if (withPending.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Sin cuentas pendientes</p>;

  return (
    <div className="space-y-4">
      {/* Filter chips + Sort controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={`cursor-pointer text-xs leading-5 ${!activeFilter ? 'bg-foreground text-background' : 'opacity-50'}`}
            onClick={() => setActiveFilter(null)}
          >
            Todas
          </Badge>
          {groupCounts.filter((g) => g.count > 0).map((g) => (
            <Badge
              key={g.key}
              variant="outline"
              className={`cursor-pointer text-xs leading-5 ${
                activeFilter === g.key
                  ? g.key === 'observaciones' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-foreground text-background'
                  : activeFilter ? 'opacity-40' : ''
              } ${!activeFilter && g.key === 'observaciones' ? 'text-red-600 font-semibold' : ''}`}
              onClick={() => setActiveFilter(activeFilter === g.key ? null : g.key)}
            >
              {g.label} ({g.count})
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0">
          <span className="text-muted-foreground mr-1">Ordenar:</span>
          {(['dias', 'monto'] as PendSortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`px-1 py-0.5 rounded ${sortKey === key ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
            >
              {key === 'dias' ? 'Días' : 'Monto'}
              {sortKey === key && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Project cards */}
      {sorted.map((p) => {
        const matchingGroup = activeFilter ? PEND_STATUS_GROUPS.find((g) => g.key === activeFilter) : null;
        const visibleBills = matchingGroup ? p.pendientes.filter((b) => matchingGroup.match(b.estado)) : p.pendientes;
        if (activeFilter && visibleBills.length === 0) return null;

        const pendTotal = p.pendientes.reduce((s, b) => s + (b.monto_total ? Number(b.monto_total) : 0), 0);

        return (
          <Card key={p.proyecto_id}>
            <CardContent className="px-5 py-4">
              {/* Project header */}
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="font-semibold text-[15px] leading-tight cursor-pointer hover:underline"
                    onClick={() => onProjectClick(p.proyecto_id)}
                  >
                    {p.proyecto_nombre_corto || p.proyecto_nombre}
                  </span>
                  {(p.cliente_abreviatura || p.cliente_nombre) && (
                    <div className="text-xs text-muted-foreground mt-0.5">{p.cliente_abreviatura || p.cliente_nombre}</div>
                  )}
                </div>
                <div className="text-sm font-semibold text-muted-foreground">
                  Total pendiente: {formatMonto(pendTotal)}
                </div>
              </div>

              {/* Bill sub-cards */}
              <div className="space-y-2 mt-3">
                {visibleBills.map((c) => {
                  const obs = isObservaciones(c.estado);
                  const days = pendDays(c);
                  const pp = formatPeriodoParts(c.periodo_inicio, c.periodo_fin);
                  const curr = c.avance_porcentaje ? Number(c.avance_porcentaje) : 0;
                  const prev = c.avance_previo;
                  const dColor = days != null ? waitColor(days) : 'text-muted-foreground';

                  return (
                    <div
                      key={c.id}
                      className={`border rounded-md px-4 py-3 cursor-pointer transition-colors ${
                        obs
                          ? 'bg-red-50/50 border-l-4 border-l-red-500 hover:bg-red-100/50'
                          : 'bg-muted/40 hover:bg-muted/60'
                      }`}
                      onClick={() => onProjectClick(p.proyecto_id)}
                    >
                      {/* Row 1: Cuenta + badge + monto */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {obs && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className="font-semibold text-sm">Cuenta {c.numero}</span>
                          <CuentaEstadoBadge estado={c.estado} />
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
                        <span className={`text-xs shrink-0 flex items-center gap-1 ${dColor}`}>
                          {days != null && days >= 14 && <AlertTriangle className="h-3 w-3" />}
                          {days != null ? `${days}d` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Shared small components ─────────────────────────────────────────────

function ProjectHeader({ project: p }: { project: ProjectResumen }) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[15px] leading-tight">{p.proyecto_nombre}</div>
        {p.cliente_nombre && <div className="text-xs text-muted-foreground mt-0.5">{p.cliente_nombre}</div>}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Avance</span>
          <AvanceBar value={p.avance_acumulado} />
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          <span>Inicio </span>
          <span className="font-medium text-foreground">{p.dias_inicio != null ? `${p.dias_inicio} días` : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ color, children }: { color: 'teal' | 'amber'; children: React.ReactNode }) {
  const colorClass = color === 'teal' ? 'text-teal-600' : 'text-amber-600';
  return <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${colorClass}`}>{children}</div>;
}

function CurrentStatusBadge({ estado }: { estado: string }) {
  const cfg = estado === 'borrador'
    ? CURRENT_STATUS_CONFIG.borrador
    : CURRENT_STATUS_CONFIG.no_iniciada;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
