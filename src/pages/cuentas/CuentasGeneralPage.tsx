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
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PendienteCuenta {
  id: number;
  numero: number;
  estado: string;
  monto_total: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  avance_porcentaje: string | null;
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
  cliente_nombre: string | null;
  cliente_tipo: string | null;
  tiene_ipt: boolean;
  avance_acumulado: number;
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cuentas</h2>
        <p className="text-muted-foreground text-sm">Vista general por proyecto</p>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
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

        <TabsContent value="pendientes" className="space-y-3 mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : (
            data
              .filter((p) => p.pendientes.length > 0)
              .map((proj) => (
                <PendientesCard key={proj.proyecto_id} project={proj} onClick={() => handleProjectClick(proj.proyecto_id)} />
              ))
          )}
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
                        <span className="ml-auto font-mono text-muted-foreground">{formatMonto(c.monto_total)}</span>
                        <span className={`font-mono ${days != null ? waitColor(days) : 'text-muted-foreground'}`}>
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

function ActualesTable({ data, loading, onProjectClick }: { data: ProjectResumen[]; loading: boolean; onProjectClick: (id: number) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead className="text-center w-10">#</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Avance cuenta</TableHead>
              <TableHead>Avance acum.</TableHead>
              <TableHead className="text-right">Últ. envío</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin cuentas</TableCell></TableRow>
            ) : (
              data.filter((p) => !p.all_paid).map((p) => (
                <TableRow key={p.proyecto_id} className="cursor-pointer" onClick={() => onProjectClick(p.proyecto_id)}>
                  <TableCell>
                    <div className="font-semibold">{p.proyecto_nombre}</div>
                    <div className="text-xs text-muted-foreground">{p.cliente_nombre || '—'}</div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-sm">
                    {p.cuenta_actual?.numero || '—'}
                  </TableCell>
                  <TableCell>
                    {p.cuenta_actual ? <CurrentStatusBadge estado={p.cuenta_actual.estado} /> : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.cuenta_actual ? formatPeriodo(p.cuenta_actual.periodo_inicio, p.cuenta_actual.periodo_fin) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                    {p.cuenta_actual ? formatMonto(p.cuenta_actual.monto_total) : '—'}
                  </TableCell>
                  <TableCell>
                    {p.cuenta_actual?.avance_porcentaje ? (
                      <AvanceBar value={p.cuenta_actual.avance_porcentaje} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AvanceBar value={p.avance_acumulado} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {p.dias_ultimo_envio != null ? (
                      <span className={waitColor(p.dias_ultimo_envio)}>{formatWait(p.dias_ultimo_envio)}</span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Pendientes Card ─────────────────────────────────────────────────────

function PendientesCard({ project: p, onClick }: { project: ProjectResumen; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-border transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <ProjectHeader project={p} />
        <div className="space-y-2 mt-3">
          {p.pendientes.map((c) => {
            const days = c.fecha_primera_submision
              ? Math.floor((Date.now() - new Date(c.fecha_primera_submision).getTime()) / 86400000)
              : null;
            return (
              <div key={c.id} className="grid grid-cols-[80px_auto_180px_130px_100px_80px] items-center gap-4 bg-muted/40 border rounded-md px-3 py-2.5 text-sm">
                <span className="font-semibold">Cuenta {c.numero}</span>
                <span className="justify-self-center">
                  <CuentaEstadoBadge estado={c.estado} />
                </span>
                <span className="font-mono text-xs text-muted-foreground">{formatPeriodo(c.periodo_inicio, c.periodo_fin)}</span>
                <span className="font-mono text-xs text-right whitespace-nowrap">{formatMonto(c.monto_total)}</span>
                <AvanceBar value={c.avance_porcentaje} />
                <span className={`font-mono text-xs text-right ${days != null ? waitColor(days) : 'text-muted-foreground'}`}>
                  {days != null ? formatWait(days) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
          <span className="font-mono font-medium text-foreground">{p.dias_inicio != null ? `${p.dias_inicio} días` : '—'}</span>
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
